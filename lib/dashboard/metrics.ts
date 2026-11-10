/**
 * Creator dashboard numbers, in the words the big affiliate programs use (clicks, conversion, EPC, commission,
 * transaction status, payment status), computed from the click log, the bookings and the payouts.
 * Pure: the page loads the rows, this file does the arithmetic, the tests pin it.
 *
 * Statuses
 *   Transaction  Pending   booked, the stay is not completed yet
 *                Approved  the stay is completed (after check out); commission is final
 *                Canceled  refunded; no commission
 *   Payment      Pending   not payable yet (stay not completed)
 *                Ready     approved, in the next monthly payout (the 15th, for stays completed the month before)
 *                Paid      sent to the creator's account
 *                Canceled  nothing to pay
 */
import type { Booking, Click, Payout } from "@/lib/db/types";
import { CARD_FEE_RATE, cardFee, r2 } from "@/lib/pricing/engine";

export type Category = "hotel" | "transfer" | "esim" | "bag" | "delay";
export const CATEGORY_LABEL: Record<Category, string> = { hotel: "Hotels", transfer: "Transfers", esim: "eSIM", bag: "Bag cover", delay: "Delay cover" };
export type TxStatus = "Pending" | "Approved" | "Canceled";
export type PayStatus = "Pending" | "Ready" | "Paid" | "Canceled";

export interface Tx {
  id: string; bookingId: string; date: string; reference: string; category: Category; info: string; source: string | null;
  price: number; margin: number; costs: number; commission: number; tx: TxStatus; pay: PayStatus; demo: boolean; checkOut: string;
}

/** The payout date for a stay approved on `approvedOn`: the 15th of the following month. */
export function payoutDateFor(approvedOn: string): string {
  const d = new Date(`${approvedOn.slice(0, 10)}T12:00:00Z`);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 15)).toISOString().slice(0, 10);
}

