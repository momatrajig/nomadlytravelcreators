/**
 * Creator identity for the dashboard.
 *  - Production: Supabase Auth magic link. A signed in user is matched to a creator by user id, or on first
 *    sign in by email (then the user id is stored on the creator row).
 *  - Pilot: until a creator has signed in once, the default creator's dashboard is open (ALLOW_DEMO_DASHBOARD,
 *    on by default while every row is demo data). Set ALLOW_DEMO_DASHBOARD=off before the first real creator.
 *  - Local mode: the seeded creator.
 */
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import type { Creator } from "@/lib/db/types";
import { supabaseForRequest } from "@/lib/supabase-server";

export async function signedInUser(): Promise<{ id: string; email: string | null } | null> {
  const sb = await supabaseForRequest();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  return data.user ? { id: data.user.id, email: data.user.email ?? null } : null;
}

export async function currentCreator(): Promise<Creator | null> {
  const e = env();
  if (e.DATA_MODE === "local") return db().creatorByUserId("00000000-0000-0000-0000-000000000001");
  const user = await signedInUser();
  if (user) {
    const byId = await db().creatorByUserId(user.id);
    if (byId) return byId;
    if (user.email) {
      const byEmail = await db().creatorByEmail(user.email);
      if (byEmail) { await db().linkCreatorUser(byEmail.id, user.id); return { ...byEmail, userId: user.id }; }
    }
    return null; // signed in but not a creator
  }
  return e.ALLOW_DEMO_DASHBOARD !== "off" ? demoCreator() : null;
}

async function demoCreator(): Promise<Creator | null> {
  const sf = await db().storefrontBySlug(env().DEFAULT_STOREFRONT ?? "lina");
  return sf ? db().creator(sf.creatorId) : null;
}
