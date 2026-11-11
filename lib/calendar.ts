/**
 * The price calendar: one night's price for every check-in day, so a reader sees which dates are cheap before
 * picking. Colours compare the days in view with each other (not a promise about the future): the cheapest
 * quarter green, then light green, orange, and the dearest quarter red.
 */
export type Level = "low" | "fair" | "high" | "peak";
export interface CalDay { date: string; price: number | null }

/** Splits the priced days into four bands by quartile. Fewer than four priced days: no colours (nothing to compare). */
export function priceLevels(days: CalDay[]): Record<string, Level> {
  const priced = days.filter((d): d is { date: string; price: number } => d.price != null && d.price > 0);
  if (priced.length < 4) return {};
  const sorted = priced.map((d) => d.price).sort((a, b) => a - b);
  const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!;
  const [q1, q2, q3] = [q(0.25), q(0.5), q(0.75)];
  if (sorted[0] === sorted[sorted.length - 1]) return Object.fromEntries(priced.map((d) => [d.date, "fair" as Level]));
  const out: Record<string, Level> = {};
  for (const d of priced) out[d.date] = d.price < q1 ? "low" : d.price < q2 ? "fair" : d.price < q3 ? "high" : "peak";
  return out;
}

export const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
