import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Runs before every page. Two jobs:
 *  1. Multi tenant guard: the creator dashboard lives on the platform host, never on a creator's domain.
 *  2. Keeps the creator's Supabase Auth session fresh (rotates the cookie), so server components can read it.
 */
export async function proxy(req: NextRequest) {
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").toLowerCase();
  const platform = (process.env.PLATFORM_HOST ?? "nomadly.app").toLowerCase();
  const isPlatform = host === platform || host === `www.${platform}` || host.endsWith(".vercel.app") || host.startsWith("localhost") || host.startsWith("127.");
  const url = req.nextUrl;
  if (!isPlatform && url.pathname.startsWith("/dashboard")) return NextResponse.redirect(`https://${platform}${url.pathname}`);

  let res = NextResponse.next({ request: req });
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (sbUrl && anon && (url.pathname.startsWith("/dashboard") || url.pathname.startsWith("/auth"))) {
    const sb = createServerClient(sbUrl, anon, {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    });
    await sb.auth.getUser();
  }
  res.headers.set("x-nomadly-host", host);
  return res;
}

export const config = { matcher: ["/((?!_next|img|favicon.ico|api/webhooks).*)"] };
