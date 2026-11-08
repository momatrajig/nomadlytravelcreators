import { currentCreator } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDate, usd } from "@/lib/format";
import { HOLD_DAYS } from "@/lib/payouts/run";

export const dynamic = "force-dynamic";

export default async function Payouts() {
  const c = (await currentCreator())!;
  const payouts = await db().payoutsForCreator(c.id);
  const bookings = await db().bookingsForCreator(c.id, 500);
  const upcoming = bookings.filter((b) => b.status === "confirmed" || b.status === "on_request").reduce((a, b) => a + b.creatorShare - b.promoDiscount, 0);
  return (
    <>
      <h1 style={{ fontSize: 26 }}>Payouts</h1>
      <p className="mute" style={{ margin: "6px 0 16px" }}>Paid every Wednesday, automatically, no minimum. A stay is paid {HOLD_DAYS} days after the reader checks out.</p>
      <div className="grid2">
        <div className="panel"><div className="small mute">Confirmed stays not yet paid</div><div className="price">{usd(upcoming, true)}</div></div>
        <div className="panel"><div className="small mute">Paid out all time</div><div className="price">{usd(payouts.filter((p) => p.status === "paid").reduce((a, p) => a + p.amount, 0), true)}</div></div>
      </div>
      <h2 style={{ fontSize: 20, margin: "22px 0 10px" }}>Statements</h2>
      <div style={{ display: "grid", gap: 10 }}>
        {payouts.map((p) => <div key={p.id} className="panel" style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}><div><b>{usd(p.amount)}</b> <span className="mute small">for stays completed up to {fmtDate(p.periodEnd)}, {p.items.length} {p.items.length === 1 ? "booking" : "bookings"}</span></div><span className={`chip ${p.status === "paid" ? "chip-ok" : "chip-warn"}`}>{p.status === "paid" ? `Paid ${p.paidAt ? fmtDate(p.paidAt) : ""}` : `Scheduled ${fmtDate(p.scheduledFor)}`}</span></div>)}
        {!payouts.length && <div className="panel mute">No payouts yet. The first one is created the Wednesday after your first reader checks out.</div>}
      </div>
    </>
  );
}
