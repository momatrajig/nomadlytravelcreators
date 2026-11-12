import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Who may open a booking page. The reader proves it once with the reference plus the lead email (the email link,
 * the lookup form or the return from Stripe); after that a signed, httpOnly cookie carries the proof and the page
 * lives at a clean URL. That keeps the email, and Stripe's return parameters (payment_intent_client_secret), out of
 * the address bar, the printed voucher footer, browser history and referrers.
 */
const key = () => env().BOOKING_LINK_SECRET ?? env().SUPABASE_SERVICE_ROLE_KEY ?? env().STRIPE_WEBHOOK_SECRET ?? "nomadly-dev-only";
const sign = (ref: string, email: string) => createHmac("sha256", key()).update(`${ref}\n${email}`).digest("base64url");
const norm = (ref: string) => ref.replace(/\s+/g, "").toUpperCase();

/** one cookie per booking, so a reader with two trips keeps both */
export const accessCookie = (ref: string) => `bk_${createHmac("sha256", "n").update(norm(ref)).digest("hex").slice(0, 12)}`;
export const accessValue = (ref: string, email: string) => `${Buffer.from(email).toString("base64url")}.${sign(norm(ref), email)}`;

/** the lead email the cookie proves for this booking, or "" */
export function emailFromAccess(ref: string, value: string | undefined): string {
  if (!value) return "";
  const [e64, sig] = value.split(".");
  if (!e64 || !sig) return "";
  const email = Buffer.from(e64, "base64url").toString();
  const want = Buffer.from(sign(norm(ref), email));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got) ? email : "";
}

export const ACCESS_DAYS = 400;
