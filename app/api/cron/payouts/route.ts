import { NextResponse } from "next/server";
import { runPayouts } from "@/lib/payouts/run";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Vercel cron: 0 6 * * 3 (Wednesday 06:00 UTC). Protected by CRON_SECRET. */
export async function GET(req: Request) {
  if (process.env.CRON_SECRET && req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return new NextResponse("unauthorized", { status: 401 });
  const lina = await db().storefrontBySlug("lina"); // TODO: iterate all creators once the creators listing exists in Db
  const res = await runPayouts(lina ? [lina.creatorId] : []);
  return NextResponse.json({ ran: res });
}
