/**
 * Performance numbers for any date range: totals and per day averages for each metric, the same numbers for the
 * period before, a series per day, week or month for the chart, the funnel (click, checkout, booking) and the
 * breakdowns (by source, hotel, country, device). Pure arithmetic over rows the page loads; tests pin it.
 */
import type { Click } from "@/lib/db/types";
import { r2 } from "@/lib/pricing/engine";
import { bucketOf, buckets, type Range } from "./range";
import type { Tx } from "./metrics";

export const METRICS = ["clicks", "visitors", "checkouts", "bookings", "commission"] as const;
export type Metric = (typeof METRICS)[number];
export type Totals = Record<Metric, number> & { value: number; canceled: number; addOns: number };

export interface BreakRow { key: string; label: string; clicks: number; visitors: number; checkouts: number | null; bookings: number; canceled: number; value: number; commission: number; epc: number | null; conversion: number | null }
export interface Perf {
  totals: Totals; prev: Totals;
  series: Array<{ start: string } & Record<Metric, number>>;
  prevSeries: Array<Record<Metric, number>>;
  funnel: { clicks: number; checkouts: number; bookings: number };
  bySource: BreakRow[]; byHotel: BreakRow[]; byCountry: BreakRow[]; byDevice: BreakRow[];
}

type Checkout = { createdAt: string; ebcId: number };
const DIRECT = "Direct and other";

function totals(cl: Click[], co: Checkout[], tx: Tx[]): Totals {
  const live = tx.filter((t) => t.tx !== "Canceled");
  const hotels = live.filter((t) => t.category === "hotel");
  return {
    clicks: cl.length, visitors: new Set(cl.map((c) => c.visitor ?? c.id)).size, checkouts: co.length, bookings: hotels.length,
    commission: r2(live.reduce((a, t) => a + t.commission, 0)), value: r2(live.reduce((a, t) => a + t.price, 0)),
    canceled: new Set(tx.filter((t) => t.tx === "Canceled" && t.category === "hotel").map((t) => t.bookingId)).size, addOns: live.length - hotels.length,
  };
}

function seriesOf(cl: Click[], co: Checkout[], tx: Tx[], from: string, to: string, grain: Range["grain"]) {
  const keys = buckets(from, to, grain);
  const idx = new Map(keys.map((k, i) => [k, i]));
  const rows = keys.map((start) => ({ start, clicks: 0, visitors: 0, checkouts: 0, bookings: 0, commission: 0 }));
  const seen = keys.map(() => new Set<string>());
  for (const c of cl) { const i = idx.get(bucketOf(c.createdAt, grain)); if (i == null) continue; rows[i]!.clicks++; seen[i]!.add(c.visitor ?? c.id); }
  seen.forEach((s, i) => { rows[i]!.visitors = s.size; });
  for (const q of co) { const i = idx.get(bucketOf(q.createdAt, grain)); if (i != null) rows[i]!.checkouts++; }
  for (const t of tx) {
    if (t.tx === "Canceled") continue;
    const i = idx.get(bucketOf(t.date, grain)); if (i == null) continue;
    if (t.category === "hotel") rows[i]!.bookings++;
    rows[i]!.commission = r2(rows[i]!.commission + t.commission);
  }
  return rows;
}

function breakdown(keys: Iterable<[string, string]>, cl: (k: string) => Click[], co: ((k: string) => Checkout[]) | null, tx: (k: string) => Tx[]): BreakRow[] {
  return [...keys].map(([key, label]) => {
    const c = cl(key), q = co ? co(key) : null, t = tx(key);
    const live = t.filter((x) => x.tx !== "Canceled");
    const bookings = live.filter((x) => x.category === "hotel").length;
    const commission = r2(live.reduce((a, x) => a + x.commission, 0));
    return {
      key, label, clicks: c.length, visitors: new Set(c.map((x) => x.visitor ?? x.id)).size, checkouts: q ? q.length : null, bookings,
      canceled: new Set(t.filter((x) => x.tx === "Canceled" && x.category === "hotel").map((x) => x.bookingId)).size,
      value: r2(live.reduce((a, x) => a + x.price, 0)), commission,
      epc: c.length ? r2(commission / c.length) : null, conversion: c.length ? bookings / c.length : null,
    };
  }).filter((r) => r.clicks || r.bookings || r.canceled || (r.checkouts ?? 0)).sort((a, b) => b.commission - a.commission || b.clicks - a.clicks || b.bookings - a.bookings);
}

