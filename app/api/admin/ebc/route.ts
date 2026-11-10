import { NextResponse, type NextRequest } from "next/server";
import { ebc, EbcError } from "@/lib/ebc/client";
import { isAdminToken } from "@/lib/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Operator probe of the supplier's content API (cities, hotel lists, details, images). Token gated, read only. */
export async function GET(req: NextRequest) {
  if (!isAdminToken(req.headers.get("x-admin-token") ?? req.nextUrl.searchParams.get("token"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const q = req.nextUrl.searchParams;
  const c = ebc();
  try {
    const op = q.get("op");
    let data: unknown;
    if (op === "cities") data = await c.cities(q.get("name") ?? "", Number(q.get("perPage") ?? 20));
    else if (op === "hotels") data = await c.hotelsPage({ cityId: q.get("cityId") ? Number(q.get("cityId")) : undefined, hotelIds: q.get("ids")?.split(",").map(Number), page: Number(q.get("page") ?? 1), perPage: Number(q.get("perPage") ?? 100) });
    else if (op === "find") {
      // every hotel in a city whose name contains each word given
      const cityId = Number(q.get("cityId")); const words = (q.get("q") ?? "").toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").split(/\s+/).filter(Boolean);
      const first = await c.hotelsPage({ cityId, page: 1, perPage: 100 });
      const pages = Math.min(first.pages, Number(q.get("maxPages") ?? 80));
      const rest = [];
      for (let p = 2; p <= pages; p += 8) rest.push(...(await Promise.all(Array.from({ length: Math.min(8, pages - p + 1) }, (_, i) => c.hotelsPage({ cityId, page: p + i, perPage: 100 })))));
      const all = [first, ...rest].flatMap((r) => r.hotels);
      const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
      data = { total: first.total, pages: first.pages, scanned: all.length, matches: all.filter((h) => words.every((w) => norm(h.name).includes(w))).slice(0, 40) };
    }
    else if (op === "details") data = await c.hotelDetails(Number(q.get("id")));
    else if (op === "images") data = await c.hotelImages(Number(q.get("id")));
    else if (op === "descriptions") data = await c.hotelDescriptions(Number(q.get("id")));
    else return NextResponse.json({ error: "op: cities | hotels | find | details | images | descriptions" }, { status: 400 });
    return NextResponse.json({ ok: true, rate: c.lastRateLimit, data }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof EbcError ? { status: e.problem.status, title: e.problem.title, code: e.code } : String(e instanceof Error ? e.message : e).slice(0, 300) }, { status: 502 });
  }
}
