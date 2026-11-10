"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { dict, money, type Lang } from "@/lib/i18n";

export default function CancelButton({ bookingId, email, penalty, refund, lang = "en", currency = "USD" }: { bookingId: string; email: string; penalty: number; refund: number; lang?: Lang; currency?: string }) {
  const t = dict(lang);
  const usd = (v: number) => money(v, { lang, currency });
  const r = useRouter();
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null);
  const go = async () => {
    setBusy(true); setErr(null);
    const res = await fetch("/api/booking/cancel", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ bookingId, email }) });
    const j = await res.json();
    if (!res.ok) { setErr(j.message ?? t.couldNotCancel); setBusy(false); return; }
    r.refresh(); setOpen(false); setBusy(false);
  };
  if (!open) return <button type="button" className="btn" onClick={() => setOpen(true)}>{t.cancelThis}</button>;
  return (
    <div className="notice warn" role="alertdialog" aria-label="Confirm cancellation" style={{ width: "100%", display: "grid", gap: 10 }}>
      <span>{penalty === 0 ? t.cancelFull(usd(refund)) : t.cancelCost(usd(penalty), usd(refund))}{t.cannotUndo}</span>
      {err && <span style={{ color: "var(--bad)" }}>{err}</span>}
      <div style={{ display: "flex", gap: 8 }}><button type="button" className="btn btn-brand" onClick={go} disabled={busy}>{busy ? t.canceling : t.yesCancel}</button><button type="button" className="btn" onClick={() => setOpen(false)}>{t.keepIt}</button></div>
    </div>
  );
}
