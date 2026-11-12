"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { loadStripe, type Appearance } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { approxOf, dict, fmtDay, money, price, type ReaderFmt } from "@/lib/i18n";
import { coDict, countryList, DIAL, type Co } from "@/lib/i18n/checkout";
import { priceExtra, type ExtraPick } from "@/lib/extras/catalog";
import AddOns from "@/components/checkout/AddOns";
import { freeNow } from "@/lib/booking/policy";
import { photoSrc } from "@/lib/media/photo";

export interface CheckoutHotel { name: string; stars: number | null; address: string | null; photo: { url: string; w?: number } | null; roomName: string | null; board: string | null }
interface Props {
  quoteId: string; amount: number; currency: string; refundable: boolean; cancelDeadline: string | null; cancelCharge: number | null;
  brandName: string; brandColor: string; stripeKey: string | null; expiresAt: string; f: ReaderFmt;
  hotel: CheckoutHotel; checkIn: string; checkOut: string; nights: number; adults: number; destination: string | null; country: string | null;
  lowestReference: number | null; lowestSource: string | null;
  /** struck through add on comparisons: checked prices, or labelled samples in the demo */
  compare: boolean;
  /** demo environment: test cards, nothing charged, no room held */
  demo?: boolean;
}
type Person = { firstName: string; lastName: string };
const REQUESTS = ["early_checkin", "late_checkout", "quiet", "high_floor", "twin", "double", "cot", "accessible"];
const HOURS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`);

/**
 * Checkout, the way the big booking sites do it: your selection, your details (who is staying, how to reach
 * them, what to ask the hotel, what to add to the trip), then payment on the page through Stripe. The summary
 * on the side follows every choice, so the total is never a surprise.
 */
export default function CheckoutForm(p: Props) {
  const t = dict(p.f.lang);
  const co = coDict(p.f.lang);
  const P = (v: number, whole = false) => price(p.f, v, whole);
  // names come from Intl, whose data differs between server and browser: option text may differ on hydration
  const countries = useMemo(() => countryList(p.f.lang), [p.f.lang]);
  const [guest, setGuest] = useState<Person & { email: string; country: string; dial: string; phone: string }>({ firstName: "", lastName: "", email: "", country: p.country && DIAL[p.country] ? p.country : "", dial: p.country && DIAL[p.country] ? DIAL[p.country]! : "", phone: "" });
  const [forWhom, setForWhom] = useState<"self" | "other">("self");
  const [booker, setBooker] = useState<Person>({ firstName: "", lastName: "" });
  const [items, setItems] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [arrival, setArrival] = useState("");
  const [picks, setPicks] = useState<ExtraPick[]>([]);
  const [promo, setPromo] = useState(""); const [promoOpen, setPromoOpen] = useState(false);
  const [terms, setTerms] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [server, setServer] = useState<{ bookingId: string; reference: string; amount: number; clientSecret: string | null; devMode?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState<string | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const payRef = useRef<HTMLDivElement>(null);
  useEffect(() => { const tick = () => setLeft(Math.max(0, Date.parse(p.expiresAt) - Date.now())); tick(); const i = setInterval(tick, 1000); return () => clearInterval(i); }, [p.expiresAt]);
  useEffect(() => { if (server) payRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [server]);
  const stripePromise = useMemo(() => (p.stripeKey ? loadStripe(p.stripeKey) : null), [p.stripeKey]);

  const ctx = { destination: p.destination, adults: p.adults, nights: p.nights };
  const lines = picks.map((x) => { try { return priceExtra(x, ctx); } catch { return null; } }).filter((x): x is NonNullable<typeof x> => !!x);
  const total = p.amount + lines.reduce((a, x) => a + x.price, 0);
  const locked = !!server;

  const validate = () => {
    const e: Record<string, string> = {};
    if (guest.firstName.trim().length < 2) e.firstName = co.errFirst;
    if (guest.lastName.trim().length < 2) e.lastName = co.errLast;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(guest.email.trim())) e.email = co.errEmail;
    if (!guest.country) e.country = co.errCountry;
    if (!guest.dial || guest.phone.replace(/\D/g, "").length < 6) e.phone = co.errPhone;
    if (forWhom === "other" && (booker.firstName.trim().length < 2 || booker.lastName.trim().length < 2)) e.booker = co.errBooker;
    if (!terms) e.terms = co.errTerms;
    setErrs(e);
    if (Object.keys(e).length) document.getElementById(`f-${Object.keys(e)[0]}`)?.focus();
    return !Object.keys(e).length;
  };
  const start = async (ev: React.FormEvent) => {
    ev.preventDefault(); if (!validate()) return;
    setBusy(true); setFail(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          quoteId: p.quoteId,
          guest: { firstName: guest.firstName.trim(), lastName: guest.lastName.trim(), email: guest.email.trim(), phone: `+${guest.dial} ${guest.phone.trim()}`, country: guest.country },
          requests: { items, note: note.trim() || null, arrival: arrival || null, bookedFor: forWhom, booker: forWhom === "other" ? booker : null },
          promoCode: promo || undefined, acceptedTerms: true, extras: picks,
        }),
      });
      const j = await res.json();
      if (!res.ok) { setFail(j.message ?? t.couldNotStart); setBusy(false); return; }
      setServer(j);
      if (j.devMode) window.location.assign(`/booking/${encodeURIComponent(j.reference)}?email=${encodeURIComponent(guest.email)}&dev=1`);
    } catch { setFail(t.noConnNothing); }
    setBusy(false);
  };
  const ms = left ?? 1; const mins = Math.floor(ms / 60000), secs = Math.floor((ms % 60000) / 1000);
  const errCount = Object.keys(errs).length;
  const field = (id: keyof typeof guest, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}, hint?: string) => (
    <div className="field">
      <label htmlFor={`f-${id}`}>{label} <span className="req" aria-hidden="true">*</span></label>
      <input id={`f-${id}`} required value={guest[id]} disabled={locked} onChange={(e) => setGuest({ ...guest, [id]: e.target.value })} aria-invalid={!!errs[id]} aria-describedby={errs[id] ? `e-${id}` : hint ? `h-${id}` : undefined} {...extra} />
      {errs[id] ? <span className="err" id={`e-${id}`}>{errs[id]}</span> : hint ? <span className="hint" id={`h-${id}`}>{hint}</span> : null}
    </div>
  );
  const appearance: Appearance = { theme: "stripe", variables: { colorPrimary: /^#[0-9a-f]{6}$/i.test(p.brandColor) ? p.brandColor : "#1a1a1a", colorText: "#14161a", colorDanger: "#b42318", fontFamily: "Hanken Grotesk, system-ui, sans-serif", borderRadius: "10px", spacingUnit: "4px", fontSizeBase: "16px" }, rules: { ".Input": { boxShadow: "none", border: "1px solid #d6d9de" }, ".Label": { fontWeight: "600" } } };

  return (
    <div className="co">
      <ol className="co-steps" aria-label="Checkout steps">
        {co.steps.map((s, i) => { const state = i === 0 || (i === 1 && locked) ? "done" : (i === 1 && !locked) || (i === 2 && locked) ? "now" : "next"; return <li key={s} className={state} aria-current={state === "now" ? "step" : undefined}><span>{state === "done" ? "✓" : i + 1}</span>{s}</li>; })}
      </ol>
      <div className="co-grid">
        <form onSubmit={start} noValidate className="co-main">
          <Summary co={co} p={p} lines={lines} total={total} P={P} mobile />
          {errCount > 0 && <div className="notice bad" role="alert">{co.errFix(errCount)}</div>}

          <section className="co-card" aria-labelledby="det-h">
            <h2 id="det-h">{co.detailsH}</h2>
            <p className="co-req mute small">* {co.required}</p>
            <fieldset className="who" disabled={locked}><legend>{co.forWhom}</legend>
              <div className="seg seg-sm">{([["self", co.forMe], ["other", co.forOther]] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={forWhom === k} onClick={() => setForWhom(k)}>{l}</button>)}</div>
            </fieldset>
            {forWhom === "other" && (
              <div className="sub-block"><p className="lbl">{co.yourName}</p>
                <div className="grid2">
                  <div className="field"><label htmlFor="f-booker">{co.firstName} <span className="req">*</span></label><input id="f-booker" autoComplete="given-name" value={booker.firstName} disabled={locked} onChange={(e) => setBooker({ ...booker, firstName: e.target.value })} aria-invalid={!!errs.booker} /></div>
                  <div className="field"><label htmlFor="f-bookerl">{co.lastName} <span className="req">*</span></label><input id="f-bookerl" autoComplete="family-name" value={booker.lastName} disabled={locked} onChange={(e) => setBooker({ ...booker, lastName: e.target.value })} aria-invalid={!!errs.booker} /></div>
                </div>{errs.booker && <span className="err">{errs.booker}</span>}
                <p className="lbl" style={{ marginTop: 14 }}>{co.guestName}</p>
              </div>
            )}
            <div className="grid2">
              {field("firstName", co.firstName, { autoComplete: forWhom === "self" ? "given-name" : "off" })}
              {field("lastName", co.lastName, { autoComplete: forWhom === "self" ? "family-name" : "off" })}
            </div>
            {field("email", co.email, { type: "email", autoComplete: "email", inputMode: "email" }, co.emailHint)}
            <div className="grid2">
              <div className="field">
                <label htmlFor="f-country">{co.country} <span className="req">*</span></label>
                <select id="f-country" value={guest.country} disabled={locked} aria-invalid={!!errs.country} autoComplete="country" onChange={(e) => setGuest({ ...guest, country: e.target.value, dial: DIAL[e.target.value] ?? guest.dial })}>
                  <option value="">…</option>{countries.map((c) => <option key={c.code} value={c.code} suppressHydrationWarning>{c.name}</option>)}
                </select>{errs.country && <span className="err">{errs.country}</span>}
              </div>
              <div className="field">
                <label htmlFor="f-phone">{co.phone} <span className="req">*</span></label>
                <div className="phone">
                  <select aria-label={co.dial} value={guest.dial} disabled={locked} onChange={(e) => setGuest({ ...guest, dial: e.target.value })}>
                    <option value="">+</option>{[...new Set(Object.values(DIAL))].sort((a, b) => Number(a) - Number(b)).map((d) => <option key={d} value={d}>+{d}</option>)}
                  </select>
                  <input id="f-phone" type="tel" inputMode="tel" autoComplete="tel-national" value={guest.phone} disabled={locked} aria-invalid={!!errs.phone} onChange={(e) => setGuest({ ...guest, phone: e.target.value.replace(/[^\d\s()-]/g, "") })} />
                </div>
                {errs.phone ? <span className="err">{errs.phone}</span> : <span className="hint">{co.phoneHint}</span>}
              </div>
            </div>
          </section>

          {!locked && <AddOns co={co} f={p.f} picks={picks} setPicks={setPicks} destination={p.destination} adults={p.adults} nights={p.nights} compare={p.compare} />}

          <details className="co-card co-more" open={items.length > 0 || !!note || !!arrival || undefined}>
            <summary><span><b id="req-h">{co.optionalH}</b><small>{co.optionalSub(items.length + (note ? 1 : 0) + (arrival ? 1 : 0))}</small></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg></summary>
            <p className="co-sub">{co.requestsSub}</p>
            <div className="chips" role="group" aria-label={co.requestsH}>
              {REQUESTS.map((k) => <button key={k} type="button" className="chip-btn" disabled={locked} aria-pressed={items.includes(k)} onClick={() => setItems(items.includes(k) ? items.filter((x) => x !== k) : [...items.filter((x) => !(k === "twin" && x === "double") && !(k === "double" && x === "twin")), k])}>{co.req[k]}</button>)}
            </div>
            <div className="grid2" style={{ marginTop: 14 }}>
              <div className="field"><label htmlFor="f-arr">{co.arrival}</label>
                <select id="f-arr" value={arrival} disabled={locked} onChange={(e) => setArrival(e.target.value)}><option value="">{co.arrivalUnknown}</option>{HOURS.map((h) => <option key={h} value={h}>{h}</option>)}</select>
              </div>
            </div>
            <div className="field"><label htmlFor="f-note">{co.note}</label><textarea id="f-note" rows={2} maxLength={300} value={note} disabled={locked} placeholder={co.notePh} onChange={(e) => setNote(e.target.value)} /></div>
          </details>

          <section className="co-card" aria-labelledby="pol-h">
            <h2 id="pol-h">{co.policyH}</h2>
            <Policy co={co} p={p} P={P} />
            <div className={`co-now ${!p.refundable ? "bad" : freeNow(p) ? "ok" : "warn"}`}>
              <p><b>{co.ifCancelNow}</b><span className="num">{!p.refundable ? co.feeLbl(P(p.amount)) : freeNow(p) ? co.noFee : co.feeLbl(p.cancelCharge ? P(p.cancelCharge) : P(p.amount))}</span></p>
              <label className="check"><input id="f-terms" type="checkbox" checked={terms} disabled={locked} onChange={(e) => setTerms(e.target.checked)} aria-invalid={!!errs.terms} aria-describedby={errs.terms ? "e-terms" : undefined} /><span>{co.terms}</span></label>
              {errs.terms && <span className="err" id="e-terms">{errs.terms}</span>}
            </div>
            {!locked && (promoOpen
              ? <div className="field" style={{ marginTop: 12, maxWidth: 260 }}><label htmlFor="pc">{co.promo}</label><input id="pc" value={promo} onChange={(e) => setPromo(e.target.value.toUpperCase())} placeholder={t.promoPh} autoFocus /></div>
              : <button type="button" className="linkish" onClick={() => setPromoOpen(true)}>{co.promoQ}</button>)}
          </section>

          {fail && <div className="notice bad" role="alert">{fail}</div>}
          {!server ? (
            <div className="co-next">
              <p className="small mute">{left === 0 ? co.heldGone : co.held(`${mins}:${String(secs).padStart(2, "0")}`)}. {co.nextHint}</p>
              <button className="btn btn-brand btn-lg" type="submit" disabled={busy || ms === 0} aria-disabled={busy || ms === 0}>{busy ? t.oneMoment : co.next}<span className="btn-total">{P(total)}</span></button>
            </div>
          ) : (
            <div ref={payRef} className="co-card pay" aria-labelledby="pay-h">
              <div className="pay-head"><h2 id="pay-h">{co.payH}</h2><button type="button" className="linkish" onClick={() => setServer(null)}>{co.change}</button></div>
              <p className="co-sub">{co.paySub}</p>
              {p.demo && <p className="notice warn co-demo">{co.demoPay}</p>}
              {server.clientSecret && stripePromise
                ? <Elements stripe={stripePromise} options={{ clientSecret: server.clientSecret, appearance, locale: p.f.lang === "cs" ? "cs" : "en" }}><PayStep co={co} demo={!!p.demo} amount={server.amount} currency={p.currency} reference={server.reference} email={guest.email} f={p.f} billing={{ name: `${(forWhom === "other" ? booker : guest).firstName} ${(forWhom === "other" ? booker : guest).lastName}`.trim(), email: guest.email.trim(), phone: `+${guest.dial}${guest.phone.replace(/\D/g, "")}`, country: guest.country }} /></Elements>
                : <div className="notice">{t.noPayConfig}</div>}
            </div>
          )}
          <p className="small mute">{t.payNote(p.brandName.normalize("NFD").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 12))}{p.f.disp ? ` ${t.chargedIn(p.currency)}` : ""}</p>
        </form>
        <Summary co={co} p={p} lines={lines} total={total} P={P} />
      </div>
    </div>
  );
}

function Policy({ co, p, P }: { co: Co; p: Props; P: (v: number, whole?: boolean) => string }) {
  const d = (iso: string) => fmtDay(iso, p.f.lang);
  // the supplier's deadline carries a time: show it, the traveler acts on the hour, not just the day
  const dt = (iso: string) => (iso.length > 15 && iso.slice(11, 16) !== "00:00" ? `${d(iso)}, ${iso.slice(11, 16)}` : d(iso));
  if (!p.refundable) return <div className="policy nonref"><span className="dot bad" /><p><b>{co.nonRef}.</b> {co.noRefund}</p></div>;
  // refundable on paper but the free period is already over: a fee from the first minute, never "free"
  if (!freeNow(p)) return (
    <ol className="timeline" aria-label={co.policyH} style={{ gridTemplateColumns: "1fr 1fr" }}>
      <li className="warn"><b>{co.cancelNow}</b><span>{`→ ${d(p.checkIn)}`}</span><em>{co.feeLbl(p.cancelCharge ? P(p.cancelCharge) : P(p.amount))}</em></li>
      <li className="bad"><b>{co.noShow}</b><span>{d(p.checkIn)}</span><em>{co.feeLbl(P(p.amount))}</em></li>
    </ol>
  );
  return (
    <ol className="timeline" aria-label={co.policyH}>
      <li className="ok"><b>{co.freeUntil}</b><span>{p.cancelDeadline ? co.until(dt(p.cancelDeadline)) : ""}</span><em>{co.noFee}</em></li>
      <li className="warn"><b>{co.then}</b><span>{p.cancelDeadline ? `${dt(p.cancelDeadline)} → ${d(p.checkIn)}` : ""}</span><em>{co.feeLbl(p.cancelCharge ? P(p.cancelCharge) : P(p.amount))}</em></li>
      <li className="bad"><b>{co.noShow}</b><span>{d(p.checkIn)}</span><em>{co.feeLbl(P(p.amount))}</em></li>
    </ol>
  );
}

function Summary({ co, p, lines, total, P, mobile }: { co: Co; p: Props; lines: Array<{ kind: string; name: string; detail: string; price: number; elsewhere: number }>; total: number; P: (v: number, whole?: boolean) => string; mobile?: boolean }) {
  const addSave = p.compare ? lines.reduce((a, l) => a + Math.max(0, l.elsewhere - l.price), 0) : 0;
  const t = dict(p.f.lang);
  const day = (iso: string) => new Intl.DateTimeFormat(p.f.lang === "cs" ? "cs-CZ" : "en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(new Date(`${iso}T12:00:00Z`));
  const approx = approxOf(p.f, total);
  const body = (
    <>
      <div className="sum-hotel">
        {p.hotel.photo && <div className="sum-pic"><img src={photoSrc(p.hotel.photo.url, 640, p.hotel.photo.w)} alt="" /><span>{co.hotelPhoto}</span></div>}
        <div><h3>{p.hotel.name}</h3>{p.hotel.stars ? <p className="stars" aria-label={`${p.hotel.stars} stars`}>{"★".repeat(p.hotel.stars)}</p> : null}{p.hotel.address && <p className="small mute">{p.hotel.address}</p>}</div>
      </div>
      <div className="sum-dates">
        <div><span>{co.checkIn}</span><b suppressHydrationWarning>{day(p.checkIn)}</b></div>
        <div><span>{co.checkOut}</span><b suppressHydrationWarning>{day(p.checkOut)}</b></div>
      </div>
      <p className="sum-stay">{co.stay(p.nights, p.adults)}</p>
      <div className="sum-room">
        <span>{co.room}</span><b>{p.hotel.roomName ?? t.board[p.hotel.board ?? "RO"]}</b>
        <span className="small">{p.hotel.roomName ? `${t.board[p.hotel.board ?? "RO"]}. ` : ""}<i className={freeNow(p) ? "ok" : p.refundable ? "warn" : "bad"}>{freeNow(p) ? co.freeCancel : p.refundable ? co.feeCancel : co.nonRef}</i></span>
      </div>
      <ul className="sum-lines">
        <li><span>{t.roomNights(p.nights)}</span><span className="num">{P(p.amount)}</span></li>
        {lines.map((l) => <li key={l.kind}><span>{l.name}<small>{l.detail}</small></span><span className="num">{P(l.price)}</span></li>)}
      </ul>
      {addSave > 0 && <p className="sum-save">{co.youSave(P(addSave))}</p>}
      {p.lowestReference && p.lowestReference > p.amount && <p className="sum-save">{t.showed(p.lowestSource ?? "")} <s className="num">{P(p.lowestReference)}</s></p>}
      <div className="sum-total"><span>{co.dueToday}, {p.currency}<small>{co.taxesIn}</small></span><span><b className="num">{P(total)}</b>{approx && <small className="num">{approx}</small>}</span></div>
      <div className="sum-hotel-due"><span>{co.dueHotel}</span><small>{co.dueHotelV}</small></div>
    </>
  );
  if (mobile) return <details className="sum sum-mobile"><summary><span>{co.summaryH}<small>{co.dueToday}, {p.currency}</small></span><b className="num">{P(total)}</b></summary>{body}</details>;
  return <aside className="sum sum-side" aria-label={co.summaryH}><h2>{co.summaryH}</h2>{body}</aside>;
}

function PayStep({ co, demo, amount, currency, reference, email, f, billing }: { co: Co; demo: boolean; amount: number; currency: string; reference: string; email: string; f: ReaderFmt; billing: { name: string; email: string; phone: string; country: string } }) {
  const t = dict(f.lang);
  const stripe = useStripe(), elements = useElements();
  const [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null);
  const pay = async () => {
    if (!stripe || !elements) return;
    setBusy(true); setErr(null);
    const r = await stripe.confirmPayment({ elements, confirmParams: { return_url: `${window.location.origin}/booking/${encodeURIComponent(reference)}/open?email=${encodeURIComponent(email)}` } });
    if (r.error) { setErr(r.error.message ?? t.declined); setBusy(false); }
  };
  return (
    <>
      <PaymentElement options={{ layout: { type: "accordion", defaultCollapsed: false, radios: "always", spacedAccordionItems: true }, wallets: { applePay: "auto", googlePay: "auto" }, defaultValues: { billingDetails: { name: billing.name, email: billing.email, phone: billing.phone, address: { country: billing.country } } } }} />
      {err && <div className="notice bad" role="alert" style={{ marginTop: 12 }}>{err}</div>}
      <button className="btn btn-brand btn-lg pay-btn" type="button" onClick={pay} disabled={busy || !stripe}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11V8a5 5 0 0110 0v3M6 11h12v9H6z" /></svg>{busy ? co.paying : demo ? co.payDemo : co.pay(`${currency} ${money(amount, { lang: f.lang, currency })}`)}
      </button>
      <p className="secure small mute">{co.secure}</p>
    </>
  );
}