export function performance(allClicks: Click[], allCheckouts: Checkout[], allTx: Tx[], r: Range, opts: { includeDemo: boolean; hotelName: (id: number) => string }): Perf {
  const win = (iso: string, a: string, b: string) => iso >= a && iso < b;
  const clicks = allClicks.filter((c) => !c.bot);
  const txs = allTx.filter((t) => opts.includeDemo || !t.demo);
  const cl = clicks.filter((c) => win(c.createdAt, r.sinceIso, r.untilIso));
  const co = allCheckouts.filter((q) => win(q.createdAt, r.sinceIso, r.untilIso));
  const tx = txs.filter((t) => win(t.date, r.sinceIso, r.untilIso));
  const pcl = clicks.filter((c) => win(c.createdAt, r.prev.sinceIso, r.prev.untilIso));
  const pco = allCheckouts.filter((q) => win(q.createdAt, r.prev.sinceIso, r.prev.untilIso));
  const ptx = txs.filter((t) => win(t.date, r.prev.sinceIso, r.prev.untilIso));
  const t = totals(cl, co, tx);

  const src = (x: { source: string | null }) => x.source ?? DIRECT;
  const srcKeys = new Map<string, string>([...cl.map((c) => [src(c), src(c)] as [string, string]), ...tx.map((x) => [src(x), src(x)] as [string, string])]);
  const hotelKeys = new Map<string, string>();
  for (const c of cl) if (c.ebcId) hotelKeys.set(String(c.ebcId), opts.hotelName(c.ebcId));
  for (const q of co) hotelKeys.set(String(q.ebcId), opts.hotelName(q.ebcId));
  for (const x of tx) if (x.ebcId) hotelKeys.set(String(x.ebcId), opts.hotelName(x.ebcId));
  const country = (c: Click) => c.country ?? "Unknown";
  const device = (c: Click) => (c.device ? c.device[0]!.toUpperCase() + c.device.slice(1) : "Unknown");

  return {
    totals: t, prev: totals(pcl, pco, ptx),
    series: seriesOf(cl, co, tx, r.from, r.to, r.grain),
    prevSeries: seriesOf(pcl, pco, ptx, r.prev.from, r.prev.to, r.grain),
    funnel: { clicks: t.clicks, checkouts: t.checkouts, bookings: t.bookings },
    bySource: breakdown(srcKeys, (k) => cl.filter((c) => src(c) === k), null, (k) => tx.filter((x) => src(x) === k)),
    byHotel: breakdown(hotelKeys, (k) => cl.filter((c) => String(c.ebcId) === k), (k) => co.filter((q) => String(q.ebcId) === k), (k) => tx.filter((x) => String(x.ebcId) === k)),
    byCountry: breakdown(new Map(cl.map((c) => [country(c), COUNTRY[country(c)] ?? country(c)])), (k) => cl.filter((c) => country(c) === k), null, () => []),
    byDevice: breakdown(new Map(cl.map((c) => [device(c), device(c)])), (k) => cl.filter((c) => device(c) === k), null, () => []),
  };
}

export const COUNTRY: Record<string, string> = {
  CZ: "Czechia", SK: "Slovakia", US: "United States", CA: "Canada", GB: "United Kingdom", DE: "Germany", FR: "France", AT: "Austria", PL: "Poland",
  LB: "Lebanon", AE: "United Arab Emirates", NL: "Netherlands", IT: "Italy", ES: "Spain", AU: "Australia", IE: "Ireland", CH: "Switzerland", Unknown: "Unknown",
};
