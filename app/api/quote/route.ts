import { NextResponse } from "next/server";
import { z } from "zod";
import { holdQuote, searchStays } from "@/lib/booking/service";
import { errorResponse, isoDate, parseBody } from "@/lib/http";
import { requireStorefront } from "@/lib/tenant";

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
    const q = await holdQuote(sf, offer, b.packageCode, b.checkIn, b.checkOut, [{ adults: b.adults, childrenAges: b.childrenAges }]);
    const { availabilityToken, resultsToken, srk, packageToken, roomTokens, ...pub } = q;
    void availabilityToken; void resultsToken; void srk; void packageToken; void roomTokens;
    return NextResponse.json({ quote: pub, hotel: { name: offer.name, stars: offer.stars } });
  } catch (e) { return errorResponse(e); }
}
