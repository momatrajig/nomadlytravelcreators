/**
 * Data access. Two implementations behind one interface:
 *  - supabase: production, service role on the server, RLS for the dashboard
 *  - local:    JSON fixtures, used by tests and when no Supabase project is configured
 * Route handlers import `db()` and never talk to a client directly.
 */
import { env } from "@/lib/env";
import type { Db } from "./types";
import { localDb } from "./local";

// one instance per process, shared across route handlers and server components in dev (separate module graphs)
const g = globalThis as unknown as { __nomadlyDb?: Db };
export function db(): Db {
  if (g.__nomadlyDb) return g.__nomadlyDb;
  let instance: Db;
  if (env().DATA_MODE === "supabase" && env().SUPABASE_SERVICE_ROLE_KEY) {
    // lazy import keeps the supabase client out of the local test path
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabaseDb } = require("./supabase") as typeof import("./supabase");
    instance = supabaseDb();
  } else {
    instance = localDb();
  }
  g.__nomadlyDb = instance;
  return instance;
}
export type { Db } from "./types";
