"use client";
import { useEffect, useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { approxOf, dict, fmtDay, money, price, type ReaderFmt } from "@/lib/i18n";
import { EXTRAS, type ExtraKind } from "@/lib/extras/catalog";

interface Props { quoteId: string; amount: number; currency: string; refundable: boolean; cancelDeadline: string | null; cancelCharge: number | null; brandName: string; stripeKey: string | null; expiresAt: string; f: ReaderFmt }
type Guest = { firstName: string; lastName: string; email: string; phone: string };

export default function CheckoutForm(p: Props) {
  const t = dict(p.f.lang);
  const P = (v: number, whole = true) => price(p.f, v, whole);
  const [guest, setGuest] = useState<Guest>({ firstName: "", lastName: "", email: "", phone: "" });
  const [promo, setPromo] = useState("");
  const [terms, setTerms] = useState(false);
  const [extras, setExtras] = useState<ExtraKind[]>([]);
  const extrasTotal = EXTRAS.filter((x) => extras.includes(x.kind)).reduce((a, x) => a + x.price, 0);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [server, setServer] = useState<{ bookingId: string; reference: string; amount: number; clientSecret: string | null; devMode?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState<string | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => { const tick = () => setLeft(Math.max(0, Date.parse(p.expiresAt) - Date.now())); tick(); const t = setInterval(tick, 1000); return () => clearInterval(t); }, [p.expiresAt]);
  const stripePromise = useMemo(() => (p.stripeKey ? loadStripe(p.stripeKey) : null), [p.stripeKey]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (guest.firstName.trim().length < 2) e.firstName = t.errFirst;
    if (guest.lastName.trim().length < 2) e.lastName = t.errLast;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(guest.email)) e.email = t.errEmail;
    if (!terms) e.terms = t.errTerms;
    setErrs(e); return !Object.keys(e).length;
  };
  const start = async (ev: React.FormEvent) => {
    ev.preventDefault(); if (!validate()) return;
    setBusy(true); setFail(null);
    try {
      const res = await fetch("/api/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ quoteId: p.quoteId, guest: { ...guest, phone: guest.phone || undefined }, promoCode: promo || undefined, acceptedTerms: true, extras }) });
      const j = await res.json();
      if (!res.ok) { setFail(j.message ?? t.couldNotStart); setBusy(false); return; }
      setServer(j);
      if (j.devMode) window.location.assign(`/booking/${encodeURIComponent(j.reference)}?email=${encodeURIComponent(guest.email)}&dev=1`);
    } catch { setFail(t.noConnNothing); }
    setBusy(false);
  };
  const ms = left ?? 1; const mins = Math.floor(ms / 60000), secs = Math.floor((ms % 60000) / 1000);

  return (
    <form onSubmit={start} noValidate>
      <p className="small mute" style={{ margin: "0 0 12px" }}>{left === null ? t.heldFor : t.heldLeft(`${mins}:${String(secs).padStart(2, "0")}`)}</p>
      <section className="panel" style={{ marginBottom: 14 }}>
        <h2 style={{ fontSize: 20, marginBottom: 12 }}>{t.whoTravels}</h2>
        <div className="grid2">
          <div className="field"><label htmlFor="fn">{t.firstName}</label><input id="fn" autoComplete="given-name" value={guest.firstName} onChange={(e) => setGuest({ ...guest, firstName: e.target.value })} aria-invalid={!!errs.firstName} />{errs.firstName && <span className="err">{errs.firstName}</span>}</div>
          <div className="field"><label htmlFor="ln">{t.lastName}</label><input id="ln" autoComplete="family-name" value={guest.lastName} onChange={(e) => setGuest({ ...guest, lastName: e.target.value })} aria-invalid={!!errs.lastName} />{errs.lastName && <span className="err">{errs.lastName}</span>}</div>
          <div className="field"><label htmlFor="em">{t.emailVoucher}</label><input id="em" type="email" autoComplete="email" value={guest.email} onChange={(e) => setGuest({ ...guest, email: e.target.value })} aria-invalid={!!errs.email} />{errs.email && <span className="err">{errs.email}</span>}</div>
          <div className="field"><label htmlFor="ph">{t.mobileOpt}</label><input id="ph" type="tel" autoComplete="tel" value={guest.phone} onChange={(e) => setGuest({ ...guest, phone: e.target.value })} /></div>
        </div>
      </section>
      <section className="panel" style={{ marginBottom: 14 }}>
        <h2 style={{ fontSize: 20, marginBottom: 4 }}>{t.addTrip}</h2>
        <p className="small mute" style={{ margin: "0 0 10px" }}>{t.addTripSub}</p>
        <div style={{ display: "grid", gap: 8 }}>
          {EXTRAS.map((x) => (
            <label key={x.kind} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 12, alignItems: "start", padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 12, background: extras.includes(x.kind) ? "var(--brand-soft)" : "var(--surface)" }}>
              <input type="checkbox" checked={extras.includes(x.kind)} onChange={(e) => setExtras(e.target.checked ? [...extras, x.kind] : extras.filter((k) => k !== x.kind))} style={{ marginTop: 4 }} />
              <span><b>{t.extras?.[x.kind]?.name ?? x.name}</b><br /><span className="small" style={{ color: "var(--fg-2)" }}>{t.extras?.[x.kind]?.short ?? x.short}</span></span>
              <span style={{ textAlign: "right" }}><b>{P(x.price)}</b><br /><span className="small mute" style={{ textDecoration: "line-through" }}>{P(x.elsewhere)}</span></span>
            </label>
          ))}
        </div>
      </section>
      <section className="panel" style={{ marginBottom: 14 }}>
        <h2 style={{ fontSize: 20, marginBottom: 8 }}>{t.cancellation}</h2>
        <p className="small" style={{ margin: 0, color: "var(--fg-2)" }}>{p.refundable ? t.cancelTerms(p.cancelDeadline ? fmtDay(p.cancelDeadline, p.f.lang) : t.checkInWord, p.cancelCharge ? P(p.cancelCharge, false) : null, P(p.amount)) : t.noRefundTerms(P(p.amount))}</p>
        <label style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "flex-start" }}><input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} style={{ marginTop: 4 }} /> <span>{t.readTerms}</span></label>
        {errs.terms && <p className="err small" style={{ color: "var(--bad)", margin: "6px 0 0" }}>{errs.terms}</p>}
        <div className="field" style={{ marginTop: 12, maxWidth: 260 }}><label htmlFor="pc">{t.promo}</label><input id="pc" value={promo} onChange={(e) => setPromo(e.target.value.toUpperCase())} placeholder={t.promoPh} /></div>
      </section>
      {fail && <div className="notice bad" role="alert" style={{ marginBottom: 12 }}>{fail}</div>}
      {!server ? (
        <>
          <p className="small" style={{ color: "var(--fg-2)" }}>{t.payNote(p.brandName.normalize("NFD").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 12))}{p.f.disp ? ` ${t.chargedIn(p.currency)}` : ""}</p>
          <button className="btn btn-brand btn-lg" type="submit" style={{ width: "100%" }} disabled={busy || ms === 0} aria-disabled={busy || ms === 0}>{busy ? t.oneMoment : t.continuePay(`${P(p.amount + extrasTotal, false)}${approxOf(p.f, p.amount + extrasTotal) ? ` (${approxOf(p.f, p.amount + extrasTotal)})` : ""}`)}</button>
        </>
      ) : server.clientSecret && stripePromise ? (
        <Elements stripe={stripePromise} options={{ clientSecret: server.clientSecret, appearance: { theme: "night", variables: { colorPrimary: "var(--brand)" } } }}>
          <PayStep amount={server.amount} currency={p.currency} reference={server.reference} email={guest.email} f={p.f} />
        </Elements>
      ) : <div className="notice">{t.noPayConfig}</div>}
    </form>
  );
}

function PayStep({ amount, currency, reference, email, f }: { amount: number; currency: string; reference: string; email: string; f: ReaderFmt }) {
  const t = dict(f.lang);
  const stripe = useStripe(), elements = useElements();
  const [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null);
  const pay = async () => {
    if (!stripe || !elements) return;
    setBusy(true); setErr(null);
    const r = await stripe.confirmPayment({ elements, confirmParams: { return_url: `${window.location.origin}/booking/${encodeURIComponent(reference)}?email=${encodeURIComponent(email)}` } });
    if (r.error) { setErr(r.error.message ?? t.declined); setBusy(false); }
  };
  return (
    <section className="panel">
      <h2 style={{ fontSize: 20, marginBottom: 12 }}>{t.payment}</h2>
      <PaymentElement options={{ layout: "tabs" }} />
      {err && <div className="notice bad" role="alert" style={{ marginTop: 12 }}>{err}</div>}
      <button className="btn btn-brand btn-lg" type="button" onClick={pay} disabled={busy || !stripe} style={{ width: "100%", marginTop: 14 }}>{busy ? t.charging : t.payConfirm(money(amount, { lang: f.lang, currency }))}</button>
    </section>
  );
}
