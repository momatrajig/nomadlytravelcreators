import { describe, expect, it } from "vitest";
import type { Booking } from "@/lib/db/types";
import { cancelStages, priceLines, tripSteps } from "./itinerary";

const b = (o: Partial<Booking> = {}): Booking => ({
  id: "b", reference: "NMD 1", clientRef: "c", storefrontId: "s", creatorId: "c", quoteId: null, ebcId: 1, ebcReservationId: 1, hotelConfirmation: null, status: "confirmed",
  checkIn: "2026-12-09", checkOut: "2026-12-11", nights: 2, guests: [{ firstName: "A", lastName: "B", type: "adult", lead: true }], leadEmail: "a@b.c", leadPhone: null,
  roomName: "Deluxe Room", board: "BB", refundable: true, cancelDeadline: "2026-12-05T23:59:00", cancelCharge: 400, currency: "USD",
  supplierNet: 700, nomadlyNet: 80, creatorRate: 0.55, creatorShare: 44, readerPrice: 900, cardFee: 26,
  extras: [{ kind: "transfer", name: "Airport pickup, private car, Standard", detail: "Charles de Gaulle (CDG) and back, Toyota Camry or similar", price: 156, commission: 54.6, creatorShare: 25 }],
  lowestReference: null, lowestReferenceSource: null, promoCode: "XMAS", promoDiscount: 50, stripePaymentIntent: null, paidAt: "2026-11-11T10:00:00Z", canceledAt: null, voucherToken: null, createdAt: "2026-11-11T09:59:00Z",
  ...o,
});

describe("booking itinerary", () => {
  it("lists the room before the discount, the discount, then each add on; total is what was charged", () => {
    const { lines, total } = priceLines(b(), "en", (v) => `$${v}`);
    expect(lines.map((l) => [l.kind, l.amount])).toEqual([["room", 950], ["discount", -50], ["extra", 156]]);
    expect(total).toBe(1056);
    expect(lines[0]!.detail).toContain("$475 a night");
  });
  it("puts the trip in order with a ride each way for a return transfer", () => {
    const s = tripSteps(b(), "en").map((x) => `${x.date} ${x.kind}`);
    expect(s).toEqual(["2026-11-11 booked", "2026-12-05 deadline", "2026-12-09 ride", "2026-12-09 checkin", "2026-12-11 checkout", "2026-12-11 ride"]);
  });
  it("marks the stage that applies now, with its penalty and refund", () => {
    const early = cancelStages(b(), "en", Date.parse("2026-11-20T10:00:00Z"));
    expect(early.find((x) => x.now)?.title).toBe("Free cancellation");
    expect(early[0]).toMatchObject({ charge: 0, refund: 1056 });
    expect(early[1]).toMatchObject({ charge: 400, refund: 656 });
    expect(early[2]).toMatchObject({ charge: 900, refund: 156 });
    expect(cancelStages(b(), "en", Date.parse("2026-12-07T10:00:00Z")).find((x) => x.now)?.title).toBe("After the free period");
    expect(cancelStages(b(), "en", Date.parse("2026-12-09T10:00:00Z")).find((x) => x.now)?.title).toBe("No show or after check in");
  });
  it("a non refundable rate is one red stage", () => {
    const s = cancelStages(b({ refundable: false }), "en");
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ tone: "bad", charge: 900, refund: 156, now: true });
  });
});

describe("a free period that ended before booking", () => {
  const late = b({ cancelDeadline: "2026-11-07T17:17:00", cancelCharge: 835.67, paidAt: "2026-11-11T10:00:00Z" });
  it("is never shown as free: no deadline step, no green stage, the fee applies now", () => {
    expect(tripSteps(late, "en").some((s) => s.kind === "deadline")).toBe(false);
    const st = cancelStages(late, "en", Date.parse("2026-11-12T10:00:00Z"));
    expect(st.map((s) => s.tone)).toEqual(["warn", "bad"]);
    expect(st[0]).toMatchObject({ title: "Until check in", charge: 835.67, now: true });
  });
});
