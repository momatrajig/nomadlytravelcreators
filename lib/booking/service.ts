/**
 * Booking service: the only code path from "reader looks at a hotel" to "hotel confirmed".
 *
 *   searchStays   -> eBooking sync search for the pinned hotels, priced with the engine, parity checked
 *   holdQuote     -> prebook (availability) one package, store the quote with its tokens
 *   pay           -> Stripe PaymentIntent for readerPrice (server side amount, never from the client)
 *   confirmPaid   -> on Stripe webhook: double booking check, book on credit, subscribe webhook, voucher
 *   cancel        -> compute penalty from the policy, cancel at eBooking, refund through Stripe
 *
 * Every monetary value is produced by lib/pricing. Failures are explicit and typed.
 */
import { cancellationDeadline, ebc, EbcError } from "@/lib/ebc/client";
import type { Package, Room } from "@/lib/ebc/types";
import { db } from "@/lib/db";
import type { Booking, PriceCheck, Quote, Storefront } from "@/lib/db/types";
import { extraLedger, lowestReference, markupCeiling, r2, stayLedger, termsOf, type ReferenceQuote } from "@/lib/pricing/engine";
import { extraByKind } from "@/lib/extras/catalog";
import { sendBookingEmail } from "@/lib/email/send";
import { bookingMode } from "./guard";

export class BookingError extends Error {
  constructor(public readonly code: "NO_AVAILABILITY" | "QUOTE_EXPIRED" | "PRICE_CHANGED" | "ALREADY_BOOKED" | "NOT_FOUND" | "SUPPLIER" | "INVALID", message: string, public readonly detail?: unknown) {
    super(message); this.name = "BookingError";
  }
}

export const SOURCE_LABEL: Record<PriceCheck["source"], string> = { booking: "Booking.com", expedia: "Expedia", agoda: "Agoda", tripcom: "Trip.com", hotel: "the hotel's own site" };
/** Display label back to the stored code (the database column is an enum of codes). */
export const sourceCode = (label: string | null | undefined): PriceCheck["source"] | null =>
  label ? ((Object.entries(SOURCE_LABEL).find(([, v]) => v === label)?.[0] as PriceCheck["source"] | undefined) ?? (label in SOURCE_LABEL ? (label as PriceCheck["source"]) : null)) : null;
export const sourceLabel = (code: string | null | undefined): string => (code && code in SOURCE_LABEL ? SOURCE_LABEL[code as PriceCheck["source"]] : code ?? "");

export interface StayOffer {
  ebcId: number; name: string; stars: number;
  hotelIndex: number; offerIndex: string; srk: string; resultsToken: string;
  rates: Array<{
    /** the supplier offer this package belongs to (a hotel returns one offer per wholesaler) */
    offerIndex?: string;
    packageCode: string; packageToken: string; roomTokens: string[]; roomName: string; board: string; refundable: boolean; onRequest: boolean;
    cancelDeadline: string | null; cancelCharge: number | null;
    supplierNet: number; readerPrice: number; creatorShare: number; nomadlyNet: number;
    /** the creator's share of Nomadly's net revenue (0.55) */
    creatorRate: number;
    /** Nomadly's markup on the supplier net used for this price */
    markup: number; margin: number; costs: number;
  }>;
  references: ReferenceQuote[]; lowestReference: ReferenceQuote | null; saving: number | null;
}

export function nights(checkIn: string, checkOut: string): number {
  const n = Math.round((Date.parse(checkOut) - Date.parse(checkIn)) / 86_400_000);
  if (!Number.isInteger(n) || n < 1 || n > 30) throw new BookingError("INVALID", "stay must be 1 to 30 nights");
  return n;
}

