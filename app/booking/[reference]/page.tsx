import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { chargedTotal, confirmPaid, penaltyNow } from "@/lib/booking/service";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { stripe } from "@/lib/stripe";
import { fmtDay, money } from "@/lib/i18n";
import { readerOf } from "@/lib/storefront/reader";
import { requireStorefront } from "@/lib/tenant";
import CancelButton from "@/components/CancelButton";
import PrintButton from "@/components/PrintButton";
import { cancelStages, priceLines, requestsLine, tripSteps, tripWords } from "@/lib/booking/itinerary";
import { photoSrc } from "@/lib/media/photo";

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
  const [hotel, quote] = await Promise.all([db().hotel(b.ebcId), b.quoteId ? db().quote(b.quoteId).catch(() => null) : null]);
  // the booking stores the lead guest's name; the party size is on the quote it came from
  const party = quote?.occupancy.reduce((a, r) => a + r.adults, 0) || b.guests.length || 1;
  const base = STATUS[b.status] ?? STATUS.confirmed!;
  const tr = t.status[b.status] ?? t.status.confirmed!;
  const mailOn = !!env().RESEND_API_KEY;
  const L = PAGE[f.lang] ?? PAGE.en;
  // without email set up the voucher lives on this page: never tell the guest it is in their inbox
  const st = { ...base, label: tr[0], text: b.status === "confirmed" && !mailOn ? L.confirmedNoMail : tr[1] };
  const penalty = penaltyNow(b);
  const canCancel = (b.status === "confirmed" || b.status === "on_request") && (!!b.ebcReservationId || !!b.demo);
  const { lines, total } = priceLines(b, f.lang, (v) => usd(v));
  const steps = tripSteps(b, f.lang);
  const stages = cancelStages(b, f.lang);
  const w = tripWords(f.lang);
  const lead = b.guests.find((g) => g.lead) ?? b.guests[0];
  const live = b.status !== "canceled" && b.status !== "failed";
  const day = (iso: string) => new Intl.DateTimeFormat(f.lang === "cs" ? "cs-CZ" : "en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso.slice(0, 10)}T12:00:00Z`));
  const saved = b.lowestReference && b.lowestReference > b.readerPrice ? Math.round((b.lowestReference - b.readerPrice) * 100) / 100 : 0;
  const photo = hotel?.images[0];
  const ics = icsFor(b, hotel?.name ?? "", [hotel?.address, hotel?.cityName].filter(Boolean).join(", "));
  return (
    <div className="bk">
      {b.demo && <div className="notice warn" role="note">{t.demoBooking}</div>}

      <section className="bk-hero voucher" aria-labelledby="bk-h">
        {photo && <div className="bk-pic"><img src={photoSrc(photo.url, 900, photo.w)} alt="" /></div>}
        <div className="bk-main">
          <span className={`chip ${st.cls}`}>{st.label}{b.demo ? t.demoSuffix : ""}</span>
          <h1 id="bk-h">{hotel?.name}</h1>
          {hotel?.stars ? <p className="stars" aria-label={`${hotel.stars} stars`}>{"★".repeat(hotel.stars)}</p> : null}
          {hotel?.address && <p className="mute">{[hotel.address, hotel.cityName].filter(Boolean).join(", ")}</p>}
          <p className="bk-status">{st.text}</p>
          <div className="bk-dates">
            <div><span>{w.checkin}</span><b>{day(b.checkIn)}</b><small>{w.checkinTime}</small></div>
            <div><span>{w.checkout}</span><b>{day(b.checkOut)}</b><small>{w.checkoutTime}</small></div>
          </div>
          <dl className="bk-facts">
            <div><dt>{t.yourRef}</dt><dd className="ref">{b.reference}</dd></div>
            {b.hotelConfirmation && <div><dt>{t.hotelConf}</dt><dd className="ref">{b.hotelConfirmation}</dd></div>}
            {lead && <div><dt>{L.guest}</dt><dd>{lead.firstName} {lead.lastName}, {L.adults(party)}</dd></div>}
            <div><dt>{t.room}</dt><dd>{b.roomName ?? t.room}, {t.board[b.board ?? "RO"]?.toLowerCase()}</dd></div>
          </dl>
          {live && <div className="bk-actions no-print"><PrintButton label={L.print} /><a className="btn" href={`data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`} download={`${b.reference.replace(/\s+/g, "")}.ics`}>{L.calendar}</a></div>}
        </div>
      </section>

      <div className="bk-grid">
        <section className="bk-card" aria-labelledby="it-h">
          <h2 id="it-h">{L.itinerary}</h2>
          <ol className="trip">
            {steps.map((s, i) => (
              <li key={i} className={`trip-${s.kind}`}>
                <span className="trip-date"><b>{new Intl.DateTimeFormat(f.lang === "cs" ? "cs-CZ" : "en-GB", { day: "numeric", timeZone: "UTC" }).format(new Date(`${s.date}T12:00:00Z`))}</b>{new Intl.DateTimeFormat(f.lang === "cs" ? "cs-CZ" : "en-GB", { month: "short", timeZone: "UTC" }).format(new Date(`${s.date}T12:00:00Z`))}</span>
                <span className="trip-dot" aria-hidden="true" />
                <div><b>{s.title}</b>{s.time ? <span className="mute">, {s.time}</span> : null}<div className="small mute">{fmtDate(s.date)}{s.detail ? `. ${s.detail}` : ""}</div></div>
              </li>
            ))}
          </ol>
          {requestsLine(b) && <div className="bk-req"><b>{L.requests}</b><p>{requestsLine(b)}</p></div>}
        </section>

        <section className="bk-card" aria-labelledby="pr-h">
          <h2 id="pr-h">{L.breakdown}</h2>
          <ul className="sum-lines">
            {lines.map((l, i) => <li key={i} className={l.kind === "discount" ? "disc" : ""}><span>{l.label}{l.detail && <small>{l.detail}</small>}</span><span className="num">{usd(l.amount)}</span></li>)}
          </ul>
          <div className="sum-total"><span>{L.totalPaid}<small>{L.taxes}</small></span><span><b className="num">{usd(total)}</b></span></div>
          {saved > 0 && <p className="sum-save">{L.saved(usd(saved), b.lowestReferenceSource ?? "")} <s className="num">{usd(b.lowestReference!)}</s></p>}
          <p className="small mute">{t.payNote(sf.brandName.normalize("NFD").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 12))}</p>
        </section>
      </div>

      {live && (
        <section className="bk-card" aria-labelledby="ch-h">
          <h2 id="ch-h">{L.changeH}</h2>
          <ul className="bk-changes">{(b.refundable ? w.changes : w.changesNonRef).map((c) => <li key={c}>{c}</li>)}</ul>
          <h3 className="bk-sub">{t.cancellation}</h3>
          <ol className="stages">
            {stages.map((s) => (
              <li key={s.title} className={`st-${s.tone}${s.now ? " now" : ""}`}>
                {s.now && <span className="now-tag">{L.now}</span>}
                <b>{s.title}</b>
                <span className="small">{s.from ? `${fmtDate(s.from)} ` : ""}{s.to ? `→ ${fmtDate(s.to)}` : ""}</span>
                <span className="pen"><em>{s.charge ? L.penalty(usd(s.charge)) : L.noPenalty}</em><small>{L.refund(usd(s.refund))}</small></span>
              </li>
            ))}
          </ol>
          <p className="small mute">{L.extrasNote}</p>
          <div className="bk-actions no-print">
            {canCancel && <CancelButton lang={f.lang} currency={b.currency} bookingId={b.id} email={email} penalty={penalty} refund={Math.round((chargedTotal(b) - penalty) * 100) / 100} />}
            <Link className="btn" href="/">{t.backStore}</Link>
          </div>
        </section>
      )}

      <section className="bk-card" aria-labelledby="hp-h">
        <h2 id="hp-h">{t.ifWrong}</h2>
        <p className="small" style={{ color: "var(--ink-2)", margin: 0 }}>{mailOn ? t.ifWrongText : L.ifWrongNoMail}</p>
      </section>
      {(b.status === "paying" || b.status === "booked") && <meta httpEquiv="refresh" content="6" />}
    </div>
  );
}

