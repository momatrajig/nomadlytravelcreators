"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BOARD, fmtDate, usd } from "@/lib/format";

export interface RateView { packageCode: string; roomName: string; board: string; refundable: boolean; onRequest: boolean; cancelDeadline: string | null; cancelCharge: number | null; readerPrice: number }

/** Rates for one hotel. "Book this rate" prebooks on the server and moves to checkout with a quote id. */
export default function RateList({ ebcId, rates, nights, checkIn, checkOut, adults }: { ebcId: number; rates: RateView[]; nights: number; checkIn: string; checkOut: string; adults: number }) {
  const r = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const book = async (packageCode: string) => {
    setBusy(packageCode); setErr(null);
    try {
      const res = await fetch("/api/quote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ebcId, packageCode, checkIn, checkOut, adults, childrenAges: [] }) });
      const j = await res.json();
      if (!res.ok) { setErr(j.message ?? "Could not hold this rate."); setBusy(null); if (j.error === "PRICE_CHANGED" || j.error === "NO_AVAILABILITY") setTimeout(() => r.refresh(), 800); return; }
      r.push(`/checkout?q=${j.quote.id}`);
    } catch { setErr("No connection. Check your network and try again."); setBusy(null); }
  };
  return (
    <div>
      {err && <div className="notice bad" role="alert" style={{ marginTop: 12 }}>{err}</div>}
      {rates.map((rt) => (
        <div className="rate" key={rt.packageCode}>
          <div>
            <h3 style={{ fontSize: 19 }}>{rt.roomName} {rt.refundable ? <span className="chip chip-ok">Free cancellation</span> : <span className="chip chip-bad">No refunds</span>}</h3>
            <p className="small" style={{ margin: "6px 0 0", color: "var(--fg-2)" }}>{rt.refundable ? (rt.cancelDeadline ? `Cancel free until ${fmtDate(rt.cancelDeadline)}${rt.cancelCharge ? `, then ${usd(rt.cancelCharge)} is charged` : ""}.` : "Free cancellation.") : `No refund or change after booking. The full ${usd(rt.readerPrice, true)} is kept if plans change.`}</p>
            <p className="small" style={{ margin: "4px 0 0", color: "var(--fg-2)" }}>{BOARD[rt.board] ?? rt.board}.{rt.onRequest ? " The hotel confirms within a few hours; nothing is charged until it does." : ""}</p>
          </div>
          <div className="side">
            <div className="price">{usd(rt.readerPrice, true)}</div>
            <div className="small mute">for {nights} {nights === 1 ? "night" : "nights"}, tax included</div>
            <button className="btn btn-brand" type="button" onClick={() => book(rt.packageCode)} aria-disabled={busy !== null} disabled={busy !== null}>{busy === rt.packageCode ? "Holding this rate…" : "Book this rate"}</button>
          </div>
        </div>
      ))}
    </div>
  );
}
