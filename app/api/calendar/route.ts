import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { searchStays } from "@/lib/booking/service";
import { currentStorefront } from "@/lib/tenant";
import { addDays, type CalDay } from "@/lib/calendar";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Q = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  days: z.coerce.number().int().min(1).max(7).default(7),
  adults: z.coerce.number().int().min(1).max(4).default(2),
  hotel: z.coerce.number().int().positive().optional(),
  d: z.string().regex(/^[a-z-]{2,40}$/).optional(),
});

/**
 * One night's lowest price for each check-in day in a week: a hotel's own price, or the cheapest of the
 * creator's hotels in a destination. A week per call keeps each answer quick; the picker asks week by week
 * and colours as they come. Every price comes from the same cached search the results page reads.
 */
export async function GET(req: NextRequest) {
  const q = Q.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!q.success || (!q.data.hotel && !q.data.d)) return NextResponse.json({ error: "INVALID" }, { status: 400 });
  const sf = await currentStorefront();
  if (!sf) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const { from, days, adults, hotel, d } = q.data;
  const today = new Date().toISOString().slice(0, 10);
  const ids = hotel ? [hotel] : (await db().pinnedHotels(sf.id)).filter((p) => p.destination === d).map((p) => p.ebcId).slice(0, 4);
  if (!ids.length) return NextResponse.json({ days: [] });
  const country = (await headers()).get("x-vercel-ip-country") ?? undefined;
  const dates = Array.from({ length: days }, (_, i) => addDays(from, i)).filter((x) => x >= today && x <= addDays(today, 330));
  const out: CalDay[] = await Promise.all(dates.map(async (date) => {
    try {
      // a hotel: its own search; a destination: each hotel on its own (a combined search drops slow answers), cheapest wins
      const prices = await Promise.all(ids.map((id) => searchStays(sf, date, addDays(date, 1), adults, [], [id], country)
        .then((r) => Math.min(...r.offers.flatMap((o) => o.rates.map((x) => x.readerPrice)))).catch(() => Infinity)));
      const p = Math.min(...prices);
      return { date, price: Number.isFinite(p) ? Math.round(p) : null };
    } catch { return { date, price: null }; }
  }));
  return NextResponse.json({ days: out }, { headers: { "cache-control": "private, max-age=900" } });
}
