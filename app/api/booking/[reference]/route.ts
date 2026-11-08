import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { penaltyNow } from "@/lib/booking/service";
import { requireStorefront } from "@/lib/tenant";
import { errorResponse } from "@/lib/http";

/** GET /api/booking/NMD%20231821?email= -> the reader's own booking, gated by the lead email. */
export async function GET(req: Request, ctx: { params: Promise<{ reference: string }> }) {
  try {
    const sf = await requireStorefront();
    const { reference } = await ctx.params;
    const email = new URL(req.url).searchParams.get("email")?.trim().toLowerCase();
    const b = await db().bookingByReference(decodeURIComponent(reference));
    if (!b || b.storefrontId !== sf.id || !email || b.leadEmail !== email) return NextResponse.json({ error: "NOT_FOUND", message: "No booking with that reference and email." }, { status: 404 });
    const { stripePaymentIntent, clientRef, ...pub } = b; void stripePaymentIntent; void clientRef;
    return NextResponse.json({ booking: pub, penaltyNow: penaltyNow(b) });
  } catch (e) { return errorResponse(e); }
}
