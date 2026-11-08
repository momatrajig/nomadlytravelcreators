"use client";
import { useEffect, useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { fmtDate, usd } from "@/lib/format";

interface Props { quoteId: string; amount: number; currency: string; refundable: boolean; cancelDeadline: string | null; cancelCharge: number | null; brandName: string; stripeKey: string | null; expiresAt: string }
type Guest = { firstName: string; lastName: string; email: string; phone: string };

export default function CheckoutForm(p: Props) {
  const [guest, setGuest] = useState<Guest>({ firstName: "", lastName: "", email: "", phone: "" });
  const [promo, setPromo] = useState("");
  const [terms, setTerms] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [server, setServer] = useState<{ bookingId: string; reference: string; amount: number; clientSecret: string | null; devMode?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState<string | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => { const tick = () => setLeft(Math.max(0, Date.parse(p.expiresAt) - Date.now())); tick(); const t = setInterval(tick, 1000); return () => clearInterval(t); }, [p.expiresAt]);
  const stripePromise = useMemo(() => (p.stripeKey ? loadStripe(p.stripeKey) : null), [p.stripeKey]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (guest.firstName.trim().length < 2) e.firstName = "Enter the first name as on the passport.";
    if (guest.lastName.trim().length < 2) e.lastName = "Enter the last name.";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(guest.email)) e.email = "Enter a valid email; the voucher goes there.";
    if (!terms) e.terms = "Please confirm you have read the cancellation terms.";
    setErrs(e); return !Object.keys(e).length;
  };
  const start = async (ev: React.FormEvent) => {
    ev.preventDefault(); if (!validate()) return;
    setBusy(true); setFail(null);
    try {
      const res = await fetch("/api/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ quoteId: p.quoteId, guest: { ...guest, phone: guest.phone || undefined }, promoCode: promo || undefined, acceptedTerms: true }) });
      const j = await res.json();
      if (!res.ok) { setFail(j.message ?? "Could not start the payment."); setBusy(false); return; }
      setServer(j);
      if (j.devMode) window.location.href = `/booking/${encodeURIComponent(j.reference)}?email=${encodeURIComponent(guest.email)}&dev=1`;
    } catch { setFail("No connection. Nothing was charged."); }
    setBusy(false);
  };
  const ms = left ?? 1; const mins = Math.floor(ms / 60000), secs = Math.floor((ms % 60000) / 1000);

  return (
    <form onSubmit={start} noValidate>
      <p className="small mute" style={{ margin: "0 0 12px" }}>{left === null ? "Price held for 20 minutes." : `Price held for ${mins}:${String(secs).padStart(2, "0")} more. After that we re-check it.`}</p>
      <section className="panel" style={{ marginBottom: 14 }}>
        <h2 style={{ fontSize: 20, marginBottom: 12 }}>Who is traveling</h2>
        <div className="grid2">
          <div className="field"><label htmlFor="fn">First name</label><input id="fn" autoComplete="given-name" value={guest.firstName} onChange={(e) => setGuest({ ...guest, firstName: e.target.value })} aria-invalid={!!errs.firstName} />{errs.firstName && <span className="err">{errs.firstName}</span>}</div>
          <div className="field"><label htmlFor="ln">Last name</label><input id="ln" autoComplete="family-name" value={guest.lastName} onChange={(e) => setGuest({ ...guest, lastName: e.target.value })} aria-invalid={!!errs.lastName} />{errs.lastName && <span className="err">{errs.lastName}</span>}</div>
          <div className="field"><label htmlFor="em">Email, for the voucher</label><input id="em" type="email" autoComplete="email" value={guest.email} onChange={(e) => setGuest({ ...guest, email: e.target.value })} aria-invalid={!!errs.email} />{errs.email && <span className="err">{errs.email}</span>}</div>
          <div className="field"><label htmlFor="ph">Mobile, optional</label><input id="ph" type="tel" autoComplete="tel" value={guest.phone} onChange={(e) => setGuest({ ...guest, phone: e.target.value })} /></div>
        </div>
      </section>
      <section className="panel" style={{ marginBottom: 14 }}>
        <h2 style={{ fontSize: 20, marginBottom: 8 }}>Cancellation</h2>
        <p className="small" style={{ margin: 0, color: "var(--fg-2)" }}>{p.refundable ? `Cancel free until ${p.cancelDeadline ? fmtDate(p.cancelDeadline) : "check in"}${p.cancelCharge ? `. After that ${usd(p.cancelCharge)} is charged` : ""}. If you do not turn up, the full ${usd(p.amount, true)} is charged.` : `This rate has no refunds. The full ${usd(p.amount, true)} is kept if your plans change.`}</p>
        <label style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "flex-start" }}><input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} style={{ marginTop: 4 }} /> <span>I have read the cancellation terms.</span></label>
        {errs.terms && <p className="err small" style={{ color: "var(--bad)", margin: "6px 0 0" }}>{errs.terms}</p>}
        <div className="field" style={{ marginTop: 12, maxWidth: 260 }}><label htmlFor="pc">Promotion code, optional</label><input id="pc" value={promo} onChange={(e) => setPromo(e.target.value.toUpperCase())} placeholder="Enter code" /></div>
      </section>
      {fail && <div className="notice bad" role="alert" style={{ marginBottom: 12 }}>{fail}</div>}
      {!server ? (
        <>
          <p className="small" style={{ color: "var(--fg-2)" }}>You pay Nomadly today and Nomadly pays the hotel. Your card statement will show NOMADLY*{p.brandName.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 12)}. City tax is paid at the hotel, not now.</p>
          <button className="btn btn-brand btn-lg" type="submit" style={{ width: "100%" }} disabled={busy || ms === 0} aria-disabled={busy || ms === 0}>{busy ? "One moment…" : `Continue to payment, ${usd(p.amount)}`}</button>
        </>
      ) : server.clientSecret && stripePromise ? (
        <Elements stripe={stripePromise} options={{ clientSecret: server.clientSecret, appearance: { theme: "night", variables: { colorPrimary: "var(--brand)" } } }}>
          <PayStep amount={server.amount} currency={p.currency} reference={server.reference} email={guest.email} />
        </Elements>
      ) : <div className="notice">Payment is not configured in this environment.</div>}
    </form>
  );
}

function PayStep({ amount, currency, reference, email }: { amount: number; currency: string; reference: string; email: string }) {
  const stripe = useStripe(), elements = useElements();
  const [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null);
  const pay = async () => {
    if (!stripe || !elements) return;
    setBusy(true); setErr(null);
    const r = await stripe.confirmPayment({ elements, confirmParams: { return_url: `${window.location.origin}/booking/${encodeURIComponent(reference)}?email=${encodeURIComponent(email)}` } });
    if (r.error) { setErr(r.error.message ?? "The card was declined. Nothing was charged."); setBusy(false); }
  };
  return (
    <section className="panel">
      <h2 style={{ fontSize: 20, marginBottom: 12 }}>Payment</h2>
      <PaymentElement options={{ layout: "tabs" }} />
      {err && <div className="notice bad" role="alert" style={{ marginTop: 12 }}>{err}</div>}
      <button className="btn btn-brand btn-lg" type="button" onClick={pay} disabled={busy || !stripe} style={{ width: "100%", marginTop: 14 }}>{busy ? "Charging…" : `Pay ${usd(amount, false, currency)} and confirm`}</button>
    </section>
  );
}
