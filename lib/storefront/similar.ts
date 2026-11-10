/**
 * "Similar stays nearby": the hotels shown under a creator's pick, like the rest of a results page on
 * Booking.com when you search one hotel by name. Nearest first, of a comparable class, with photos.
 *
 * Candidates come from the supplier's directory (any hotel it sells, not only the creator's picks), are
 * imported once (details and photos) so they can be priced and shown, and the list is cached for a week.
 */
import { db } from "@/lib/db";
import type { DirectoryHotel, Hotel } from "@/lib/db/types";
import { importHotel } from "@/lib/links/directory";

const KEEP_S = 7 * 86400;
const RADIUS_KM = 2.5;
/** Listings that are flats or rooms, not hotels: shown under a hotel they read as a different product. */
const NOT_HOTEL = /\b(apartment|apartments|appartement|apt|flat|loft|studio|residence|résidence|suite[s]? in|holidays?|airbnb|duplex|room in|chambre|maison|house|villa in|rue|avenue|boulevard|bd)\b/i;
export const looksLikeHotel = (name: string) => !NOT_HOTEL.test(name);

export function km(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const x = r(bLng - aLng) * Math.cos(r((aLat + bLat) / 2));
  const y = r(bLat - aLat);
  return Math.sqrt(x * x + y * y) * 6371;
}

/** Ranks directory rows around a hotel: same class first (stars within one), then distance. Pure, tested. */
export function rankNearby(pick: { ebcId: number; lat: number; lng: number; stars: number | null }, rows: DirectoryHotel[], exclude: Set<number>, radiusKm = RADIUS_KM): Array<DirectoryHotel & { km: number }> {
  const want = pick.stars ?? 0;
  return rows
    .filter((r) => r.ebcId !== pick.ebcId && !exclude.has(r.ebcId) && r.lat != null && r.lng != null && looksLikeHotel(r.name))
    .map((r) => ({ ...r, km: km(pick.lat, pick.lng, r.lat!, r.lng!) }))
    .filter((r) => r.km <= radiusKm && (!want || (r.stars != null && Math.abs(r.stars - want) <= 1)))
    .sort((a, b) => a.km - b.km);
}

/**
 * Up to `n` candidate hotels near `pick`, by ID, nearest first (ask for about twice what you show: some have no
 * rooms on given dates). The creator's other picks nearby are left to the caller
 * (they are shown with their own badge). Waits at most `waitMs` for first time imports; whatever is not ready
 * in time is finished in the background and joins the list for the next reader.
 */
export async function similarTo(pick: Hotel, exclude: number[], n = 6, waitMs = 7000): Promise<Array<{ ebcId: number; km: number }>> {
  if (pick.lat == null || pick.lng == null) return [];
  const key = `similar:v2:${pick.ebcId}:${n}`;
  const hit = await db().cacheGet<Array<{ ebcId: number; km: number }>>(key).catch(() => null);
  const skip = new Set(exclude);
  if (hit?.length) return hit.filter((h) => !skip.has(h.ebcId)).slice(0, n);

  const dLat = RADIUS_KM / 111, dLng = RADIUS_KM / (111 * Math.cos((pick.lat * Math.PI) / 180));
  // a tight box first (dense city centres hold hundreds of hotels), the full radius when that is thin
  let rows = await db().directoryNear(pick.lat, pick.lng, dLat / 2, dLng / 2, 1000).catch(() => []);
  let ranked = rankNearby({ ebcId: pick.ebcId, lat: pick.lat, lng: pick.lng, stars: pick.stars }, rows, skip);
  if (ranked.length < n * 2) { rows = await db().directoryNear(pick.lat, pick.lng, dLat, dLng, 1000).catch(() => []); ranked = rankNearby({ ebcId: pick.ebcId, lat: pick.lat, lng: pick.lng, stars: pick.stars }, rows, skip); }
  ranked = ranked.slice(0, n);

  const imported = ranked.map((r) => importHotel(r.ebcId).then((h) => ({ ok: h.images.length > 0, ebcId: r.ebcId, km: r.km })).catch(() => ({ ok: false, ebcId: r.ebcId, km: r.km })));
  const all = Promise.all(imported);
  const done = await Promise.race([all, new Promise<null>((res) => setTimeout(() => res(null), waitMs))]);
  if (!done) {
    // first reader on this hotel: show what is ready now, the rest is stored for the next one
    const ready: Array<{ ebcId: number; km: number }> = [];
    await Promise.all(imported.map((p) => Promise.race([p.then((x) => { if (x.ok) ready.push(x); }), new Promise((r) => setTimeout(r, 50))])));
    void all.then((xs) => db().cacheSet(key, xs.filter((x) => x.ok).map(({ ebcId, km }) => ({ ebcId, km })).slice(0, n), KEEP_S)).catch(() => undefined);
    return ready.sort((a, b) => a.km - b.km).slice(0, n);
  }
  const out = done.filter((x) => x.ok).map(({ ebcId, km }) => ({ ebcId, km })).slice(0, n);
  if (out.length) await db().cacheSet(key, out, KEEP_S).catch(() => undefined);
  return out;
}

/**
 * Everything priced under a pick, in one search: the creator's other picks within 3 km, then the nearby
 * candidates. Shared by the results page and the daily warm up, so both ask the supplier the same question
 * (and the warm up's answer is the page's cache).
 */
export async function underPick(pick: Hotel, pins: Array<{ ebcId: number; lat: number | null; lng: number | null }>): Promise<{ ids: number[]; pinIds: number[]; near: Array<{ ebcId: number; km: number }> }> {
  const pinIds = pick.lat == null || pick.lng == null ? [] : pins.filter((p) => p.ebcId !== pick.ebcId && p.lat != null && p.lng != null && km(pick.lat!, pick.lng!, p.lat, p.lng) <= 3).map((p) => p.ebcId);
  const near = await similarTo(pick, [pick.ebcId, ...pins.map((p) => p.ebcId)], 14).catch(() => []);
  return { ids: [...pinIds, ...near.map((n) => n.ebcId)], pinIds, near };
}