function packagesToRates(pkgs: Package[], rooms: Room[], markup: number, share: number): StayOffer["rates"] {
  return pkgs.filter((p) => p.complete).map((p) => {
    const refs = p.packageRooms.flatMap((pr) => pr.roomReferences.filter((r) => r.selected).map((r) => r));
    const room = rooms.find((r) => r.index === refs[0]?.roomCode) ?? rooms[0];
    const supplierNet = p.price.components?.supplier?.value ?? p.price.selling.value;
    const l = stayLedger(supplierNet, markup, share);
    const dl = room?.cancellationDeadline ?? null;
    return {
      packageCode: p.packageCode, packageToken: p.packageToken, roomTokens: refs.map((r) => r.roomToken),
      roomName: room?.name ?? "Room", board: room?.boardBasis ?? "RO", refundable: !(room?.nonRefundable ?? false), onRequest: p.status === "RQ",
      // a supplier's penalty can be stated on a different basis; the reader never owes more than they pay
      cancelDeadline: dl?.date ?? null, cancelCharge: dl?.charge.value != null ? Math.min(dl.charge.value, l.readerPrice) : null,
      supplierNet: l.supplierNet, readerPrice: l.readerPrice, creatorShare: l.creatorShare, nomadlyNet: l.nomadlyNet, creatorRate: share, markup, margin: l.margin, costs: l.costs,
    };
  }).sort((a, b) => Number(b.refundable) - Number(a.refundable) || a.readerPrice - b.readerPrice); // flexible rates first, then price
}

/** Markup for this storefront on these dates: its set markup, capped where a big site price was recorded for the same stay. */
export async function effectiveRate(sf: Storefront, hotelsNet: Array<{ ebcId: number; supplierNet: number }>, checks: PriceCheck[]): Promise<{ rate: number; ceiling: number }> {
  const wanted = termsOf(sf).markup;
  const ceiling = markupCeiling(hotelsNet.map((h) => ({ supplierNet: h.supplierNet, quotes: checks.filter((c) => c.ebcId === h.ebcId).map((c) => ({ source: SOURCE_LABEL[c.source], price: c.price, checkedAt: c.checkedAt })) })), wanted);
  return { rate: ceiling, ceiling };
}

type StaysResult = { offers: StayOffer[]; rate: number; ceiling: number; checkedAt: string | null; searchedAt?: string };
const inflight = new Map<string, Promise<StaysResult>>();
const FRESH_MS = 15 * 60_000;      // within this a cached search is served as is
const KEEP_S = 6 * 3600;           // a stale search is still shown instantly while a new one runs in the background

/**
 * Supplier search, priced and parity checked. A live search of twenty hotels takes 10 to 30 seconds, so:
 *  fresh (under 15 minutes): served from the shared cache.
 *  stale (under 6 hours):    served instantly, and a background search replaces it for the next reader.
 *  missing, or fresh asked:  searched now; identical searches running together share one supplier call.
 * Displayed prices can be up to a few hours old; the price is re-checked with the hotel when a reader
 * picks a rate (holdQuote), and a change is shown before any payment.
 */
export async function searchStays(sf: Storefront, checkIn: string, checkOut: string, adults: number, childrenAges: number[] = [], only?: number[], leaderIso?: string, opts: { fresh?: boolean } = {}): Promise<StaysResult> {
  nights(checkIn, checkOut);
  const terms = termsOf(sf);
  const key = `stays:v5:${sf.id}:${checkIn}:${checkOut}:${adults}:${childrenAges.join(".")}:${(leaderIso ?? "").toUpperCase()}:${only ? [...only].sort((a, b) => a - b).join(".") : "all"}:${terms.markup}:${terms.hotelShare}`;
  const run = () => {
    const running = inflight.get(key);
    if (running) return running;
    const p = searchStaysUncached(sf, checkIn, checkOut, adults, childrenAges, only, leaderIso)
      .then(async (r) => { const out = { ...r, searchedAt: new Date().toISOString() }; if (r.offers.length) await db().cacheSet(key, out, KEEP_S).catch(() => undefined); return out; })
      .finally(() => inflight.delete(key));
    inflight.set(key, p);
    return p;
  };
  if (!opts.fresh) {
    const hit = await db().cacheGet<StaysResult>(key).catch(() => null);
    if (hit) {
      if (Date.now() - Date.parse(hit.searchedAt ?? "1970-01-01") > FRESH_MS) refreshLater(run);
      return hit;
    }
  }
  return run();
}

