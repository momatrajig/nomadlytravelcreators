import { Check, MousePointerClick, ReceiptText, X } from "lucide-react";
import { Ico } from "@/components/Icon";
import Link from "next/link";
import { dashContext } from "@/lib/dashboard/context";
import { db } from "@/lib/db";
import { transactions, type Tx } from "@/lib/dashboard/metrics";
import { performance } from "@/lib/dashboard/perf";
import { bucketLabel, parseRange, rangeLabel } from "@/lib/dashboard/range";
import { fmtDate, usd } from "@/lib/format";
import AutoRefresh from "@/components/dash/AutoRefresh";
import RangeBar from "@/components/dash/RangeBar";
import PerfPanel from "@/components/dash/PerfPanel";
import Breakdown from "@/components/dash/Breakdown";
import { payoutDateFor } from "@/lib/dashboard/metrics";
import type { Click } from "@/lib/db/types";
import { sampleData } from "@/lib/dashboard/sample";
import SampleNote from "@/components/dash/SampleNote";

export const dynamic = "force-dynamic";

const pct = (v: number) => `${(v * 100).toFixed(v > 0 && v < 0.01 ? 2 : 1).replace(/\.0$/, "")}%`;
// outside render: the clock is read once per request on this dynamic page
/** true when the last week or month runs past the end of the range (still in progress) */
function bucketEndAfter(start: string | undefined, grain: string, to: string) {
  if (!start) return false;
  const d = new Date(`${start}T00:00:00Z`);
  const end = grain === "week" ? new Date(d.getTime() + 6 * 86_400_000) : new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  return end.toISOString().slice(0, 10) > to;
}
function todayIso() { return new Date().toISOString().slice(0, 10); }

