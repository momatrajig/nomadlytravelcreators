/**
 * Nomadly pricing engine, option D.
 *
 * One function family computes every number shown anywhere (storefront, dashboard,
 * checkout, payout statements). Nothing else may do price arithmetic.
 *
 * Model (per stay, in the selling currency):
 *   supplierNet      what the hotel receives (eBooking "supplier" component, or selling if components hidden)
 *   nomadlyNet       supplierNet * (1 + NOMADLY_MARKUP)           Nomadly's 7 percent lives here
 *   creatorShare     nomadlyNet * creatorRate                      0 to 8 percent, chosen by the creator
 *   readerPrice      nomadlyNet + creatorShare                      what the reader pays
 *   cardFee          readerPrice * 0.029 + 0.30                     paid by Nomadly, never by the creator
 *   nomadlyKeeps     nomadlyNet - supplierNet - cardFee
 *
 * Parity guard: a creator rate is only allowed if readerPrice <= lowest reference quote
 * for every pinned hotel with a live quote. The guard returns the ceiling rate, and the
 * dashboard dial stops there.
 */

export const NOMADLY_MARKUP = 0.07;
export const CREATOR_RATE_MAX = 0.08;
export const CARD_FEE_RATE = 0.029;
export const CARD_FEE_FIXED = 0.3;
export const FLIGHT_FLAT_FEE = 3; // USD per ticket, Nomadly
export const EXTRAS_CREATOR_SHARE_OF_COMMISSION = 0.5;

export type Money = number; // major units, 2 dp after rounding

export const r2 = (x: number): Money => Math.round((x + Number.EPSILON) * 100) / 100;

export interface StayLedger {
  supplierNet: Money;
  nomadlyNet: Money;
  creatorRate: number;
  creatorShare: Money;
  readerPrice: Money;
  cardFee: Money;
  nomadlyGross: Money; // nomadlyNet - supplierNet
  nomadlyKeeps: Money; // nomadlyGross - cardFee
}

export function assertRate(rate: number): void {
  if (!Number.isFinite(rate) || rate < 0 || rate > CREATOR_RATE_MAX + 1e-9) {
    throw new RangeError(`creator rate ${rate} outside 0..${CREATOR_RATE_MAX}`);
  }
}

export function nomadlyNet(supplierNet: Money): Money {
  return r2(supplierNet * (1 + NOMADLY_MARKUP));
}

export function readerPrice(supplierNet: Money, creatorRate: number): Money {
  assertRate(creatorRate);
  const nn = nomadlyNet(supplierNet);
  return r2(nn + r2(nn * creatorRate));
}

export function cardFee(charged: Money): Money {
  return r2(charged * CARD_FEE_RATE + CARD_FEE_FIXED);
}

export function stayLedger(supplierNet: Money, creatorRate: number): StayLedger {
  assertRate(creatorRate);
  const nn = nomadlyNet(supplierNet);
  const creatorShare = r2(nn * creatorRate);
  const rp = r2(nn + creatorShare);
  const fee = cardFee(rp);
  const nomadlyGross = r2(nn - supplierNet);
  return {
    supplierNet: r2(supplierNet),
    nomadlyNet: nn,
    creatorRate,
    creatorShare,
    readerPrice: rp,
    cardFee: fee,
    nomadlyGross,
    nomadlyKeeps: r2(nomadlyGross - fee),
  };
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
export function saving(supplierNet: Money, creatorRate: number, quotes: ReferenceQuote[]): Money | null {
  const low = lowestReference(quotes);
  if (!low) return null;
  return r2(low.price - readerPrice(supplierNet, creatorRate));
}

/**
 * The highest creator rate at which every hotel with a live quote stays at or below
 * its lowest reference. Hotels without quotes do not constrain. Clamped to [0, max].
 */
export function parityCeiling(
  hotels: Array<{ supplierNet: Money; quotes: ReferenceQuote[] }>,
  step = 0.005,
): number {
  let ceiling = CREATOR_RATE_MAX;
  for (const h of hotels) {
    const low = lowestReference(h.quotes);
    if (!low) continue;
    const nn = nomadlyNet(h.supplierNet);
    // readerPrice = nn * (1 + rate) <= low  =>  rate <= low / nn - 1
    const maxRate = low.price / nn - 1;
    ceiling = Math.min(ceiling, maxRate);
  }
  if (ceiling <= 0) return 0;
  // round DOWN to the dial step so the dial never lands above the ceiling
  return Math.min(CREATOR_RATE_MAX, Math.floor(ceiling / step + 1e-9) * step);
}

export function flightLedger(fare: Money, creatorFlat: Money) {
  const readerPays = r2(fare + FLIGHT_FLAT_FEE + creatorFlat);
  const fee = cardFee(readerPays);
  return { fare: r2(fare), nomadlyFee: FLIGHT_FLAT_FEE, creatorShare: r2(creatorFlat), readerPrice: readerPays, cardFee: fee, nomadlyKeeps: r2(FLIGHT_FLAT_FEE - fee) };
}

export function extraLedger(price: Money, nomadlyCommission: Money) {
  const creatorShare = r2(nomadlyCommission * EXTRAS_CREATOR_SHARE_OF_COMMISSION);
  return { price: r2(price), nomadlyCommission: r2(nomadlyCommission), creatorShare, nomadlyKeeps: r2(nomadlyCommission - creatorShare) };
}

/** Monthly projection used by the dashboard calculator. Bookings per 1,000 readers published by creators: 1.5 to 2.5. */
export function monthlyProjection(readers: number, bookRatePct: number, avgReaderPrice: Money, creatorRate: number) {
  const bookings = Math.round(readers * (bookRatePct / 100));
  const supplierNet = avgReaderPrice / (1 + NOMADLY_MARKUP) / (1 + creatorRate);
  const per = stayLedger(supplierNet, creatorRate).creatorShare;
  return { bookings, perBooking: per, monthly: r2(bookings * per) };
}
