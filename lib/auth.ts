/**
 * Creator identity for the dashboard. Production: Supabase Auth session cookie (magic link).
 * Local mode: the seeded creator, so the dashboard can be developed without credentials.
 */
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import type { Creator } from "@/lib/db/types";

export async function currentCreator(): Promise<Creator | null> {
  const e = env();
  if (e.DATA_MODE === "local") return db().creatorByUserId("00000000-0000-0000-0000-000000000001");
  if (!e.NEXT_PUBLIC_SUPABASE_URL || !e.NEXT_PUBLIC_SUPABASE_ANON_KEY) return e.ALLOW_DEMO_DASHBOARD ? demoCreator() : null;
  const store = await cookies();
  const sb = createServerClient(e.NEXT_PUBLIC_SUPABASE_URL, e.NEXT_PUBLIC_SUPABASE_ANON_KEY, { cookies: { getAll: () => store.getAll(), setAll: () => { /* read only in server components */ } } });
  const { data } = await sb.auth.getUser();
  if (!data.user) return e.ALLOW_DEMO_DASHBOARD ? demoCreator() : null;
  return db().creatorByUserId(data.user.id);
}

/** Pilot only: the seeded creator owns the dashboard until creator sign in is switched on. */
async function demoCreator(): Promise<Creator | null> {
  const sf = await db().storefrontBySlug("lina");
  return sf ? db().creator(sf.creatorId) : null;
}
