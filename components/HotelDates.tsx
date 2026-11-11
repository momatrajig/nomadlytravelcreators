"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import DateRange from "@/components/DateRange";
import { dict, type Lang } from "@/lib/i18n";

/** Change dates and guests without leaving the hotel: the calendar shows this hotel's own price for each night. */
export default function HotelDates({ ebcId, checkIn, checkOut, adults, lang, currency }: { ebcId: number; checkIn: string; checkOut: string; adults: number; lang: Lang; currency: string }) {
  const t = dict(lang);
  const r = useRouter();
  const [n, setN] = useState(adults);
  const [busy, setBusy] = useState(false);
  const go = (a: string, b: string, k: number) => { setBusy(true); r.push(`/hotel/${ebcId}?in=${a}&out=${b}&adults=${k}#rooms`, { scroll: false }); };
  return (
    <div className="hotel-dates">
      <DateRange key={`${ebcId}:${n}`} lang={lang} currency={currency} checkIn={checkIn} checkOut={checkOut} adults={n} hotel={ebcId} onChange={(a, b) => go(a, b, n)} />
      <select aria-label={t.guests} value={n} onChange={(e) => { const k = Number(e.target.value); setN(k); go(checkIn, checkOut, k); }}>{[1, 2, 3, 4].map((k) => <option key={k} value={k}>{t.adultsN(k)}</option>)}</select>
      {busy && <span className="small mute" role="status">{t.searching}</span>}
    </div>
  );
}
