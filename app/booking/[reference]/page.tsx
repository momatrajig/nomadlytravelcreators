import Link from "next/link";
import { notFound } from "next/navigation";
import { chargedTotal, confirmPaid, penaltyNow } from "@/lib/booking/service";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { BOARD, fmtDate, usd } from "@/lib/format";
import { requireStorefront } from "@/lib/tenant";
import CancelButton from "@/components/CancelButton";

export const dynamic = "force-dynamic";

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
  const { reference } = await params;
  const sp = await searchParams;
  const email = typeof sp.email === "string" ? sp.email.trim().toLowerCase() : "";
  let b = await db().bookingByReference(decodeURIComponent(reference));
  if (!b || b.storefrontId !== sf.id || b.leadEmail !== email) notFound();
  // development without Stripe: the dev flag completes the booking inline so the flow can be walked end to end
  if (sp.dev === "1" && !env().STRIPE_SECRET_KEY && b.status === "paying") {
    try { b = await confirmPaid(b.id, "pi_dev", ""); } catch { b = (await db().booking(b.id))!; }
  }
  const hotel = await db().hotel(b.ebcId);
  const st = STATUS[b.status] ?? STATUS.confirmed!;
  const penalty = penaltyNow(b);
  const canCancel = (b.status === "confirmed" || b.status === "on_request") && !!b.ebcReservationId;
  return (
    <>
      <div style={{ marginTop: 18 }} className="panel">
        <span className={`chip ${st.cls}`}>{st.label}</span>
        <h1 style={{ fontSize: 28, marginTop: 10 }}>{hotel?.name}</h1>
        <p className="mute" style={{ margin: "4px 0 0" }}>{fmtDate(b.checkIn)} to {fmtDate(b.checkOut)}, {b.nights} {b.nights === 1 ? "night" : "nights"}. {b.roomName ?? "Room"}, {BOARD[b.board ?? "RO"]?.toLowerCase()}.</p>
        <p style={{ margin: "12px 0 0" }}>{st.text}</p>
        {b.extras.length > 0 && <ul className="small" style={{ margin: "10px 0 0", paddingLeft: 18, color: "var(--fg-2)" }}>{b.extras.map((x) => <li key={x.kind}>{x.name}, {usd(x.price, true)}</li>)}</ul>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginTop: 16 }}>
          <div><div className="small mute">Your reference</div><b>{b.reference}</b></div>
          {b.hotelConfirmation && <div><div className="small mute">Hotel confirmation</div><b>{b.hotelConfirmation}</b></div>}
          <div><div className="small mute">Paid</div><b>{usd(chargedTotal(b))}</b></div>
          <div><div className="small mute">Cancellation</div><b>{b.refundable ? (penalty === 0 ? `Free until ${b.cancelDeadline ? fmtDate(b.cancelDeadline) : "check in"}` : `${usd(penalty)} if canceled now`) : "No refunds"}</b></div>
        </div>
      </div>
      <div className="panel" style={{ marginTop: 14 }}>
        <h2 style={{ fontSize: 20 }}>If anything goes wrong</h2>
        <p className="small" style={{ color: "var(--fg-2)", margin: "6px 0 10px" }}>If the hotel cannot find your booking, show them the reference above and the voucher in your email. Nomadly support answers 7 days a week, 08:00 to 22:00 Lisbon time, by phone and WhatsApp, in English, Arabic and Portuguese.</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {canCancel && <CancelButton bookingId={b.id} email={email} penalty={penalty} refund={Math.round((chargedTotal(b) - penalty) * 100) / 100} />}
          <Link className="btn" href="/">Back to the storefront</Link>
        </div>
      </div>
      {(b.status === "paying" || b.status === "booked") && <meta httpEquiv="refresh" content="6" />}
    </>
  );
}
