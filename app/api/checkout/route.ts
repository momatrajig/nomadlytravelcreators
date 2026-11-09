import { NextResponse } from "next/server";
import { z } from "zod";
import { startPayment } from "@/lib/booking/service";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { errorResponse, parseBody } from "@/lib/http";
import { stripe, toMinor } from "@/lib/stripe";
import { requireStorefront } from "@/lib/tenant";

const B = z.object({
  quoteId: z.string().uuid(),
  guest: z.object({ firstName: z.string().trim().min(2).max(60), lastName: z.string().trim().min(2).max(60), email: z.string().email().max(120), phone: z.string().trim().max(30).optional(), country: z.string().length(2).optional() }),
  promoCode: z.string().trim().max(24).optional(),
  acceptedTerms: z.literal(true),
  extras: z.array(z.enum(["transfer", "esim", "bag", "delay"])).max(4).default([]),
});

/**
 * POST /api/checkout -> creates the booking in "paying" and a Stripe PaymentIntent for the server computed amount.
 * The browser confirms the PaymentIntent with Stripe Elements; the webhook finishes the hotel booking.
 */
export async function POST(req: Request) {
  try {
    const sf = await requireStorefront();
    const b = await parseBody(req, B);
    const quote = await db().quote(b.quoteId);
    if (!quote || quote.storefrontId !== sf.id) return NextResponse.json({ error: "NOT_FOUND", message: "Quote not found." }, { status: 404 });
    const { booking, amount, currency } = await startPayment(sf, quote, b.guest, b.promoCode, b.extras);
    if (!env().STRIPE_SECRET_KEY) {
      // development without Stripe: pretend the payment succeeded so the flow can be exercised end to end
      return NextResponse.json({ bookingId: booking.id, reference: booking.reference, amount, currency, clientSecret: null, devMode: true });
    }
    const pi = await stripe().paymentIntents.create({
      amount: toMinor(amount, currency), currency: currency.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      statement_descriptor_suffix: sf.brandName.replace(/[^A-Za-z0-9 ]/g, "").toUpperCase().slice(0, 12),
      receipt_email: booking.leadEmail,
      metadata: { bookingId: booking.id, storefrontId: sf.id, reference: booking.reference },
    }, { idempotencyKey: `pi-${booking.id}` });
    await db().updateBooking(booking.id, { stripePaymentIntent: pi.id });
    return NextResponse.json({ bookingId: booking.id, reference: booking.reference, amount, currency, clientSecret: pi.client_secret });
  } catch (e) { return errorResponse(e); }
}
