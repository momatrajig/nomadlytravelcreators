import { currentCreator } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDate, usd } from "@/lib/format";
import { stayLedger, NOMADLY_MARKUP } from "@/lib/pricing/engine";

export const dynamic = "force-dynamic";
const AVG_STAY = 640;
const lastThirtyDays = <T extends { createdAt: string; status: string }>(rows: T[]) => { const since = Date.now() - 30 * 86_400_000; return rows.filter((b) => Date.parse(b.createdAt) > since && b.status !== "failed" && b.status !== "paying"); };

export default async function Overview() {
  const c = (await currentCreator())!;
  const sf = (await db().storefrontsForCreator(c.id))[0];
  const bookings = await db().bookingsForCreator(c.id, 200);
  const recent = lastThirtyDays(bookings);
  const earnOf = (b: { creatorShare: number; promoDiscount: number; extras: Array<{ creatorShare: number }> }) => b.creatorShare - b.promoDiscount + b.extras.reduce((a, x) => a + x.creatorShare, 0);
  const earned = recent.filter((b) => b.status !== "canceled").reduce((a, b) => a + earnOf(b), 0);
  const rate = sf?.creatorRate ?? 0.08;
  const per = stayLedger(AVG_STAY / (1 + NOMADLY_MARKUP) / (1 + rate), rate).creatorShare;
  const count = (s: string) => recent.filter((b) => b.status === s).length;
  return (
    <>
      <h1 style={{ fontSize: 26 }}>Overview</h1>
      <div className="notice" style={{ marginTop: 12 }}><span><b>You earn about {usd(per, true)} per hotel booking</b> at {Math.round(rate * 100)} percent of Nomadly&apos;s net rate on a USD {AVG_STAY} stay. {recent.length} {recent.length === 1 ? "booking" : "bookings"} in the last 30 days, {usd(earned, true)}. Paid every Wednesday, 7 days after each check out.</span></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginTop: 14 }}>
        {[["Waiting for the hotel", count("on_request")], ["Confirmed, stay ahead", count("confirmed")], ["Completed, in payout", count("completed")], ["Canceled by the reader", count("canceled")]].map(([l, v]) => <div key={String(l)} className="panel"><div className="small mute">{l}</div><div className="price">{v}</div></div>)}
      </div>
      <h2 style={{ fontSize: 20, margin: "22px 0 10px" }}>Latest bookings</h2>
      <div className="panel" style={{ padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead><tr style={{ textAlign: "left", color: "var(--mute)" }}>{["Reference", "Stay", "Status", "Reader paid", "Hotel received", "Nomadly", "You earn"].map((h) => <th key={h} style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)" }}>{h}</th>)}</tr></thead>
          <tbody>
            {bookings.slice(0, 25).map((b) => <tr key={b.id}>
              <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)" }}><b>{b.reference}</b><div className="small mute">{fmtDate(b.createdAt)}</div></td>
              <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)" }}>{fmtDate(b.checkIn)}, {b.nights} {b.nights === 1 ? "night" : "nights"}</td>
              <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)" }}><span className={`chip ${b.status === "confirmed" || b.status === "completed" ? "chip-ok" : b.status === "canceled" || b.status === "failed" ? "chip-bad" : "chip-warn"}`}>{b.status.replace("_", " ")}</span></td>
              <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)" }}>{usd(b.readerPrice + b.extras.reduce((a, x) => a + x.price, 0))}{b.extras.length ? <div className="small mute">{b.extras.length} {b.extras.length === 1 ? "extra" : "extras"}</div> : null}</td>
              <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)" }}>{usd(b.supplierNet)}</td>
              <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)" }}>{usd(b.nomadlyNet - b.supplierNet)}</td>
              <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)", color: "var(--ok)", fontWeight: 600 }}>{b.status === "canceled" ? usd(0) : usd(earnOf(b))}</td>
            </tr>)}
            {!bookings.length && <tr><td colSpan={7} className="mute" style={{ padding: 20 }}>No bookings yet. Share your storefront link and this fills in by itself.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="small mute" style={{ marginTop: 10 }}>Every row shows what the hotel received, Nomadly&apos;s part and yours. Nobody else prints this.</p>
    </>
  );
}
