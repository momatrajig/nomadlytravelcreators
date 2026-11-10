/**
 * Nomadly pricing engine: the net revenue share model.
 *
 * One function family computes every number shown anywhere (storefront, dashboard, checkout, payout
 * statements). Nothing else may do price arithmetic.
 *
 * Per stay, in the selling currency:
 *   supplierNet    what the hotel (through the wholesaler) receives
 *   readerPrice    supplierNet * (1 + markup)            Nomadly sets the markup per storefront
 *   margin         readerPrice - supplierNet             Nomadly's commission on the booking
 *   costs          card fee on what the reader pays       transaction costs
 *   nomadlyNet     margin - costs                         Nomadly's net revenue
 *   creatorShare   max(nomadlyNet, 0) * share             55 percent on hotels by default
 *   nomadlyKeeps   nomadlyNet - creatorShare
 *
 * Add ons (transfers, eSIM, bag and delay cover): Nomadly's commission less the card fee on the item's
 * price, shared at 50 percent by default.
 *
 * Parity guard: where a big site price was recorded for the same room and dates, the markup is capped so
 * the reader price stays at or below it (never under the floor markup).
 */

export const DEFAULT_MARKUP = 0.15;
export const MIN_MARKUP = 0.05;
export const MAX_MARKUP = 0.6;
export const HOTEL_SHARE = 0.55;
export const EXTRAS_SHARE = 0.5;
export const CARD_FEE_RATE = 0.029;
export const CARD_FEE_FIXED = 0.3;
export const FLIGHT_FLAT_FEE = 3; // USD per ticket, Nomadly (flights: coming soon, fixed margin)

export type Money = number; // major units, 2 dp after rounding
export const r2 = (x: number): Money => Math.round((x + Number.EPSILON) * 100) / 100;

export interface Terms { markup: number; hotelShare: number; extrasShare: number }
export const DEFAULT_TERMS: Terms = { markup: DEFAULT_MARKUP, hotelShare: HOTEL_SHARE, extrasShare: EXTRAS_SHARE };
/** a storefront's commercial terms, defaults where the row predates them */
export function termsOf(sf: { markup?: number | null; hotelShare?: number | null; extrasShare?: number | null }): Terms {
  const n = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v !== "" && Number.isFinite(Number(v)) ? Number(v) : d);
  return { markup: n(sf.markup, DEFAULT_MARKUP), hotelShare: n(sf.hotelShare, HOTEL_SHARE), extrasShare: n(sf.extrasShare, EXTRAS_SHARE) };
}

export function assertMarkup(m: number): void {
  if (!Number.isFinite(m) || m < 0 || m > MAX_MARKUP + 1e-9) throw new RangeError(`markup ${m} outside 0..${MAX_MARKUP}`);
}
export function assertShare(s: number): void {
  if (!Number.isFinite(s) || s < 0 || s > 1) throw new RangeError(`share ${s} outside 0..1`);
}

export function cardFee(charged: Money): Money {
  return r2(charged * CARD_FEE_RATE + CARD_FEE_FIXED);
}

export interface StayLedger {
  supplierNet: Money; markup: number; readerPrice: Money; margin: Money; costs: Money;
  /** Nomadly's net revenue: margin less transaction costs */
  nomadlyNet: Money;
  /** the creator's share of the net revenue (0.55 means 55 percent) */
  creatorRate: number;
  creatorShare: Money; nomadlyKeeps: Money;
  /** creator share as a fraction of what the reader pays, for display */
  ofBookingValue: number;
}

export function readerPrice(supplierNet: Money, markup: number): Money {
  assertMarkup(markup);
  return r2(supplierNet * (1 + markup));
}

