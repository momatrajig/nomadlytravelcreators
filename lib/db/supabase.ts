/** Supabase implementation (service role, server only). Column names are snake_case in SQL, camelCase in code. */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Booking, Click, Collection, Creator, Db, DirectoryHotel, Hotel, Payout, PinnedHotel, PriceCheck, PromoCode, Quote, Storefront } from "./types";
import { leadWith } from "./lead";

const snake = (s: string) => s.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
const camel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
const toRow = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [snake(k), v]));
const fromRow = <T>(r: Record<string, unknown>): T => Object.fromEntries(Object.entries(r).map(([k, v]) => [camel(k), typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v) && /price|net|share|rate|fee|charge|reference$|discount|amount|markup|margin|costs/.test(k) ? Number(v) : v])) as T;

function client(): SupabaseClient {
  const e = env();
  if (!e.NEXT_PUBLIC_SUPABASE_URL || !e.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase env missing");
  return createClient(e.NEXT_PUBLIC_SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

const must = <T>(r: { data: T | null; error: { message: string } | null }): T => { if (r.error) throw new Error(r.error.message); return r.data as T; };

export function supabaseDb(): Db {
  const sb = client();
  const hotelFrom = (r: Record<string, unknown>): Hotel => ({ ebcId: r.ebc_id as number, name: r.name as string, stars: (r.stars as number) ?? null, address: (r.address as string) ?? null, cityName: (r.city_name as string) ?? null, lat: (r.lat as number) ?? null, lng: (r.lng as number) ?? null, images: (r.images as Hotel["images"]) ?? [], rating: r.rating == null ? null : Number(r.rating), ratingCount: (r.rating_count as number) ?? null, destination: (r.destination_slug as string) ?? null });
  return {
    async creatorByUserId(userId) { const r = await sb.from("creators").select("id,user_id,display_name,email").eq("user_id", userId).maybeSingle(); return r.data ? fromRow<Creator>(r.data) : null; },
    async creatorByEmail(email) { const r = await sb.from("creators").select("id,user_id,display_name,email").ilike("email", email).maybeSingle(); return r.data ? fromRow<Creator>(r.data) : null; },
    async linkCreatorUser(creatorId, userId) { must(await sb.from("creators").update({ user_id: userId }).eq("id", creatorId)); },
    async creator(id) { const r = await sb.from("creators").select("id,user_id,display_name,email").eq("id", id).maybeSingle(); return r.data ? fromRow<Creator>(r.data) : null; },
    async storefrontsForCreator(creatorId) { const rows = must(await sb.from("storefronts").select("*").eq("creator_id", creatorId)) as Array<Record<string, unknown>>; return rows.map((r) => fromRow<Storefront>(r)); },
    async updateStorefront(id, patch) { must(await sb.from("storefronts").update(toRow(patch)).eq("id", id)); },
    async updatePin(storefrontId, ebcId, patch) { must(await sb.from("storefront_hotels").update(toRow(patch)).eq("storefront_id", storefrontId).eq("ebc_id", ebcId)); },
    async payoutsForCreator(creatorId) {
      const rows = must(await sb.from("payouts").select("*, payout_items(booking_id, amount)").eq("creator_id", creatorId).order("scheduled_for", { ascending: false })) as Array<Record<string, unknown>>;
      return rows.map((r) => ({ ...fromRow<Omit<Payout, "items">>(r), items: ((r.payout_items as Array<{ booking_id: string; amount: string }>) ?? []).map((i) => ({ bookingId: i.booking_id, amount: Number(i.amount) })) }));
    },
    async payableBookings(creatorId, before) {
      const paid = must(await sb.from("payout_items").select("booking_id")) as Array<{ booking_id: string }>;
      const rows = must(await sb.from("bookings").select("*").eq("creator_id", creatorId).in("status", ["confirmed", "completed"]).eq("demo", false).lte("check_out", before)) as Array<Record<string, unknown>>;
      const set = new Set(paid.map((p) => p.booking_id));
      return rows.map((r) => fromRow<Booking>(r)).filter((b) => !set.has(b.id));
    },
    async createPayout(p) {
      const { items, ...rest } = p;
      const row = must(await sb.from("payouts").insert(toRow(rest)).select("*").single()) as Record<string, unknown>;
      if (items.length) must(await sb.from("payout_items").insert(items.map((i) => ({ payout_id: row.id, booking_id: i.bookingId, amount: i.amount }))));
      return { ...fromRow<Omit<Payout, "items">>(row), items };
    },
    async cacheGet<T>(key: string) {
      const r = await sb.from("search_cache").select("payload, expires_at").eq("key", key).maybeSingle();
      return r.data && Date.parse(r.data.expires_at as string) > Date.now() ? (r.data.payload as T) : null;
    },
    async cacheSet(key, value, ttl) {
      const { error } = await sb.from("search_cache").upsert({ key, payload: value, expires_at: new Date(Date.now() + ttl * 1000).toISOString() });
      if (error) console.error("cacheSet", error.message);
    },
    async storefrontByHost(host, platformHost) {
      const h = host.toLowerCase().split(":")[0]!;
      let q = sb.from("storefronts").select("*").eq("live", true);
      q = h.endsWith(`.${platformHost}`) ? q.eq("slug", h.split(".")[0]!) : q.eq("custom_domain", h);
      const r = await q.maybeSingle();
      if (r.data) return fromRow<Storefront>(r.data);
      // Platform, preview and local addresses (nomadly.app, *.vercel.app, localhost) show the default storefront,
      // so the product can be demoed before a creator's domain is pointed at us. A creator's own domain never falls back.
      const isPlatformish = h === platformHost || h === `www.${platformHost}` || h.endsWith(".vercel.app") || h === "localhost" || h === "127.0.0.1";
      if (!isPlatformish) return null;
      const d = await sb.from("storefronts").select("*").eq("slug", env().DEFAULT_STOREFRONT ?? "lina").maybeSingle();
      return d.data ? fromRow<Storefront>(d.data) : null;
    },
    async storefrontBySlug(slug) { const r = await sb.from("storefronts").select("*").eq("slug", slug).maybeSingle(); return r.data ? fromRow<Storefront>(r.data) : null; },
    async pinnedHotels(storefrontId) {
      const rows = must(await sb.from("storefront_hotels").select("position, tip, stayed_when, cover_url, hotels(*)").eq("storefront_id", storefrontId).order("position")) as Array<Record<string, unknown>>;
      return rows.map((r) => { const h = hotelFrom(r.hotels as Record<string, unknown>); const cover = (r.cover_url as string) ?? null; return { ...h, images: leadWith(h.images, cover), position: r.position as number, tip: (r.tip as string) ?? null, stayedWhen: (r.stayed_when as string) ?? null, coverUrl: cover }; });
    },
    async collections(storefrontId) { const rows = must(await sb.from("collections").select("*").eq("storefront_id", storefrontId).order("position")) as Array<Record<string, unknown>>; return rows.map((r) => fromRow<Collection>(r)); },
    async hotel(ebcId) { const r = await sb.from("hotels").select("*").eq("ebc_id", ebcId).maybeSingle(); return r.data ? hotelFrom(r.data) : null; },
    async latestPriceChecks(ids, checkIn, checkOut, adults) {
      const rows = must(await sb.from("latest_price_checks").select("*").in("ebc_id", ids).eq("check_in", checkIn).eq("check_out", checkOut).eq("adults", adults)) as Array<Record<string, unknown>>;
      return rows.map((r) => fromRow<PriceCheck>(r));
    },
    async saveQuote(q) { return fromRow<Quote>(must(await sb.from("quotes").insert(toRow(q)).select("*").single())); },
    async quote(id) { const r = await sb.from("quotes").select("*").eq("id", id).maybeSingle(); return r.data ? fromRow<Quote>(r.data) : null; },
    async updateQuote(id, patch) { must(await sb.from("quotes").update(toRow(patch)).eq("id", id)); },
    async promo(storefrontId, code) { const r = await sb.from("promo_codes").select("*").eq("storefront_id", storefrontId).ilike("code", code).maybeSingle(); return r.data ? fromRow<PromoCode>(r.data) : null; },
    async createBooking(b) {
      // a reference collision is one in 900,000; retry with a fresh one rather than fail the reader's checkout
      for (let i = 0; i < 3; i++) {
        const r = await sb.from("bookings").insert(toRow(i ? { ...b, reference: `NMD ${100000 + Math.floor(Math.random() * 900000)}` } : b)).select("*").single();
        if (!r.error) return fromRow<Booking>(r.data);
        if (!/bookings_reference_key/.test(r.error.message)) throw new Error(r.error.message);
      }
      throw new Error("could not allocate a booking reference");
    },
    async booking(id) { const r = await sb.from("bookings").select("*").eq("id", id).maybeSingle(); return r.data ? fromRow<Booking>(r.data) : null; },
    async bookingByReference(ref) { const r = await sb.from("bookings").select("*").eq("reference", ref).maybeSingle(); return r.data ? fromRow<Booking>(r.data) : null; },
    async bookingByPaymentIntent(pi) { const r = await sb.from("bookings").select("*").eq("stripe_payment_intent", pi).maybeSingle(); return r.data ? fromRow<Booking>(r.data) : null; },
    async updateBooking(id, patch) { must(await sb.from("bookings").update(toRow(patch)).eq("id", id)); },
    async addEvent(bookingId, kind, payload) { must(await sb.from("booking_events").insert({ booking_id: bookingId, kind, payload })); },
    async bookedCountsByHotel(storefrontId, sinceIso) { const rows = must(await sb.from('bookings').select('ebc_id').eq('storefront_id', storefrontId).in('status', ['confirmed', 'completed']).eq('demo', false).gte('created_at', sinceIso)) as Array<{ ebc_id: number }>; const m = new Map<number, number>(); for (const r of rows) m.set(r.ebc_id, (m.get(r.ebc_id) ?? 0) + 1); return m; },
    async storefrontSlugs() { return ((must(await sb.from("storefronts").select("slug").order("slug")) as Array<{ slug: string }>)).map((r) => r.slug); },
    async creatorIdsWithStorefronts() { return [...new Set((must(await sb.from("storefronts").select("creator_id")) as Array<{ creator_id: string }>).map((r) => r.creator_id))]; },
    async logClick(c) { return fromRow<Click>(must(await sb.from("clicks").insert(toRow(c)).select("*").single())); },
    async click(id) { const r = await sb.from("clicks").select("*").eq("id", id).maybeSingle(); return r.data ? fromRow<Click>(r.data) : null; },
    async clicksForStorefront(storefrontId, since) {
      // paged: a busy creator can pass the default 1,000 row limit in a month
      const out: Click[] = [];
      for (let from = 0; ; from += 1000) {
        const rows = must(await sb.from("clicks").select("id,storefront_id,created_at,source,article,target,ebc_id,query,country,device,visitor,bot").eq("storefront_id", storefrontId).gte("created_at", since).order("created_at", { ascending: false }).range(from, from + 999)) as Array<Record<string, unknown>>;
        out.push(...rows.map((r) => fromRow<Click>(r)));
        if (rows.length < 1000 || out.length >= 50000) break;
      }
      return out;
    },
    async upsertHotel(h) {
      must(await sb.from("hotels").upsert({ ebc_id: h.ebcId, name: h.name, stars: h.stars, address: h.address, city_id: h.cityId ?? null, city_name: h.cityName, country_iso: h.countryIso ?? null, lat: h.lat, lng: h.lng, images: h.images, rating: h.rating, rating_count: h.ratingCount, destination_slug: h.destination, description: h.description ?? null, synced_at: new Date().toISOString() }));
    },
    async pinHotel(storefrontId, ebcId, patch = {}) {
      const exists = await sb.from("storefront_hotels").select("ebc_id").eq("storefront_id", storefrontId).eq("ebc_id", ebcId).maybeSingle();
      if (exists.data) return;
      const last = await sb.from("storefront_hotels").select("position").eq("storefront_id", storefrontId).order("position", { ascending: false }).limit(1).maybeSingle();
      must(await sb.from("storefront_hotels").insert({ storefront_id: storefrontId, ebc_id: ebcId, position: patch.position ?? ((last.data?.position as number | undefined) ?? -1) + 1, tip: patch.tip ?? null }));
    },
    async unpinHotel(storefrontId, ebcId) { must(await sb.from("storefront_hotels").delete().eq("storefront_id", storefrontId).eq("ebc_id", ebcId)); },
    async directoryCity(cityId) { const r = await sb.from("directory_cities").select("*").eq("city_id", cityId).maybeSingle(); return r.data ? fromRow(r.data) : null; },
    async saveDirectoryCity(c) { must(await sb.from("directory_cities").upsert(toRow(c))); },
    async saveDirectoryHotels(rows) { for (let i = 0; i < rows.length; i += 500) must(await sb.from("hotel_directory").upsert(rows.slice(i, i + 500).map((r) => toRow(r as unknown as Record<string, unknown>)))); },
    async directoryHotels(cityId) {
      const out: DirectoryHotel[] = [];
      for (let from = 0; ; from += 1000) {
        const rows = must(await sb.from("hotel_directory").select("*").eq("city_id", cityId).range(from, from + 999)) as Array<Record<string, unknown>>;
        out.push(...rows.map((r) => fromRow<DirectoryHotel>(r)));
        if (rows.length < 1000) break;
      }
      return out;
    },
    async directoryNear(lat, lng, dLat, dLng, limit = 300) {
      const rows = must(await sb.from("hotel_directory").select("*").gte("lat", lat - dLat).lte("lat", lat + dLat).gte("lng", lng - dLng).lte("lng", lng + dLng).limit(limit)) as Array<Record<string, unknown>>;
      return rows.map((r) => fromRow<DirectoryHotel>(r));
    },
    async bookingsForCreator(creatorId, limit = 50) { const rows = must(await sb.from("bookings").select("*").eq("creator_id", creatorId).order("created_at", { ascending: false }).limit(limit)) as Array<Record<string, unknown>>; return rows.map((r) => fromRow<Booking>(r)); },
  };
}
