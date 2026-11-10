/**
 * Turns a creator's existing hotel links (or every hotel link in an article) into Nomadly links.
 * Understands links that name a hotel (hotelname and address parameters, the format several affiliate
 * networks use), Booking.com hotel pages (the name is in the address), and plain Nomadly links.
 */
import { findHotel, importHotel } from "./directory";
import { db } from "@/lib/db";
import type { Storefront } from "@/lib/db/types";
import { sourceOf } from "./track";

export interface ConvertRow { from: string; kind: "hotel" | "search" | "skip"; name: string | null; place: string | null; source: string | null; ebcId: number | null; matched: string | null; to: string | null; note: string | null }

const slugOf = (u: URL) => u.pathname.split("/").filter(Boolean).pop()?.replace(/\.[a-z]+$/, "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").slice(0, 80) || null;

/** What a single outbound link asks for. */
export function readLink(href: string): { name: string | null; place: string | null; source: string | null; search: boolean } | null {
  let u: URL;
  try { u = new URL(href); } catch { return null; }
  const q = u.searchParams;
  const name = q.get("hotelname") ?? q.get("hotel_name") ?? null;
  if (name) return { name, place: q.get("address") ?? q.get("city") ?? null, source: sourceOf(q), search: false };
  if (/booking\.com$/.test(u.hostname.replace(/^www\./, "")) && /^\/hotel\/[a-z]{2}\//.test(u.pathname)) {
    const slug = u.pathname.split("/")[3]?.replace(/\.[a-z-]+\.html$|\.html$/, "") ?? "";
    return { name: slug.replace(/-/g, " "), place: null, source: sourceOf(q), search: false };
  }
  if (q.get("address") || /allez|roam|searchresults|\/search/i.test(u.pathname)) return { name: null, place: q.get("address") ?? q.get("ss") ?? q.get("city") ?? null, source: sourceOf(q), search: true };
  return null;
}

/** Hotel links found in an article page (the creator's own site). */
export async function linksInArticle(url: string): Promise<{ links: string[]; source: string | null }> {
  const r = await fetch(url, { headers: { "user-agent": "NomadlyLinkConverter/1.0 (+creator tool)" }, signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`The article answered ${r.status}`);
  const html = (await r.text()).slice(0, 3_000_000);
  const hrefs = [...html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]!.replace(/&amp;/g, "&").replace(/&#038;/g, "&"));
  const hotel = hrefs.filter((h) => { const x = readLink(h); return !!x && (!!x.name || x.search); });
  return { links: [...new Set(hotel)].slice(0, 60), source: slugOf(new URL(url)) };
}

export async function convertLinks(sf: Storefront, lines: string[], base: string, opts: { place?: string | null; source?: string | null } = {}): Promise<ConvertRow[]> {
  const out: ConvertRow[] = [];
  const queue: Array<{ href: string; source: string | null }> = [];
  for (const raw of lines.map((l) => l.trim()).filter(Boolean).slice(0, 80)) {
    const link = readLink(raw);
    if (link) { queue.push({ href: raw, source: opts.source ?? null }); continue; }
    // not a hotel link: treat it as an article and read the hotel links in it
    try {
      const a = await linksInArticle(raw);
      if (!a.links.length) out.push({ from: raw, kind: "skip", name: null, place: null, source: null, ebcId: null, matched: null, to: null, note: "No hotel links found on this page." });
      for (const h of a.links) queue.push({ href: h, source: opts.source ?? a.source });
    } catch (e) {
      out.push({ from: raw, kind: "skip", name: null, place: null, source: null, ebcId: null, matched: null, to: null, note: e instanceof Error ? e.message : "Could not read this address." });
    }
  }
  const pins = await db().pinnedHotels(sf.id);
  let position = pins.length;
  for (const { href, source: fallback } of queue.slice(0, 60)) {
    const l = readLink(href)!;
    const source = opts.source ?? fallback ?? l.source;
    const place = l.place ?? opts.place ?? sf.cityName ?? null;
    const p = new URLSearchParams();
    if (l.search || !l.name) {
      if (place) p.set("city", place);
      if (source) p.set("src", source);
      out.push({ from: href, kind: "search", name: null, place, source, ebcId: null, matched: place ? `Hotels in ${place}` : "Your storefront", to: `${base}?${p}`, note: null });
      continue;
    }
    const m = place ? await findHotel(l.name, place, 45_000).catch(() => null) : null;
    if (!m) {
      out.push({ from: href, kind: "hotel", name: l.name, place, source, ebcId: null, matched: null, to: null, note: place ? "Not found in the supplier's list for this place. Add it from Hotels, by name." : "Add the place (city) to find this hotel." });
      continue;
    }
    const h = await importHotel(m.ebcId, l.name);
    await db().pinHotel(sf.id, m.ebcId, { position: position++ });
    p.set("hotel", String(m.ebcId));
    if (source) p.set("src", source);
    out.push({ from: href, kind: "hotel", name: l.name, place, source, ebcId: m.ebcId, matched: `${h.name}${h.stars ? `, ${h.stars} star` : ""}${h.address ? `, ${h.address}` : ""}`, to: `${base}?${p}`, note: m.score < 1 ? "Close match: check the address." : null });
  }
  return out;
}
