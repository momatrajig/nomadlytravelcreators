/**
 * Who is looking at the dashboard, and whose numbers they see.
 *  - A creator signed in by magic link sees their own storefront.
 *  - A Nomadly operator (signed in with an ADMIN_EMAILS address) can open any creator's dashboard (?as=<slug>,
 *    remembered in a cookie) to set it up with them.
 *  - Not signed in, while the pilot demo is open: the default demo creator, read only.
 */
import { cookies } from "next/headers";
import { currentCreator, signedInUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import type { Creator, Storefront } from "@/lib/db/types";

export const AS_COOKIE = "nf_as";

export interface DashContext { creator: Creator; sf: Storefront; user: { id: string; email: string | null } | null; admin: boolean; canEdit: boolean; demo: boolean }

export async function dashContext(): Promise<DashContext | null> {
  const user = await signedInUser();
  const admin = isAdminEmail(user?.email);
  if (admin) {
    const slug = (await cookies()).get(AS_COOKIE)?.value;
    const sf = slug ? await db().storefrontBySlug(slug) : null;
    const own = sf ? null : await currentCreator();
    const target = sf ?? (own ? (await db().storefrontsForCreator(own.id))[0] : null) ?? await db().storefrontBySlug(process.env.DEFAULT_STOREFRONT ?? "lina");
    if (!target) return null;
    const creator = (await db().creator(target.creatorId))!;
    return { creator, sf: target, user, admin, canEdit: true, demo: false };
  }
  const creator = await currentCreator();
  if (!creator) return null;
  const sf = (await db().storefrontsForCreator(creator.id))[0];
  if (!sf) return null;
  const demo = !user && env().DATA_MODE !== "local";
  return { creator, sf, user, admin: false, canEdit: !demo || env().DATA_MODE === "local", demo };
}

/** For server actions: the context, only when it may change things. */
export async function editableContext(): Promise<DashContext> {
  const c = await dashContext();
  if (!c || !c.canEdit) throw new Error("Sign in to change your storefront.");
  return c;
}
