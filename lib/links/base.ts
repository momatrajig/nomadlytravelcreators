import type { Storefront } from "@/lib/db/types";

/** The address a creator puts in articles: their own domain once it is verified, else the platform link. */
export function linkBase(sf: Storefront & { domainVerifiedAt?: string | null }, h: Headers): string {
  if (sf.customDomain && sf.domainVerifiedAt) return `https://${sf.customDomain}/go`;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "nomadly.app";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}/go/${sf.slug}`;
}
