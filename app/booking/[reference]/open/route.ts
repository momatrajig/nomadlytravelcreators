import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireStorefront } from "@/lib/tenant";
import { ACCESS_DAYS, accessCookie, accessValue } from "@/lib/booking/access";

/**
 * GET /booking/NMD%20231821/open?email=... : checks the reference and lead email once, stores the proof in a
 * signed httpOnly cookie and sends the reader to the clean page URL. Every way into a booking (email link, lookup
 * form, Stripe return) passes through here, so no email or payment parameter stays in the address bar.
 */
export async function GET(req: Request, ctx: { params: Promise<{ reference: string }> }) {
  const url = new URL(req.url);
  const { reference } = await ctx.params;
  const ref = decodeURIComponent(reference);
  const email = (url.searchParams.get("email") ?? "").trim().toLowerCase();
  const sf = await requireStorefront();
  const b = email ? await db().bookingByReference(ref) : null;
  if (!b || b.storefrontId !== sf.id || b.leadEmail !== email) {
    return NextResponse.redirect(new URL(`/booking?missing=1&ref=${encodeURIComponent(ref)}`, url), 303);
  }
  const res = NextResponse.redirect(new URL(`/booking/${encodeURIComponent(b.reference)}`, url), 303);
  res.cookies.set(accessCookie(b.reference), accessValue(b.reference, email), {
    httpOnly: true, secure: url.protocol === "https:", sameSite: "lax", path: "/", maxAge: ACCESS_DAYS * 86400,
  });
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
