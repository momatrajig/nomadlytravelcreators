/** In memory implementation seeded from the fixtures and the demo storefront plan. Used by tests and credential free dev. */
import { randomUUID } from "node:crypto";
import lisbonFx from "@/lib/ebc/fixtures/lisbon.json";
import portugalFx from "@/lib/ebc/fixtures/portugal.json";
import worldFx from "@/lib/ebc/fixtures/world.json";
import plan from "@/lib/content/lina.json";
import { destination, destinationForCity } from "@/lib/content/destinations";
import type { Photo } from "@/lib/media/photo";
import type { Booking, Collection, Creator, Db, Hotel, Payout, PinnedHotel, PriceCheck, PromoCode, Quote, Storefront } from "./types";

type Fx = { slug: string; ebcId: number; name: string; area: string; city: string; stars: number; rating: number; votes: number; lat: number; lng: number; tip: string; refs: Array<{ source: string; price: number }>; images?: Photo[]; destination?: string };
const ALL: Fx[] = [...lisbonFx, ...portugalFx, ...worldFx] as Fx[];

const STOREFRONT: Storefront = {
  id: "20000000-0000-0000-0000-000000000001", creatorId: "10000000-0000-0000-0000-000000000001", slug: "lina", customDomain: "stays.wanderwithlina.com",
  brandName: "Wander with Lina", brandColor: "#2458d6", logoPath: null, template: "postcard",
  headline: "Hotels I slept in, from Paris to Rio.", cityId: null, cityName: null, currency: "USD", creatorRate: 0.08, flightFee: 5, live: true,
};
const SRC: Record<string, PriceCheck["source"]> = { "Booking.com": "booking", Expedia: "expedia", Agoda: "agoda" };
const COLLECTIONS: Collection[] = plan.collections.map((c, i) => {
  const d = c.kind === "destination" ? destination(c.slug) : null;
  return {
    id: `c${i}`, storefrontId: STOREFRONT.id, slug: c.slug, kind: c.kind as Collection["kind"], title: "title" in c ? c.title! : d?.name ?? c.slug,
    subtitle: "subtitle" in c ? c.subtitle! : d?.blurb ?? null, checkIn: "checkIn" in c ? c.checkIn! : null, checkOut: "checkOut" in c ? c.checkOut! : null,
    ebcIds: c.ebcIds, position: i, heroUrl: "heroUrl" in c ? c.heroUrl! : d?.hero ?? null,
  };
});

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
  const cache = new Map<string, { v: unknown; exp: number }>();

  for (const h of ALL) {
    hotels.set(h.ebcId, { ebcId: h.ebcId, name: h.name, stars: h.stars, address: h.area, cityName: h.city, lat: h.lat, lng: h.lng, images: h.images ?? [], rating: h.rating, ratingCount: h.votes, destination: h.destination ?? destinationForCity(h.city)?.slug ?? null });
    for (const d of plan.priceDates) for (const r of h.refs) {
      if (!SRC[r.source]) continue;
      checks.push({ ebcId: h.ebcId, source: SRC[r.source]!, checkIn: d.checkIn, checkOut: d.checkOut, adults: d.adults, price: Math.round(r.price * d.factor), currency: "USD", checkedAt: new Date().toISOString() });
    }
  }
  plan.pins.forEach((p, i) => { const hotel = hotels.get(p.ebcId)!; pins.push({ ...hotel, position: i, tip: p.tip, stayedWhen: null }); });
  // the service tests also exercise the eBooking mapped Lisbon hotels (on request, real IDs); the demo storefront does not show them
  if (process.env.NOMADLY_PIN_ALL === "1") for (const h of ALL) if (!pins.some((p) => p.ebcId === h.ebcId)) pins.push({ ...hotels.get(h.ebcId)!, position: pins.length, tip: h.tip, stayedWhen: null });

  return {
    async creatorByUserId(userId) { return CREATOR.userId === userId ? CREATOR : null; },
    async creatorByEmail(email) { return CREATOR.email.toLowerCase() === email.toLowerCase() ? CREATOR : null; },
    async linkCreatorUser() { /* local creator is pre linked */ },
    async creator(id) { return CREATOR.id === id ? CREATOR : null; },
    async storefrontsForCreator(creatorId) { return creatorId === sf.creatorId ? [sf] : []; },
    async updateStorefront(id, patch) { if (id === sf.id) sf = { ...sf, ...patch }; },
    async updatePin(storefrontId, ebcId, patch) { const p = pins.find((x) => x.ebcId === ebcId); if (storefrontId === sf.id && p) Object.assign(p, patch); },
    async payoutsForCreator(creatorId) { return payouts.filter((p) => p.creatorId === creatorId); },
    async payableBookings(creatorId, before) { const paid = new Set(payouts.flatMap((p) => p.items.map((i) => i.bookingId))); return [...bookings.values()].filter((b) => b.creatorId === creatorId && (b.status === "confirmed" || b.status === "completed") && !b.demo && b.checkOut <= before && !paid.has(b.id)); },
    async createPayout(p) { const full: Payout = { ...p, id: randomUUID() }; payouts.push(full); return full; },
    async cacheGet<T>(key: string) { const c = cache.get(key); return c && c.exp > Date.now() ? (c.v as T) : null; },
    async cacheSet(key, value, ttl) { cache.set(key, { v: value, exp: Date.now() + ttl * 1000 }); },
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
    async bookedCountsByHotel(storefrontId, sinceIso) { const m = new Map<number, number>(); for (const b of bookings.values()) if (b.storefrontId === storefrontId && (b.status === 'confirmed' || b.status === 'completed') && !b.demo && b.createdAt >= sinceIso) m.set(b.ebcId, (m.get(b.ebcId) ?? 0) + 1); return m; },
    async bookingsForCreator(creatorId, limit = 50) { return [...bookings.values()].filter((b) => b.creatorId === creatorId).slice(-limit).reverse(); },
  };
}
