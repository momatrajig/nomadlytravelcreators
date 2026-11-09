/** Supabase implementation (service role, server only). Column names are snake_case in SQL, camelCase in code. */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Booking, Collection, Creator, Db, Hotel, Payout, PinnedHotel, PriceCheck, PromoCode, Quote, Storefront } from "./types";

const snake = (s: string) => s.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
const camel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
const toRow = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [snake(k), v]));
const fromRow = <T>(r: Record<string, unknown>): T => Object.fromEntries(Object.entries(r).map(([k, v]) => [camel(k), typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v) && /price|net|share|rate|fee|charge|reference$|discount|amount/.test(k) ? Number(v) : v])) as T;

function client(): SupabaseClient {
  const e = env();
  if (!e.NEXT_PUBLIC_SUPABASE_URL || !e.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase env missing");
  return createClient(e.NEXT_PUBLIC_SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

const must = <T>(r: { data: T | null; error: { message: string } | null }): T => { if (r.error) throw new Error(r.error.message); return r.data as T; };

export function supabaseDb(): Db {
  const sb = client();
  const hotelFrom = (r: Record<string, unknown>): Hotel => ({ ebcId: r.ebc_id as number, name: r.name as string, stars: (r.stars as number) ?? null, address: (r.address as string) ?? null, cityName: (r.city_name as string) ?? null, lat: (r.lat as number) ?? null, lng: (r.lng as number) ?? null, images: (r.images as Hotel["images"]) ?? [], rating: r.rating == null ? null : Number(r.rating), ratingCount: (r.rating_count as number) ?? null });
  return {
    async creatorByUserId(userId) { const r = await sb.from("creators").select("id,user_id,display_name,email").eq("user_id", userId).maybeSingle(); return r.data ? fromRow<Creator>(r.data) : null; },
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
      const rows = must(await sb.from("bookings").select("*").eq("creator_id", creatorId).in("status", ["confirmed", "completed"]).lte("check_out", before)) as Array<Record<string, unknown>>;
      const set = new Set(paid.map((p) => p.booking_id));
      return rows.map((r) => fromRow<Booking>(r)).filter((b) => !set.has(b.id));
    },
    async createPayout(p) {
      const { items, ...rest } = p;
      const row = must(await sb.from("payouts").insert(toRow(rest)).select("*").single()) as Record<string, unknown>;
      if (items.length) must(await sb.from("payout_items").insert(items.map((i) => ({ payout_id: row.id, booking_id: i.bookingId, amount: i.amount }))));
      return { ...fromRow<Omit<Payout, "items">>(row), items };
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
      const rows = must(await sb.from("storefront_hotels").select("position, tip, stayed_when, hotels(*)").eq("storefront_id", storefrontId).order("position")) as Array<Record<string, unknown>>;
      return rows.map((r) => ({ ...hotelFrom(r.hotels as Record<string, unknown>), position: r.position as number, tip: (r.tip as string) ?? null, stayedWhen: (r.stayed_when as string) ?? null }));
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
    async createBooking(b) { return fromRow<Booking>(must(await sb.from("bookings").insert(toRow(b)).select("*").single())); },
    async booking(id) { const r = await sb.from("bookings").select("*").eq("id", id).maybeSingle(); return r.data ? fromRow<Booking>(r.data) : null; },
    async bookingByReference(ref) { const r = await sb.from("bookings").select("*").eq("reference", ref).maybeSingle(); return r.data ? fromRow<Booking>(r.data) : null; },
    async bookingByPaymentIntent(pi) { const r = await sb.from("bookings").select("*").eq("stripe_payment_intent", pi).maybeSingle(); return r.data ? fromRow<Booking>(r.data) : null; },
    async updateBooking(id, patch) { must(await sb.from("bookings").update(toRow(patch)).eq("id", id)); },
    async addEvent(bookingId, kind, payload) { must(await sb.from("booking_events").insert({ booking_id: bookingId, kind, payload })); },
    async bookedCountsByHotel(storefrontId, sinceIso) { const rows = must(await sb.from('bookings').select('ebc_id').eq('storefront_id', storefrontId).in('status', ['confirmed', 'completed']).gte('created_at', sinceIso)) as Array<{ ebc_id: number }>; const m = new Map<number, number>(); for (const r of rows) m.set(r.ebc_id, (m.get(r.ebc_id) ?? 0) + 1); return m; },
    async bookingsForCreator(creatorId, limit = 50) { const rows = must(await sb.from("bookings").select("*").eq("creator_id", creatorId).order("created_at", { ascending: false }).limit(limit)) as Array<Record<string, unknown>>; return rows.map((r) => fromRow<Booking>(r)); },
  };
}
