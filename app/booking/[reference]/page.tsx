import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { chargedTotal, confirmPaid, penaltyNow } from "@/lib/booking/service";
import { db } from "@/lib/db";
import { requestComments } from "@/lib/booking/service";
import { env } from "@/lib/env";
import { stripe } from "@/lib/stripe";
import { fmtDay, money } from "@/lib/i18n";
import { readerOf } from "@/lib/storefront/reader";
import { requireStorefront } from "@/lib/tenant";
import CancelButton from "@/components/CancelButton";

export const dynamic = "force-dynamic";
const b0Currency = (c: string | null | undefined) => c || "USD";

const STATUS: Record<string, { label: string; cls: string; text: string }> = {
  paying: { label: "Payment in progress", cls: "chip-warn", text: "We are waiting for the card confirmation. This page refreshes itself." },
  booked: { label: "Booking the hotel", cls: "chip-warn", text: "Payment received. Confirming with the hotel now." },
  on_request: { label: "Waiting for the hotel", cls: "chip-warn", text: "The hotel confirms within a few hours. We email you the moment it does." },
  confirmed: { label: "Confirmed", cls: "chip-ok", text: "Your room is booked. The voucher is in your email." },
  completed: { label: "Stay completed", cls: "chip-ok", text: "We hope it was a good one." },
  canceled: { label: "Canceled", cls: "chip-bad", text: "This booking is canceled. Any refund reaches your card in 5 to 10 working days." },
  failed: { label: "Did not go through", cls: "chip-bad", text: "The hotel could not confirm. If a charge shows on your card it is being refunded." },
};

export default async function BookingPage({ params, searchParams }: { params: Promise<{ reference: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sf = await requireStorefront();
  const { t, f } = await readerOf(sf);
  const fmtDate = (d: string) => fmtDay(d, f.lang);
  const usd = (x: number, whole = false) => money(x, { lang: f.lang, currency: b0Currency(sf.currency), whole });
  const { reference } = await params;
  const sp = await searchParams;
  const email = typeof sp.email === "string" ? sp.email.trim().toLowerCase() : "";
  let b = await db().bookingByReference(decodeURIComponent(reference));
  if (!b || b.storefrontId !== sf.id || b.leadEmail !== email) notFound();
  // development without Stripe: the dev flag completes the booking inline so the flow can be walked end to end
  // The reader returns here from Stripe. Ask Stripe whether the charge succeeded and finish the hotel booking now;
  // the webhook does the same thing and whichever arrives first wins (confirmPaid is idempotent).
  if (b.status === "paying" && b.stripePaymentIntent && env().STRIPE_SECRET_KEY) {
    try {
      const pi = await stripe().paymentIntents.retrieve(b.stripePaymentIntent);
      if (pi.status === "succeeded") {
        const h = await headers();
        const base = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
        b = await confirmPaid(b.id, pi.id, base);
      } else if (pi.status === "canceled" || pi.status === "requires_payment_method") {
        // card declined or abandoned: nothing charged; the booking stays open so the reader can retry from checkout
      }
    } catch { b = (await db().booking(b.id))!; }
  }
  if (sp.dev === "1" && !env().STRIPE_SECRET_KEY && b.status === "paying") {
    try { b = await confirmPaid(b.id, "pi_dev", ""); } catch { b = (await db().booking(b.id))!; }
  }
  const hotel = await db().hotel(b.ebcId);
  const base = STATUS[b.status] ?? STATUS.confirmed!;
  const tr = t.status[b.status] ?? t.status.confirmed!;
  const st = { ...base, label: tr[0], text: tr[1] };
  const penalty = penaltyNow(b);
  const canCancel = (b.status === "confirmed" || b.status === "on_request") && (!!b.ebcReservationId || !!b.demo);
  return (
    <>
      <div style={{ marginTop: 18 }} className="panel">
        {b.demo && <div className="notice warn" role="note" style={{ marginBottom: 12 }}>{t.demoBooking}</div>}
        <span className={`chip ${st.cls}`}>{st.label}{b.demo ? t.demoSuffix : ""}</span>
        <h1 style={{ fontSize: 28, marginTop: 10 }}>{hotel?.name}</h1>
        <p className="mute" style={{ margin: "4px 0 0" }}>{t.stayLine(fmtDate(b.checkIn), fmtDate(b.checkOut), b.nights, b.guests.length || 1).split(", ").slice(0, 2).join(", ")}. {b.roomName ?? t.room}, {t.board[b.board ?? "RO"]?.toLowerCase()}.</p>
        <p style={{ margin: "12px 0 0" }}>{st.text}</p>
        {b.extras.length > 0 && <ul className="small" style={{ margin: "10px 0 0", paddingLeft: 18, color: "var(--fg-2)" }}>{b.extras.map((x) => <li key={x.kind}>{x.option ? x.name : t.extras?.[x.kind]?.name ?? x.name}, {usd(x.price, true)}{x.detail ? <><br /><span className="mute">{x.detail}</span></> : null}</li>)}</ul>}
        {b.requests && (b.requests.items.length > 0 || b.requests.note || b.requests.arrival) && <p className="small" style={{ margin: "10px 0 0", color: "var(--fg-2)" }}><b>{f.lang === "cs" ? "Požadavky pro hotel" : "Requests sent to the hotel"}:</b> {requestComments(b.requests)}</p>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginTop: 16 }}>
          <div><div className="small mute">{t.yourRef}</div><b>{b.reference}</b></div>
          {b.hotelConfirmation && <div><div className="small mute">{t.hotelConf}</div><b>{b.hotelConfirmation}</b></div>}
          <div><div className="small mute">{t.paid}</div><b>{usd(chargedTotal(b))}</b></div>
          <div><div className="small mute">{t.cancellation}</div><b>{b.refundable ? (penalty === 0 ? t.freeUntil(b.cancelDeadline ? fmtDate(b.cancelDeadline) : t.checkInWord) : t.ifCanceledNow(usd(penalty))) : t.noRefunds}</b></div>
        </div>
      </div>
      <div className="panel" style={{ marginTop: 14 }}>
        <h2 style={{ fontSize: 20 }}>{t.ifWrong}</h2>
        <p className="small" style={{ color: "var(--fg-2)", margin: "6px 0 10px" }}>{t.ifWrongText}</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {canCancel && <CancelButton lang={f.lang} currency={b.currency} bookingId={b.id} email={email} penalty={penalty} refund={Math.round((chargedTotal(b) - penalty) * 100) / 100} />}
          <Link className="btn" href="/">{t.backStore}</Link>
        </div>
      </div>
      {(b.status === "paying" || b.status === "booked") && <meta httpEquiv="refresh" content="6" />}
    </>
  );
}
