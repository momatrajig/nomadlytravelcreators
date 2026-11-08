import { NextResponse } from "next/server";
import { confirmPaid } from "@/lib/booking/service";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { stripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

/** Stripe -> payment_intent.succeeded: finish the hotel booking. Signature verified; idempotent on replay. */
export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const secret = env().STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) return new NextResponse("missing signature", { status: 400 });
  const raw = await req.text();
  let event;
  try { event = stripe().webhooks.constructEvent(raw, sig, secret); } catch { return new NextResponse("bad signature", { status: 400 }); }
  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object;
    const bookingId = pi.metadata?.bookingId;
    if (bookingId) {
      const base = `${req.headers.get("x-forwarded-proto") ?? "https"}://${req.headers.get("x-forwarded-host") ?? req.headers.get("host")}`;
      try { await confirmPaid(bookingId, pi.id, base); } catch (e) { console.error("confirmPaid", bookingId, e); /* booking marked failed; refund job picks it up */ }
    }
  } else if (event.type === "payment_intent.payment_failed") {
    const b = await db().bookingByPaymentIntent(event.data.object.id);
    if (b && b.status === "paying") { await db().updateBooking(b.id, { status: "failed" }); await db().addEvent(b.id, "payment_failed", event.data.object.last_payment_error ?? null); }
  }
  return NextResponse.json({ received: true });
}
