import { CircleCheck, Hourglass, Receipt, Wallet } from "lucide-react";
import { Ico } from "@/components/Icon";
import { dashContext } from "@/lib/dashboard/context";
import { db } from "@/lib/db";
import { fmtDate, usd } from "@/lib/format";
import { transactions } from "@/lib/dashboard/metrics";

export const dynamic = "force-dynamic";

export default async function Payouts() {
  const c = (await dashContext())!;
  const [payouts, bookings] = await Promise.all([db().payoutsForCreator(c.creator.id), db().bookingsForCreator(c.creator.id, 2000)]);
  const txs = transactions(bookings, payouts, () => "");
  const real = txs.filter((t) => !t.demo && t.tx !== "Canceled");
  const sum = (s: string) => real.filter((t) => t.pay === s).reduce((a, t) => a + t.commission, 0);
  return (
    <>
      <div className="dash-head"><div><h1>Payouts</h1><p>Monthly, on the 15th, for stays completed the month before. No minimum. Statements itemize every booking.</p></div></div>
      <div className="kpis" style={{ gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
        <div className="kpi"><span><Ico of={CircleCheck} size={16} />Ready</span><b>{usd(sum("Ready"))}</b><small>Stays completed, in the next payout</small></div>
        <div className="kpi"><span><Ico of={Hourglass} size={16} />Pending</span><b>{usd(sum("Pending"))}</b><small>Booked, stay ahead</small></div>
        <div className="kpi"><span><Ico of={Wallet} size={16} />Paid, all time</span><b>{usd(payouts.filter((p) => p.status === "paid").reduce((a, p) => a + p.amount, 0))}</b><small>{payouts.filter((p) => p.status === "paid").length} payouts</small></div>
      </div>
      <section className="dcard">
        <h2>Statements</h2>
        <table className="dtable"><thead><tr><th>Payout</th><th>Stays completed</th><th className="n">Bookings</th><th className="n">Amount</th><th>Status</th></tr></thead>
          <tbody>
            {payouts.map((p) => <tr key={p.id}><td>{fmtDate(p.scheduledFor)}</td><td>{fmtDate(p.periodStart)} to {fmtDate(p.periodEnd)}</td><td className="n">{p.items.length}</td><td className="n"><b>{usd(p.amount, false, p.currency)}</b></td><td><span className={`status st-${p.status === "paid" ? "Paid" : "Ready"}`}>{p.status === "paid" ? `Paid ${p.paidAt ? fmtDate(p.paidAt) : ""}` : "Scheduled"}</span></td></tr>)}
            {!payouts.length && <tr><td colSpan={5} className="mute empty-row"><Ico of={Receipt} size={18} />No payouts yet. The first one is made on the 15th of the month after your first reader checks out.</td></tr>}
          </tbody></table>
        <p className="note">Paid to the account on file, in USD. Tell your partner manager where to send it; account details are never stored on this site.</p>
      </section>
    </>
  );
}