/** Runs after the response is sent where the platform supports it (Vercel), inline otherwise. Errors only log. */
function refreshLater(task: () => Promise<unknown>) {
  const go = () => task().catch((e) => console.error("background search", e instanceof Error ? e.message : e));
  import("next/server").then(({ after }) => { try { after(go); } catch { void go(); } }).catch(() => void go());
}

async function searchStaysUncached(sf: Storefront, checkIn: string, checkOut: string, adults: number, childrenAges: number[], only?: number[], leaderIso?: string): Promise<StaysResult> {
  const all = await db().pinnedHotels(sf.id);
  const pins = only ? all.filter((p) => only.includes(p.ebcId)) : all;
  if (!pins.length) return { offers: [], rate: termsOf(sf).markup, ceiling: termsOf(sf).markup, checkedAt: null };
  const [res, checks] = await Promise.all([
    ebc().searchSync({ accommodation: pins.map((p) => p.ebcId), checkIn, checkOut, occupancy: { rooms: [{ adults, childrenAges }], leaderIso } }),
    db().latestPriceChecks(pins.map((p) => p.ebcId), checkIn, checkOut, adults),
  ]);
  // the cheapest refundable rate per hotel drives the parity guard
  const nets = res.hotels.map((h) => {
    const cheapest = Math.min(...h.offers.flatMap((o) => o.packages.filter((p) => p.complete).map((p) => p.price.components?.supplier?.value ?? p.price.selling.value)));
    return { ebcId: Number(h.index), supplierNet: cheapest };
  }).filter((n) => Number.isFinite(n.supplierNet));
  const { rate, ceiling } = await effectiveRate(sf, nets, checks);
  const offers: StayOffer[] = res.hotels.filter((h) => h.offers.length).map((h) => {
    const o = h.offers[0]!;
    const refs = checks.filter((c) => Number(c.ebcId) === Number(h.index)).map((c) => ({ source: SOURCE_LABEL[c.source], price: c.price, checkedAt: c.checkedAt }));
    // a five star hotel can return two hundred packages; the reader compares a handful: keep the cheapest
    // eight, making sure the cheapest refundable and cheapest with breakfast are among them
    // every wholesaler's offer, then the cheapest of each room, board and refund combination
    const merged = h.offers.flatMap((of) => packagesToRates(of.packages, of.rooms, rate, termsOf(sf).hotelShare).map((r) => ({ ...r, offerIndex: of.id })));
    const best = new Map<string, (typeof merged)[number]>();
    for (const r of merged) { const k = `${r.roomName.toLowerCase()}|${r.board}|${r.refundable}`; const cur = best.get(k); if (!cur || r.readerPrice < cur.readerPrice) best.set(k, r); }
    const all = [...best.values()].sort((a, b) => a.readerPrice - b.readerPrice);
    const must = [all.find((x) => x.refundable), all.find((x) => x.board !== "RO")].filter((x): x is NonNullable<typeof x> => !!x);
    const rates = [...new Set([...all.slice(0, 8), ...must])].sort((a, b) => Number(b.refundable) - Number(a.refundable) || a.readerPrice - b.readerPrice);
    const low = lowestReference(refs);
    const cheapestFlex = rates.find((r) => r.refundable) ?? rates[0];
    // the live API returns the hotel index as a string; our IDs are numbers
    const id = Number(h.index);
    const pin = pins.find((x) => x.ebcId === id);
    return { ebcId: id, name: pin?.name ?? h.name, stars: pin?.stars ?? h.stars, hotelIndex: h.index, offerIndex: o.id, srk: res.srk, resultsToken: res.tokens.results, rates, references: refs, lowestReference: low, saving: low && cheapestFlex ? r2(low.price - cheapestFlex.readerPrice) : null };
  });
  const checkedAt = checks.map((c) => c.checkedAt).sort().at(-1) ?? null;
  return { offers, rate, ceiling, checkedAt };
}

