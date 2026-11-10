import { describe, expect, it } from "vitest";
import { cardFee, extraLedger, lowestReference, markupCeiling, MIN_MARKUP, monthlyProjection, readerPrice, saving, shareOf, stayLedger, termsOf } from "./engine";

describe("net revenue share, hotels", () => {
  it("matches the brochure: retail 4,000, commission 1,200, costs 170", () => {
    const s = shareOf(4000, 1200, 170);
    expect(s.net).toBe(1030);
    expect(s.creatorShare).toBe(566.5);
    expect(s.ofBookingValue).toBeCloseTo(0.1416, 4);
  });
  it("prices a stay from the supplier net and the markup", () => {
    const l = stayLedger(800, 0.15);
    expect(l.readerPrice).toBe(920);
    expect(l.margin).toBe(120);
    expect(l.costs).toBe(cardFee(920));
    expect(l.costs).toBe(26.98);
    expect(l.nomadlyNet).toBe(93.02);
    expect(l.creatorShare).toBe(51.16);
    expect(l.nomadlyKeeps).toBe(41.86);
    expect(l.creatorRate).toBe(0.55);
  });
  it("creator share plus Nomadly's part is always the net revenue", () => {
    for (const [n, m] of [[123.45, 0.1], [999.99, 0.22], [60, 0.05]] as const) {
      const l = stayLedger(n, m);
      expect(l.creatorShare + l.nomadlyKeeps).toBeCloseTo(l.nomadlyNet, 2);
      expect(l.supplierNet + l.margin).toBeCloseTo(l.readerPrice, 2);
    }
  });
  it("a negative net never becomes a negative share", () => {
    const l = stayLedger(5, 0.01);
    expect(l.nomadlyNet).toBeLessThan(0);
    expect(l.creatorShare).toBe(0);
  });
  it("rejects markups and shares out of range", () => {
    expect(() => stayLedger(300, 0.7)).toThrow(RangeError);
    expect(() => stayLedger(300, -0.01)).toThrow(RangeError);
    expect(() => stayLedger(300, 0.1, 1.2)).toThrow(RangeError);
  });
  it("reads a storefront's terms with defaults", () => {
    expect(termsOf({})).toEqual({ markup: 0.15, hotelShare: 0.55, extrasShare: 0.5 });
    expect(termsOf({ markup: 0.2, hotelShare: 0.6 }).markup).toBe(0.2);
  });
});

describe("add ons", () => {
  it("matches the brochure ride: 29.00, commission 10.15, the creator takes half of the net", () => {
    const l = extraLedger(29, 10.15);
    expect(l.costs).toBe(0.84);
    expect(l.net).toBe(9.31);
    expect(l.creatorShare).toBe(4.66);
    expect(l.creatorShare + l.nomadlyKeeps).toBeCloseTo(l.net, 2);
  });
});

describe("parity guard", () => {
  const q = (price: number, source = "Booking.com") => ({ source, price, checkedAt: "2026-11-08T10:00:00Z" });
  it("finds the lowest reference", () => {
    expect(lowestReference([q(404), q(409, "Expedia"), q(399, "Agoda")])?.price).toBe(399);
    expect(lowestReference([])).toBeNull();
  });
  it("saving is positive below the big sites and negative above", () => {
    expect(saving(320, 0.15, [q(400)])).toBe(32);
    expect(saving(320, 0.15, [q(360)])).toBe(-8);
  });
  it("caps the markup so the reader price stays at or below the lowest reference", () => {
    const m = markupCeiling([{ supplierNet: 300, quotes: [q(330)] }], 0.15);
    expect(m).toBe(0.1);
    expect(readerPrice(300, m)).toBeLessThanOrEqual(330);
    expect(markupCeiling([{ supplierNet: 300, quotes: [] }], 0.15)).toBe(0.15);
    expect(markupCeiling([{ supplierNet: 300, quotes: [q(301)] }], 0.15)).toBe(MIN_MARKUP);
  });
});

describe("projection", () => {
  it("projects monthly earnings and EPC", () => {
    const p = monthlyProjection(10000, 0.5, 460);
    expect(p.bookings).toBe(50);
    expect(p.perBooking).toBe(stayLedger(400, 0.15).creatorShare);
    expect(p.epc).toBe(Math.round((p.monthly / 10000) * 100) / 100);
  });
});
