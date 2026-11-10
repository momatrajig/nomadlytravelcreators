"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { approxOf, dict, fmtDay, price, type ReaderFmt } from "@/lib/i18n";

export interface RateView { packageCode: string; roomName: string; board: string; refundable: boolean; onRequest: boolean; cancelDeadline: string | null; cancelCharge: number | null; readerPrice: number }

/** Rates for one hotel. "Book this rate" prebooks on the server and moves to checkout with a quote id. */
export default function RateList({ ebcId, rates, nights, checkIn, checkOut, adults, f }: { ebcId: number; rates: RateView[]; nights: number; checkIn: string; checkOut: string; adults: number; f: ReaderFmt }) {
  const t = dict(f.lang);
  const p$ = (v: number, whole = true) => price(f, v, whole);
  const r = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const book = async (packageCode: string) => {
    setBusy(packageCode); setErr(null);
    try {
      const res = await fetch("/api/quote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ebcId, packageCode, checkIn, checkOut, adults, childrenAges: [] }) });
      const j = await res.json();
      if (!res.ok) { setErr(j.message ?? t.couldNotHold); setBusy(null); if (j.error === "PRICE_CHANGED" || j.error === "NO_AVAILABILITY") setTimeout(() => r.refresh(), 800); return; }
      r.push(`/checkout?q=${j.quote.id}`);
    } catch { setErr(t.noConnection); setBusy(null); }
  };
  return (
    <div>
      {err && <div className="notice bad" role="alert" style={{ marginTop: 12 }}>{err}</div>}
      {rates.map((rt) => (
        <div className="rate" key={rt.packageCode}>
          <div>
            <h3 style={{ fontSize: 19 }}>{rt.roomName} {rt.refundable ? <span className="chip chip-ok">{t.freeCancel}</span> : <span className="chip chip-bad">{t.noRefunds}</span>}</h3>
            <p className="small" style={{ margin: "6px 0 0", color: "var(--fg-2)" }}>{rt.refundable ? (rt.cancelDeadline ? t.cancelFreeUntil(fmtDay(rt.cancelDeadline, f.lang), rt.cancelCharge ? p$(rt.cancelCharge, false) : null) : t.refundableNoDate) : t.noRefundKept(p$(rt.readerPrice))}</p>
            <p className="small" style={{ margin: "4px 0 0", color: "var(--fg-2)" }}>{t.board[rt.board] ?? rt.board}.{rt.onRequest ? t.onRequest : ""}</p>
          </div>
          <div className="side">
            <div className="price">{p$(rt.readerPrice)}</div>{approxOf(f, rt.readerPrice) && <div className="small mute">{approxOf(f, rt.readerPrice)}</div>}
            <div className="small mute">{t.forNights(nights)}</div>
            <button className="btn btn-brand" type="button" onClick={() => book(rt.packageCode)} aria-disabled={busy !== null} disabled={busy !== null}>{busy === rt.packageCode ? t.holding : t.bookRate}</button>
          </div>
        </div>
      ))}
    </div>
  );
}
