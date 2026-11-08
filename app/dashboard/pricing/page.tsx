import { revalidatePath } from "next/cache";
import { currentCreator } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { defaultDates } from "@/lib/dates";
import { usd } from "@/lib/format";
import { CREATOR_RATE_MAX, monthlyProjection, parityCeiling, stayLedger } from "@/lib/pricing/engine";
import { searchStays } from "@/lib/booking/service";

export const dynamic = "force-dynamic";

export default async function Pricing({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const c = (await currentCreator())!;
  const sf = (await db().storefrontsForCreator(c.id))[0]!;
  const sp = await searchParams;
  const d = defaultDates(env().EBC_MODE);
  // live parity read on the storefront's default dates, so the dial is honest about where it stops
  let ceiling = CREATOR_RATE_MAX, offersCount = 0, aboveNames: string[] = [], best: Array<[string, number]> = [];
  try {
    const r = await searchStays(sf, d.checkIn, d.checkOut, 1);
    offersCount = r.offers.length; ceiling = r.ceiling;
    aboveNames = r.offers.filter((o) => o.saving !== null && o.saving < 0).map((o) => o.name);
    best = r.offers.filter((o) => o.saving !== null).map((o) => [o.name, o.saving!] as [string, number]).sort((a, b) => b[1] - a[1]);
  } catch { /* supplier down: show the dial without live parity */ }
  const rate = sf.creatorRate;
  const ex = stayLedger(800, rate);
  const readers = Number(sp.readers ?? 12000), conv = Number(sp.conv ?? 0.6);
  const proj = monthlyProjection(readers, conv, 640, rate);

  async function setRate(fd: FormData) {
    "use server";
    const me = (await currentCreator())!; const mine = (await db().storefrontsForCreator(me.id))[0]!;
    const v = Math.max(0, Math.min(CREATOR_RATE_MAX, Number(fd.get("rate")) / 100));
    await db().updateStorefront(mine.id, { creatorRate: Math.round(v * 200) / 200 });
    revalidatePath("/dashboard/pricing");
  }

  return (
    <>
      <h1 style={{ fontSize: 26 }}>Pricing and earnings</h1>
      <p className="mute" style={{ margin: "6px 0 16px" }}>Your share is 8 percent of Nomadly&apos;s net rate. You can give part of it back to readers as a bigger saving; most creators leave it at 8. Nomadly&apos;s 7 percent and the parity guard never move.</p>
      <div className="panel">
        <h2 style={{ fontSize: 20 }}>Your cut</h2>
        <form action={setRate} style={{ display: "grid", gap: 10, marginTop: 10 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}><span className="price">{(rate * 100).toFixed(1)}%</span><span className="small mute">your share, on Nomadly&apos;s net rate</span></div>
          <input type="range" name="rate" min={0} max={Math.round(Math.min(CREATOR_RATE_MAX, ceiling) * 100 * 2) / 2} step={0.5} defaultValue={rate * 100} aria-label="Your share on stays, percent" />
          <div className="small mute" style={{ display: "flex", justifyContent: "space-between" }}><span>Readers save more</span><span>You earn more</span></div>
          <div>{ceiling < CREATOR_RATE_MAX ? <span className="chip chip-warn">The dial stops at {(ceiling * 100).toFixed(1)} percent so your prices never go above Booking.com</span> : <span className="chip chip-ok">Your prices stay below the big sites at every setting of this dial</span>}</div>
          <button className="btn btn-brand" type="submit" style={{ justifySelf: "start" }}>Save</button>
        </form>
      </div>
      <div className="grid2" style={{ marginTop: 14 }}>
        <div className="panel">
          <h2 style={{ fontSize: 20 }}>One booking, in full</h2>
          <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0", display: "grid", gap: 8, fontSize: 14 }}>
            {[["What the hotel receives", usd(ex.supplierNet)], ["Nomadly adds 7 percent: Nomadly's net rate", usd(ex.nomadlyNet)], [`Your share, ${(rate * 100).toFixed(1)} percent of Nomadly's net rate`, usd(ex.creatorShare)], ["The reader pays", usd(ex.readerPrice)], ["Card processing, paid by Nomadly", usd(ex.cardFee)], ["Nomadly keeps after the card fee", usd(ex.nomadlyKeeps)]].map(([l, v]) => <li key={l} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><span>{l}</span><b>{v}</b></li>)}
            <li style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--line)", paddingTop: 8, color: "var(--ok)" }}><span>You are paid, after the reader checks out</span><b>{usd(ex.creatorShare)}</b></li>
          </ul>
        </div>
        <div className="panel">
          <h2 style={{ fontSize: 20 }}>Are my prices ever above Booking.com?</h2>
          {offersCount ? (aboveNames.length ? <p><b>{aboveNames.length} of {offersCount} hotels would show above the big sites right now</b> ({aboveNames.join(", ")}). The dial has stopped so that does not happen.</p>
            : <p><b>All {offersCount} hotels are cheaper than the big sites at {(rate * 100).toFixed(1)} percent.</b> {best[0] ? `${best[0][0]} by ${usd(best[0][1], true)}` : ""}{best.length > 1 ? `, ${best[best.length - 1]![0]} by ${usd(best[best.length - 1]![1], true)}` : ""}.</p>)
            : <p className="mute">The hotel system did not answer, so the live check is not available right now.</p>}
          <details><summary className="btn-link small">Show every hotel</summary><ul className="small" style={{ margin: "8px 0 0", paddingLeft: 18 }}>{best.map(([n, s]) => <li key={n}>{n}: {s >= 0 ? `${usd(s, true)} below` : `${usd(-s, true)} above`}</li>)}</ul></details>
        </div>
      </div>
      <div className="panel" style={{ marginTop: 14 }}>
        <h2 style={{ fontSize: 20 }}>What that means a month</h2>
        <form style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, marginTop: 10, alignItems: "end" }}>
          <div className="field"><label htmlFor="readers">Readers who open the storefront a month</label><input id="readers" name="readers" type="number" min={100} step={100} defaultValue={readers} /></div>
          <div className="field"><label htmlFor="conv">Out of 100 readers, how many book</label><input id="conv" name="conv" type="number" min={0.1} max={10} step={0.1} defaultValue={conv} /></div>
          <button className="btn" type="submit">Recalculate</button>
        </form>
        <p style={{ margin: "12px 0 0" }}><b>{proj.bookings} bookings</b> a month, about <b>{usd(proj.perBooking, true)}</b> each, <b>{usd(proj.monthly, true)}</b> a month. Travel blogs typically see 1.5 to 2.5 bookings per 1,000 readers.</p>
      </div>
      <p className="small mute" style={{ marginTop: 10 }}>Every figure on this page comes from the same pricing engine that prices the storefront and writes your payout statement.</p>
      <span className="sr">{parityCeiling.name}</span>
    </>
  );
}
