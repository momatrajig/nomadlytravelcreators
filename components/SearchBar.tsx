"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export interface SearchDest { slug: string; name: string }

/** Where, when, who. Validates dates in place; the server re-validates. */
export default function SearchBar({ checkIn, checkOut, adults, dest = "", destinations }: { checkIn: string; checkOut: string; adults: number; dest?: string; destinations: SearchDest[] }) {
  const r = useRouter();
  const [d, setD] = useState(dest), [a, setA] = useState(checkIn), [b, setB] = useState(checkOut), [n, setN] = useState(adults), [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const nights = Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
    if (!(nights >= 1 && nights <= 30)) { setErr("Check out has to be 1 to 30 nights after check in."); return; }
    setErr(null); setBusy(true);
    r.push(`/stays?${d ? `d=${d}&` : ""}in=${a}&out=${b}&adults=${n}`);
  };
  return (
    <form className="search" onSubmit={submit} aria-label="Search stays">
      <div className="field f-where"><label htmlFor="s-d">Where</label>
        <select id="s-d" value={d} onChange={(e) => setD(e.target.value)}>
          <option value="">Anywhere I stayed</option>
          {destinations.map((x) => <option key={x.slug} value={x.slug}>{x.name}</option>)}
        </select></div>
      <div className="field"><label htmlFor="s-in">Check in</label><input id="s-in" type="date" value={a} min={new Date().toISOString().slice(0, 10)} onChange={(e) => { setA(e.target.value); if (e.target.value >= b) { const t = new Date(e.target.value); t.setDate(t.getDate() + 2); setB(t.toISOString().slice(0, 10)); } }} required /></div>
      <div className="field"><label htmlFor="s-out">Check out</label><input id="s-out" type="date" value={b} min={a} onChange={(e) => setB(e.target.value)} required /></div>
      <div className="field f-guests"><label htmlFor="s-ad">Guests</label><select id="s-ad" value={n} onChange={(e) => setN(Number(e.target.value))}>{[1, 2, 3, 4].map((k) => <option key={k} value={k}>{k} {k === 1 ? "adult" : "adults"}</option>)}</select></div>
      <button className="btn btn-brand" type="submit" disabled={busy}>{busy ? "Searching" : "See prices"}</button>
      {err && <p className="search-err" role="alert">{err}</p>}
    </form>
  );
}
