"use client";
import { LoaderCircle, Search } from "lucide-react";
import { Ico, To } from "@/components/Icon";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { dict, fmtDay, type Lang } from "@/lib/i18n";
import DateRange from "@/components/DateRange";

export interface SearchDest { slug: string; name: string }

/** Where, when, who. Validates dates in place; the server re-validates. */
/** compact: on phones, results pages show a one line summary that opens the full form (Booking.com style). */
export default function SearchBar({ checkIn, checkOut, adults, dest = "", destinations, lang = "en", compact = false }: { checkIn: string; checkOut: string; adults: number; dest?: string; destinations: SearchDest[]; lang?: Lang; compact?: boolean }) {
  const t = dict(lang);
  const r = useRouter();
  const [d, setD] = useState(dest), [a, setA] = useState(checkIn), [b, setB] = useState(checkOut), [n, setN] = useState(adults), [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const nights = Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
    if (!(nights >= 1 && nights <= 30)) { setErr(t.nightsRange); return; }
    setErr(null); setBusy(true);
    r.push(`/stays?${d ? `d=${d}&` : ""}in=${a}&out=${b}&adults=${n}`);
  };
  const place = destinations.find((x) => x.slug === dest)?.name ?? t.anywhere;
  return (
    <>
    {compact && !open && (
      <button type="button" className="search-sum" onClick={() => setOpen(true)} aria-expanded={false}>
        <Ico of={Search} size={18} />
        <span><b>{place}</b><small>{fmtDay(checkIn, lang)} <To /> {fmtDay(checkOut, lang)} · {t.adultsN(adults)}</small></span>
        <em>{t.edit}</em>
      </button>
    )}
    <form className={`search${compact && !open ? " collapsed" : ""}`} onSubmit={submit} aria-label="Search stays">
      <div className="field f-where"><label htmlFor="s-d">{t.where}</label>
        <select id="s-d" value={d} onChange={(e) => setD(e.target.value)}>
          <option value="">{t.anywhere}</option>
          {destinations.map((x) => <option key={x.slug} value={x.slug}>{x.name}</option>)}
        </select></div>
      <div className="field f-dates"><span className="lbl-like">{t.checkIn} / {t.checkOut}</span>
        <DateRange key={`${d}:${n}`} lang={lang} checkIn={a} checkOut={b} adults={n} dest={d || undefined} onChange={(x, y) => { setA(x); setB(y); setErr(null); }} />
      </div>
      <div className="field f-guests"><label htmlFor="s-ad">{t.guests}</label><select id="s-ad" value={n} onChange={(e) => setN(Number(e.target.value))}>{[1, 2, 3, 4].map((k) => <option key={k} value={k}>{t.adultsN(k)}</option>)}</select></div>
      <button className="btn btn-brand" type="submit" disabled={busy}>{busy ? <Ico of={LoaderCircle} size={17} className="spin" /> : <Ico of={Search} size={17} />}{busy ? t.searching : t.seePrices}</button>
      {err && <p className="search-err" role="alert">{err}</p>}
    </form>
    </>
  );
}