export function transactions(bookings: Booking[], payouts: Payout[], hotelName: (ebcId: number) => string, today = new Date().toISOString().slice(0, 10)): Tx[] {
  const paid = new Set(payouts.filter((p) => p.status === "paid").flatMap((p) => p.items.map((i) => i.bookingId)));
  const out: Tx[] = [];
  for (const b of bookings) {
    if (b.status === "paying" || b.status === "quoted" || b.status === "failed") continue;
    const canceled = b.status === "canceled";
    const approved = !canceled && (b.status === "completed" || ((b.status === "confirmed" || b.status === "booked") && b.checkOut < today));
    const tx: TxStatus = canceled ? "Canceled" : approved ? "Approved" : "Pending";
    const pay: PayStatus = canceled ? "Canceled" : !approved ? "Pending" : paid.has(b.id) ? "Paid" : "Ready";
    const roomValue = r2(b.readerPrice + b.promoDiscount);
    const margin = b.margin ?? r2(roomValue - b.supplierNet);
    const costs = b.costs ?? cardFee(b.readerPrice);
    const nights = `${b.nights} ${b.nights === 1 ? "night" : "nights"}`;
    out.push({
      id: `${b.id}:hotel`, bookingId: b.id, date: b.createdAt, reference: b.reference, category: "hotel", info: `${hotelName(b.ebcId)}, ${nights}`, source: b.source ?? null,
      price: b.readerPrice, margin: canceled ? 0 : margin, costs: canceled ? 0 : costs, commission: canceled ? 0 : r2(b.creatorShare - b.promoDiscount), tx, pay, demo: !!b.demo, checkOut: b.checkOut,
    });
    for (const x of b.extras) {
      const cat = (["transfer", "esim", "bag", "delay"].includes(x.kind) ? x.kind : "transfer") as Category;
      out.push({
        id: `${b.id}:${x.kind}`, bookingId: b.id, date: b.createdAt, reference: b.reference, category: cat, info: x.name, source: b.source ?? null,
        price: x.price, margin: canceled ? 0 : x.commission, costs: canceled ? 0 : r2(x.price * CARD_FEE_RATE), commission: canceled ? 0 : x.creatorShare, tx, pay, demo: !!b.demo, checkOut: b.checkOut,
      });
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

export interface SourceRow { source: string; clicks: number; visitors: number; bookings: number; commission: number; conversion: number; epc: number }
export interface Summary {
  clicks: number; visitors: number; hotelBookings: number; addOns: number; canceled: number; conversion: number; epc: number;
  commission: number; bookingValue: number; ofValue: number;
  byCategory: Array<{ category: Category; bookings: number; value: number; commission: number }>;
  byStatus: { paid: number; ready: number; pending: number; canceled: number; canceledCount: number; nextPayout: string | null };
  sources: SourceRow[]; series: Array<{ label: string; from: string; clicks: number; bookings: number }>;
  topHotels: Array<{ ebcId: number; clicks: number }>;
}

const DIRECT = "Direct and other";

export function summarize(clicks: Click[], txs: Tx[], opts: { since: string; until?: string; days: number; includeDemo?: boolean }): Summary {
  const inRange = (iso: string) => iso >= opts.since && (!opts.until || iso < opts.until);
  const cl = clicks.filter((c) => !c.bot && inRange(c.createdAt));
  const tx = txs.filter((t) => inRange(t.date) && (opts.includeDemo || !t.demo));
  const live = tx.filter((t) => t.tx !== "Canceled");
  const hotels = live.filter((t) => t.category === "hotel");
  const commission = r2(live.reduce((a, t) => a + t.commission, 0));
  const value = r2(live.reduce((a, t) => a + t.price, 0));
  const visitors = new Set(cl.map((c) => c.visitor ?? c.id)).size;

  const cats: Category[] = ["hotel", "transfer", "esim", "bag", "delay"];
  const byCategory = cats.map((category) => {
    const rows = live.filter((t) => t.category === category);
    return { category, bookings: rows.length, value: r2(rows.reduce((a, t) => a + t.price, 0)), commission: r2(rows.reduce((a, t) => a + t.commission, 0)) };
  });
  const sum = (s: PayStatus) => r2(live.filter((t) => t.pay === s).reduce((a, t) => a + t.commission, 0));
  const ready = live.filter((t) => t.pay === "Ready");
  const nextPayout = ready.length ? ready.map((t) => payoutDateFor(t.checkOut)).sort()[0]! : null;
  const canceledBookings = new Set(tx.filter((t) => t.tx === "Canceled").map((t) => t.bookingId));

  const srcNames = new Set<string>([...cl.map((c) => c.source ?? DIRECT), ...hotels.map((t) => t.source ?? DIRECT)]);
  const sources: SourceRow[] = [...srcNames].map((source) => {
    const c = cl.filter((x) => (x.source ?? DIRECT) === source);
    const b = hotels.filter((t) => (t.source ?? DIRECT) === source);
    const com = r2(live.filter((t) => (t.source ?? DIRECT) === source).reduce((a, t) => a + t.commission, 0));
    return { source, clicks: c.length, visitors: new Set(c.map((x) => x.visitor ?? x.id)).size, bookings: b.length, commission: com, conversion: c.length ? b.length / c.length : 0, epc: c.length ? r2(com / c.length) : 0 };
  }).sort((a, b) => b.clicks - a.clicks || b.commission - a.commission);

  // daily up to 31 days, weekly beyond
  const step = opts.days <= 31 ? 1 : 7;
  const start = new Date(`${opts.since.slice(0, 10)}T00:00:00Z`).getTime();
  const end = opts.until ? Date.parse(opts.until) : Date.now();
  const series: Summary["series"] = [];
  for (let t = start; t < end; t += step * 86_400_000) {
    const from = new Date(t).toISOString(), to = new Date(t + step * 86_400_000).toISOString();
    const label = new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
    series.push({ label, from, clicks: cl.filter((c) => c.createdAt >= from && c.createdAt < to).length, bookings: hotels.filter((h) => h.date >= from && h.date < to).length });
  }
  const hc = new Map<number, number>();
  for (const c of cl) if (c.ebcId) hc.set(c.ebcId, (hc.get(c.ebcId) ?? 0) + 1);

  return {
    clicks: cl.length, visitors, hotelBookings: hotels.length, addOns: live.length - hotels.length, canceled: canceledBookings.size,
    conversion: cl.length ? hotels.length / cl.length : 0, epc: cl.length ? r2(commission / cl.length) : 0, commission, bookingValue: value, ofValue: value ? commission / value : 0,
    byCategory, byStatus: { paid: sum("Paid"), ready: sum("Ready"), pending: sum("Pending"), canceled: 0, canceledCount: canceledBookings.size, nextPayout },
    sources, series, topHotels: [...hc.entries()].map(([ebcId, clicks]) => ({ ebcId, clicks })).sort((a, b) => b.clicks - a.clicks).slice(0, 8),
  };
}
