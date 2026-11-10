import Link from "next/link";
import CreatorMark from "@/components/CreatorMark";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { readDates } from "@/lib/dates";
import { readerOf } from "@/lib/storefront/reader";
import { storefrontDestinations } from "@/lib/storefront/data";
import { requireStorefront } from "@/lib/tenant";
import { photoSet, photoSrc } from "@/lib/media/photo";

export const dynamic = "force-dynamic";

/**
 * The creator's storefront, inside the booking platform: who they are and every hotel they recommend,
 * with their own words, grouped by place. No live prices here (the page is instant); each pick opens
 * the results with that hotel first and similar stays below.
 */
export default async function Picks({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sf = await requireStorefront();
  const { t, f } = await readerOf(sf);
  const { qs } = readDates(await searchParams, env().EBC_MODE);
  const pins = await db().pinnedHotels(sf.id);
  const dests = storefrontDestinations(pins, f.lang);
  const elsewhere = pins.filter((p) => !p.destination || !dests.some((d) => d.slug === p.destination));
  const groups = [...dests.map((d) => ({ key: d.slug, name: d.name, hotels: pins.filter((p) => p.destination === d.slug) })), ...(elsewhere.length ? [{ key: "other", name: f.lang === "cs" ? "Další" : "More", hotels: elsewhere }] : [])];
  const site = sf.siteUrl?.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return (
    <>
      <section className="profile" aria-labelledby="pf-h">
        <CreatorMark sf={sf} size={72} />
        <div>
          <h1 id="pf-h">{t.theirPicks(sf.brandName)}</h1>
          <p>{sf.headline}</p>
          <p className="mute small">{t.picksSub(pins.length, groups.length)}{site ? <> <a href={sf.siteUrl!} rel="noopener">{site}</a></> : null}</p>
        </div>
      </section>
      {groups.map((g) => (
        <section key={g.key} className="pick-group" aria-labelledby={`g-${g.key}`}>
          <h2 id={`g-${g.key}`}>{g.name}</h2>
          <ul className="pick-grid" role="list">
            {g.hotels.map((h) => {
              const p = h.images[0];
              const href = `/stays?pick=${h.ebcId}&${qs}`;
              return (
                <li key={h.ebcId} className="pick-card">
                  <Link href={href} className="pick-pic" tabIndex={-1} aria-hidden="true">{p ? <img src={photoSrc(p.url, 720, p.w)} srcSet={photoSet(p.url, p.w)} sizes="(max-width: 700px) 100vw, 360px" alt="" loading="lazy" /> : <span className="pick-nopic">{h.name.slice(0, 1)}</span>}</Link>
                  <div className="pick-body">
                    <div className="stay-where">{[h.stars ? t.star(h.stars) : null, h.cityName].filter(Boolean).join(", ")}</div>
                    <h3><Link href={href}>{h.name}</Link></h3>
                    {h.tip && <p className="stay-tip">{h.tip}</p>}
                    <Link className="btn btn-brand" href={href}>{t.seeRooms}</Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {!pins.length && <div className="empty"><p>{t.noRoomsDates}</p><Link className="btn" href="/stays">{t.showEvery}</Link></div>}
    </>
  );
}
