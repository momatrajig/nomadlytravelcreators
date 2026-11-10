import { NextResponse } from "next/server";
import { runPayouts } from "@/lib/payouts/run";
import { db } from "@/lib/db";
import { isAdminToken } from "@/lib/admin";

export const dynamic = "force-dynamic";

/**
 * Vercel cron, monthly: the 15th at 06:00 UTC. Pays every creator for stays completed before the 1st of this
 * month. Only Vercel's cron (CRON_SECRET) or a Nomadly operator token can run it; without a secret it refuses.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const cron = process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`;
  if (!cron && !isAdminToken(req.headers.get("x-admin-token"))) return new NextResponse("unauthorized", { status: 401 });
  const res = await runPayouts(await db().creatorIdsWithStorefronts());
  return NextResponse.json({ ran: res });
}
