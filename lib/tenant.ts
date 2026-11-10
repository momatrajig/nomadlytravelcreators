import { cookies, headers } from "next/headers";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import type { Storefront } from "@/lib/db/types";
import { SF_COOKIE } from "@/lib/links/track";

/** Platform, preview and local addresses: these can show any storefront (chosen by link or cookie); a creator's own domain shows only its own. */
export function isPlatformHost(host: string, platformHost = env().PLATFORM_HOST): boolean {
  const h = host.toLowerCase().split(":")[0]!;
  return h === platformHost || h === `www.${platformHost}` || h.endsWith(".vercel.app") || h === "localhost" || h === "127.0.0.1";
}

/** Resolve the storefront for a host, honoring the preview choice (nomadly.app/s/<slug>) on platform hosts. */
export async function storefrontFor(host: string, previewSlug?: string | null): Promise<Storefront | null> {
  if (previewSlug && isPlatformHost(host)) {
    const sf = await db().storefrontBySlug(previewSlug);
    if (sf?.live) return sf;
  }
  return db().storefrontByHost(host, env().PLATFORM_HOST);
}

/** Resolve the storefront from the request host. Called in server components and route handlers. */
export async function currentStorefront(): Promise<Storefront | null> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const slug = (await cookies()).get(SF_COOKIE)?.value ?? null;
  return storefrontFor(host, slug);
}

export async function requireStorefront(): Promise<Storefront> {
  const sf = await currentStorefront();
  if (!sf) throw new Response("No storefront on this host", { status: 404 });
  return sf;
}

/** Public address of a storefront: its own domain once verified, else the platform preview link. */
export function storefrontUrl(sf: Storefront & { domainVerifiedAt?: string | null }, platformOrigin: string): string {
  return sf.customDomain && sf.domainVerifiedAt ? `https://${sf.customDomain}` : `${platformOrigin}/s/${sf.slug}`;
}
