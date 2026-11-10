/**
 * The supplier's hotel list per city, cached in our database, and on demand import of one hotel's content
 * (details and photos) so it can be pinned to a storefront and priced.
 *
 * A large city is 40+ pages of 100 hotels; a sync reads pages in parallel batches within a time budget and
 * resumes where it stopped on the next call.
 */
import { ebc } from "@/lib/ebc/client";
import { db } from "@/lib/db";
import type { DirectoryHotel, Hotel } from "@/lib/db/types";
import { destinationForCity, DESTINATIONS } from "@/lib/content/destinations";
import { bestMatch, cityQuery, displayName, fold, normName } from "./match";

const RESYNC_DAYS = 30;

export interface CityRef { id: number; name: string }

/** Supplier cities for a place name: the exact name first, then its "Surroundings" area (hotels just outside). */
export async function citiesFor(place: string): Promise<CityRef[]> {
  const q = cityQuery(place);
  if (!q) return [];
  const key = `cities:v1:${fold(q)}`;
  const hit = await db().cacheGet<CityRef[]>(key).catch(() => null);
  if (hit) return hit;
  const list = await ebc().cities(q, 50);
  const exact = list.filter((c) => fold(c.name) === fold(q));
  const around = list.filter((c) => fold(c.name) === `${fold(q)} surroundings`);
  const out = [...exact, ...around].map((c) => ({ id: c.id, name: c.name }));
  if (out.length) await db().cacheSet(key, out, 30 * 86400).catch(() => undefined);
  return out;
}

/** Reads the city's hotel list into the directory. Returns true when the whole list is stored. */
export async function syncCity(city: CityRef, budgetMs = 40_000): Promise<boolean> {
  const started = Date.now();
  const have = await db().directoryCity(city.id);
  if (have?.finishedAt && Date.now() - Date.parse(have.finishedAt) < RESYNC_DAYS * 86_400_000) return true;
  let pages = have?.pages ?? 0, done = have && !have.finishedAt ? have.pagesDone : 0, total = have?.total ?? 0;
  const c = ebc();
  if (!pages || done === 0) {
    const first = await c.hotelsPage({ cityId: city.id, page: 1, perPage: 100 });
    pages = first.pages; total = first.total; done = 1;
    await db().saveDirectoryHotels(first.hotels.map((h) => row(h, city.id)));
    await db().saveDirectoryCity({ cityId: city.id, name: city.name, pages, pagesDone: done, total, finishedAt: pages <= 1 ? new Date().toISOString() : null });
  }
  while (done < pages && Date.now() - started < budgetMs) {
    const batch = Array.from({ length: Math.min(8, pages - done) }, (_, i) => done + 1 + i);
    const res = await Promise.all(batch.map((p) => c.hotelsPage({ cityId: city.id, page: p, perPage: 100 })));
    await db().saveDirectoryHotels(res.flatMap((r) => r.hotels.map((h) => row(h, city.id))));
    done += batch.length;
    await db().saveDirectoryCity({ cityId: city.id, name: city.name, pages, pagesDone: done, total, finishedAt: done >= pages ? new Date().toISOString() : null });
  }
  return done >= pages;
}

type ApiHotel = Awaited<ReturnType<ReturnType<typeof ebc>["hotelsPage"]>>["hotels"][number];
const row = (h: ApiHotel, cityId: number): DirectoryHotel => ({
  ebcId: Number(h.id), name: h.name, norm: normName(h.name), cityId, address: h.address ?? null, zip: h.zipCode ?? null, stars: h.stars ?? null,
  lat: h.geolocation?.latitude ?? null, lng: h.geolocation?.longitude ?? null,
});

export interface Resolved { ebcId: number; supplierName: string; score: number; cityId: number }

/**
 * Finds a hotel by the name and place an article uses. Syncs the city's list if it is not stored yet
 * (within the budget). Returns null when nothing matches clearly.
 */
export async function findHotel(name: string, place: string, budgetMs = 40_000): Promise<Resolved | null> {
  const cities = await citiesFor(place);
  let best: Resolved | null = null;
  for (const city of cities) {
    await syncCity(city, budgetMs);
    const rows = await db().directoryHotels(city.id);
    const m = bestMatch(name, rows);
    if (m && (!best || m.score > best.score)) best = { ebcId: m.row.ebcId, supplierName: m.row.name, score: m.score, cityId: city.id };
    if (best?.score === 1) break;
  }
  return best;
}

/** Search the stored directory of a place for the dashboard's hotel picker. */
export async function searchHotels(place: string, q: string, limit = 12): Promise<Array<DirectoryHotel & { cityName: string }>> {
  const cities = await citiesFor(place);
  const out: Array<DirectoryHotel & { cityName: string }> = [];
  const want = fold(q).split(" ").filter(Boolean);
  for (const city of cities) {
    await syncCity(city);
    for (const r of await db().directoryHotels(city.id)) if (want.every((w) => r.norm.includes(w))) out.push({ ...r, cityName: city.name });
  }
  return out.sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0)).slice(0, limit);
}

/** The supplier's photo, served through our own address (cached at the edge; the supplier is not named to readers). */
export const supplierPhoto = (url: string): string | null => {
  const src = /[?&]src=(hotel:[^&]+)/.exec(url)?.[1];
  return src ? `/media/ebc?src=${encodeURIComponent(decodeURIComponent(src))}` : null;
};

/** Imports one hotel's details and photos into our hotel table. `name` overrides the supplier's upper case name. */
export async function importHotel(ebcId: number, name?: string | null): Promise<Hotel> {
  const existing = await db().hotel(ebcId);
  if (existing && existing.images.length && (!name || existing.name === name)) return existing;
  const c = ebc();
  const [d, imgs] = await Promise.all([c.hotelDetails(ebcId), c.hotelImages(ebcId).catch(() => [])]);
  const city = d.city?.name ?? null;
  const dest = destinationForCity(city) ?? (d.geolocation ? DESTINATIONS.find((x) => Math.abs(x.lat - d.geolocation!.latitude) < 0.35 && Math.abs(x.lng - d.geolocation!.longitude) < 0.5) ?? null : null);
  // portrait and landscape photos alike; the supplier's largest size is 1000 pixels on the long side
  const images = imgs.map((i) => supplierPhoto(i.url)).filter((u): u is string => !!u).slice(0, 24).map((url) => ({ url, w: 1000, source: "supplier" }));
  const hotel: Hotel = {
    ebcId, name: (name?.trim() || existing?.name || displayName(d.name)).slice(0, 120), stars: d.stars ?? null, address: d.address ?? null, cityName: dest?.name ?? city, lat: d.geolocation?.latitude ?? null, lng: d.geolocation?.longitude ?? null,
    images: images.length ? images : existing?.images ?? [], rating: existing?.rating ?? null, ratingCount: existing?.ratingCount ?? null, destination: dest?.slug ?? existing?.destination ?? null,
  };
  await db().upsertHotel({ ...hotel, cityId: d.city?.id ?? null, countryIso: d.country?.iso ?? null });
  return hotel;
}
