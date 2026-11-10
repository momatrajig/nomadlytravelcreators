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
    .filter((r) => r.ebcId !== pick.ebcId && !exclude.has(r.ebcId) && r.lat != null && r.lng != null)
    .map((r) => ({ ...r, km: km(pick.lat, pick.lng, r.lat!, r.lng!) }))
    .filter((r) => r.km <= radiusKm && (!want || (r.stars != null && Math.abs(r.stars - want) <= 1)))
    .sort((a, b) => a.km - b.km);
}

/**
 * Up to `n` hotels near `pick`, by ID, nearest first. The creator's other picks nearby are left to the caller
 * (they are shown with their own badge). Waits at most `waitMs` for first time imports; whatever is not ready
 * in time is finished in the background and joins the list for the next reader.
 */
export async function similarTo(pick: Hotel, exclude: number[], n = 6, waitMs = 7000): Promise<Array<{ ebcId: number; km: number }>> {
  if (pick.lat == null || pick.lng == null) return [];
  const key = `similar:v1:${pick.ebcId}:${n}`;
  const hit = await db().cacheGet<Array<{ ebcId: number; km: number }>>(key).catch(() => null);
  const skip = new Set(exclude);
  if (hit?.length) return hit.filter((h) => !skip.has(h.ebcId)).slice(0, n);

  const dLat = RADIUS_KM / 111, dLng = RADIUS_KM / (111 * Math.cos((pick.lat * Math.PI) / 180));
  const rows = await db().directoryNear(pick.lat, pick.lng, dLat, dLng, 400).catch(() => []);
  const ranked = rankNearby({ ebcId: pick.ebcId, lat: pick.lat, lng: pick.lng, stars: pick.stars }, rows, skip).slice(0, n + 4);

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
