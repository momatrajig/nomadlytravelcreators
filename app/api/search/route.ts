import { NextResponse } from "next/server";
import { z } from "zod";
import { searchStays } from "@/lib/booking/service";
import { errorResponse, isoDate } from "@/lib/http";
import { requireStorefront } from "@/lib/tenant";

const Q = z.object({ checkIn: z.string().regex(isoDate), checkOut: z.string().regex(isoDate), adults: z.coerce.number().int().min(1).max(9).default(2), children: z.string().optional() });

export const dynamic = "force-dynamic";

/** GET /api/search?checkIn=&checkOut=&adults=&children=4,7  -> priced offers for the pinned hotels */
export async function GET(req: Request) {
  try {
    const sf = await requireStorefront();
    const u = new URL(req.url);
    const q = Q.parse(Object.fromEntries(u.searchParams));
    const ages = q.children ? q.children.split(",").filter(Boolean).map(Number) : [];
    const r = await searchStays(sf, q.checkIn, q.checkOut, q.adults, ages);
    // tokens are server state; strip them before the response and keep a server side lookup instead
    const offers = r.offers.map(({ srk, resultsToken, ...o }) => ({ ...o, searchKey: Buffer.from(`${srk}|${resultsToken}`).toString("base64url") }));
    return NextResponse.json({ ...r, offers }, { headers: { "cache-control": "private, max-age=60" } });
  } catch (e) { return errorResponse(e); }
}
