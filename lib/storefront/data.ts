import { headers } from "next/headers";
/** Server side composition of what the storefront pages show. */
import { searchStays, type StayOffer } from "@/lib/booking/service";
import { db } from "@/lib/db";
import type { PinnedHotel, Storefront } from "@/lib/db/types";
export type { PinnedHotel };
import type { StayCardData } from "@/components/StaysFlow";
import { nights as nightsOf } from "@/lib/booking/service";

export interface StayView { cards: StayCardData[]; offers: StayOffer[]; pins: PinnedHotel[]; nights: number; checkedAt: string | null; rate: number; error: string | null }

export async function stayView(sf: Storefront, checkIn: string, checkOut: string, adults: number, only?: number[]): Promise<StayView> {
  const allPins = await db().pinnedHotels(sf.id);
  const pins = only ? allPins.filter((p) => only.includes(p.ebcId)) : allPins;
  const n = nightsOf(checkIn, checkOut);
  try {
    // hotels price by the lead guest's nationality; the reader's country (from the edge) is the best guess before checkout
    const country = (await headers()).get("x-vercel-ip-country") ?? undefined;
    const r = await searchStays(sf, checkIn, checkOut, adults, [], only, country);
    const booked = await db().bookedCountsByHotel(sf.id, new Date(Date.now() - 30 * 86_400_000).toISOString());
    const cards: StayCardData[] = r.offers.map((o) => {
      const pin = pins.find((p) => p.ebcId === o.ebcId);
      const cheapestFlex = o.rates.find((x) => x.refundable) ?? o.rates[0]!;
      return {
        ebcId: o.ebcId, name: o.name, stars: o.stars, area: pin?.address ?? null, city: pin?.cityName ?? null, rating: pin?.rating ?? null, ratingCount: pin?.ratingCount ?? null,
        photos: pin?.images ?? [],
        readerPrice: cheapestFlex.readerPrice, refundable: cheapestFlex.refundable, board: cheapestFlex.board, cancelDeadline: cheapestFlex.cancelDeadline, cancelCharge: cheapestFlex.cancelCharge, onRequest: cheapestFlex.onRequest,
        lowestReference: o.lowestReference ? { source: o.lowestReference.source, price: o.lowestReference.price } : null, saving: o.saving, booked: booked.get(o.ebcId) ?? 0, tip: pin?.tip ?? null,
      };
    });
    return { cards, offers: r.offers, pins, nights: n, checkedAt: r.checkedAt, rate: r.rate, error: null };
  } catch (e) {
    console.error("stayView", e);
    return { cards: [], offers: [], pins, nights: n, checkedAt: null, rate: sf.creatorRate, error: "The hotel system did not answer. Try again in a moment." };
  }
}


import { DESTINATIONS, destination, type Destination } from "@/lib/content/destinations";
import { placeName, type Lang } from "@/lib/i18n";
export interface DestView extends Destination { hotels: number[] }
/** Destinations this storefront has hotels in, in the platform's order. */
export function storefrontDestinations(pins: PinnedHotel[], lang: Lang = "en"): DestView[] {
  return DESTINATIONS.map((d) => ({ ...d, name: placeName(d.slug, d.name, lang), hotels: pins.filter((p) => p.destination === d.slug).map((p) => p.ebcId) })).filter((d) => d.hotels.length);
}
export { destination };
