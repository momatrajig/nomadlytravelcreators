import { NextResponse, type NextRequest } from "next/server";

/**
 * Multi tenant routing. A request's host decides the storefront; the dashboard and admin live on
 * the platform host. We only tag the request here; resolution happens in lib/tenant on the server.
 */
export function middleware(req: NextRequest) {
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").toLowerCase();
  const platform = (process.env.PLATFORM_HOST ?? "nomadly.app").toLowerCase();
  const isPlatform = host === platform || host === `www.${platform}` || host.endsWith(".vercel.app") || host.startsWith("localhost") || host.startsWith("127.");
  const url = req.nextUrl;
  // Platform host serves the dashboard; a creator host must not reach it.
  if (!isPlatform && url.pathname.startsWith("/dashboard")) return NextResponse.redirect(`https://${platform}${url.pathname}`);
  const res = NextResponse.next();
  res.headers.set("x-nomadly-host", host);
  return res;
}

export const config = { matcher: ["/((?!_next|img|favicon.ico|api/webhooks).*)"] };
