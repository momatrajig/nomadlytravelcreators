/** Daily USD exchange rates from the ECB (via Frankfurter), cached 12 hours. Display only: nothing is charged at these rates. */
import { db } from "@/lib/db";

export async function usdTo(currency: string | null | undefined): Promise<number | null> {
  if (!currency || currency === "USD" || !/^[A-Z]{3}$/.test(currency)) return null;
  const key = `fx:USD:${currency}`;
  const hit = await db().cacheGet<number>(key).catch(() => null);
  if (hit) return hit;
  try {
    const r = await fetch(`https://api.frankfurter.app/latest?from=USD&to=${currency}`, { signal: AbortSignal.timeout(2500), next: { revalidate: 43200 } });
    if (!r.ok) return null;
    const rate = Number((await r.json() as { rates?: Record<string, number> }).rates?.[currency]);
    if (!Number.isFinite(rate) || rate <= 0) return null;
    await db().cacheSet(key, rate, 43200).catch(() => undefined);
    return rate;
  } catch { return null; }
}
