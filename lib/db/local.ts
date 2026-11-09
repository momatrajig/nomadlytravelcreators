/** In memory implementation seeded from the Lisbon fixture. Used by tests and credential free dev. */
import { randomUUID } from "node:crypto";
import lisbonFx from "@/lib/ebc/fixtures/lisbon.json";
import portugalFx from "@/lib/ebc/fixtures/portugal.json";
const lisbon = [...lisbonFx, ...portugalFx];
import type { Booking, Collection, Creator, Db, Hotel, Payout, PinnedHotel, PriceCheck, PromoCode, Quote, Storefront } from "./types";

const STOREFRONT: Storefront = {
  id: "20000000-0000-0000-0000-000000000001", creatorId: "10000000-0000-0000-0000-000000000001", slug: "lina", customDomain: "stays.wanderwithlina.com",
  brandName: "Wander with Lina", brandColor: "#2458d6", logoPath: null, template: "postcard",
  headline: "Book the hotels I actually stayed in, below the big sites.", cityId: 1, cityName: "Lisbon", currency: "USD", creatorRate: 0.08, flightFee: 5, live: true,
};
const SRC: Record<string, PriceCheck["source"]> = { "Booking.com": "booking", Expedia: "expedia", Agoda: "agoda" };
const IMG_COUNT: Record<string, number> = { vilavita: 3, quintacomporta: 3, reids: 3, pestana: 3, torel: 3 };
const COLLECTIONS: Collection[] = [
  { id: "c1", storefrontId: STOREFRONT.id, slug: "new-year", kind: "season", title: "Christmas and New Year", subtitle: "Four nights over New Year, 29 Dec to 2 Jan, two adults. Prices checked against the big sites for those exact dates.", checkIn: "2026-12-29", checkOut: "2027-01-02", ebcIds: [322364, 515886, 900004, 900001, 900002, 900006], position: 0, heroUrl: "/img/reids_0.jpg" },
  { id: "c2", storefrontId: STOREFRONT.id, slug: "porto", kind: "destination", title: "Porto", subtitle: "Three stays on the Douro.", checkIn: null, checkOut: null, ebcIds: [900001, 900007, 900008], position: 1, heroUrl: "/img/yeatman_0.jpg" },
  { id: "c3", storefrontId: STOREFRONT.id, slug: "algarve", kind: "destination", title: "Algarve and Comporta", subtitle: "Cliffs, coves and rice fields.", checkIn: null, checkOut: null, ebcIds: [900002, 900005, 900003], position: 2, heroUrl: "/img/vilavita_0.jpg" },
  { id: "c4", storefrontId: STOREFRONT.id, slug: "madeira", kind: "destination", title: "Madeira", subtitle: "Tea on the terrace.", checkIn: null, checkOut: null, ebcIds: [900004], position: 3, heroUrl: "/img/reids_1.jpg" },
];

