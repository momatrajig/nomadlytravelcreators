import Stripe from "stripe";
import { env } from "@/lib/env";

let s: Stripe | null = null;
export function stripe(): Stripe {
  if (!s) {
    const key = env().STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY missing");
    s = new Stripe(key, { apiVersion: "2026-10-29.clover" as Stripe.LatestApiVersion, appInfo: { name: "Nomadly Ambassadors", version: "0.1.0" } });
  }
  return s;
}
/** Stripe wants minor units. USD and EUR have 2 decimals; extend if we ever sell in JPY or KWD. */
export const toMinor = (amount: number, currency: string) => Math.round(amount * (["JPY", "KRW"].includes(currency.toUpperCase()) ? 1 : 100));
