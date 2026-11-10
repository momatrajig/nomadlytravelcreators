import Link from "next/link";
import { Suspense } from "react";
import type { Collection, Storefront } from "@/lib/db/types";
import SearchBar from "@/components/SearchBar";
import StaysFlow from "@/components/StaysFlow";
import ExtrasRow from "@/components/ExtrasRow";
import HeroCycle from "@/components/HeroCycle";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { fmtDay, price, type Dict, type ReaderFmt } from "@/lib/i18n";
import { readerOf } from "@/lib/storefront/reader";
import { readDates } from "@/lib/dates";
import { stayView, storefrontDestinations } from "@/lib/storefront/data";
import { requireStorefront } from "@/lib/tenant";
import { photoSet, photoSrc } from "@/lib/media/photo";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sf = await requireStorefront();
  const { t, f } = await readerOf(sf);
  const fmtDate = (d: string) => fmtDay(d, f.lang);
  const { checkIn, checkOut, adults, qs } = readDates(await searchParams, env().EBC_MODE);
  const [pins, collections] = await Promise.all([db().pinnedHotels(sf.id), db().collections(sf.id)]);
  const seasons = collections.filter((c) => c.kind === "season" && c.checkIn && c.checkOut);
  const dests = storefrontDestinations(pins, f.lang);
  const who = f.lang === "cs" ? sf.brandName : sf.brandName.split(" ").pop()!;
  const slides = ["paris", "dubai", "rio", "london", "istanbul"].map((s) => dests.find((d) => d.slug === s)).filter(Boolean).map((d) => ({ url: d!.hero, place: d!.name }));
  return (
    <>
      <section className="hero" aria-labelledby="hero-h">
        <HeroCycle slides={slides} />
        <div className="hero-copy">
          <h1 id="hero-h">{sf.headline}</h1>
          <p>{t.heroSub(who)}</p>
        </div>
      </section>
      <div className="search-dock"><SearchBar lang={f.lang} checkIn={checkIn} checkOut={checkOut} adults={adults} destinations={dests.map((d) => ({ slug: d.slug, name: d.name }))} /></div>

      <section className="block" aria-labelledby="dest-h">
        <div className="block-head">
          <h2 id="dest-h">{t.whereStayed}</h2>
          <p>{t.placesHotels(dests.length, pins.length)} {t.pricesFor(fmtDate(checkIn), fmtDate(checkOut))}</p>
        </div>
        <ul className="rail" role="list">
          {dests.map((d) => {
            return (
              <li key={d.slug}>
                <Link href={`/stays?d=${d.slug}&${qs}`} className="place">
                  <img src={photoSrc(d.hero, 800)} srcSet={photoSet(d.hero)} sizes="(max-width: 600px) 70vw, 280px" alt="" loading="lazy" />
                  <span className="place-text">
                    <span className="place-name">{d.name}</span>
                    <span className="place-meta">{t.hotelsN(d.hotels.length)}<Suspense fallback={null}><FromPrice sf={sf} ids={d.hotels} checkIn={checkIn} checkOut={checkOut} adults={adults} t={t} f={f} /></Suspense></span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {seasons.map((c) => (
        <Suspense key={c.slug} fallback={<BandSkeleton title={c.title} sub={c.subtitle} hero={c.heroUrl} />}>
          <SeasonBand sf={sf} c={c} t={t} f={f} />
        </Suspense>
      ))}

      <Suspense fallback={<BandSkeleton title={t.everyHotelDates(fmtDate(checkIn), fmtDate(checkOut))} sub={t.askingRates} />}>
        <AllBand sf={sf} checkIn={checkIn} checkOut={checkOut} adults={adults} qs={qs} t={t} f={f} />
      </Suspense>

      <ExtrasRow f={f} />

      <section className="how" aria-labelledby="how-h">
        <h2 id="how-h">{t.howTitle}</h2>
        <div className="how-cols">
          {t.how.map(([h, p]) => <div key={h}><h3>{h}</h3><p>{p}</p></div>)}
        </div>
      </section>
    </>
  );
}

/* Each price dependent part streams in on its own, so the page shows at once even when a live search takes seconds. */

async function FromPrice({ sf, ids, checkIn, checkOut, adults, t, f }: { sf: Storefront; ids: number[]; checkIn: string; checkOut: string; adults: number; t: Dict; f: ReaderFmt }) {
  const v = await stayView(sf, checkIn, checkOut, adults);
  const prices = v.cards.filter((c) => ids.includes(c.ebcId)).map((c) => c.readerPrice / v.nights);
  return prices.length ? <>{t.fromNight(price(f, Math.min(...prices)))}</> : null;
}

function BandSkeleton({ title, sub, hero }: { title: string; sub?: string | null; hero?: string | null }) {
  return (
    <section className={`nf-section${hero ? "" : " plain"}`} style={hero ? { ["--band" as string]: `url("${photoSrc(hero, 1600)}")` } : undefined} aria-busy="true">
      <div className="nf-head"><div><h2>{title}</h2>{sub && <p>{sub}</p>}</div></div>
      <div className="band-wait" role="status"><span className="dot" /><span className="dot" /><span className="dot" /><span className="sr">…</span></div>
    </section>
  );
}

async function SeasonBand({ sf, c, t, f }: { sf: Storefront; c: Collection; t: Dict; f: ReaderFmt }) {
  const v = await stayView(sf, c.checkIn!, c.checkOut!, 2, c.ebcIds);
  return (
    <section className="nf-section" style={{ ["--band" as string]: `url("${photoSrc(c.heroUrl ?? "", 1600)}")` }} aria-labelledby={`s-${c.slug}`}>
      <div className="nf-head">
        <div><h2 id={`s-${c.slug}`}>{c.title}</h2><p>{c.subtitle}</p></div>
        <Link href={`/stays?in=${c.checkIn}&out=${c.checkOut}&adults=2&collection=${c.slug}`}>{t.allN(c.ebcIds.length)}</Link>
      </div>
      {v.error ? <p className="nf-empty" role="alert">{v.error}</p> : v.cards.length ? <StaysFlow f={f} items={v.cards} nights={v.nights} checkedAt={v.checkedAt} qs={`in=${c.checkIn}&out=${c.checkOut}&adults=2`} label={c.title} tabs={false} /> : <p className="nf-empty">{t.noRoomsLeft}</p>}
    </section>
  );
}

async function AllBand({ sf, checkIn, checkOut, adults, qs, t, f }: { sf: Storefront; checkIn: string; checkOut: string; adults: number; qs: string; t: Dict; f: ReaderFmt }) {
  const fmtDate = (d: string) => fmtDay(d, f.lang);
  const all = await stayView(sf, checkIn, checkOut, adults);
  const best = all.cards.filter((c) => (c.saving ?? 0) > 0).length;
  const compared = all.cards.filter((c) => c.saving !== null).length;
  return (
    <section className="nf-section plain" aria-labelledby="picks">
      <div className="nf-head">
        <div><h2 id="picks">{t.everyHotelDates(fmtDate(checkIn), fmtDate(checkOut))}</h2>
          <p>{compared ? t.belowBig(best, compared) : ""}{t.withRooms(all.cards.length)} {t.guestsNights(adults, all.nights)}</p></div>
        <Link href={`/stays?${qs}`}>{t.seeList}</Link>
      </div>
      {all.error ? <p className="nf-empty" role="alert">{t.supplierDown} <Link href={`/?${qs}`}>{t.tryAgain}</Link></p> : <StaysFlow f={f} items={all.cards} nights={all.nights} checkedAt={all.checkedAt} qs={qs} label={t.everyHotel} />}
    </section>
  );
}
