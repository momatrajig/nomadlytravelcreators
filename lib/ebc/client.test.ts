import { beforeEach, describe, expect, it } from "vitest";
import { EbcClient, EbcError, cancellationDeadline } from "./client";
import { resetMock } from "./mock";

const cfg = { mode: "mock" as const, baseUrl: "https://www.ebookingcenter.com/tbs/reseller", clientId: "x", clientSecret: "y", scopes: "s", leaderNationalityId: 158, sellingChannel: "B2C" as const };

describe("ebc client against the mock transport (full booking path)", () => {
  beforeEach(() => resetMock());

  it("searches, prebooks, books, reads and cancels", async () => {
    const c = new EbcClient(cfg);
    const s = await c.searchSync({ accommodation: [515886, 322829], checkIn: "2026-12-03", checkOut: "2026-12-05", occupancy: { rooms: [{ adults: 1, childrenAges: [] }] } });
    expect(s.hotels).toHaveLength(2);
    const h = s.hotels[0]!, o = h.offers[0]!;
    const flex = o.packages.find((p) => p.packageCode.endsWith("-flex"))!;
    const av = await c.availability(s.srk, h.index, o.id, s.tokens.results, { packageToken: flex.packageToken, roomTokens: [flex.packageRooms[0]!.roomReferences[0]!.roomToken] });
    expect(av.price.selling.value).toBeCloseTo(328.48, 2);
    expect(cancellationDeadline(av.cancellationPolicy)).toEqual({ date: "2026-11-21T23:59:00", charge: 171.56 });
    const dbl = await c.doubleBookingCheck(s.srk, h.index, o.id, s.tokens.results, { availabilityToken: av.availabilityToken, rooms: [{ packageRoomToken: flex.packageRooms[0]!.packageRoomCode, travelers: [{ firstName: "Lina", lastName: "Reader" }] }] });
    expect(dbl.hasDoubleBookings).toBe(false);
    const b = await c.book(s.srk, h.index, o.id, s.tokens.results, {
      availabilityToken: av.availabilityToken, clientRef: "nomadly-test-1",
      rooms: [{ packageRoomToken: flex.packageRooms[0]!.packageRoomCode, travelers: [{ reference: "t1", type: "adult", lead: true, title: "ms", firstName: "Lina", lastName: "Reader", email: "l@example.com" }] }],
      payment: { method: "credit" },
    });
    expect(b.status).toBe("OK");
    const r = await c.reservation(b.id);
    expect(r.hotelConfirmationNumber).toMatch(/^HB/);
    expect((await c.reservationByRef("nomadly-test-1")).id).toBe(b.id);
    expect((await c.documents(b.id)).documents[0]!.code).toBe("voucher");
    const x = await c.cancel(b.id);
    expect(x.service.status).toBe("XX");
  });

  it("refuses a reused availability token", async () => {
    const c = new EbcClient(cfg);
    const s = await c.searchSync({ accommodation: [322826], checkIn: "2026-12-03", checkOut: "2026-12-05", occupancy: { rooms: [{ adults: 2, childrenAges: [] }] } });
    const h = s.hotels[0]!, o = h.offers[0]!, p = o.packages[0]!;
    const av = await c.availability(s.srk, h.index, o.id, s.tokens.results, { packageToken: p.packageToken, roomTokens: [p.packageRooms[0]!.roomReferences[0]!.roomToken] });
    const req = { availabilityToken: av.availabilityToken, clientRef: "nomadly-test-2", rooms: [{ packageRoomToken: p.packageRooms[0]!.packageRoomCode, travelers: [{ reference: "t1", type: "adult" as const, lead: true, title: "mr" as const, firstName: "A", lastName: "B" }] }], payment: { method: "credit" as const } };
    await c.book(s.srk, h.index, o.id, s.tokens.results, req);
    await expect(c.book(s.srk, h.index, o.id, s.tokens.results, { ...req, clientRef: "nomadly-test-3" })).rejects.toMatchObject({ code: "AVAILABILITY_TOKEN_EXPIRED" });
  });

  it("validates book input before calling the API", async () => {
    const c = new EbcClient(cfg);
    const base = { availabilityToken: "a", clientRef: "ok-1", rooms: [{ packageRoomToken: "p", travelers: [{ reference: "t1", type: "adult" as const, lead: false, title: "mr" as const, firstName: "A", lastName: "B" }] }], payment: { method: "credit" as const } };
    expect(() => c.book("s", 1, "o", "t", base)).toThrow(/lead/);
    expect(() => c.book("s", 1, "o", "t", { ...base, clientRef: "bad ref!" })).toThrow(/clientRef/);
    expect(() => c.searchSync({ accommodation: [], checkIn: "2026-12-03", checkOut: "2026-12-05", occupancy: { rooms: [] } })).toThrow(RangeError);
  });

  it("retries 429 and 5xx with backoff, refreshes on 401, surfaces rate limit headers", async () => {
    let calls = 0; const sleeps: number[] = [];
    const f: typeof fetch = async (input) => {
      const u = String(input instanceof Request ? input.url : input);
      if (u.endsWith("/oauth2/token")) return new Response(JSON.stringify({ access_token: `t${calls}`, expires_in: 3600 }), { status: 200 });
      calls++;
      if (calls === 1) return new Response("", { status: 429, headers: { "retry-after": "2" } });
      if (calls === 2) return new Response("", { status: 503 });
      if (calls === 3) return new Response("", { status: 401 });
      return new Response(JSON.stringify({ resellerId: 1, enabled: true, active: true, unlimited: false, available: { value: 1, currency: "USD" } }), { status: 200, headers: { "x-ratelimit-limit": "100", "x-ratelimit-remaining": "7", "x-ratelimit-reset": "1800000000" } });
    };
    const c = new EbcClient({ ...cfg, mode: "live", fetch: f, sleep: async (ms) => { sleeps.push(ms); } });
    const cr = await c.credit();
    expect(cr.enabled).toBe(true);
    expect(calls).toBe(4);
    expect(sleeps[0]).toBe(2000);
    expect(c.lastRateLimit).toEqual({ limit: 100, remaining: 7, resetAt: 1_800_000_000_000 });
  });

  it("wraps RFC 7807 problems", async () => {
    const f: typeof fetch = async (input) => String(input instanceof Request ? input.url : input).endsWith("/oauth2/token")
      ? new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }))
      : new Response(JSON.stringify({ title: "Bad Request", status: 400, detail: "OFFER_RECONFIGURED" }), { status: 400 });
    const c = new EbcClient({ ...cfg, mode: "live", fetch: f });
    const err = await c.credit().catch((e) => e);
    expect(err).toBeInstanceOf(EbcError);
    expect(err.code).toBe("OFFER_RECONFIGURED");
  });
});
