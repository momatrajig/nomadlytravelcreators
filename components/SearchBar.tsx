"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SearchBar({ checkIn, checkOut, adults, city }: { checkIn: string; checkOut: string; adults: number; city: string }) {
  const r = useRouter();
  const [a, setA] = useState(checkIn), [b, setB] = useState(checkOut), [n, setN] = useState(adults), [err, setErr] = useState<string | null>(null);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const nights = Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
    if (!(nights >= 1 && nights <= 30)) { setErr("Check out must be 1 to 30 nights after check in."); return; }
    setErr(null);
    r.push(`/stays?in=${a}&out=${b}&adults=${n}`);
  };
  return (
    <form className="search" onSubmit={submit} aria-label="Search stays">
      <div className="field"><label htmlFor="in">Check in, {city}</label><input id="in" type="date" value={a} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setA(e.target.value)} required /></div>
      <div className="field"><label htmlFor="out">Check out</label><input id="out" type="date" value={b} min={a} onChange={(e) => setB(e.target.value)} required /></div>
      <div className="field"><label htmlFor="ad">Guests</label><select id="ad" value={n} onChange={(e) => setN(Number(e.target.value))}>{[1, 2, 3, 4].map((k) => <option key={k} value={k}>{k} {k === 1 ? "adult" : "adults"}</option>)}</select></div>
      <button className="btn btn-brand" type="submit" style={{ alignSelf: "end" }}>See prices</button>
      {err && <p className="err small" role="alert" style={{ gridColumn: "1 / -1", color: "var(--bad)", margin: 0 }}>{err}</p>}
    </form>
  );
}
