import Link from "next/link";
import { CalendarCheck, DollarSign, Receipt, Wallet } from "lucide-react";
import { Ico } from "@/components/Icon";
import { dashContext } from "@/lib/dashboard/context";
import { db } from "@/lib/db";
import { CATEGORY_LABEL, transactions } from "@/lib/dashboard/metrics";
import { parseRange, rangeLabel } from "@/lib/dashboard/range";
import { termsOf } from "@/lib/pricing/engine";
import { usd } from "@/lib/format";
import RangeBar from "@/components/dash/RangeBar";
import TxTable, { type TxBooking } from "@/components/dash/TxTable";
import { sampleData } from "@/lib/dashboard/sample";
import SampleNote from "@/components/dash/SampleNote";

export const dynamic = "force-dynamic";
function todayIso() { return new Date().toISOString().slice(0, 10); }

export default async function Transactions({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const c = (await dashContext())!;
  const sp = await searchParams;
  const today = todayIso();
  const r = parseRange({ r: "ytd", ...sp }, today);
  const includeDemo = sp.demo === "1" || (c.demo && sp.demo !== "0");
  const [bookings, payouts, pins] = await Promise.all([db().bookingsForCreator(c.creator.id, 5000), db().payoutsForCreator(c.creator.id), db().pinnedHotels(c.sf.id)]);
  const names = new Map(pins.map((p) => [p.ebcId, p.name]));
  await Promise.all([...new Set(bookings.map((b) => b.ebcId).filter((id) => !names.has(id)))].slice(0, 60).map(async (id) => { const h = await db().hotel(id); if (h) names.set(id, h.name); }));
  const sample = c.demo && sp.sample !== "0" ? sampleData(pins.map((x) => ({ ebcId: x.ebcId, name: x.name })), today) : null;
  const txs = (sample ? sample.txs : transactions(bookings.filter((b) => b.storefrontId === c.sf.id), payouts, (id) => names.get(id) ?? `Hotel ${id}`))
    .filter((t) => t.date >= r.sinceIso && t.date < r.untilIso && (includeDemo || !t.demo));

  // one row per booking: the stay and its add ons together
  const rows: TxBooking[] = [];
  for (const t of txs) {
    let row = rows.find((x) => x.id === t.bookingId);
    if (!row) {
      row = { id: t.bookingId, reference: t.reference, date: t.date, hotel: names.get(t.ebcId) ?? `Hotel ${t.ebcId}`, source: t.source, checkIn: t.checkIn ?? null, checkOut: t.checkOut, nights: t.nights ?? null, tx: t.tx, pay: t.pay, demo: t.demo, lines: [], price: 0, commission: 0 };
      rows.push(row);
    }
    if (t.category === "hotel") Object.assign(row, { checkIn: t.checkIn ?? row.checkIn, nights: t.nights ?? row.nights, tx: t.tx, pay: t.pay });
    row.lines.push({ category: t.category, info: t.info, price: t.price, margin: t.margin, costs: t.costs, commission: t.commission });
    row.price = Math.round((row.price + (t.tx === "Canceled" ? 0 : t.price)) * 100) / 100;
    row.commission = Math.round((row.commission + t.commission) * 100) / 100;
  }
  for (const row of rows) row.lines.sort((a, b) => (a.category === "hotel" ? -1 : b.category === "hotel" ? 1 : 0));
  const live = rows.filter((x) => x.tx !== "Canceled");
  const commission = live.reduce((a, x) => a + x.commission, 0), value = live.reduce((a, x) => a + x.price, 0);
  const terms = termsOf(c.sf);
  const byCat = (Object.keys(CATEGORY_LABEL) as Array<keyof typeof CATEGORY_LABEL>).map((k) => {
    const l = txs.filter((t) => t.category === k && t.tx !== "Canceled");
    return { k, n: l.length, c: l.reduce((a, t) => a + t.commission, 0) };
  }).filter((x) => x.n);
  const demoCount = rows.filter((x) => x.demo).length;

  return (
    <>
      <div className="dash-head"><div><h1>Transactions</h1><p>Every booking from your storefront and what you earn on it. Times in UTC.</p></div></div>
      <RangeBar from={r.from} to={r.to} preset={r.preset} grain={r.grain} label={rangeLabel(r)} today={today} grains={false} defaultPreset="ytd" />
      {sample && <SampleNote realHref={`?${new URLSearchParams({ ...(sp as Record<string, string>), sample: "0" })}`} />}
      {!sample && demoCount > 0 && includeDemo && <div className="notice small notice-inline">Includes {demoCount} demo {demoCount === 1 ? "booking" : "bookings"} made with a test card. They are never paid. <Link href={`?${new URLSearchParams({ ...(sp as Record<string, string>), demo: "0" })}`}>Hide them</Link>.</div>}
      <div className="kpis kpis-4">
        <div className="kpi"><span><Ico of={DollarSign} size={16} />Booking value</span><b>{usd(value)}</b><small>Paid by your readers, taxes in</small></div>
        <div className="kpi"><span><Ico of={Wallet} size={16} />Commission</span><b>{usd(commission)}</b><small>{value ? `${((commission / value) * 100).toFixed(1)}% of booking value` : "Cancellations left out"}</small></div>
        <div className="kpi"><span><Ico of={CalendarCheck} size={16} />Bookings</span><b>{live.length}</b><small>{rows.length - live.length ? `${rows.length - live.length} canceled` : "None canceled"}</small></div>
        <div className="kpi"><span><Ico of={Receipt} size={16} />Average commission</span><b>{usd(live.length ? commission / live.length : 0)}</b><small>Per booking, add ons included</small></div>
      </div>
      {byCat.length > 0 && <div className="catstrip" aria-label="By product">{byCat.map((x) => <span key={x.k}><b>{CATEGORY_LABEL[x.k]}</b> {x.n} · {usd(x.c)}</span>)}<span className="mute">You earn {Math.round(terms.hotelShare * 100)}% of our net on hotels, {Math.round(terms.extrasShare * 100)}% on add ons.</span></div>}
      <TxTable rows={rows} range={`${r.from}_${r.to}`} />
      <div className="gloss">
        <span><span className="status st-Pending">Pending</span> Booked; the stay is not completed yet.</span>
        <span><span className="status st-Approved">Approved</span> Stay completed; commission is final.</span>
        <span><span className="status st-Ready">Ready</span> In the next monthly payout.</span>
        <span><span className="status st-Paid">Paid</span> Sent to your account.</span>
        <span><span className="status st-Canceled">Canceled</span> Refunded; no commission.</span>
      </div>
    </>
  );
}
