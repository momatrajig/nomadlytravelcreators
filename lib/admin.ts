/**
 * Platform operator access (Nomadly staff), separate from creator sign in.
 *  - Token: requests carrying x-admin-token whose SHA-256 matches ADMIN_TOKEN_SHA256. Only the hash lives in
 *    code or env, so the public repository never holds a usable secret. Rotate by changing the hash.
 *  - Email: a signed in Supabase user whose email is in ADMIN_EMAILS can open any creator's dashboard.
 */
import { createHash, timingSafeEqual } from "node:crypto";

const DEFAULT_HASH = "f7673b6d83923238e5d9b1e99beda5134c5a15ba4507e7f6d50ae6002acf7dc2";
const DEFAULT_ADMINS = ["mo@veny.ai"];

export function isAdminToken(token: string | null | undefined): boolean {
  if (!token || token.length < 32) return false;
  const want = Buffer.from(process.env.ADMIN_TOKEN_SHA256 ?? DEFAULT_HASH, "hex");
  const got = createHash("sha256").update(token).digest();
  return want.length === got.length && timingSafeEqual(want, got);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS ?? DEFAULT_ADMINS.join(",")).split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return list.includes(email.toLowerCase());
}