export function localDb(): Db {
  const hotels = new Map<number, Hotel>();
  const pins: PinnedHotel[] = [];
  const checks: PriceCheck[] = [];
  const quotes = new Map<string, Quote>();
  const bookings = new Map<string, Booking>();
  const events: Array<{ bookingId: string; kind: string; payload?: unknown; at: string }> = [];
  const promos: PromoCode[] = [{ storefrontId: STOREFRONT.id, code: "LISBON10", amountOff: 10, maxUses: 200, uses: 0, active: true, startsAt: null, endsAt: null }];
  let seq = 231821;
  const payouts: Payout[] = [];
  const CREATOR: Creator = { id: STOREFRONT.creatorId, userId: "00000000-0000-0000-0000-000000000001", displayName: "Lina", email: "lina@example.com" };
  let sf: Storefront = { ...STOREFRONT };

  lisbon.forEach((h, i) => {
    const n = IMG_COUNT[h.slug] ?? 4;
    const hotel: Hotel = { ebcId: h.ebcId, name: h.name, stars: h.stars, address: h.area, cityName: h.city, lat: h.lat, lng: h.lng, images: Array.from({ length: n }, (_, k) => ({ url: `/img/${h.slug}_${k}.jpg` })), rating: h.rating, ratingCount: h.votes };
    hotels.set(h.ebcId, hotel);
    pins.push({ ...hotel, position: i, tip: h.tip, stayedWhen: null });
    for (const r of h.refs) {
      checks.push({ ebcId: h.ebcId, source: SRC[r.source] ?? "booking", checkIn: "2026-12-03", checkOut: "2026-12-05", adults: 1, price: r.price, currency: "USD", checkedAt: new Date().toISOString() });
      // festive dates: the big sites run about 22 percent higher for the same room over New Year
      checks.push({ ebcId: h.ebcId, source: SRC[r.source] ?? "booking", checkIn: "2026-12-29", checkOut: "2027-01-02", adults: 2, price: Math.round(r.price * 2 * 1.22), currency: "USD", checkedAt: new Date().toISOString() });
    }
  });

  return {
    async creatorByUserId(userId) { return CREATOR.userId === userId ? CREATOR : null; },
    async creator(id) { return CREATOR.id === id ? CREATOR : null; },
    async storefrontsForCreator(creatorId) { return creatorId === sf.creatorId ? [sf] : []; },
    async updateStorefront(id, patch) { if (id === sf.id) sf = { ...sf, ...patch }; },
    async updatePin(storefrontId, ebcId, patch) { const p = pins.find((x) => x.ebcId === ebcId); if (storefrontId === sf.id && p) Object.assign(p, patch); },
    async payoutsForCreator(creatorId) { return payouts.filter((p) => p.creatorId === creatorId); },
    async payableBookings(creatorId, before) { const paid = new Set(payouts.flatMap((p) => p.items.map((i) => i.bookingId))); return [...bookings.values()].filter((b) => b.creatorId === creatorId && (b.status === "confirmed" || b.status === "completed") && b.checkOut <= before && !paid.has(b.id)); },
    async createPayout(p) { const full: Payout = { ...p, id: randomUUID() }; payouts.push(full); return full; },
    async storefrontByHost() {
      // local mode is the demo: one storefront answers on every host (localhost, a Vercel preview URL, anything)
      return sf;
    },
    async storefrontBySlug(slug) { return slug === sf.slug ? sf : null; },
    async pinnedHotels(id) { return id === sf.id ? [...pins].sort((a, b) => a.position - b.position) : []; },
    async collections(id) { return id === sf.id ? COLLECTIONS : []; },
    async hotel(id) { return hotels.get(id) ?? null; },
    async latestPriceChecks(ids, checkIn, checkOut, adults) { return checks.filter((c) => ids.includes(c.ebcId) && c.checkIn === checkIn && c.checkOut === checkOut && c.adults === adults); },
    async saveQuote(q) { const full: Quote = { ...q, id: randomUUID(), createdAt: new Date().toISOString() }; quotes.set(full.id, full); return full; },
    async quote(id) { return quotes.get(id) ?? null; },
    async updateQuote(id, patch) { const q = quotes.get(id); if (q) quotes.set(id, { ...q, ...patch }); },
    async promo(storefrontId, code) { return promos.find((p) => p.storefrontId === storefrontId && p.code.toLowerCase() === code.toLowerCase()) ?? null; },
    async createBooking(b) { const full: Booking = { ...b, id: randomUUID(), createdAt: new Date().toISOString(), reference: b.reference || `NMD ${seq++}` }; bookings.set(full.id, full); return full; },
    async booking(id) { return bookings.get(id) ?? null; },
    async bookingByReference(ref) { return [...bookings.values()].find((b) => b.reference === ref) ?? null; },
    async bookingByPaymentIntent(pi) { return [...bookings.values()].find((b) => b.stripePaymentIntent === pi) ?? null; },
    async updateBooking(id, patch) { const b = bookings.get(id); if (b) bookings.set(id, { ...b, ...patch }); },
    async addEvent(bookingId, kind, payload) { events.push({ bookingId, kind, payload, at: new Date().toISOString() }); },
    async bookedCountsByHotel(storefrontId, sinceIso) { const m = new Map<number, number>(); for (const b of bookings.values()) if (b.storefrontId === storefrontId && (b.status === 'confirmed' || b.status === 'completed') && b.createdAt >= sinceIso) m.set(b.ebcId, (m.get(b.ebcId) ?? 0) + 1); return m; },
    async bookingsForCreator(creatorId, limit = 50) { return [...bookings.values()].filter((b) => b.creatorId === creatorId).slice(-limit).reverse(); },
  };
}
