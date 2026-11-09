/**
 * Fixture backed transport for EBC_MODE=mock. Implements the subset of the IRIX API the
 * product calls, with the same shapes, tokens that expire, and the failure cases that
 * matter (expired availability token, offer reconfigured, non refundable, on request).
 */
import lisbonFx from "./fixtures/lisbon.json";
import portugalFx from "./fixtures/portugal.json";
const lisbon = [...lisbonFx, ...portugalFx];
import type { AvailabilityResponse, BookRequest, BookResponse, Offer, Reservation, SearchHotel, SearchResponse } from "./types";

type Fixture = (typeof lisbonFx)[number];

const TOKEN_TTL_MS = 10 * 60 * 60 * 1000; // results tokens last hours
const AVAIL_TTL_MS = 20 * 60 * 1000; // availability tokens are short lived

interface Session { srk: string; checkIn: string; checkOut: string; nights: number; hotels: Fixture[]; issuedAt: number }
interface Avail { token: string; hotel: Fixture; nonRef: boolean; price: number; issuedAt: number; used: boolean }

const sessions = new Map<string, Session>();
const avails = new Map<string, Avail>();
const reservations = new Map<number, Reservation>();
let nextResId = 231821;

const rid = () => Math.random().toString(36).slice(2, 10);
/** free cancellation closes 12 days before check in on the mock supplier */
const deadline = (checkIn: string) => { const d = new Date(checkIn + 'T23:59:00Z'); d.setUTCDate(d.getUTCDate() - 12); return d.toISOString().slice(0, 19); };
const nightsBetween = (a: string, b: string) => Math.max(1, Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000));

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/hal+json", "x-ratelimit-limit": "600", "x-ratelimit-remaining": "599", ...headers } });
}
function problem(status: number, title: string, detail?: string): Response {
  return json({ title, type: `https://httpstatus.es/${status}`, status, detail }, status);
}

function offerFor(h: Fixture, s: Session): Offer {
  const price = (v: number) => ({ selling: { value: Math.round(v * s.nights * 100) / 100, currency: "USD" }, components: { supplier: { value: Math.round(v * s.nights * 100) / 100, currency: "USD" } } });
  const rooms = [
    { index: `${h.slug}-flex`, name: "Superior room, flexible", status: (h.onRequest ? "RQ" : "OK") as "RQ" | "OK", boardBasis: "RO" as const, nonRefundable: false, price: price(h.supplierNet / 2), cancellationDeadline: { date: deadline(s.checkIn), charge: { value: h.penalty, currency: "USD" } } },
    { index: `${h.slug}-bb`, name: "Superior room, breakfast included", status: (h.onRequest ? "RQ" : "OK") as "RQ" | "OK", boardBasis: "BB" as const, nonRefundable: false, price: price((h.supplierNet + 28) / 2), cancellationDeadline: { date: deadline(s.checkIn), charge: { value: h.penalty, currency: "USD" } } },
    { index: `${h.slug}-nr`, name: "Superior room, no refunds", status: "OK" as const, boardBasis: "RO" as const, nonRefundable: true, price: price(h.supplierNetNonRef / 2) },
  ];
  return {
    id: `${h.ebcId}-1`, minPrice: rooms[2]!.price, system: { code: "hotelbeds", alias: "HB" },
    nonRefundable: [{ code: "refundable", price: rooms[0]!.price.selling }, { code: "nonrefundable", price: rooms[2]!.price.selling }],
    boardBasis: [{ code: "RO", price: rooms[0]!.price.selling }, { code: "BB", price: rooms[1]!.price.selling }],
    rooms,
    packages: rooms.map((r) => ({ packageCode: `P-${r.index}`, packageToken: `pt-${r.index}-${s.srk}`, status: r.status, complete: true, price: r.price, packageRooms: [{ packageRoomCode: `PR-${r.index}`, occupancy: { adults: 1, childrenAges: [] }, roomReferences: [{ roomCode: r.index, roomToken: `rt-${r.index}-${s.srk}`, selected: true }] }] })),
  };
}

function hotelFor(h: Fixture, s: Session): SearchHotel {
  const o = offerFor(h, s);
  return { index: h.ebcId, name: h.name, stars: h.stars, minPrice: o.minPrice, nonRefundable: o.nonRefundable, boardBasis: o.boardBasis, offers: [o] };
}