/** Prebook one rate and persist the quote. The reader has 20 minutes to pay. */
export async function holdQuote(sf: Storefront, offer: StayOffer, packageCode: string, checkIn: string, checkOut: string, occupancy: Array<{ adults: number; childrenAges: number[] }>): Promise<Quote> {
  const rate = offer.rates.find((r) => r.packageCode === packageCode);
  if (!rate) throw new BookingError("NOT_FOUND", "rate not in this offer");
  let av;
  try {
    av = await ebc().availability(offer.srk, offer.hotelIndex, rate.offerIndex ?? offer.offerIndex, offer.resultsToken, { packageToken: rate.packageToken, roomTokens: rate.roomTokens });
  } catch (e) {
    if (e instanceof EbcError && (e.code === "ROOM_UNAVAILABLE" || e.code === "OFFER_RECONFIGURED")) throw new BookingError("NO_AVAILABILITY", "This rate is no longer available. Pick another.", e.problem);
    throw new BookingError("SUPPLIER", "The hotel system did not answer. Try again in a moment.", e instanceof EbcError ? e.problem : String(e));
  }
  const supplierNet = av.price.components?.supplier?.value ?? av.price.selling.value;
  if (Math.abs(supplierNet - rate.supplierNet) > 0.01) {
    // the supplier repriced between search and prebook: never silently book the new price
    throw new BookingError("PRICE_CHANGED", "The price changed while you were looking. Refresh to see the new one.", { was: rate.supplierNet, now: supplierNet });
  }
  const l = stayLedger(supplierNet, rate.markup, rate.creatorRate);
  const dl = cancellationDeadline(av.cancellationPolicy);
  const now = Date.now();
  return db().saveQuote({
    storefrontId: sf.id, ebcId: offer.ebcId, checkIn, checkOut, occupancy, srk: offer.srk, resultsToken: offer.resultsToken, hotelIndex: offer.hotelIndex, offerIndex: rate.offerIndex ?? offer.offerIndex,
    packageCode, packageToken: rate.packageToken, roomTokens: rate.roomTokens, board: rate.board, refundable: rate.refundable && !(av.rooms[0]?.nonRefundable ?? false),
    cancelDeadline: dl?.date ?? null, cancelCharge: dl?.charge != null ? Math.min(dl.charge, l.readerPrice) : null,
    supplierNet: l.supplierNet, currency: av.price.selling.currency, creatorRate: l.creatorRate, nomadlyNet: l.nomadlyNet, creatorShare: l.creatorShare, readerPrice: l.readerPrice,
    pricingModel: "net", margin: l.margin, costs: l.costs,
    lowestReference: offer.lowestReference?.price ?? null, lowestReferenceSource: sourceCode(offer.lowestReference?.source),
    availabilityToken: av.availabilityToken, availabilityAt: new Date(now).toISOString(), autocancelAt: av.autocancelDate ?? null, expiresAt: new Date(now + 20 * 60_000).toISOString(),
  });
}

/** Reader facing reference: NMD plus 6 digits, unambiguous to read over the phone. Unique index in the database backs it. */
export function newReference(): string {
  const n = 100000 + Math.floor(Math.random() * 900000);
  return `NMD ${n}`;
}

export interface GuestInput { firstName: string; lastName: string; email: string; phone?: string; title?: "mr" | "mrs" | "ms"; country?: string }

