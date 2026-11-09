import { NextResponse } from "next/server";
import { ebc, EbcError } from "@/lib/ebc/client";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Connection check for the hotel supplier. Never returns credentials: errors are reduced to status, title and a redacted detail. */
const redact = (s: unknown) => String(s ?? "").replace(/[0-9a-f]{24,}/gi, "[redacted]").slice(0, 300);

export async function GET() {
  const out: Record<string, unknown> = { mode: env().EBC_MODE };
  const step = async (name: string, fn: () => Promise<unknown>) => {
    try { out[name] = { ok: true, ...(await fn() as object) }; return true; }
    catch (e) { out[name] = e instanceof EbcError ? { ok: false, status: e.problem.status, title: redact(e.problem.title), code: e.code, detail: redact(e.problem?.detail ?? e.message) } : { ok: false, detail: redact(e instanceof Error ? e.message : e) }; return false; }
  };
  const c = ebc();
  if (await step("nationality", async () => ({ US: await c.nationalityId("US") })))
    await step("search", async () => {
      const r = await c.searchSync({ accommodation: [483658, 303974, 421077], checkIn: "2026-12-03", checkOut: "2026-12-05", occupancy: { rooms: [{ adults: 1, childrenAges: [] }] } });
      return { hotels: r.hotels.length, offers: r.hotels.reduce((a, h) => a + h.offers.length, 0) };
    });
  out.scopesNotGranted = c.droppedScopes;
  return NextResponse.json(out, { headers: { "cache-control": "no-store" } });
}
