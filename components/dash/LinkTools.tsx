"use client";
import { useMemo, useState } from "react";
import { Check, Copy as CopyIc } from "lucide-react";
import { Ico } from "@/components/Icon";

interface Opt { value: string; label: string }

/** Copies a link; the icon turns into a check and the label says so, for screen readers too. */
export function Copy({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className={`btn copy-btn${done ? " done" : ""}`} onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* clipboard blocked: the link is selectable */ } }}>
      <Ico of={done ? Check : CopyIc} size={16} /><span aria-live="polite">{done ? "Copied" : "Copy"}</span>
    </button>
  );
}

/** Build one link: a hotel, a destination or the home page, with the source (article) it sits in. */
export function LinkBuilder({ base, hotels, places }: { base: string; hotels: Opt[]; places: Opt[] }) {
  const [kind, setKind] = useState<"hotel" | "city" | "home">(hotels.length ? "hotel" : "home");
  const [hotel, setHotel] = useState(hotels[0]?.value ?? "");
  const [city, setCity] = useState(places[0]?.value ?? "");
  const [src, setSrc] = useState("");
  const [a, setA] = useState(""), [b, setB] = useState("");
  const link = useMemo(() => {
    const p = new URLSearchParams();
    if (kind === "hotel" && hotel) p.set("hotel", hotel);
    if (kind === "city" && city) p.set("city", city);
    const s = src.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
    if (s) p.set("src", s);
    if (a && b && b > a) { p.set("in", a); p.set("out", b); }
    return `${base}${p.size ? `?${p}` : ""}`;
  }, [base, kind, hotel, city, src, a, b]);
  return (
    <div className="dform">
      <div className="grid2">
        <div className="field"><label htmlFor="lk">Link to</label>
          <select id="lk" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            {hotels.length > 0 && <option value="hotel">A hotel</option>}
            {places.length > 0 && <option value="city">A destination</option>}
            <option value="home">The storefront home page</option>
          </select></div>
        {kind === "hotel" && <div className="field"><label htmlFor="lh">Hotel</label><select id="lh" value={hotel} onChange={(e) => setHotel(e.target.value)}>{hotels.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}</select></div>}
        {kind === "city" && <div className="field"><label htmlFor="lc">Destination</label><select id="lc" value={city} onChange={(e) => setCity(e.target.value)}>{places.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}</select></div>}
      </div>
      <div className="grid2">
        <div className="field"><label htmlFor="ls">Source, the article or post this link sits in</label><input id="ls" value={src} onChange={(e) => setSrc(e.target.value)} placeholder="pariz-obvody-kde-bydlet" /></div>
        <div className="grid2">
          <div className="field"><label htmlFor="la">Dates, optional</label><input id="la" type="date" value={a} onChange={(e) => setA(e.target.value)} /></div>
          <div className="field"><label htmlFor="lb">&nbsp;</label><input id="lb" type="date" value={b} onChange={(e) => setB(e.target.value)} aria-label="Check out" /></div>
        </div>
      </div>
      <div className="linkrow"><code className="code">{link}</code><Copy text={link} /></div>
      <p className="small mute" style={{ margin: 0 }}>Without dates the reader lands on the next available dates four weeks out and can change them.</p>
    </div>
  );
}

interface Row { from: string; kind: "hotel" | "search" | "skip"; name: string | null; place: string | null; source: string | null; ebcId: number | null; matched: string | null; to: string | null; note: string | null }

/** Paste your current links, or an article's address: get a Nomadly link for each hotel link in it. */
export function Converter({ disabled }: { disabled: boolean }) {
  const [text, setText] = useState(""), [place, setPlace] = useState(""), [source, setSource] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null), [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null);
  const run = async () => {
    setBusy(true); setErr(null); setRows(null);
    try {
      const r = await fetch("/api/dashboard/convert", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, place: place || undefined, source: source || undefined }) });
      const j = await r.json();
      if (!r.ok) setErr(j.message ?? "Could not convert."); else setRows(j.rows);
    } catch { setErr("No connection. Try again."); }
    setBusy(false);
  };
  const ok = rows?.filter((r) => r.to) ?? [];
  return (
    <div className="dform">
      <div className="field"><label htmlFor="cv">Your current hotel links, one per line, or the address of an article</label>
        <textarea id="cv" value={text} onChange={(e) => setText(e.target.value)} placeholder={"https://loudavymkrokem.cz/pariz-obvody-kde-bydlet/\nor the hotel links themselves"} /></div>
      <div className="grid2">
        <div className="field"><label htmlFor="cp">Place, if the links do not name one</label><input id="cp" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Paris" /></div>
        <div className="field"><label htmlFor="cs">Source name, optional (else the article&apos;s address)</label><input id="cs" value={source} onChange={(e) => setSource(e.target.value)} /></div>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn btn-brand" type="button" onClick={run} disabled={busy || disabled || !text.trim()}>{busy ? "Finding the hotels…" : "Convert"}</button>
        {busy && <span className="small mute">The first time a city is used we read its whole hotel list; that takes up to a minute.</span>}
        {disabled && <span className="small mute">Sign in to convert links for your storefront.</span>}
      </div>
      {err && <div className="notice bad" role="alert">{err}</div>}
      {rows && (
        <div className="scroll"><table className="dtable">
          <thead><tr><th>Your link</th><th>Found</th><th>Nomadly link</th></tr></thead>
          <tbody>{rows.map((r, i) => (
            <tr key={i}>
              <td className="small" style={{ maxWidth: 260, wordBreak: "break-all" }}>{r.name ? <b>{r.name}</b> : null}{r.name ? <br /> : null}<span className="mute">{r.from.length > 90 ? `${r.from.slice(0, 90)}…` : r.from}</span></td>
              <td className="small">{r.matched ? <span className="ok-t">{r.matched}</span> : <span className="bad-t">{r.note}</span>}{r.matched && r.note ? <div className="mute">{r.note}</div> : null}</td>
              <td>{r.to ? <div className="linkrow"><code className="code">{r.to}</code><Copy text={r.to} /></div> : null}</td>
            </tr>
          ))}</tbody>
        </table>
        {ok.length > 1 && <div style={{ marginTop: 10 }}><Copy text={ok.map((r) => `${r.name ?? r.matched}\t${r.to}`).join("\n")} /> <span className="small mute">all {ok.length} links, one per line with the hotel name</span></div>}
        </div>
      )}
    </div>
  );
}