/** Create the booking row in "paying" and return the amount to charge. The caller creates the PaymentIntent. */
export async function startPayment(sf: Storefront, quote: Quote, guest: GuestInput, promoCode?: string, extraKinds: string[] = [], attribution: { clickId: string | null; source: string | null } = { clickId: null, source: null }): Promise<{ booking: Booking; amount: number; currency: string }> {
  if (Date.parse(quote.expiresAt) < Date.now()) throw new BookingError("QUOTE_EXPIRED", "This quote expired. Search again for a fresh price.");
  let discount = 0;
  if (promoCode) {
    const p = await db().promo(sf.id, promoCode);
    const live = p && p.active && (!p.maxUses || p.uses < p.maxUses) && (!p.startsAt || Date.parse(p.startsAt) <= Date.now()) && (!p.endsAt || Date.parse(p.endsAt) >= Date.now());
    if (!live) throw new BookingError("INVALID", "That code is not valid.");
    discount = Math.min(p.amountOff, quote.creatorShare); // a promo is paid out of the creator's share, never below Nomadly's net
  }
  const n = nights(quote.checkIn, quote.checkOut);
  const extras = [...new Set(extraKinds)].map((k) => extraByKind(k)).filter((x): x is NonNullable<typeof x> => !!x).map((x) => { const l = extraLedger(x.price, x.commission, termsOf(sf).extrasShare); return { kind: x.kind, name: x.name, price: l.price, commission: l.nomadlyCommission, creatorShare: l.creatorShare }; });
  const seq = Date.now().toString(36);
  const booking = await db().createBooking({
    reference: newReference(), clientRef: `nomadly-${seq}`.toLowerCase(), storefrontId: sf.id, creatorId: sf.creatorId, quoteId: quote.id, ebcId: quote.ebcId, ebcReservationId: null, hotelConfirmation: null,
    status: "paying", checkIn: quote.checkIn, checkOut: quote.checkOut, nights: n,
    guests: [{ firstName: guest.firstName.trim(), lastName: guest.lastName.trim(), type: "adult", lead: true }], leadEmail: guest.email.trim().toLowerCase(), leadPhone: guest.phone ?? null,
    roomName: null, board: quote.board, refundable: quote.refundable, cancelDeadline: quote.cancelDeadline, cancelCharge: quote.cancelCharge, currency: quote.currency,
    supplierNet: quote.supplierNet, nomadlyNet: quote.nomadlyNet, creatorRate: quote.creatorRate, creatorShare: quote.creatorShare, readerPrice: r2(quote.readerPrice - discount), cardFee: null,
    pricingModel: quote.pricingModel ?? "v1", margin: quote.margin ?? null, costs: quote.costs ?? null, clickId: attribution.clickId, source: attribution.source,
    extras, lowestReference: quote.lowestReference, lowestReferenceSource: quote.lowestReferenceSource, promoCode: promoCode ?? null, promoDiscount: discount,
    stripePaymentIntent: null, paidAt: null, canceledAt: null, voucherToken: null,
  });
  const amount = r2(booking.readerPrice + extras.reduce((a, x) => a + x.price, 0));
  await db().addEvent(booking.id, "payment_started", { amount, extras: extras.map((x) => x.kind) });
  return { booking, amount, currency: booking.currency };
}

