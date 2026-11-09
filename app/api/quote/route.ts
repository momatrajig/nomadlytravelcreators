import { NextResponse } from "next/server";
import { z } from "zod";
import { BookingError, holdQuote, searchStays, type StayOffer } from "@/lib/booking/service";
import { errorResponse, isoDate, parseBody } from "@/lib/http";
import { requireStorefront } from "@/lib/tenant";
import { usd } from "@/lib/format";

const B = z.object({ ebcId: z.number().int(), packageCode: z.string().min(1), checkIn: z.string().regex(isoDate), checkOut: z.string().regex(isoDate), adults: z.number().int().min(1).max(9), childrenAges: z.array(z.number().int().min(0).max(17)).max(8).default([]) });

/** POST /api/quote -> prebooks one rate and returns a quote id the checkout pays against. Re-searches server side so tokens never travel to the browser. */
export async function POST(req: Request) {
  try {
    const sf = await requireStorefront();
    const b = await parseBody(req, B);
    // the same search the hotel page ran (one hotel, the reader's country), so the price and the cached tokens match
    const country = req.headers.get("x-vercel-ip-country") ?? undefined;
    const r = await searchStays(sf, b.checkIn, b.checkOut, b.adults, b.childrenAges, [b.ebcId], country);
    const offer = r.offers.find((o) => o.ebcId === b.ebcId);
    if (!offer) return NextResponse.json({ error: "NO_AVAILABILITY", message: "This hotel has no rooms for those dates." }, { status: 409 });
    const occ = [{ adults: b.adults, childrenAges: b.childrenAges }];
    let q;
    try {
      q = await holdQuote(sf, offer, b.packageCode, b.checkIn, b.checkOut, occ);
    } catch (e) {
      // the shown price may come from a search up to a few hours old: search again now and hold the same room
      if (!(e instanceof BookingError) || !["SUPPLIER", "NO_AVAILABILITY", "PRICE_CHANGED", "NOT_FOUND"].includes(e.code)) throw e;
      const was = offer.rates.find((x) => x.packageCode === b.packageCode);
      const fresh = (await searchStays(sf, b.checkIn, b.checkOut, b.adults, b.childrenAges, [b.ebcId], country, { fresh: true })).offers.find((o) => o.ebcId === b.ebcId);
      const same = fresh && was ? sameRate(fresh, was) : undefined;
      if (!fresh || !same) return NextResponse.json({ error: "NO_AVAILABILITY", message: "That room just sold out. The list now shows what is left." }, { status: 409 });
      if (was && Math.abs(same.readerPrice - was.readerPrice) > 0.5) return NextResponse.json({ error: "PRICE_CHANGED", message: `The hotel changed this price from ${usd(was.readerPrice, true)} to ${usd(same.readerPrice, true)}. The list now shows the new price.` }, { status: 409 });
      q = await holdQuote(sf, fresh, same.packageCode, b.checkIn, b.checkOut, occ);
    }
    const { availabilityToken, resultsToken, srk, packageToken, roomTokens, ...pub } = q;
    void availabilityToken; void resultsToken; void srk; void packageToken; void roomTokens;
    return NextResponse.json({ quote: pub, hotel: { name: offer.name, stars: offer.stars } });
  } catch (e) { return errorResponse(e); }
}

/** The same room, board and refund terms in a newer search (package codes change between searches). */
function sameRate(o: StayOffer, was: StayOffer["rates"][number]) {
  return o.rates.find((x) => x.packageCode === was.packageCode)
    ?? o.rates.find((x) => x.roomName.toLowerCase() === was.roomName.toLowerCase() && x.board === was.board && x.refundable === was.refundable);
}
