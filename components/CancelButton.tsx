"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { usd } from "@/lib/format";

export default function CancelButton({ bookingId, email, penalty, refund }: { bookingId: string; email: string; penalty: number; refund: number }) {
  const r = useRouter();
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null);
  const go = async () => {
    setBusy(true); setErr(null);
    const res = await fetch("/api/booking/cancel", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ bookingId, email }) });
    const j = await res.json();
    if (!res.ok) { setErr(j.message ?? "Could not cancel."); setBusy(false); return; }
    r.refresh(); setOpen(false); setBusy(false);
  };
  if (!open) return <button type="button" className="btn" onClick={() => setOpen(true)}>Cancel this booking</button>;
  return (
    <div className="notice warn" role="alertdialog" aria-label="Confirm cancellation" style={{ width: "100%", display: "grid", gap: 10 }}>
      <span>{penalty === 0 ? <>Cancel now and the full <b>{usd(refund)}</b> goes back to your card.</> : <>Canceling now costs <b>{usd(penalty)}</b>; <b>{usd(refund)}</b> goes back to your card.</>} This cannot be undone.</span>
      {err && <span style={{ color: "var(--bad)" }}>{err}</span>}
      <div style={{ display: "flex", gap: 8 }}><button type="button" className="btn btn-brand" onClick={go} disabled={busy}>{busy ? "Canceling…" : "Yes, cancel it"}</button><button type="button" className="btn" onClick={() => setOpen(false)}>Keep my booking</button></div>
    </div>
  );
}
