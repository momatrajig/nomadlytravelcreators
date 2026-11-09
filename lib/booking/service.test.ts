import { beforeEach, describe, expect, it } from "vitest";
import { resetMock } from "@/lib/ebc/mock";
import { db } from "@/lib/db";
import { cancelBooking, confirmPaid, holdQuote, penaltyNow, searchStays, startPayment } from "./service";

process.env.EBC_MODE = "mock";
process.env.DATA_MODE = "local";
process.env.NOMADLY_PIN_ALL = "1";

describe("booking service end to end on fixtures", () => {
  beforeEach(() => resetMock());

  it("searches the pinned hotels, prices them with option D and reports savings", async () => {
    const sf = (await db().storefrontBySlug("lina"))!;
    const r = await searchStays(sf, "2026-12-03", "2026-12-05", 1);
    expect(r.offers).toHaveLength(37);
    expect(r.rate).toBe(0.08); // ceiling is 10.5 percent, above the dial max
    const ic = r.offers.find((o) => o.ebcId === 515886)!;
    const flex = ic.rates.find((x) => x.refundable && x.board === "RO")!;
    expect(flex.supplierNet).toBe(328.48);
    expect(flex.readerPrice).toBe(379.59);
    expect(ic.lowestReference?.price).toBe(404);
    expect(ic.saving).toBe(24.41);
    for (const o of r.offers) if (o.saving !== null) expect(o.saving).toBeGreaterThan(0);
  });

  it("holds a quote, takes payment, books, and cancels free before the deadline", async () => {
    const sf = (await db().storefrontBySlug("lina"))!;
    const r = await searchStays(sf, "2026-12-03", "2026-12-05", 1);
    const ic = r.offers.find((o) => o.ebcId === 515886)!;
    const flex = ic.rates.find((x) => x.refundable && x.board === "RO")!;
    const q = await holdQuote(sf, ic, flex.packageCode, "2026-12-03", "2026-12-05", [{ adults: 1, childrenAges: [] }]);
    expect(q.availabilityToken).toMatch(/^av\./);
    expect(q.readerPrice).toBe(379.59);
    expect(q.cancelDeadline).toBe("2026-11-21T23:59:00");
    // stored as the database enum code, never the display label
    expect(["booking", "expedia", "agoda", "tripcom", "hotel", null]).toContain(q.lowestReferenceSource);
    const { booking, amount } = await startPayment(sf, q, { firstName: "Lina", lastName: "Reader", email: "L@Example.com" }, "LISBON10");
    expect(amount).toBe(369.59); // promo comes out of the creator share
    expect(booking.status).toBe("paying");
    expect(booking.leadEmail).toBe("l@example.com");
    const confirmed = await confirmPaid(booking.id, "pi_test_1", "https://stays.wanderwithlina.com");
    expect(confirmed.status).toBe("confirmed");
    expect(confirmed.hotelConfirmation).toMatch(/^HB/);
    expect(confirmed.voucherToken).toBe(`doc-${confirmed.ebcReservationId}`);
    // replaying the webhook does nothing
    expect((await confirmPaid(booking.id, "pi_test_1", "x")).status).toBe("confirmed");
    const c = await cancelBooking(booking.id);
    expect(c.penalty).toBe(0);
    expect(c.refund).toBe(369.59);
    expect(c.booking.status).toBe("canceled");
  });

  it("an on request hotel books as on_request", async () => {
    const sf = (await db().storefrontBySlug("lina"))!;
    const r = await searchStays(sf, "2026-12-03", "2026-12-05", 1);
    const uni = r.offers.find((o) => o.ebcId === 2218071)!;
    const rate = uni.rates.find((x) => x.refundable)!;
    expect(rate.onRequest).toBe(true);
    const q = await holdQuote(sf, uni, rate.packageCode, "2026-12-03", "2026-12-05", [{ adults: 1, childrenAges: [] }]);
    const { booking } = await startPayment(sf, q, { firstName: "A", lastName: "B", email: "a@b.c" });
    expect((await confirmPaid(booking.id, "pi_2", "x")).status).toBe("on_request");
  });

  it("rejects an invalid promo and an expired quote", async () => {
    const sf = (await db().storefrontBySlug("lina"))!;
    const r = await searchStays(sf, "2026-12-03", "2026-12-05", 1);
    const o = r.offers[0]!;
    const q = await holdQuote(sf, o, o.rates[0]!.packageCode, "2026-12-03", "2026-12-05", [{ adults: 1, childrenAges: [] }]);
    await expect(startPayment(sf, q, { firstName: "A", lastName: "B", email: "a@b.c" }, "NOPE")).rejects.toMatchObject({ code: "INVALID" });
    await db().updateQuote(q.id, { expiresAt: new Date(Date.now() - 1000).toISOString() });
    await expect(startPayment(sf, (await db().quote(q.id))!, { firstName: "A", lastName: "B", email: "a@b.c" })).rejects.toMatchObject({ code: "QUOTE_EXPIRED" });
  });

  it("penalty follows the policy", () => {
    const base = { refundable: true, cancelDeadline: "2026-11-21T23:59:00", cancelCharge: 171.56, readerPrice: 379.61 };
    expect(penaltyNow(base, Date.parse("2026-11-10T00:00:00"))).toBe(0);
    expect(penaltyNow(base, Date.parse("2026-11-25T00:00:00"))).toBe(171.56);
    expect(penaltyNow({ ...base, refundable: false }, Date.parse("2026-11-10T00:00:00"))).toBe(379.61);
  });
});

describe("extras", () => {
  it("adds Veny services to the charge and refunds them with the stay", async () => {
    resetMock();
    const sf = (await db().storefrontBySlug("lina"))!;
    const r = await searchStays(sf, "2026-12-03", "2026-12-05", 1);
    const o = r.offers.find((x) => x.ebcId === 515886)!;
    const q = await holdQuote(sf, o, o.rates.find((x) => x.refundable)!.packageCode, "2026-12-03", "2026-12-05", [{ adults: 1, childrenAges: [] }]);
    const { booking, amount } = await startPayment(sf, q, { firstName: "A", lastName: "B", email: "a@b.c" }, undefined, ["transfer", "esim", "esim"]);
    expect(booking.extras.map((x) => x.kind)).toEqual(["transfer", "esim"]);
    expect(amount).toBe(379.59 + 29 + 12);
    expect(booking.extras[0]!.creatorShare).toBe(4.5);
    await confirmPaid(booking.id, "pi_x", "https://x");
    const c = await cancelBooking(booking.id);
    expect(c.refund).toBe(420.59);
  });
});