export default async function Performance({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const c = (await dashContext())!;
  const sp = await searchParams;
  const today = todayIso();
  const r = parseRange(sp, today);
  // the demo dashboard shows its test bookings by default, so a visitor sees how a booking appears
  const includeDemo = sp.demo === "1" || (c.demo && sp.demo !== "0");
  const [bookings, clicks, checkouts, payouts, pins] = await Promise.all([
    db().bookingsForCreator(c.creator.id, 5000), db().clicksForStorefront(c.sf.id, r.prev.sinceIso), db().checkoutsForStorefront(c.sf.id, r.prev.sinceIso), db().payoutsForCreator(c.creator.id), db().pinnedHotels(c.sf.id),
  ]);
  const names = new Map(pins.map((p) => [p.ebcId, p.name]));
  const missing = [...new Set([...bookings.map((b) => b.ebcId), ...clicks.map((k) => k.ebcId ?? 0), ...checkouts.map((q) => q.ebcId)].filter((id) => id && !names.has(id)))];
  await Promise.all(missing.slice(0, 40).map(async (id) => { const h = await db().hotel(id); if (h) names.set(id, h.name); }));
  const name = (id: number) => names.get(id) ?? `Hotel ${id}`;
  // the public demo shows a year of sample traffic by default (labelled), so every chart has something to show
  const sample = c.demo && sp.sample !== "0" ? sampleData(pins.map((x) => ({ ebcId: x.ebcId, name: x.name })), today) : null;
  const realTx = transactions(bookings.filter((b) => b.storefrontId === c.sf.id), payouts, name);
  const txs = sample ? sample.txs : realTx;
  const p = performance(sample ? sample.clicks : clicks, sample ? sample.checkouts : checkouts, txs, r, { includeDemo, hotelName: name });
  const demoCount = txs.filter((t) => t.demo && t.category === "hotel" && t.date >= r.sinceIso && t.date < r.untilIso).length;
  const q = (o: Record<string, string>) => `?${new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([, v]) => v != null)) as Record<string, string>, ...o })}`;
  const live = txs.filter((t) => t.tx !== "Canceled" && (includeDemo || !t.demo));
  const sum = (s: Tx["pay"]) => live.filter((t) => t.pay === s).reduce((a, t) => a + t.commission, 0);
  const ready = live.filter((t) => t.pay === "Ready");
  const nextPayout = ready.length ? ready.map((t) => payoutDateFor(t.checkOut)).sort()[0]! : null;
  const f = p.funnel;

  return (
    <>
      <div className="dash-head">
        <div><h1>Performance</h1><p>How your links and storefront turn readers into stays. Live, to the second.</p></div>
      </div>
      <RangeBar from={r.from} to={r.to} preset={r.preset} grain={r.grain} label={rangeLabel(r)} today={today} />
      {sample && <SampleNote realHref={q({ sample: "0" })} />}
      {!sample && demoCount > 0 && <div className="notice small notice-inline">{includeDemo ? <>Showing {demoCount} demo {demoCount === 1 ? "booking" : "bookings"} (test card, nothing reserved). They are never paid. <Link href={q({ demo: "0" })}>Hide them</Link>.</> : <>{demoCount} demo {demoCount === 1 ? "booking" : "bookings"} made with a test card are left out. <Link href={q({ demo: "1" })}>Show them</Link>.</>}</div>}

      <PerfPanel totals={p.totals} prev={p.prev} series={p.series} prevSeries={p.prevSeries} labels={p.series.map((x) => bucketLabel(x.start, r.grain))} days={r.days} prevLabel="Period before" partialLast={r.grain !== "day" && bucketEndAfter(p.series.at(-1)?.start, r.grain, r.to)} />

      <div className="dgrid">
        <section className="dcard" aria-labelledby="fn-h">
          <h2 id="fn-h">From click to stay</h2>
          <ol className="funnel" role="list">
            {([["Clicks", f.clicks, null], ["Checkouts", f.checkouts, f.clicks ? f.checkouts / f.clicks : null], ["Bookings", f.bookings, f.checkouts ? f.bookings / f.checkouts : null]] as const).map(([l, v, rate], i) => (
              <li key={l} style={{ ["--w" as string]: `${Math.max(6, f.clicks ? (v / Math.max(f.clicks, f.checkouts, f.bookings, 1)) * 100 : i === 0 ? 100 : 6)}%` }}>
                <div className="fn-top"><span>{l}</span>{rate != null && rate <= 1 && <small>{pct(rate)} of the step before</small>}</div>
                <div className="fn-bar"><i /></div>
                <b className="num">{v.toLocaleString("en-US")}</b>
              </li>
            ))}
          </ol>
          <p className="note">{p.totals.bookings && p.totals.value ? <>Average booking {usd(p.totals.value / Math.max(1, p.totals.bookings), true)}, you earn {usd(p.totals.commission / Math.max(1, p.totals.bookings))} a booking on average{p.totals.addOns ? `, with ${p.totals.addOns} add ${p.totals.addOns === 1 ? "on" : "ons"}` : ""}{p.totals.canceled ? `. ${p.totals.canceled} canceled` : ""}.</> : "A checkout is a reader who chose a room and held the price. Most book within the hour."}</p>
        </section>
        <section className="dcard" aria-labelledby="ps-h">
          <div className="card-head"><h2 id="ps-h">Your money</h2><Link className="btn btn-sm" href="/dashboard/transactions"><Ico of={ReceiptText} size={15} />Transactions</Link></div>
          <div className="paystat">
            <div><span><i className="dot st-Paid" />Paid</span><span>{usd(sum("Paid"))}</span></div>
            <div><span><i className="dot st-Ready" />Ready{nextPayout ? `, pays ${fmtDate(nextPayout)}` : ""}</span><span>{usd(sum("Ready"))}</span></div>
            <div><span><i className="dot st-Pending" />Pending, stay ahead</span><span>{usd(sum("Pending"))}</span></div>
            <div><span>All time</span><span>{usd(live.reduce((a, t) => a + t.commission, 0))}</span></div>
          </div>
          <p className="note">Paid monthly on the 15th for stays completed the month before. No minimum.</p>
        </section>
      </div>

      <Breakdown data={{ source: p.bySource, hotel: p.byHotel, country: p.byCountry, device: p.byDevice }} range={`${r.from}_${r.to}`} />

      <Activity clicks={sample ? sample.clicks : clicks} txs={txs.filter((t) => includeDemo || !t.demo)} name={name} slug={c.sf.slug} />
    </>
  );
}

const FLAG: Record<string, string> = { CZ: "Czechia", SK: "Slovakia", US: "United States", GB: "United Kingdom", DE: "Germany", FR: "France", AT: "Austria", PL: "Poland", LB: "Lebanon", AE: "UAE" };
function ago(iso: string, now: number) {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return fmtDate(iso);
}
function nowMs() { return Date.now(); }

/** What readers did, newest first: each link click and each booking, as it happens. */
function Activity({ clicks, txs, name, slug }: { clicks: Click[]; txs: Tx[]; name: (id: number) => string; slug: string }) {
  const now = nowMs();
  type Ev = { at: string; key: string; kind: "click" | "booking" | "cancel"; title: string; detail: string; amount?: string; status?: string };
  const evs: Ev[] = [
    ...clicks.filter((k) => !k.bot).slice(0, 40).map((k): Ev => ({
      at: k.createdAt, key: `c${k.id}`, kind: "click",
      title: k.target === "hotel" && k.ebcId ? `Clicked ${name(k.ebcId)}` : k.target === "city" ? `Clicked ${k.query?.city ?? k.query?.address ?? "a destination"}` : k.query?.hotelname ? `Clicked ${k.query.hotelname}` : "Clicked your storefront",
      detail: [k.source ? `from ${k.source}` : "direct", k.country ? FLAG[k.country] ?? k.country : null, k.device].filter(Boolean).join(", "),
    })),
    // one line per booking: the stay with its add ons, the total and what the creator earns on all of it
    ...[...new Map(txs.slice(0, 120).map((t) => [t.bookingId, t])).keys()].slice(0, 40).map((id): Ev => {
      const parts = txs.filter((t) => t.bookingId === id);
      const stay = parts.find((t) => t.category === "hotel") ?? parts[0]!;
      const extras = parts.filter((t) => t !== stay).map((t) => t.info.replace(/,\s*(Standard|Business|Van|First class)$/i, ""));
      const price = parts.reduce((a, t) => a + t.price, 0), earn = parts.reduce((a, t) => a + t.commission, 0);
      return {
        at: stay.date, key: `b${id}`, kind: stay.tx === "Canceled" ? "cancel" : "booking",
        title: `${stay.tx === "Canceled" ? "Canceled" : "Booked"}: ${stay.info}`,
        detail: [extras.length ? `with ${extras.join(", ")}` : null, stay.reference, stay.source ? `from ${stay.source}` : "direct", stay.demo ? "test card" : null].filter(Boolean).join(" · "),
        amount: `${usd(price)}, you earn ${usd(earn)}`, status: stay.tx,
      };
    }),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12);
  return (
    <section className="dcard" aria-labelledby="act-h">
      <div className="act-head"><h2 id="act-h">Live activity</h2><AutoRefresh /></div>
      {evs.length ? (
        <ol className="act" role="list">
          {evs.map((e) => (
            <li key={e.key} className={`act-${e.kind}`}>
              <span className="act-ico" aria-hidden="true"><Ico of={e.kind === "click" ? MousePointerClick : e.kind === "cancel" ? X : Check} size={16} /></span>
              <div><b>{e.title}</b><div className="small mute">{e.detail}</div></div>
              <div className="act-r">{e.amount && <div className="small"><b>{e.amount}</b></div>}{e.status && <span className={`status st-${e.status}`}>{e.status}</span>}<div className="small mute">{ago(e.at, now)}</div></div>
            </li>
          ))}
        </ol>
      ) : <p className="mute">Nothing yet. Open one of your links (<Link href="/dashboard/links">Links</Link>) in another tab and the click shows here within seconds; a booking shows the moment it is paid. Your storefront: <Link href={`/s/${slug}`}>/s/{slug}</Link>.</p>}
    </section>
  );
}
