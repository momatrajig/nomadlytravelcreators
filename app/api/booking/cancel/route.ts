import { NextResponse } from "next/server";
import { z } from "zod";
import { cancelBooking } from "@/lib/booking/service";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { errorResponse, parseBody } from "@/lib/http";
import { stripe, toMinor } from "@/lib/stripe";
import { requireStorefront } from "@/lib/tenant";

/** POST /api/booking/cancel {bookingId, email}: cancels at the hotel, then refunds the right amount through Stripe. */
export async function POST(req: Request) {
  try {
    const sf = await requireStorefront();
    const { bookingId, email } = await parseBody(req, z.object({ bookingId: z.string().uuid(), email: z.string().email() }));
    const b = await db().booking(bookingId);
    if (!b || b.storefrontId !== sf.id || b.leadEmail !== email.trim().toLowerCase()) return NextResponse.json({ error: "NOT_FOUND", message: "Booking not found." }, { status: 404 });
    const r = await cancelBooking(b.id);
    if (r.refund > 0 && b.stripePaymentIntent && env().STRIPE_SECRET_KEY) {
      const re = await stripe().refunds.create({ payment_intent: b.stripePaymentIntent, amount: toMinor(r.refund, b.currency), reason: "requested_by_customer" }, { idempotencyKey: `refund-${b.id}` });
      await db().addEvent(b.id, "refund", { id: re.id, amount: r.refund });
    }
    return NextResponse.json({ status: r.booking.status, penalty: r.penalty, refund: r.refund });
  } catch (e) { return errorResponse(e); }
}
