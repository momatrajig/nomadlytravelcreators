import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { isPlatformHost } from "@/lib/tenant";
import { SF_COOKIE } from "@/lib/links/track";

/** A creator's storefront on the platform: /s/<slug> opens their picks page and keeps the platform co-branded with them. Preview a creator's storefront on the platform address before their own domain points at us: /s/<slug>. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  const sf = await db().storefrontBySlug(slug.toLowerCase());
  const to = new URL(req.nextUrl.searchParams.get("to") === "home" ? "/" : "/picks", req.url);
  req.nextUrl.searchParams.forEach((v, k) => { if (k !== "to") to.searchParams.set(k, v); });
  if (!sf?.live || !isPlatformHost(host)) return NextResponse.redirect(new URL("/", req.url));
  const res = NextResponse.redirect(to);
  res.cookies.set(SF_COOKIE, sf.slug, { path: "/", maxAge: 30 * 86400, sameSite: "lax", secure: true, httpOnly: true });
  return res;
}
