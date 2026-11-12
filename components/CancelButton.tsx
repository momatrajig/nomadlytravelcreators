"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { dict, money, type Lang } from "@/lib/i18n";

const R = {
  en: { h: "Review cancellation", fee: "Cancellation fee", refund: "Estimated refund", addons: "Add-ons", addonsV: "Refunded in full", when: "Refund timing", whenV: "5 to 10 working days, to the card you paid with", demo: "Demo booking: nothing was charged, so nothing moves." },
  cs: { h: "Kontrola zrušení", fee: "Storno poplatek", refund: "Odhad vrácené částky", addons: "Doplňky", addonsV: "Vracíme v plné výši", when: "Kdy přijde", whenV: "Za 5 až 10 pracovních dní na kartu, kterou jste platili", demo: "Ukázková rezervace: nic se nestrhlo, takže se nic nevrací." },
};

/**
 * Cancelling is a two step decision: "Review cancellation" opens the numbers (fee, refund, add-ons, timing) and only
 * then the destructive button. Fee and refund are kept visually apart so nobody reads one as the other.
 */
export default function CancelButton({ bookingId, email, penalty, refund, demo = false, lang = "en", currency = "USD" }: { bookingId: string; email: string; penalty: number; refund: number; demo?: boolean; lang?: Lang; currency?: string }) {
  const t = dict(lang);
  const L = R[lang] ?? R.en;
  const usd = (v: number) => money(v, { lang, currency });
  const r = useRouter();
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null), opener = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (open) box.current?.focus(); }, [open]);
  const close = () => { setOpen(false); setTimeout(() => opener.current?.focus(), 0); };
  const go = async () => {
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/booking/cancel", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ bookingId, email }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(j.message ?? t.couldNotCancel); setBusy(false); return; }
      r.refresh(); setOpen(false); setBusy(false);
    } catch { setErr(t.couldNotCancel); setBusy(false); }
  };
  if (!open) return <button ref={opener} type="button" className="btn btn-danger-ghost" onClick={() => setOpen(true)}>{t.cancelThis}</button>;
  return (
    <div ref={box} tabIndex={-1} className="cx-review" role="region" aria-labelledby="cx-h" onKeyDown={(e) => e.key === "Escape" && close()}>
      <h3 id="cx-h">{L.h}</h3>
      <dl>
        <div className="cx-fee"><dt>{L.fee}</dt><dd className="num">{usd(penalty)}</dd></div>
        <div className="cx-ref"><dt>{L.refund}</dt><dd className="num">{usd(refund)}</dd></div>
        <div><dt>{L.addons}</dt><dd>{L.addonsV}</dd></div>
        <div><dt>{L.when}</dt><dd>{demo ? L.demo : L.whenV}</dd></div>
      </dl>
      <p className="small">{(penalty === 0 ? t.cancelFull(usd(refund)) : t.cancelCost(usd(penalty), usd(refund))) + t.cannotUndo}</p>
      {err && <p className="small" role="alert" style={{ color: "var(--bad)", margin: 0 }}>{err}</p>}
      <div className="cx-actions">
        <button type="button" className="btn btn-danger" onClick={go} disabled={busy}>{busy ? t.canceling : t.yesCancel}</button>
        <button type="button" className="btn" onClick={close}>{t.keepIt}</button>
      </div>
    </div>
  );
}
