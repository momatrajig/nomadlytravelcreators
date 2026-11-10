import { dashContext } from "@/lib/dashboard/context";
import { extraLedger, monthlyProjection, shareOf, stayLedger, termsOf } from "@/lib/pricing/engine";
import { EXTRAS } from "@/lib/extras/catalog";
import { usd } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Earnings() {
  const c = (await dashContext())!;
  const t = termsOf(c.sf);
  const ex = shareOf(4000, 1200, 170, t.hotelShare);
  const live = stayLedger(400 / (1 + t.markup), t.markup, t.hotelShare);
  const proj = [5000, 20000, 60000].map((clicks) => ({ clicks, ...monthlyProjection(clicks, 0.5, 460, t.markup, t.hotelShare) }));
  return (
    <>
      <div className="dash-head"><div><h1>How you earn</h1><p>{Math.round(t.hotelShare * 100)}% of Nomadly&apos;s net revenue on hotels, {Math.round(t.extrasShare * 100)}% on add ons, for life. Flights soon, at a fixed margin per ticket.</p></div></div>
      <section className="dcard">
        <h2>Net revenue, line by line</h2>
        <table className="dtable"><tbody>
          <tr><td>Your reader pays for the stay</td><td className="n">{usd(4000)}</td></tr>
          <tr><td>Nomadly&apos;s margin (what we earn above the hotel&apos;s net rate)</td><td className="n">{usd(1200)}</td></tr>
          <tr><td>Less card and payout costs</td><td className="n">{usd(-170)}</td></tr>
          <tr><td>Nomadly&apos;s net revenue</td><td className="n">{usd(ex.net)}</td></tr>
          <tr className="total"><td>You take {Math.round(t.hotelShare * 100)}%</td><td className="n">{usd(ex.creatorShare)}, {(ex.ofBookingValue * 100).toFixed(1)}% of the price</td></tr>
        </tbody></table>
        <p className="note">The margin differs by hotel and date: the wider our trade rate sits below the public price, the more you earn. Every transaction in your Overview shows the price, our margin, the costs and your commission.</p>
      </section>
      <section className="dcard">
        <h2>On your storefront today</h2>
        <p className="small" style={{ marginTop: -4 }}>Your storefront sells at the hotel&apos;s net rate plus {Math.round(t.markup * 100)}%. On a {usd(400, true)} stay that is a margin of {usd(live.margin)}, costs of {usd(live.costs)}, and <b>{usd(live.creatorShare)} for you ({(live.ofBookingValue * 100).toFixed(1)}% of the price)</b>. Where we know the big sites&apos; price for the same room, the price is capped at or below it.</p>
        <table className="dtable"><thead><tr><th>Add on</th><th className="n">Price</th><th className="n">Our margin</th><th className="n">Costs</th><th className="n">You earn</th></tr></thead>
          <tbody>{EXTRAS.map((x) => { const l = extraLedger(x.price, x.commission, t.extrasShare); return <tr key={x.kind}><td>{x.name}</td><td className="n">{usd(x.price)}</td><td className="n">{usd(x.commission)}</td><td className="n">{usd(l.costs)}</td><td className="n"><b>{usd(l.creatorShare)}</b></td></tr>; })}</tbody></table>
      </section>
      <section className="dcard">
        <h2>What clicks are worth</h2>
        <table className="dtable"><thead><tr><th className="n">Clicks a month</th><th className="n">Bookings at 0.5%</th><th className="n">Per booking</th><th className="n">A month</th><th className="n">EPC</th></tr></thead>
          <tbody>{proj.map((p) => <tr key={p.clicks}><td className="n">{p.clicks.toLocaleString("en-US")}</td><td className="n">{p.bookings}</td><td className="n">{usd(p.perBooking)}</td><td className="n"><b>{usd(p.monthly)}</b></td><td className="n">{usd(p.epc)}</td></tr>)}</tbody></table>
        <p className="note">An illustration at a USD 460 average stay and the storefront&apos;s current markup, not a forecast. Your Overview shows your real conversion and EPC from the first click.</p>
      </section>
    </>
  );
}
