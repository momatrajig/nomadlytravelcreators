import { headers } from "next/headers";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import type { Storefront } from "@/lib/db/types";

/** Resolve the storefront from the request host. Called in server components and route handlers. */
export async function currentStorefront(): Promise<Storefront | null> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  return db().storefrontByHost(host, env().PLATFORM_HOST);
}

export async function requireStorefront(): Promise<Storefront> {
  const sf = await currentStorefront();
  if (!sf) throw new Response("No storefront on this host", { status: 404 });
  return sf;
}
