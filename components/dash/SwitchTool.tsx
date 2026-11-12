"use client";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, CircleAlert, FileSpreadsheet, Hotel, Link2, LockKeyhole, Pencil, Printer, RotateCcw, Ticket, Upload } from "lucide-react";
import { Ico } from "@/components/Icon";
import { parseStay22, project, type Kind, type Parsed, type ProviderRow } from "@/lib/switch/stay22";

const money = (v: number, d = 2) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", currencyDisplay: "narrowSymbol", minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
const n0 = (v: number) => v.toLocaleString("en-US");
/** tiny earnings per click read in cents ("0.15¢"), never as $0.00 */
const perClick = (v: number) => (v > 0 && v < 0.01 ? `${(v * 100).toFixed(2)}¢` : money(v));
const pctS = (v: number) => `${Number((v * 100).toFixed(v < 0.001 ? 3 : v < 0.01 ? 2 : 1))}%`;
/** Stay22 shares no booking values; their hotel partners pay around 4% of the stay, so commission / 0.04 is our first guess */
const STAY22_RATE_GUESS = 0.04;

/**
 * The switch calculator. A creator drops in a Stay22 export (or types three numbers), corrects which providers are
 * hotels, and sees what the same hotel bookings earn on Nomadly at our standard and our lowest price. Everything
 * runs in the browser; the file is never uploaded.
 */
