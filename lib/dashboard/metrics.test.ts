import { describe, expect, it } from "vitest";
import type { Booking, Click } from "@/lib/db/types";
import { payoutDateFor, summarize, transactions } from "./metrics";
import { stayLedger, extraLedger } from "@/lib/pricing/engine";

const l = stayLedger(800, 0.15);
const x = extraLedger(29, 9);
const base = (o: Partial<Booking>): Booking => ({
  id: "b1", reference: "NMD 1", clientRef: "c", storefrontId: "s", creatorId: "c", quoteId: null, ebcId: 1, ebcReservationId: 1, hotelConfirmation: null, status: "confirmed",
  checkIn: "2026-11-01", checkOut: "2026-11-03", nights: 2, guests: [], leadEmail: "a@b.c", leadPhone: null, roomName: null, board: "BB", refundable: true, cancelDeadline: null, cancelCharge: null,
  currency: "USD", supplierNet: l.supplierNet, nomadlyNet: l.nomadlyNet, creatorRate: 0.55, creatorShare: l.creatorShare, readerPrice: l.readerPrice, cardFee: null, pricingModel: "net", margin: l.margin, costs: l.costs,
  extras: [{ kind: "transfer", name: "Airport pickup", price: 29, commission: 9, creatorShare: x.creatorShare }], lowestReference: null, lowestReferenceSource: null, promoCode: null, promoDiscount: 0,
  stripePaymentIntent: null, paidAt: null, canceledAt: null, voucherToken: null, createdAt: "2026-10-20T10:00:00Z", source: "paris", ...o,
});
const click = (o: Partial<Click>): Click => ({ id: Math.random().toString(), storefrontId: "s", createdAt: "2026-10-19T10:00:00Z", source: "paris", article: null, target: "hotel", ebcId: 1, query: null, country: "CZ", device: "mobile", visitor: "v1", bot: false, ...o });

describe("dashboard", () => {
  it("pays on the 15th of the month after the stay", () => {
    expect(payoutDateFor("2026-11-03")).toBe("2026-12-15");
    expect(payoutDateFor("2026-12-31")).toBe("2027-01-15");
  });
  it("splits a booking into a hotel line and an add on line with the right statuses", () => {
    const txs = transactions([base({}), base({ id: "b2", reference: "NMD 2", checkOut: "2026-12-20", source: null, extras: [] }), base({ id: "b3", status: "canceled" }), base({ id: "b4", status: "paying" })], [], () => "Hotel", "2026-11-10");
    expect(txs.filter((t) => t.bookingId === "b1").map((t) => [t.category, t.tx, t.pay])).toEqual([["hotel", "Approved", "Ready"], ["transfer", "Approved", "Ready"]]);
    expect(txs.find((t) => t.bookingId === "b2")!.tx).toBe("Pending");
    expect(txs.find((t) => t.bookingId === "b3")!.commission).toBe(0);
    expect(txs.some((t) => t.bookingId === "b4")).toBe(false);
  });
  it("adds up clicks, conversion, EPC and commission, without bots or demo bookings", () => {
    const txs = transactions([base({}), base({ id: "d", demo: true })], [], () => "Hotel", "2026-11-10");
    const clicks = [click({}), click({ visitor: "v2" }), click({ bot: true }), click({ source: null, visitor: "v3" })];
    const s = summarize(clicks, txs, { since: "2026-10-01T00:00:00Z", until: "2026-11-01T00:00:00Z", days: 31 });
    expect(s.clicks).toBe(3);
    expect(s.visitors).toBe(3);
    expect(s.hotelBookings).toBe(1);
    expect(s.addOns).toBe(1);
    expect(s.commission).toBe(Math.round((l.creatorShare + x.creatorShare) * 100) / 100);
    expect(s.epc).toBe(Math.round((s.commission / 3) * 100) / 100);
    expect(s.sources.find((r) => r.source === "paris")).toMatchObject({ clicks: 2, bookings: 1 });
    expect(s.byStatus.ready).toBe(s.commission);
    expect(s.byStatus.nextPayout).toBe("2026-12-15");
  });
});