export function stayLedger(supplierNet: Money, markup: number, share = HOTEL_SHARE): StayLedger {
  assertMarkup(markup); assertShare(share);
  const sn = r2(supplierNet);
  const rp = readerPrice(sn, markup);
  const margin = r2(rp - sn);
  const costs = cardFee(rp);
  const net = r2(margin - costs);
  const creatorShare = r2(Math.max(net, 0) * share);
  return { supplierNet: sn, markup, readerPrice: rp, margin, costs, nomadlyNet: net, creatorRate: share, creatorShare, nomadlyKeeps: r2(net - creatorShare), ofBookingValue: rp > 0 ? creatorShare / rp : 0 };
}

/**
 * The same split for any price and commission, as the brochure states it
 * (retail 4,000, commission 1,200, costs 170: net 1,030, the creator takes 566.50).
 */
export function shareOf(retail: Money, commission: Money, costs: Money, share = HOTEL_SHARE) {
  const net = r2(commission - costs);
  const creatorShare = r2(Math.max(net, 0) * share);
  return { net, creatorShare, ofBookingValue: retail > 0 ? creatorShare / retail : 0 };
}

export interface ReferenceQuote {
  source: string; // "Booking.com", "Expedia", "Agoda"
  price: Money; // same room, dates, guests, signed out price
  checkedAt: string; // ISO timestamp
}

export function lowestReference(quotes: ReferenceQuote[]): ReferenceQuote | null {
  if (!quotes.length) return null;
  return quotes.reduce((a, b) => (b.price < a.price ? b : a));
}

/** Saving the reader makes against the lowest big site quote. Negative means we are above. */
export function saving(supplierNet: Money, markup: number, quotes: ReferenceQuote[]): Money | null {
  const low = lowestReference(quotes);
  if (!low) return null;
  return r2(low.price - readerPrice(supplierNet, markup));
}

/**
 * The highest markup at which every hotel with a recorded reference stays at or below it. Hotels without
 * references do not constrain. Clamped to [MIN_MARKUP, wanted]; rounded down to the step.
 */
export function markupCeiling(hotels: Array<{ supplierNet: Money; quotes: ReferenceQuote[] }>, wanted: number, step = 0.005): number {
  let ceiling = wanted;
  for (const h of hotels) {
    const low = lowestReference(h.quotes);
    if (!low || h.supplierNet <= 0) continue;
    ceiling = Math.min(ceiling, low.price / h.supplierNet - 1);
  }
  const stepped = Math.floor(ceiling / step + 1e-9) * step;
  return Math.max(MIN_MARKUP, Math.min(wanted, r2(stepped * 1000) / 1000));
}

export function flightLedger(fare: Money) {
  const readerPays = r2(fare + FLIGHT_FLAT_FEE);
  const fee = cardFee(readerPays);
  return { fare: r2(fare), nomadlyFee: FLIGHT_FLAT_FEE, readerPrice: readerPays, cardFee: fee, nomadlyKeeps: r2(FLIGHT_FLAT_FEE - fee) };
}

/** An add on: Nomadly's commission less the card fee on the item's price, shared with the creator. */
export function extraLedger(price: Money, nomadlyCommission: Money, share = EXTRAS_SHARE) {
  assertShare(share);
  const costs = r2(price * CARD_FEE_RATE);
  const net = r2(nomadlyCommission - costs);
  const creatorShare = r2(Math.max(net, 0) * share);
  return { price: r2(price), nomadlyCommission: r2(nomadlyCommission), costs, net, creatorShare, nomadlyKeeps: r2(net - creatorShare) };
}

/** Monthly projection for the dashboard calculator. */
export function monthlyProjection(clicks: number, conversionPct: number, avgReaderPrice: Money, markup = DEFAULT_MARKUP, share = HOTEL_SHARE) {
  const bookings = Math.round(clicks * (conversionPct / 100));
  const per = stayLedger(avgReaderPrice / (1 + markup), markup, share).creatorShare;
  return { bookings, perBooking: per, monthly: r2(bookings * per), epc: clicks ? r2((bookings * per) / clicks) : 0 };
}