export default function SwitchTool({ share, sharePct, signedIn }: { share: number; sharePct: number; signedIn: boolean }) {
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [rows, setRows] = useState<ProviderRow[]>([]);
  const [err, setErr] = useState<string | null>(null), [file, setFile] = useState<string | null>(null), [drag, setDrag] = useState(false);
  const [manual, setManual] = useState(false);
  const [clicksOverride, setClicksOverride] = useState<string>("");
  const [avg, setAvg] = useState<string>("");
  const input = useRef<HTMLInputElement>(null);

  const read = async (f: File) => {
    setErr(null);
    if (f.size > 20_000_000) { setErr("That file is over 20 MB. Export a shorter date range."); return; }
    try {
      const p = parseStay22(await f.text());
      setParsed(p); setRows(p.rows); setFile(f.name); setManual(false); setAvg(""); setClicksOverride("");
    } catch (e) { setErr(e instanceof Error ? e.message : "We could not read that file."); }
  };
  const startManual = () => { setManual(true); setParsed({ format: "campaigns", rows: [], period: { from: null, to: null }, warnings: [] }); setRows([{ provider: "Hotels on Stay22", kind: "hotel", clicks: 0, bookings: 0, canceled: 0, commission: 0 }]); setFile(null); setErr(null); };
  const reset = () => { setParsed(null); setRows([]); setFile(null); setManual(false); setErr(null); setAvg(""); setClicksOverride(""); };

  const hotel = useMemo(() => {
    const h = rows.filter((r) => r.kind === "hotel");
    const clicks = clicksOverride !== "" ? Number(clicksOverride) || 0 : h.reduce((a, r) => a + r.clicks, 0);
    return { clicks, bookings: h.reduce((a, r) => a + r.bookings, 0), commission: Math.round(h.reduce((a, r) => a + r.commission, 0) * 100) / 100 };
  }, [rows, clicksOverride]);
  const other = rows.filter((r) => r.kind === "other");
  const guess = hotel.bookings ? Math.max(50, Math.round(hotel.commission / hotel.bookings / STAY22_RATE_GUESS / 10) * 10) : 300;
  const avgValue = avg !== "" ? Number(avg) || 0 : guess;
  // what if more of the same clicks book? Stay22's widget clicks are often low intent; a storefront converts differently
  const [conv, setConv] = useState<number | null>(null);
  const theirConv = hotel.clicks ? hotel.bookings / hotel.clicks : 0;
  const scenarioBookings = conv != null && hotel.clicks ? Math.round(hotel.clicks * conv) : hotel.bookings;
  const p0 = project(hotel, avgValue, share);
  const ps = project({ ...hotel, bookings: scenarioBookings, commission: hotel.commission }, avgValue, share);
  const p = { theirs: p0.theirs, ours: conv != null ? ps.ours.map((o) => ({ ...o, vsTheirs: hotel.commission > 0 ? o.total / hotel.commission - 1 : null })) : p0.ours };
  const best = p.ours[0]!, floor = p.ours[1]!;
  const max = Math.max(p.theirs.commission, best.total, floor.total, 1);
  const setKind = (i: number, kind: Kind) => setRows((rs) => rs.map((r, k) => (k === i ? { ...r, kind } : r)));
  const setNum = (i: number, f: "clicks" | "bookings" | "commission", v: string) => setRows((rs) => rs.map((r, k) => (k === i ? { ...r, [f]: Number(v) || 0 } : r)));

  if (!parsed) {
    return (
      <div className="sw-start">
        <div className={`drop${drag ? " on" : ""}`} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) void read(f); }}>
          <span className="drop-ic"><Ico of={FileSpreadsheet} size={28} /></span>
          <b>Drop your Stay22 export here</b>
          <span className="mute">The CSV from Performance (by campaign) or from Transactions.</span>
          <div className="drop-row">
            <button type="button" className="btn btn-brand" onClick={() => input.current?.click()}><Ico of={Upload} size={17} />Choose the file</button>
            <button type="button" className="btn" onClick={startManual}><Ico of={Pencil} size={17} />Type my numbers instead</button>
          </div>
          <input ref={input} type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void read(f); e.target.value = ""; }} />
          <span className="small mute drop-safe"><Ico of={LockKeyhole} size={14} />Read on your computer. Nothing is uploaded or stored.</span>
        </div>
        {err && <p className="auth-err" role="alert"><Ico of={CircleAlert} size={16} />{err}</p>}
        <ol className="how">
          <li><b>1</b><span>In Stay22, open <i>Performance</i> and pick the dates you want, for example this year.</span></li>
          <li><b>2</b><span>Press <i>Export</i>. You get a file called stats_overall.csv.</span></li>
          <li><b>3</b><span>Drop it here. We split hotels from tours and cars, and do the maths.</span></li>
        </ol>
      </div>
    );
  }

  return (
    <div className="swt">
      <div className="sw-file">
        <span><Ico of={FileSpreadsheet} size={16} />{manual ? "Your numbers" : file}{parsed.period.from ? `, ${parsed.period.from} to ${parsed.period.to}` : ""}</span>
        <button type="button" className="btn btn-sm" onClick={reset}><Ico of={RotateCcw} size={15} />Start again</button>
      </div>
      {parsed.warnings.map((w) => <p key={w} className="notice small notice-inline">{w}</p>)}

      <section className="dcard" aria-labelledby="sw-p">
        <div className="card-head"><h2 id="sw-p">{manual ? "Your Stay22 hotel results" : "What Stay22 sent you"}</h2></div>
        <p className="note" style={{ margin: "0 0 8px" }}>{manual ? "Take these from your Stay22 dashboard, for the same dates." : "Nomadly replaces your hotel links. Tours, cars and flights stay where they are. Fix a row if we sorted it wrong."}</p>
        <div className="scroll"><table className="dtable">
          <thead><tr><th>Provider</th><th>Counts as</th><th className="n">Clicks</th><th className="n">Bookings</th><th className="n">Canceled</th><th className="n">Commission</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.provider + i} className={r.kind === "other" ? "dim" : undefined}>
                <td className="bd-name">{r.provider}</td>
                <td><div className="seg mini" role="group" aria-label={`${r.provider} counts as`}><button type="button" aria-pressed={r.kind === "hotel"} onClick={() => setKind(i, "hotel")}><Ico of={Hotel} size={13} />Hotel</button><button type="button" aria-pressed={r.kind === "other"} onClick={() => setKind(i, "other")}><Ico of={Ticket} size={13} />Other</button></div></td>
                {manual ? (
                  <>
                    <td className="n"><input className="numin" inputMode="numeric" value={r.clicks || ""} placeholder="0" onChange={(e) => setNum(i, "clicks", e.target.value)} aria-label="Clicks" /></td>
                    <td className="n"><input className="numin" inputMode="numeric" value={r.bookings || ""} placeholder="0" onChange={(e) => setNum(i, "bookings", e.target.value)} aria-label="Bookings" /></td>
                    <td className="n">-</td>
                    <td className="n"><input className="numin" inputMode="decimal" value={r.commission || ""} placeholder="0.00" onChange={(e) => setNum(i, "commission", e.target.value)} aria-label="Commission in dollars" /></td>
                  </>
                ) : (
                  <><td className="n">{n0(r.clicks)}</td><td className="n">{n0(r.bookings)}</td><td className="n">{n0(r.canceled)}</td><td className="n strong">{money(r.commission)}</td></>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot><tr className="total"><td>Hotels</td><td /><td className="n">{n0(hotel.clicks)}</td><td className="n">{n0(hotel.bookings)}</td><td /><td className="n">{money(hotel.commission)}</td></tr></tfoot>
        </table></div>
        {other.length > 0 && <p className="note">Kept off this comparison: {other.map((o) => o.provider).join(", ")}, {money(other.reduce((a, o) => a + o.commission, 0))} together. Keep those links as they are.</p>}
      </section>

      <section className="dcard sw-assume" aria-labelledby="sw-a">
        <h2 id="sw-a">Check the numbers</h2>
        <div className="sw-fields">
          <label className="field"><span>Average hotel booking value, USD</span>
            <input inputMode="decimal" value={avg !== "" ? avg : String(guess)} onChange={(e) => setAvg(e.target.value.replace(/[^0-9.]/g, ""))} />
            <small className="mute">Stay22 does not show booking values. We guessed {money(guess, 0)} from your {money(p.theirs.perBooking)} per booking, as their hotel partners pay you about 4% of the stay. Change it if you know yours.</small>
          </label>
          {hotel.clicks > 0 && (
            <div className="field"><span>Bookings to compare</span>
              <div className="seg conv" role="group" aria-label="Bookings to compare">
                <button type="button" aria-pressed={conv == null} onClick={() => setConv(null)}>Same as Stay22, {pctS(theirConv)}</button>
                {[0.005, 0.01, 0.02].filter((v) => v > theirConv).map((v) => <button key={v} type="button" aria-pressed={conv === v} onClick={() => setConv(v)}>{pctS(v)} of clicks</button>)}
              </div>
              <small className="mute">{n0(hotel.clicks)} hotel clicks became {n0(hotel.bookings)} {hotel.bookings === 1 ? "booking" : "bookings"} on Stay22. Map clicks include many readers just looking. Pick a rate to see what more bookings would mean: a scenario, not a promise.</small>
            </div>
          )}
          {parsed.format === "transactions" && !manual && (
            <label className="field"><span>Hotel link clicks, same dates</span>
              <input inputMode="numeric" value={clicksOverride} placeholder="From Stay22 Performance, optional" onChange={(e) => setClicksOverride(e.target.value.replace(/[^0-9]/g, ""))} />
              <small className="mute">Only needed for earnings per click.</small>
            </label>
          )}
        </div>
      </section>

      {hotel.bookings > 0 ? (
        <section className="dcard sw-result" aria-labelledby="sw-r">
          <div className="card-head"><h2 id="sw-r">{conv == null ? `The same ${n0(hotel.bookings)} hotel ${hotel.bookings === 1 ? "booking" : "bookings"} on Nomadly` : `${n0(scenarioBookings)} hotel bookings on Nomadly, if ${pctS(conv)} of your hotel clicks book`}</h2><button type="button" className="btn btn-sm no-print" onClick={() => window.print()}><Ico of={Printer} size={15} />Print or save PDF</button></div>
          <div className="cmp">
            {[
              { k: "theirs", label: "Stay22, what you earned", total: p.theirs.commission, per: p.theirs.perBooking, epc: hotel.clicks ? p.theirs.commission / hotel.clicks : null, delta: null as number | null },
              { k: "best", label: best.label, total: best.total, per: best.perBooking, epc: hotel.clicks ? best.total / hotel.clicks : null, delta: best.vsTheirs },
              { k: "floor", label: floor.label, total: floor.total, per: floor.perBooking, epc: hotel.clicks ? floor.total / hotel.clicks : null, delta: floor.vsTheirs },
            ].map((c) => (
              <div key={c.k} className={`cmp-row cmp-${c.k}`}>
                <div className="cmp-top"><span>{c.label}</span>{c.delta != null && <b className={`delta ${c.delta >= 0 ? "up" : "down"}`}>{c.delta >= 0 ? "+" : "-"}{Math.abs(Math.round(c.delta * 100))}%</b>}</div>
                <div className="cmp-bar"><i style={{ width: `${Math.max(2, (c.total / max) * 100)}%` }} /></div>
                <div className="cmp-num"><b>{money(c.total)}</b><span>{money(c.per)} a booking{c.epc != null ? `, ${perClick(c.epc)} a click` : ""}</span></div>
              </div>
            ))}
          </div>
          <ul className="sw-why">
            <li><b>You keep {sharePct}% of what we earn on every stay.</b> On Stay22 you earn a share of the referral fee Booking.com or Expedia pays for the click.</li>
            <li><b>Readers stay on your storefront.</b> Your name, your colors, your picks; checkout, ride and eSIM in one payment, and you earn on the add ons too.</li>
            <li><b>Paid on the 15th</b> for stays completed the month before. No minimum.</li>
          </ul>
          <p className="note">{conv == null ? "Assumes the same number of bookings at the same average value." : `A scenario: ${n0(scenarioBookings)} bookings at the same average value, against what Stay22 paid you for ${n0(hotel.bookings)}.`} Your real conversion shows on Performance from the first week your links point to Nomadly. Our lowest price is what you earn on a stay where we cut our margin to beat a cheaper site.</p>
          <div className="sw-cta no-print">
            {signedIn ? <Link className="btn btn-brand" href="/dashboard/links"><Ico of={Link2} size={17} />Switch my hotel links<Ico of={ArrowRight} size={16} /></Link>
              : <Link className="btn btn-brand" href="/login"><Ico of={ArrowRight} size={17} />Get my own storefront</Link>}
            <span className="small mute">Paste an article address on Links and we swap every hotel link in it for yours.</span>
          </div>
        </section>
      ) : (
        <p className="notice small notice-inline">No hotel bookings yet in these rows. Mark a provider as Hotel, or type your numbers.</p>
      )}
    </div>
  );
}