/** Called from the Stripe webhook once the charge succeeded. Idempotent. */
export async function confirmPaid(bookingId: string, paymentIntentId: string, webhookBase: string): Promise<Booking> {
  const b = await db().booking(bookingId);
  if (!b) throw new BookingError("NOT_FOUND", "booking");
  if (b.status !== "paying") return b; // webhook replay
  const q = b.quoteId ? await db().quote(b.quoteId) : null;
  if (!q?.availabilityToken) throw new BookingError("QUOTE_EXPIRED", "quote lost");
  await db().updateBooking(b.id, { stripePaymentIntent: paymentIntentId, paidAt: new Date().toISOString() });
  // live hotel prices with test card payments: never reserve a real room on Veny's credit; finish as a demo
  if (bookingMode() === "demo") {
    await db().updateBooking(b.id, { status: "confirmed", demo: true, roomName: b.roomName ?? null });
    await db().addEvent(b.id, "demo_confirmed", { paymentIntentId, note: "no reservation made with the supplier" });
    const done = (await db().booking(b.id))!;
    try { const sent = await sendBookingEmail(done, webhookBase); await db().addEvent(b.id, sent ? "email_sent" : "email_skipped", { to: b.leadEmail }); } catch (e) { await db().addEvent(b.id, "email_failed", String(e)); }
    return done;
  }
  const lead = b.guests.find((g) => g.lead)!;
  const c = ebc();
  try {
    const dbl = await c.doubleBookingCheck(q.srk, q.hotelIndex, q.offerIndex, q.resultsToken, { availabilityToken: q.availabilityToken, rooms: [{ packageRoomToken: q.packageCode, travelers: [{ firstName: lead.firstName, lastName: lead.lastName }] }] });
    if (dbl.hasDoubleBookings) await db().addEvent(b.id, "double_booking_warning", dbl);
    const res = await c.book(q.srk, q.hotelIndex, q.offerIndex, q.resultsToken, {
      availabilityToken: q.availabilityToken, clientRef: b.clientRef,
      rooms: [{ packageRoomToken: q.packageCode, travelers: [{ reference: "t1", type: "adult", lead: true, title: "ms", firstName: lead.firstName, lastName: lead.lastName, email: b.leadEmail, phone: b.leadPhone ?? undefined }] }],
      payment: { method: "credit" },
    });
    const r = await c.reservation(res.id);
    let webhookId: number | undefined;
    try { webhookId = (await c.subscribeWebhook(res.id, `${webhookBase}/api/webhooks/ebc/${b.id}`)).id; } catch (e) { await db().addEvent(b.id, "webhook_subscribe_failed", String(e)); }
    let voucherToken: string | null = null;
    try { const docs = await c.documents(res.id); voucherToken = docs.documents.find((d) => d.code === "voucher")?.documents[0]?.token ?? null; } catch { /* voucher may arrive later by webhook */ }
    const status: Booking["status"] = res.status === "RQ" ? "on_request" : "confirmed";
    await db().updateBooking(b.id, { status, ebcReservationId: res.id, hotelConfirmation: r.hotelConfirmationNumber ?? null, roomName: r.rooms[0]?.name ?? null, voucherToken });
    await db().addEvent(b.id, "booked", { reservationId: res.id, status: res.status, webhookId });
    const done = (await db().booking(b.id))!;
    try { const sent = await sendBookingEmail(done, webhookBase); await db().addEvent(b.id, sent ? "email_sent" : "email_skipped", { to: b.leadEmail }); } catch (e) { await db().addEvent(b.id, "email_failed", String(e)); }
    return done;
  } catch (e) {
    // money was taken and the hotel did not confirm: mark failed; the refund job reads this state
    await db().updateBooking(b.id, { status: "failed" });
    await db().addEvent(b.id, "book_failed", e instanceof EbcError ? e.problem : String(e));
    throw new BookingError("SUPPLIER", "Payment succeeded but the hotel booking failed; refund scheduled.", e);
  }
}

/** What the reader was charged: room plus extras. */
export const chargedTotal = (b: Pick<Booking, "readerPrice" | "extras">) => r2(b.readerPrice + b.extras.reduce((a, x) => a + x.price, 0));

/** Penalty the reader would pay if canceling now, from the stored policy. */
export function penaltyNow(b: Pick<Booking, "refundable" | "cancelDeadline" | "cancelCharge" | "readerPrice">, now = Date.now()): number {
  if (!b.refundable) return b.readerPrice;
  if (b.cancelDeadline && Date.parse(b.cancelDeadline) < now) return b.cancelCharge ?? b.readerPrice;
  return 0;
}

export async function cancelBooking(bookingId: string): Promise<{ booking: Booking; penalty: number; refund: number }> {
  const b = await db().booking(bookingId);
  if (!b) throw new BookingError("NOT_FOUND", "booking");
  if (b.status === "canceled") return { booking: b, penalty: 0, refund: 0 };
  const penalty = penaltyNow(b);
  if (b.demo) { // nothing was reserved; the test payment is refunded by the caller like any other
    const refund = r2(chargedTotal(b) - penalty);
    await db().updateBooking(b.id, { status: "canceled", canceledAt: new Date().toISOString() });
    await db().addEvent(b.id, "canceled", { penalty, refund, demo: true });
    return { booking: (await db().booking(b.id))!, penalty, refund };
  }
  if (!b.ebcReservationId) throw new BookingError("INVALID", "nothing to cancel at the hotel");
  const r = await ebc().cancel(b.ebcReservationId);
  if (r.service.status !== "XX" && r.service.status !== "XP") throw new BookingError("SUPPLIER", "The hotel did not accept the cancellation", r);
  const refund = r2(chargedTotal(b) - penalty); // extras are refunded in full with the stay
  await db().updateBooking(b.id, { status: "canceled", canceledAt: new Date().toISOString() });
  await db().addEvent(b.id, "canceled", { penalty, refund, supplierStatus: r.service.status });
  return { booking: (await db().booking(b.id))!, penalty, refund };
}
