import { NextResponse } from "next/server";
import { z } from "zod";
import { startPayment } from "@/lib/booking/service";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { errorResponse, parseBody } from "@/lib/http";
import { stripe, toMinor } from "@/lib/stripe";
import { requireStorefront } from "@/lib/tenant";
import { cookies } from "next/headers";
import { REF_COOKIE, attributionFor } from "@/lib/links/track";

const KIND = z.enum(["transfer", "esim", "bag", "delay"]);
const PICK = z.union([KIND, z.object({
  kind: KIND, option: z.string().max(20).optional(), airport: z.string().regex(/^[A-Z]{3}$/).optional(),
  direction: z.enum(["arrival", "departure", "both"]).optional(), flight: z.string().trim().max(10).optional(), qty: z.number().int().min(1).max(9).optional(),
})]);
const REQUEST = z.enum(["early_checkin", "late_checkout", "quiet", "high_floor", "low_floor", "twin", "double", "cot", "accessible", "connecting"]);
const NAME = z.string().trim().min(2).max(60);
const B = z.object({
  quoteId: z.string().uuid(),
  guest: z.object({
    firstName: NAME, lastName: NAME, email: z.string().email().max(120),
    // the hotel needs a number it can reach: "+<dial code> <number>"
    phone: z.string().trim().regex(/^\+\d{1,4}\s[\d\s()-]{6,20}$/, "Enter a phone number with its country code."),
    country: z.string().regex(/^[A-Z]{2}$/),
  }),
  requests: z.object({
    items: z.array(REQUEST).max(10).default([]),
    note: z.string().trim().max(300).nullable().default(null),
    arrival: z.string().regex(/^([01]\d|2[0-3]):00$/).nullable().default(null),
    bookedFor: z.enum(["self", "other"]).default("self"),
    booker: z.object({ firstName: NAME, lastName: NAME }).nullable().default(null),
  }).default({ items: [], note: null, arrival: null, bookedFor: "self", booker: null }),
  promoCode: z.string().trim().max(24).optional(),
  acceptedTerms: z.literal(true),
  extras: z.array(PICK).max(4).default([]),
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
    const attribution = await attributionFor(sf.id, (await cookies()).get(REF_COOKIE)?.value);
    const requests = { ...b.requests, booker: b.requests.bookedFor === "other" ? b.requests.booker : null };
    if (requests.bookedFor === "other" && !requests.booker) return NextResponse.json({ error: "INVALID", message: "Add your own name as the person booking." }, { status: 400 });
    const { booking, amount, currency } = await startPayment(sf, quote, { ...b.guest, requests }, b.promoCode, b.extras, attribution);
    if (!env().STRIPE_SECRET_KEY) {
      // development without Stripe: pretend the payment succeeded so the flow can be exercised end to end
      return NextResponse.json({ bookingId: booking.id, reference: booking.reference, amount, currency, clientSecret: null, devMode: true });
    }
    let pi;
    try {
      pi = await stripe().paymentIntents.create({
      amount: toMinor(amount, currency), currency: currency.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      statement_descriptor_suffix: sf.brandName.replace(/[^A-Za-z0-9 ]/g, "").toUpperCase().slice(0, 12),
      receipt_email: booking.leadEmail,
      metadata: { bookingId: booking.id, storefrontId: sf.id, reference: booking.reference },
      }, { idempotencyKey: `pi-${booking.id}` });
    } catch (err) {
      // nothing was charged; close the booking so it never shows as pending, and tell the reader plainly
      const detail = err instanceof Error ? err.message : String(err);
      await db().updateBooking(booking.id, { status: "failed" });
      await db().addEvent(booking.id, "payment_intent_failed", { detail });
      console.error("stripe paymentIntents.create", booking.id, detail);
      return NextResponse.json({ error: "PAYMENT_UNAVAILABLE", message: "Card payment is not available right now. Nothing was charged; please try again in a few minutes." }, { status: 503 });
    }
    await db().updateBooking(booking.id, { stripePaymentIntent: pi.id });
    return NextResponse.json({ bookingId: booking.id, reference: booking.reference, amount, currency, clientSecret: pi.client_secret });
  } catch (e) { return errorResponse(e); }
}
