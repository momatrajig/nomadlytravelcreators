/**
 * The creator link: /go on the creator's own domain, or /go/<slug> on the platform address.
 *
 *   /go?hotel=634515&src=paris-where-to-stay                 a hotel by ID (what the dashboard's link builder writes)
 *   /go?hotelname=Hôtel Providence&address=Paříž&campaign=…   a hotel by name and place, as article links already name them
 *   /go?city=paris&src=…                                      a destination's hotels
 *   optional: in=YYYY-MM-DD&out=YYYY-MM-DD&adults=2
 *
 * Every click is logged, the reader gets the attribution cookie, and lands: a hotel link on results with that hotel
 * first (Recommended by the creator) and similar stays below, a destination on its results, else the home page. A hotel named but not on
 * the storefront yet is matched in the supplier's list, imported and pinned, so an article can link to any hotel.
 * When a name cannot be matched within a moment the reader still lands (on the destination, else the home page)
 * and the match finishes in the background for the next reader.
 */
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import type { Storefront } from "@/lib/db/types";
import { DESTINATIONS } from "@/lib/content/destinations";
import { isPlatformHost, storefrontFor } from "@/lib/tenant";
import { ATTRIBUTION_DAYS, REF_COOKIE, SF_COOKIE, articleOf, deviceOf, isBot, sourceOf, visitorHash } from "./track";
import { bestMatch, cityQuery, fold, normName } from "./match";
import { findHotel, importHotel } from "./directory";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function later(task: () => Promise<unknown>) {
  const go = () => task().catch((e) => console.error("go background", e instanceof Error ? e.message : e));
  import("next/server").then(({ after }) => { try { after(go); } catch { void go(); } }).catch(() => void go());
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);
}

/** Finds (and if needed imports and pins) the hotel a link names. */
export async function resolveHotel(sf: Storefront, q: URLSearchParams, waitMs: number): Promise<number | null> {
  const pins = await db().pinnedHotels(sf.id);
  const id = Number(q.get("hotel") ?? q.get("h"));
  if (Number.isInteger(id) && id > 0) {
    if (pins.some((p) => p.ebcId === id)) return id;
    const done = await withTimeout(importHotel(id).then(() => db().pinHotel(sf.id, id)).then(() => true), waitMs).catch(() => null);
    if (!done) later(() => importHotel(id).then(() => db().pinHotel(sf.id, id)));
    return done ? id : null;
  }
  const name = q.get("hotelname")?.trim();
  if (!name) return null;
  const pinned = bestMatch(name, pins.map((p) => ({ id: p.ebcId, norm: normName(p.name) })), 0.75);
  if (pinned) return pinned.row.id;
  const place = q.get("address") ?? q.get("city") ?? sf.cityName ?? "";
  const work = async () => {
    const m = await findHotel(name, place);
    if (!m) return null;
    await importHotel(m.ebcId, name);
    await db().pinHotel(sf.id, m.ebcId);
    return m.ebcId;
  };
  const found = await withTimeout(work(), waitMs).catch(() => null);
  if (found === null) later(work);
  return found;
}

function destinationSlug(q: URLSearchParams): string | null {
  const raw = q.get("city") ?? q.get("d") ?? q.get("address");
  if (!raw) return null;
  const name = cityQuery(raw);
  const d = DESTINATIONS.find((x) => x.slug === fold(raw).replace(/ /g, "-") || (name && fold(x.name) === fold(name)));
  return d?.slug ?? null;
}

export async function handleGo(req: NextRequest, slug: string | null): Promise<NextResponse> {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  const platform = isPlatformHost(host);
  const sf = await storefrontFor(host, platform ? slug ?? req.cookies.get(SF_COOKIE)?.value ?? null : null);
  const q = req.nextUrl.searchParams;
  if (!sf) return NextResponse.redirect(new URL("/", req.url));

  // the creator's own domain is live: send the reader there so the cookie and the checkout share one address
  const ownDomain = (sf as Storefront & { domainVerifiedAt?: string | null }).domainVerifiedAt ? sf.customDomain : null;
  if (platform && ownDomain) return NextResponse.redirect(`https://${ownDomain}/go?${q.toString()}`, 302);

  const ua = req.headers.get("user-agent");
  const bot = isBot(ua);
  const ebcId = bot ? null : await resolveHotel(sf, q, 6000).catch(() => null);
  const dest = ebcId ? null : destinationSlug(q);
  const target: "hotel" | "city" | "home" = ebcId ? "hotel" : dest ? "city" : "home";

  const qs = new URLSearchParams();
  const ci = q.get("in") ?? q.get("checkin"), co = q.get("out") ?? q.get("checkout");
  if (ci && co && DATE.test(ci) && DATE.test(co)) { qs.set("in", ci); qs.set("out", co); }
  const adults = Number(q.get("adults"));
  if (adults >= 1 && adults <= 6) qs.set("adults", String(adults));
  if (dest) qs.set("d", dest);
  // a hotel link opens results with the creator's hotel on top ("Recommended by") and similar stays below
  if (ebcId) qs.set("pick", String(ebcId));
  const path = ebcId || dest ? "/stays" : "/";
  const to = new URL(path + (qs.size ? `?${qs}` : ""), req.url);

  const query: Record<string, string> = {};
  for (const k of ["hotel", "hotelname", "address", "city"]) { const v = q.get(k); if (v) query[k] = v.slice(0, 160); }
  const click = await db().logClick({
    storefrontId: sf.id, source: sourceOf(q), article: articleOf(req.headers.get("referer")), target, ebcId: ebcId ?? null, query: Object.keys(query).length ? query : null,
    country: req.headers.get("x-vercel-ip-country")?.slice(0, 2) ?? null, device: deviceOf(ua),
    visitor: visitorHash(req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null, ua), bot,
  }).catch((e) => { console.error("logClick", e instanceof Error ? e.message : e); return null; });

  const res = NextResponse.redirect(to, 302);
  res.headers.set("cache-control", "no-store");
  res.headers.set("x-robots-tag", "noindex");
  if (click && !bot) res.cookies.set(REF_COOKIE, click.id, { path: "/", maxAge: ATTRIBUTION_DAYS * 86400, sameSite: "lax", secure: true, httpOnly: true });
  if (platform) res.cookies.set(SF_COOKIE, sf.slug, { path: "/", maxAge: 30 * 86400, sameSite: "lax", secure: true, httpOnly: true });
  return res;
}
