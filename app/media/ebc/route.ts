import type { NextRequest } from "next/server";

/**
 * Hotel photos from the supplier's content service, served under our own address: cached at the edge for a
 * year (the file name is a content hash), and the reader's browser never talks to the supplier.
 * Only the supplier's hotel image paths are accepted, so this cannot be used to fetch anything else.
 */
const SRC = /^hotel:[0-9a-f]\/[0-9a-f]\/[0-9a-f]\/\d+\/[\w.-]+\.(jpe?g|png|webp)$/i;
const ORIGIN = "https://www.ebookingcenter.com/tbs/reseller/assets/thumbnail?src=";

export async function GET(req: NextRequest) {
  const src = req.nextUrl.searchParams.get("src") ?? "";
  if (!SRC.test(src)) return new Response("bad image", { status: 400 });
  const r = await fetch(ORIGIN + src, { headers: { accept: "image/*" }, cache: "no-store" }).catch(() => null);
  if (!r || !r.ok || !(r.headers.get("content-type") ?? "").startsWith("image/")) return new Response("not found", { status: 404, headers: { "cache-control": "public, max-age=300" } });
  return new Response(r.body, { headers: { "content-type": r.headers.get("content-type")!, "cache-control": "public, max-age=31536000, immutable", "cdn-cache-control": "public, max-age=31536000, immutable" } });
}
