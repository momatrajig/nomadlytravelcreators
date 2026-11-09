import { env } from "@/lib/env";

type E = { EBC_MODE: string; STRIPE_SECRET_KEY?: string };

/**
 * How a paid checkout ends.
 *  real: the room is reserved with the supplier (simulator, or live supplier with live card payments).
 *  demo: live hotel prices but test card payments. A real reservation would be charged to Veny's
 *        eBooking credit with no money collected, so the whole flow runs (quote, pay with a test card,
 *        confirmation, email) and the reservation step is skipped. The booking is marked demo everywhere.
 */
export function bookingMode(e: E = env()): "real" | "demo" {
  if (e.EBC_MODE !== "live") return "real";
  return e.STRIPE_SECRET_KEY?.startsWith("sk_live_") ? "real" : "demo";
}

/** Kept for callers that only need to know whether real reservations are open. */
export function bookingClosedReason(e: E = env()): string | null {
  return bookingMode(e) === "demo" ? "Live hotel prices, test card payments: bookings run as demos and no room is reserved." : null;
}
