import { env } from "@/lib/env";

/**
 * A real hotel reservation is charged to Veny's eBooking credit line the moment it is made.
 * So when the supplier is live, a booking may only be made against a real card payment
 * (a Stripe live key). Live supplier plus test payments would create real reservations
 * that nobody paid for. Returns the reason booking is closed, or null when it is open.
 */
export function bookingClosedReason(e: { EBC_MODE: string; STRIPE_SECRET_KEY?: string } = env()): string | null {
  if (e.EBC_MODE !== "live") return null; // simulator: nothing real is reserved
  if (!e.STRIPE_SECRET_KEY?.startsWith("sk_live_")) return "Live hotel prices are on, but card payments are still in test mode, so booking is not open yet. Nothing was charged.";
  return null;
}
