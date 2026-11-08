/** In memory implementation seeded from the Lisbon fixture. Used by tests and credential free dev. */
import { randomUUID } from "node:crypto";
import lisbon from "@/lib/ebc/fixtures/lisbon.json";
import type { Booking, Creator, Db, Hotel, Payout, PinnedHotel, PriceCheck, PromoCode, Quote, Storefront } from "./types";

const STOREFRONT: Storefront = {
  id: "20000000-0000-0000-0000-000000000001", creatorId: "10000000-0000-0000-0000-000000000001", slug: "lina", customDomain: "stays.wanderwithlina.com",
  brandName: "Wander with Lina", brandColor: "#2458d6", logoPath: null, template: "postcard",
  headline: "Book the hotels I actually stayed in, below the big sites.", cityId: 1, cityName: "Lisbon", currency: "USD", creatorRate: 0.08, flightFee: 5, live: true,
};
const SRC: Record<string, PriceCheck["source"]> = { "Booking.com": "booking", Expedia: "expedia", Agoda: "agoda" };

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
    const hotel: Hotel = { ebcId: h.ebcId, name: h.name, stars: h.stars, address: h.area, cityName: "Lisbon", lat: h.lat, lng: h.lng, images: [0, 1, 2, 3].map((k) => ({ url: `/img/${h.slug}_${k}.jpg` })), rating: h.rating, ratingCount: h.votes };
    hotels.set(h.ebcId, hotel);
    pins.push({ ...hotel, position: i, tip: h.tip, stayedWhen: null });
    for (const r of h.refs) checks.push({ ebcId: h.ebcId, source: SRC[r.source] ?? "booking", checkIn: "2026-12-03", checkOut: "2026-12-05", adults: 1, price: r.price, currency: "USD", checkedAt: new Date().toISOString() });
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
    async storefrontByHost(host, platformHost) {
      const h = host.toLowerCase().split(":")[0]!;
      if (h === sf.customDomain) return sf;
      if (h.endsWith(`.${platformHost}`) && h.split(".")[0] === sf.slug) return sf;
      if (h === "localhost" || h === "127.0.0.1") return sf; // dev convenience
      return null;
    },
    async storefrontBySlug(slug) { return slug === sf.slug ? sf : null; },
    async pinnedHotels(id) { return id === sf.id ? [...pins].sort((a, b) => a.position - b.position) : []; },
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
