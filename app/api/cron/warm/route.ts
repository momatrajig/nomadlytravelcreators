import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminToken } from "@/lib/admin";
import { searchStays } from "@/lib/booking/service";
import { defaultDates } from "@/lib/dates";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Daily, just after midnight UTC: the default stay dates move by a day, so every storefront's searches are run
 * once ahead of readers (the whole list and each hotel page), for the readers' usual country. A reader arriving
 * from an article then sees prices at once instead of waiting for the supplier.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const cron = process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`;
  if (!cron && !isAdminToken(req.headers.get("x-admin-token"))) return new NextResponse("unauthorized", { status: 401 });
  const { checkIn, checkOut } = defaultDates(env().EBC_MODE);
  const started = Date.now();
  const done: Array<{ sf: string; hotels: number; ok: number }> = [];
  for (const slug of await db().storefrontSlugs()) {
    const sf = await db().storefrontBySlug(slug);
    if (!sf?.live) continue;
    const country = sf.locale === "cs" ? "CZ" : "US";
    const pins = await db().pinnedHotels(sf.id);
    const jobs: Array<() => Promise<unknown>> = [() => searchStays(sf, checkIn, checkOut, 2, [], undefined, country, { fresh: true }), ...pins.map((p) => () => searchStays(sf, checkIn, checkOut, 2, [], [p.ebcId], country, { fresh: true }))];
    let ok = 0;
    for (let i = 0; i < jobs.length && Date.now() - started < 270_000; i += 4) {
      const r = await Promise.allSettled(jobs.slice(i, i + 4).map((j) => j()));
      ok += r.filter((x) => x.status === "fulfilled").length;
    }
    done.push({ sf: slug, hotels: pins.length, ok });
  }
  return NextResponse.json({ checkIn, checkOut, done, seconds: Math.round((Date.now() - started) / 1000) });
}
