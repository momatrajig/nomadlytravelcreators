import { Check, MousePointerClick, X } from "lucide-react";
import { Ico } from "@/components/Icon";
import Link from "next/link";
import { dashContext } from "@/lib/dashboard/context";
import { db } from "@/lib/db";
import { CATEGORY_LABEL, summarize, transactions, type Tx } from "@/lib/dashboard/metrics";
import { termsOf } from "@/lib/pricing/engine";
import { fmtDate, usd } from "@/lib/format";
import AutoRefresh from "@/components/dash/AutoRefresh";
import type { Click } from "@/lib/db/types";

export const dynamic = "force-dynamic";

const PERIODS: Array<[number, string]> = [[7, "7 days"], [30, "30 days"], [90, "90 days"], [365, "12 months"]];
const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;
const num = (v: number) => v.toLocaleString("en-US");
// outside render: the clock is read once per request on this dynamic page
function daysAgo(d: number) { return new Date(Date.now() - d * 86_400_000).toISOString(); }

export default async function Overview({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const c = (await dashContext())!;
  const sp = await searchParams;
  const days = PERIODS.some(([d]) => String(d) === sp.p) ? Number(sp.p) : 30;
  // the demo dashboard shows its test bookings by default, so a visitor sees how a booking appears
  const includeDemo = sp.demo === "1" || (c.demo && sp.demo !== "0");
  const since = daysAgo(days);
  const prevSince = daysAgo(2 * days);
  const [bookings, clicks, payouts, pins] = await Promise.all([
    db().bookingsForCreator(c.creator.id, 2000), db().clicksForStorefront(c.sf.id, prevSince), db().payoutsForCreator(c.creator.id), db().pinnedHotels(c.sf.id),
  ]);
  const names = new Map(pins.map((p) => [p.ebcId, p.name]));
  const missing = [...new Set(bookings.map((b) => b.ebcId).filter((id) => !names.has(id)))];
  for (const id of missing.slice(0, 40)) { const h = await db().hotel(id); if (h) names.set(id, h.name); }
  const txs = transactions(bookings.filter((b) => b.storefrontId === c.sf.id), payouts, (id) => names.get(id) ?? `Hotel ${id}`);
  const s = summarize(clicks, txs, { since, days, includeDemo });
  const prev = summarize(clicks, txs, { since: prevSince, until: since, days, includeDemo });
  const delta = (a: number, b: number) => (b > 0 ? `${a >= b ? "+" : ""}${Math.round(((a - b) / b) * 100)}% on the ${days} days before` : "");
  const demoCount = txs.filter((t) => t.demo && t.category === "hotel" && t.date >= since).length;
  const terms = termsOf(c.sf);
  const q = (o: Record<string, string>) => `?${new URLSearchParams({ p: String(days), ...(includeDemo ? { demo: "1" } : {}), ...o })}`;
  const shown = txs.filter((t) => t.date >= since && (includeDemo || !t.demo)).slice(0, 60);

  return (
    <>
      <div className="dash-head">
        <div><h1>Overview</h1><p>{c.sf.brandName}, last {PERIODS.find(([d]) => d === days)![1]}. Every number is live.</p></div>
        <nav className="period" aria-label="Period">{PERIODS.map(([d, l]) => <Link key={d} href={`?${new URLSearchParams({ p: String(d), ...(includeDemo ? { demo: "1" } : {}) })}`} aria-current={d === days ? "page" : undefined}>{l}</Link>)}</nav>
      </div>
      {demoCount > 0 && <div className="notice small notice-inline">{includeDemo ? <>Showing {demoCount} demo {demoCount === 1 ? "booking" : "bookings"} (test card, nothing reserved). They are never paid. <Link href={q({ demo: "0" })}>Hide them</Link>.</> : <>{demoCount} demo {demoCount === 1 ? "booking" : "bookings"} made with a test card are left out. <Link href={q({ demo: "1" })}>Show them</Link> to see how a booking appears.</>}</div>}

      <div className="kpis">
        <div className="kpi"><span>Clicks</span><b>{num(s.clicks)}</b><small>{num(s.visitors)} unique visitors{prev.clicks ? `. ${delta(s.clicks, prev.clicks)}` : ""}</small></div>
        <div className="kpi"><span>Bookings</span><b>{num(s.hotelBookings)}</b><small>{[s.addOns ? `Plus ${num(s.addOns)} add ${s.addOns === 1 ? "on" : "ons"}` : null, s.canceled ? `${s.canceled} canceled` : null].filter(Boolean).join(", ") || "Hotel stays"}</small></div>
        <div className="kpi"><span>Conversion</span><b>{pct(s.conversion, s.conversion > 0 && s.conversion < 0.1 ? 2 : 1).replace(/\.0+%$/, "%")}</b><small>Bookings per click</small></div>
        <div className="kpi"><span>EPC</span><b>{usd(s.epc)}</b><small>Earnings per click</small></div>
        <div className="kpi"><span>Commission</span><b>{usd(s.commission)}</b><small>{s.bookingValue ? `${pct(s.ofValue)} of booking value` : "Pending and approved"}</small></div>
      </div>

      <Activity clicks={clicks} txs={txs.filter((t) => includeDemo || !t.demo)} name={(id) => names.get(id) ?? `Hotel ${id}`} slug={c.sf.slug} />

      <div className="dgrid">
        <section className="dcard" aria-labelledby="ch-h">
          <h2 id="ch-h">Clicks and bookings by {days <= 31 ? "day" : "week"}</h2>
          <Chart series={s.series} />
          <div className="legend"><span><i style={{ background: "var(--mist-2)" }} />Clicks</span><span><i style={{ background: "var(--ink)" }} />Bookings</span></div>
        </section>
        <section className="dcard" aria-labelledby="ps-h">
          <h2 id="ps-h">Payment status</h2>
          <div className="paystat">
            <div><span>Paid</span><span>{usd(s.byStatus.paid)}</span></div>
            <div><span>Ready{s.byStatus.nextPayout ? `, pays ${fmtDate(s.byStatus.nextPayout)}` : ""}</span><span>{usd(s.byStatus.ready)}</span></div>
            <div><span>Pending</span><span>{usd(s.byStatus.pending)}</span></div>
            <div><span>Canceled{s.byStatus.canceledCount ? `, ${s.byStatus.canceledCount} ${s.byStatus.canceledCount === 1 ? "booking" : "bookings"}` : ""}</span><span>{usd(0)}</span></div>
            <div><span>Total commission</span><span>{usd(s.commission)}</span></div>
          </div>
          <p className="note">Paid monthly on the 15th for stays completed the month before. No minimum.</p>
        </section>
      </div>

      <section className="dcard" aria-labelledby="src-h">
        <h2 id="src-h">Top sources</h2>
        <div className="scroll"><table className="dtable">
          <thead><tr><th>Source</th><th className="n">Clicks</th><th className="n">Visitors</th><th className="n">Bookings</th><th className="n">Conversion</th><th className="n">Commission</th><th className="n">EPC</th></tr></thead>
          <tbody>
            {s.sources.slice(0, 12).map((r) => <tr key={r.source}><td>{r.source}</td><td className="n">{num(r.clicks)}</td><td className="n">{num(r.visitors)}</td><td className="n">{num(r.bookings)}</td><td className="n">{r.clicks ? pct(r.conversion, 2) : "n/a"}</td><td className="n">{usd(r.commission)}</td><td className="n">{r.clicks ? usd(r.epc) : "n/a"}</td></tr>)}
            {!s.sources.length && <tr><td colSpan={7} className="mute">No clicks yet. Put one of your links in an article (<Link href="/dashboard/links">Links</Link>) and the first click shows here within a second.</td></tr>}
          </tbody>
        </table></div>
        <p className="note">A source is the name you give a link (src=), usually the article. Clicks from bots and link previews are left out. Every booking on your storefront is yours whether or not it came through a link; the source only says where it came from.</p>
      </section>

      <section className="dcard" aria-labelledby="cat-h">
        <h2 id="cat-h">By category</h2>
        <div className="scroll"><table className="dtable">
          <thead><tr><th>Category</th><th className="n">Bookings</th><th className="n">Booking value</th><th>Your share</th><th className="n">Commission</th></tr></thead>
          <tbody>
            {s.byCategory.map((r) => <tr key={r.category}><td>{CATEGORY_LABEL[r.category]}</td><td className="n">{num(r.bookings)}</td><td className="n">{usd(r.value)}</td><td>{Math.round((r.category === "hotel" ? terms.hotelShare : terms.extrasShare) * 100)}% of net</td><td className="n">{usd(r.commission)}</td></tr>)}
            <tr className="soon"><td>Flights</td><td colSpan={4}>Coming soon, fixed margin per ticket</td></tr>
            <tr className="total"><td>Total</td><td className="n">{num(s.byCategory.reduce((a, r) => a + r.bookings, 0))}</td><td className="n">{usd(s.bookingValue)}</td><td /><td className="n">{usd(s.commission)}</td></tr>
          </tbody>
        </table></div>
      </section>

      <section className="dcard" aria-labelledby="tx-h">
        <h2 id="tx-h">Transactions</h2>
        <div className="scroll"><table className="dtable">
          <thead><tr><th>Date</th><th>Info</th><th>Source</th><th className="n">Price</th><th className="n">Our margin</th><th className="n">Costs</th><th className="n">Commission</th><th className="n">Of price</th><th>Transaction</th><th>Payment</th></tr></thead>
          <tbody>
            {shown.map((t) => <TxRow key={t.id} t={t} />)}
            {!shown.length && <tr><td colSpan={10} className="mute">No bookings in this period yet.</td></tr>}
          </tbody>
        </table></div>
        <div className="gloss" style={{ marginTop: 12 }}>
          <span><span className="status st-Pending">Pending</span> Booked; the stay is not completed yet.</span>
          <span><span className="status st-Approved">Approved</span> Stay completed; commission is final.</span>
          <span><span className="status st-Ready">Ready</span> In the next monthly payout.</span>
          <span><span className="status st-Paid">Paid</span> Sent to your account.</span>
          <span><span className="status st-Canceled">Canceled</span> Refunded; no commission.</span>
        </div>
        <p className="note">Commission is {Math.round(terms.hotelShare * 100)}% of Nomadly&apos;s net revenue on hotels and {Math.round(terms.extrasShare * 100)}% on add ons. Net revenue is our margin less the card and payout costs we pay. Every line shows both.</p>
      </section>
    </>
  );
}

function TxRow({ t }: { t: Tx }) {
  return (
    <tr>
      <td style={{ whiteSpace: "nowrap" }}>{fmtDate(t.date)}<div className="small mute">{t.reference}</div></td>
      <td>{t.info}{t.demo && <span className="chip" style={{ marginLeft: 6 }}>demo</span>}</td>
      <td className="small">{t.source ?? <span className="mute">direct</span>}</td>
      <td className="n">{usd(t.price)}</td><td className="n">{usd(t.margin)}</td><td className="n">{usd(t.costs)}</td>
      <td className="n"><b>{usd(t.commission)}</b></td><td className="n">{t.price ? pct(t.commission / t.price) : ""}</td>
      <td><span className={`status st-${t.tx}`}>{t.tx}</span></td><td><span className={`status st-${t.pay}`}>{t.pay}</span></td>
    </tr>
  );
}

function Chart({ series }: { series: Array<{ label: string; clicks: number; bookings: number }> }) {
  const W = 640, H = 180, pad = 22, n = Math.max(series.length, 1);
  const maxC = Math.max(1, ...series.map((s) => s.clicks)), maxB = Math.max(1, ...series.map((s) => s.bookings));
  const bw = (W - pad) / n;
  const every = Math.ceil(n / 8);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Clicks per period, highest ${maxC}`}>
      {series.map((s, i) => {
        const h = ((H - pad - 8) * s.clicks) / maxC, x = pad + i * bw;
        const bh = s.bookings ? Math.max(4, ((H - pad - 8) * 0.45 * s.bookings) / maxB) : 0;
        return (
          <g key={i}>
            <rect className="bar" x={x + 1} y={H - pad - h} width={Math.max(1, bw - 3)} height={h} rx={2}><title>{`${s.label}: ${s.clicks} clicks, ${s.bookings} bookings`}</title></rect>
            {bh > 0 && <rect className="bk" x={x + bw * 0.3} y={H - pad - bh} width={Math.max(1, bw * 0.4 - 1)} height={bh} rx={2} />}
            {i % every === 0 && <text x={x + bw / 2} y={H - 6} textAnchor="middle">{s.label}</text>}
          </g>
        );
      })}
      <text x={0} y={12}>{maxC}</text>
    </svg>
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