export function mockTransport(now: () => number = Date.now): typeof fetch {
  return async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const method = (init?.method ?? "GET").toUpperCase();
    const path = url.pathname.replace(/^\/tbs\/reseller/, "");
    if (path === "/oauth2/token") return json({ access_token: `mock-${rid()}`, token_type: "Bearer", expires_in: 43_200 });

    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    const token = url.searchParams.get("token");
    const srkMatch = /^\/api\/hotels\/v1\/search\/results\/([^/]+)\/hotels\/(\d+)\/offers\/([^/]+)(\/(availability|book|double-booking-verification))?$/.exec(path);

    if (path === "/api/hotels/v1/search/sync" && method === "POST") {
      const ids: number[] = body.accommodation;
      const s: Session = { srk: `srk-${rid()}`, checkIn: body.checkIn, checkOut: body.checkOut, nights: nightsBetween(body.checkIn, body.checkOut), hotels: lisbon.filter((h) => ids.includes(h.ebcId)), issuedAt: now() };
      sessions.set(s.srk, s);
      const res: SearchResponse = { srk: s.srk, tokens: { results: `res-${s.srk}` }, hotels: s.hotels.map((h) => hotelFor(h, s)) };
      return json(res);
    }

    if (srkMatch) {
      const [, srk, hotelIndex, offerIndex, , action] = srkMatch;
      const s = sessions.get(srk!);
      if (!s || token !== `res-${srk}`) return problem(401, "Unauthorized", "search token invalid");
      if (now() - s.issuedAt > TOKEN_TTL_MS) return problem(401, "Unauthorized", "search token expired");
      const h = s.hotels.find((x) => x.ebcId === Number(hotelIndex));
      if (!h || offerIndex !== `${h.ebcId}-1`) return problem(404, "Not Found", "offer not in this search");
      const offer = offerFor(h, s);
      if (!action) return json(offer);
      if (action === "availability") {
        const pkg = offer.packages.find((p) => p.packageToken === body.packageToken);
        if (!pkg) return problem(400, "Bad Request", "ROOM_UNAVAILABLE");
        const nonRef = pkg.packageCode.endsWith("-nr");
        const a: Avail = { token: `av-${rid()}`, hotel: h, nonRef, price: pkg.price.selling.value, issuedAt: now(), used: false };
        avails.set(a.token, a);
        const res: AvailabilityResponse = {
          availabilityToken: a.token, serviceDates: { startDate: s.checkIn, endDate: s.checkOut, duration: s.nights, type: "nights" }, system: offer.system,
          package: pkg, rooms: offer.rooms.filter((r) => pkg.packageRooms[0]!.roomReferences[0]!.roomCode === r.index),
          paymentMethods: { credit: { code: "credit", info: { enabled: true, active: true, available: { value: 25_000, currency: "USD" } } } },
          autocancelDate: new Date(now() + 2 * 3_600_000).toISOString(),
          cancellationPolicy: { date: nonRef ? s.checkIn : deadline(s.checkIn), policies: nonRef ? [{ type: "standard", date: new Date(now()).toISOString().slice(0, 19), charge: { value: a.price, currency: "USD" } }] : [{ type: "standard", date: deadline(s.checkIn), charge: { value: h.penalty, currency: "USD" } }, { type: "noshow", date: s.checkIn, charge: { value: a.price, currency: "USD" } }] },
          price: pkg.price,
          taxes: [{ type: "general", name: "VAT 6 percent", amount: Math.round(a.price * 0.06 * 100) / 100, currency: "USD", isIncluded: true }, { type: "property", name: "Lisbon municipal tourist tax", amount: 4.5 * s.nights, currency: "USD", isIncluded: false, description: "Paid at the hotel, per person per night" }],
          remarks: h.deposit !== "None" ? [{ group: "CATEGORY_ESSENTIAL_INFORMATION", list: [h.deposit] }] : [],
          offerConfiguration: { contactDetails: { email: { required: true }, phone: { required: true } }, priceModifiers: { allowed: true, components: ["markup", "sellingPrice"] }, birthdate: { adults: false, children: true } },
        };
        return json(res);
      }
      if (action === "double-booking-verification") {
        const a = avails.get(body.availabilityToken);
        if (!a) return problem(400, "Bad Request", "AVAILABILITY_TOKEN_EXPIRED");
        return json({ hasDoubleBookings: false, count: 0, reservations: [] });
      }
      if (action === "book") {
        const req = body as BookRequest;
        const a = avails.get(req.availabilityToken);
        if (!a || a.used) return problem(400, "Bad Request", "AVAILABILITY_TOKEN_EXPIRED");
        if (now() - a.issuedAt > AVAIL_TTL_MS) return problem(400, "Bad Request", "AVAILABILITY_TOKEN_EXPIRED");
        if (req.payment.method !== "credit") return problem(400, "Bad Request", "PAYMENT_ORDER_INVALID");
        if ([...reservations.values()].some((r) => r.clientRef === req.clientRef)) return problem(400, "Bad Request", "clientRef must be unique");
        a.used = true;
        const id = nextResId++;
        const status = a.hotel.onRequest ? "RQ" : "OK";
        const r: Reservation = {
          id, clientRef: req.clientRef, hotelConfirmationNumber: status === "OK" ? `HB${id}X` : undefined,
          service: { status }, payment: { status: "OK", type: "credit" },
          prices: { currency: "USD", issue: { supplier: a.price, selling: a.price }, total: { supplier: a.price, selling: a.price } },
          cancellationPolicy: a.nonRef ? undefined : { date: deadline(s.checkIn), policies: [{ type: "standard", date: deadline(s.checkIn), charge: { value: a.hotel.penalty, currency: "USD" } }] },
          serviceDates: { startDate: s.checkIn, endDate: s.checkOut, duration: s.nights, type: "nights" },
          hotel: { id: a.hotel.ebcId, cityId: 1, countryId: 1, name: a.hotel.name, stars: a.hotel.stars },
          rooms: [{ id: "1", name: "Superior room", boardBasis: "RO" }],
        };
        reservations.set(id, r);
        const res: BookResponse = { id, clientRef: req.clientRef, type: "hotel", status, price: { selling: { value: a.price, currency: "USD" } }, notifications: status === "RQ" ? [{ type: "info", code: "RQ", text: "Supplier confirmation pending" }] : [] };
        return json(res);
      }
    }

    const resMatch = /^\/api\/reservationsApi\/v1\/reservations\/(\d+)(\/(sync-status|documents|webhooks))?$/.exec(path);
    if (resMatch) {
      const r = reservations.get(Number(resMatch[1]));
      if (!r) return problem(404, "Not Found");
      if (method === "DELETE") { r.service.status = "XX"; r.prices.total = { supplier: 0, selling: 0 }; return json(r); }
      if (resMatch[3] === "documents") return json({ documents: [{ code: "voucher", name: "Voucher", documents: [{ filename: `voucher-${r.id}.pdf`, token: `doc-${r.id}` }] }] });
      if (resMatch[3] === "webhooks") return json({ id: 1, url: body?.url, isActive: true });
      if (resMatch[3] === "sync-status" && r.service.status === "RQ") r.service.status = "OK";
      return json(r);
    }
    const refMatch = /^\/api\/reservationsApi\/v1\/reservations\/reference\/(.+)$/.exec(path);
    if (refMatch) { const r = [...reservations.values()].find((x) => x.clientRef === decodeURIComponent(refMatch[1]!)); return r ? json(r) : problem(404, "Not Found"); }

    if (path === "/api/credit/v1/get") return json({ resellerId: 1701, enabled: true, active: true, unlimited: false, available: { value: 25_000, currency: "USD" }, creditSource: { identifier: "mock", name: "Mock" } });

    const detMatch = /^\/api\/mapping\/v1\/hotels\/(\d+)\/(details|images)$/.exec(path);
    if (detMatch) {
      const h = lisbon.find((x) => x.ebcId === Number(detMatch[1]));
      if (!h) return problem(404, "Not Found");
      if (detMatch[2] === "details") return json({ id: h.ebcId, name: h.name, stars: h.stars, address: h.area, geolocation: { latitude: h.lat, longitude: h.lng }, city: { id: 1, name: "Lisbon" }, country: { id: 1, name: "Portugal", iso: "PT" } });
      return json({ images: [0, 1, 2, 3].map((i) => ({ id: i, hotelId: h.ebcId, url: `/img/${h.slug}_${i}.jpg`, source: "fixture" })) });
    }

    return problem(404, "Not Found", path);
  };
}

/** Test hook: wipe mock state. */
export function resetMock() { sessions.clear(); avails.clear(); reservations.clear(); nextResId = 231821; }