const PAGE = {
  en: {
    confirmedNoMail: "Your room is booked. This page is your voucher: print it or keep the link.", guest: "Guest", adults: (n: number) => `${n} ${n === 1 ? "adult" : "adults"}`,
    print: "Print voucher", calendar: "Add to calendar", itinerary: "Your trip", requests: "Requests sent to the hotel", breakdown: "Price breakdown", totalPaid: "Total paid",
    taxes: "Taxes and charges included", cityTax: "City tax, if the city charges one, is paid at the hotel.", saved: (v: string, src: string) => `You saved ${v} on the price ${src} showed`,
    changeH: "Change or cancel", now: "Now", penalty: (v: string) => `Penalty ${v}`, noPenalty: "No penalty", refund: (v: string) => `You get back ${v}`,
    extrasNote: "Add ons (ride, eSIM, covers) are refunded in full whenever the stay is canceled.",
    ifWrongNoMail: "If the hotel cannot find your booking, show them this page and the reference above. Nomadly support answers 7 days a week, 08:00 to 22:00 UTC, by phone and WhatsApp.",
  },
  cs: {
    confirmedNoMail: "Pokoj je rezervovaný. Tato stránka je váš voucher: vytiskněte si ji nebo si uložte odkaz.", guest: "Host", adults: (n: number) => `${n} ${n === 1 ? "dospělý" : "dospělí"}`,
    print: "Vytisknout voucher", calendar: "Přidat do kalendáře", itinerary: "Vaše cesta", requests: "Požadavky pro hotel", breakdown: "Rozpis ceny", totalPaid: "Celkem zaplaceno",
    taxes: "Včetně daní a poplatků", cityTax: "Městskou taxu, pokud ji město vybírá, platíte v hotelu.", saved: (v: string, src: string) => `Ušetřili jste ${v} oproti ceně na ${src}`,
    changeH: "Změna nebo zrušení", now: "Nyní", penalty: (v: string) => `Storno poplatek ${v}`, noPenalty: "Bez poplatku", refund: (v: string) => `Vrátíme ${v}`,
    extrasNote: "Doplňky (odvoz, eSIM, pojištění) vracíme v plné výši, kdykoli se pobyt zruší.",
    ifWrongNoMail: "Pokud hotel vaši rezervaci nenajde, ukažte mu tuto stránku a číslo rezervace. Podpora Nomadly odpovídá 7 dní v týdnu, 08:00 až 22:00 UTC, telefonicky i přes WhatsApp.",
  },
};

/** An all day calendar entry for the stay, with the reference and the manage link in it. */
function icsFor(b: { reference: string; checkIn: string; checkOut: string }, name: string, where: string) {
  const d = (x: string) => x.replace(/-/g, "");
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Nomadly//Booking//EN", "BEGIN:VEVENT", `UID:${b.reference.replace(/\s+/g, "")}@nomadly`, `DTSTART;VALUE=DATE:${d(b.checkIn)}`, `DTEND;VALUE=DATE:${d(b.checkOut)}`, `SUMMARY:${name} (${b.reference})`, `LOCATION:${where.replace(/,/g, "\\,")}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
}
