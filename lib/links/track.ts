/**
 * Click tracking and booking attribution for creator links.
 *  - A click is logged with its source (the article), the device class, the reader's country (from the edge),
 *    and a visitor hash that changes every day and cannot be turned back into an IP address.
 *  - The reader carries the click id in a first party cookie for 30 days; the last click before a booking wins.
 *  - Known bots and link preview fetchers are logged as bots and never counted.
 */
import { createHash } from "node:crypto";
import { db } from "@/lib/db";

export const REF_COOKIE = "nf_ref";
export const SF_COOKIE = "nf_sf";
export const ATTRIBUTION_DAYS = 30;

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|discord|slack|embedly|curl|wget|python-requests|httpclient|headless|lighthouse|pingdom|uptime|monitor/i;
export const isBot = (ua: string | null) => !ua || BOT.test(ua);
export const deviceOf = (ua: string | null): "mobile" | "tablet" | "desktop" => (!ua ? "desktop" : /ipad|tablet/i.test(ua) ? "tablet" : /mobi|iphone|android/i.test(ua) ? "mobile" : "desktop");

export function visitorHash(ip: string | null, ua: string | null, day = new Date().toISOString().slice(0, 10)): string {
  const salt = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY ?? "local";
  return createHash("sha256").update(`${salt}|${day}|${ip ?? ""}|${ua ?? ""}`).digest("hex").slice(0, 24);
}

/** Source label from a link: src, or the last campaign value (links often carry a site wide campaign first). */
export function sourceOf(q: URLSearchParams): string | null {
  const src = q.get("src") ?? q.getAll("campaign").filter(Boolean).at(-1) ?? q.get("utm_campaign") ?? null;
  return src ? src.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || null : null;
}

/** Referring page path, without query string (most sites send only their origin). */
export function articleOf(referer: string | null): string | null {
  if (!referer) return null;
  try { const u = new URL(referer); return (u.host + (u.pathname === "/" ? "" : u.pathname)).slice(0, 200); } catch { return null; }
}

/** The click a booking is attributed to: same storefront, within the window, not a bot. */
export async function attributionFor(storefrontId: string, clickId: string | null | undefined): Promise<{ clickId: string | null; source: string | null }> {
  if (!clickId || !/^[0-9a-f-]{36}$/i.test(clickId)) return { clickId: null, source: null };
  const c = await db().click(clickId).catch(() => null);
  if (!c || c.storefrontId !== storefrontId || c.bot || Date.now() - Date.parse(c.createdAt) > ATTRIBUTION_DAYS * 86_400_000) return { clickId: null, source: null };
  return { clickId: c.id, source: c.source };
}
