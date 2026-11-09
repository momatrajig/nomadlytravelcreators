import Link from "next/link";
import { Suspense } from "react";
import type { Collection, Storefront } from "@/lib/db/types";
import SearchBar from "@/components/SearchBar";
import StaysFlow from "@/components/StaysFlow";
import ExtrasRow from "@/components/ExtrasRow";
import HeroCycle from "@/components/HeroCycle";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { fmtDate, usd } from "@/lib/format";
import { readDates } from "@/lib/dates";
import { stayView, storefrontDestinations } from "@/lib/storefront/data";
import { requireStorefront } from "@/lib/tenant";
import { photoSet, photoSrc } from "@/lib/media/photo";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sf = await requireStorefront();
  const { checkIn, checkOut, adults, qs } = readDates(await searchParams, env().EBC_MODE);
  const [pins, collections] = await Promise.all([db().pinnedHotels(sf.id), db().collections(sf.id)]);
  const seasons = collections.filter((c) => c.kind === "season" && c.checkIn && c.checkOut);
  const dests = storefrontDestinations(pins);
  const first = sf.brandName.split(" ").pop();
  const slides = ["paris", "dubai", "rio", "london", "istanbul"].map((s) => dests.find((d) => d.slug === s)).filter(Boolean).map((d) => ({ url: d!.hero, place: d!.name }));
  return (
    <>
      <section className="hero" aria-labelledby="hero-h">
        <HeroCycle slides={slides} />
        <div className="hero-copy">
          <h1 id="hero-h">{sf.headline}</h1>
          <p>Live rates from the hotels, booked through {first}. Where we have read Booking.com and Expedia for the same room and dates, you see their price next to ours.</p>
        </div>
      </section>
      <div className="search-dock"><SearchBar checkIn={checkIn} checkOut={checkOut} adults={adults} destinations={dests.map((d) => ({ slug: d.slug, name: d.name }))} /></div>

      <section className="block" aria-labelledby="dest-h">
        <div className="block-head">
          <h2 id="dest-h">Where I stayed</h2>
          <p>{dests.length} places, {pins.length} hotels. Prices per night for {fmtDate(checkIn)} to {fmtDate(checkOut)}.</p>
        </div>
        <ul className="rail" role="list">
          {dests.map((d) => {
            return (
              <li key={d.slug}>
                <Link href={`/stays?d=${d.slug}&${qs}`} className="place">
                  <img src={photoSrc(d.hero, 800)} srcSet={photoSet(d.hero)} sizes="(max-width: 600px) 70vw, 280px" alt="" loading="lazy" />
                  <span className="place-text">
                    <span className="place-name">{d.name}</span>
                    <span className="place-meta">{d.country}. {d.hotels.length} {d.hotels.length === 1 ? "hotel" : "hotels"}<Suspense fallback={null}><FromPrice sf={sf} ids={d.hotels} checkIn={checkIn} checkOut={checkOut} adults={adults} /></Suspense></span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {seasons.map((c) => (
        <Suspense key={c.slug} fallback={<BandSkeleton title={c.title} sub={c.subtitle} hero={c.heroUrl} />}>
          <SeasonBand sf={sf} c={c} />
        </Suspense>
      ))}

      <Suspense fallback={<BandSkeleton title={`Every hotel, ${fmtDate(checkIn)} to ${fmtDate(checkOut)}`} sub="Asking the hotels for live rates." />}>
        <AllBand sf={sf} checkIn={checkIn} checkOut={checkOut} adults={adults} qs={qs} />
      </Suspense>

      <ExtrasRow />

      <section className="how" aria-labelledby="how-h">
        <h2 id="how-h">How booking here works</h2>
        <div className="how-cols">
          <div><h3>Compared where we can</h3><p>When we have read Booking.com and Expedia for the same room, dates and guests, the card shows their price. If we are not cheaper, it says so.</p></div>
          <div><h3>You pay Nomadly</h3><p>Nomadly buys the room at trade rates and pays the hotel. Your confirmation and reference number arrive by email.</p></div>
          <div><h3>Free cancellation is real</h3><p>Flexible rates cancel free until the date on the rate. The refund goes back to your card.</p></div>
        </div>
      </section>
    </>
  );
}

/* Each price dependent part streams in on its own, so the page shows at once even when a live search takes seconds. */

async function FromPrice({ sf, ids, checkIn, checkOut, adults }: { sf: Storefront; ids: number[]; checkIn: string; checkOut: string; adults: number }) {
  const v = await stayView(sf, checkIn, checkOut, adults);
  const prices = v.cards.filter((c) => ids.includes(c.ebcId)).map((c) => c.readerPrice / v.nights);
  return prices.length ? <>, from {usd(Math.min(...prices), true)} a night</> : null;
}

function BandSkeleton({ title, sub, hero }: { title: string; sub?: string | null; hero?: string | null }) {
  return (
    <section className={`nf-section${hero ? "" : " plain"}`} style={hero ? { ["--band" as string]: `url("${photoSrc(hero, 1600)}")` } : undefined} aria-busy="true">
      <div className="nf-head"><div><h2>{title}</h2>{sub && <p>{sub}</p>}</div></div>
      <div className="band-wait" role="status"><span className="dot" /><span className="dot" /><span className="dot" /><span className="sr">Loading live rates</span></div>
    </section>
  );
}

async function SeasonBand({ sf, c }: { sf: Storefront; c: Collection }) {
  const v = await stayView(sf, c.checkIn!, c.checkOut!, 2, c.ebcIds);
  return (
    <section className="nf-section" style={{ ["--band" as string]: `url("${photoSrc(c.heroUrl ?? "", 1600)}")` }} aria-labelledby={`s-${c.slug}`}>
      <div className="nf-head">
        <div><h2 id={`s-${c.slug}`}>{c.title}</h2><p>{c.subtitle}</p></div>
        <Link href={`/stays?in=${c.checkIn}&out=${c.checkOut}&adults=2&collection=${c.slug}`}>All {c.ebcIds.length} hotels</Link>
      </div>
      {v.error ? <p className="nf-empty" role="alert">{v.error}</p> : v.cards.length ? <StaysFlow items={v.cards} nights={v.nights} checkedAt={v.checkedAt} qs={`in=${c.checkIn}&out=${c.checkOut}&adults=2`} label={c.title} tabs={false} /> : <p className="nf-empty">These hotels have no rooms left for these dates.</p>}
    </section>
  );
}

async function AllBand({ sf, checkIn, checkOut, adults, qs }: { sf: Storefront; checkIn: string; checkOut: string; adults: number; qs: string }) {
  const all = await stayView(sf, checkIn, checkOut, adults);
  const best = all.cards.filter((c) => (c.saving ?? 0) > 0).length;
  const compared = all.cards.filter((c) => c.saving !== null).length;
  return (
    <section className="nf-section plain" aria-labelledby="picks">
      <div className="nf-head">
        <div><h2 id="picks">Every hotel, {fmtDate(checkIn)} to {fmtDate(checkOut)}</h2>
          <p>{compared ? `${best} of ${compared} compared are below the big sites for these dates. ` : ""}{all.cards.length} with rooms. {adults} {adults === 1 ? "adult" : "adults"}, {all.nights} {all.nights === 1 ? "night" : "nights"}, tax included.</p></div>
        <Link href={`/stays?${qs}`}>See the list</Link>
      </div>
      {all.error ? <p className="nf-empty" role="alert">{all.error} <Link href={`/?${qs}`}>Try again</Link></p> : <StaysFlow items={all.cards} nights={all.nights} checkedAt={all.checkedAt} qs={qs} label="Every hotel" />}
    </section>
  );
}
