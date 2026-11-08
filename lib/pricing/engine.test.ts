import { describe, expect, it } from "vitest";
import { cardFee, flightLedger, lowestReference, monthlyProjection, parityCeiling, readerPrice, saving, stayLedger } from "./engine";

describe("option D stay ledger", () => {
  it("matches the brochure worked example (USD 320 net, 8 percent)", () => {
    const l = stayLedger(320, 0.08);
    expect(l.nomadlyNet).toBe(342.4);
    expect(l.creatorShare).toBe(27.39);
    expect(l.readerPrice).toBe(369.79);
    expect(l.nomadlyGross).toBe(22.4);
    expect(l.cardFee).toBe(cardFee(369.79));
    expect(l.nomadlyKeeps).toBe(Math.round((22.4 - l.cardFee) * 100) / 100);
  });
  it("matches the dashboard worked example (USD 800 net)", () => {
    const l = stayLedger(800, 0.08);
    expect(l.nomadlyNet).toBe(856);
    expect(l.creatorShare).toBe(68.48);
    expect(l.readerPrice).toBe(924.48);
    expect(l.cardFee).toBe(27.11);
    expect(l.nomadlyKeeps).toBe(28.89);
  });
  it("creator share is never reduced by the card fee", () => {
    const l = stayLedger(500, 0.05);
    expect(l.creatorShare).toBe(26.75);
    expect(l.nomadlyKeeps).toBeLessThan(l.nomadlyGross);
  });
  it("rejects rates outside the dial", () => {
    expect(() => stayLedger(300, 0.09)).toThrow(RangeError);
    expect(() => stayLedger(300, -0.01)).toThrow(RangeError);
  });
});

describe("parity guard", () => {
  const q = (price: number, source = "Booking.com") => ({ source, price, checkedAt: "2026-11-08T10:00:00Z" });
  it("finds the lowest reference", () => {
    expect(lowestReference([q(404), q(409, "Expedia"), q(399, "Agoda")])?.price).toBe(399);
    expect(lowestReference([])).toBeNull();
  });
  it("saving is positive below the big sites and negative above", () => {
    expect(saving(320, 0.08, [q(400)])).toBe(30.21);
    expect(saving(380, 0.08, [q(400)])).toBeLessThan(0);
    expect(saving(320, 0.08, [])).toBeNull();
  });
  it("ceiling is the tightest hotel, rounded down to the dial step", () => {
    // hotel A: nn 342.40 vs 400 -> 16.8 percent; hotel B: nn 321 vs 340 -> 5.9 percent
    const c = parityCeiling([
      { supplierNet: 320, quotes: [q(400)] },
      { supplierNet: 300, quotes: [q(340)] },
    ]);
    expect(c).toBe(0.055);
    expect(readerPrice(300, c)).toBeLessThanOrEqual(340);
  });
  it("hotels without quotes do not constrain; max is 8 percent", () => {
    expect(parityCeiling([{ supplierNet: 320, quotes: [] }])).toBe(0.08);
    expect(parityCeiling([{ supplierNet: 320, quotes: [q(400)] }])).toBe(0.08);
  });
  it("ceiling is zero when a hotel is above the big sites even at zero", () => {
    expect(parityCeiling([{ supplierNet: 380, quotes: [q(400)] }])).toBe(0);
  });
});

describe("flights and projections", () => {
  it("flight ledger adds the flat fees", () => {
    const f = flightLedger(420, 5);
    expect(f.readerPrice).toBe(428);
    expect(f.creatorShare).toBe(5);
  });
  it("monthly projection follows the published booking rate", () => {
    const p = monthlyProjection(40000, 0.2, 640, 0.08);
    expect(p.bookings).toBe(80);
    expect(p.perBooking).toBeGreaterThan(45);
    expect(p.perBooking).toBeLessThan(49);
    expect(p.monthly).toBe(Math.round(p.bookings * p.perBooking * 100) / 100);
  });
});
