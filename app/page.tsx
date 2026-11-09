import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import StaysFlow from "@/components/StaysFlow";
import ExtrasRow from "@/components/ExtrasRow";
import HeroCycle from "@/components/HeroCycle";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { checkedLabel, fmtDate, usd } from "@/lib/format";
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
  const [all, ...sv] = await Promise.all([
    stayView(sf, checkIn, checkOut, adults),
    ...seasons.map((s) => stayView(sf, s.checkIn!, s.checkOut!, 2, s.ebcIds)),
  ]);
  const first = sf.brandName.split(" ").pop();
  const fromPrice = (ids: number[]) => {
    const prices = all.cards.filter((c) => ids.includes(c.ebcId)).map((c) => c.readerPrice / all.nights);
    return prices.length ? Math.min(...prices) : null;
  };
  const slides = ["paris", "dubai", "rio", "london", "istanbul"].map((s) => dests.find((d) => d.slug === s)).filter(Boolean).map((d) => ({ url: d!.hero, place: d!.name }));
  const best = all.cards.filter((c) => (c.saving ?? 0) > 0).length;
  return (
    <>
      <section className="hero" aria-labelledby="hero-h">
        <HeroCycle slides={slides} />
        <div className="hero-copy">
          <h1 id="hero-h">{sf.headline}</h1>
          <p>Book through {first} and pay less than on Booking.com or Expedia for the same room and dates. You see both prices before you pay.</p>
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
            const from = fromPrice(d.hotels);
            return (
              <li key={d.slug}>
                <Link href={`/stays?d=${d.slug}&${qs}`} className="place">
                  <img src={photoSrc(d.hero, 800)} srcSet={photoSet(d.hero)} sizes="(max-width: 600px) 70vw, 280px" alt="" loading="lazy" />
                  <span className="place-text">
                    <span className="place-name">{d.name}</span>
                    <span className="place-meta">{d.country}. {d.hotels.length} {d.hotels.length === 1 ? "hotel" : "hotels"}{from ? `, from ${usd(from, true)} a night` : ""}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {seasons.map((s, k) => {
        const v = sv[k]!;
        return (
          <section key={s.slug} className="nf-section" style={{ ["--band" as string]: `url("${photoSrc(s.heroUrl ?? "", 1600)}")` }} aria-labelledby={`s-${s.slug}`}>
            <div className="nf-head">
              <div><h2 id={`s-${s.slug}`}>{s.title}</h2><p>{s.subtitle}{v.checkedAt ? ` Big site prices ${checkedLabel(v.checkedAt)}.` : ""}</p></div>
              <Link href={`/stays?in=${s.checkIn}&out=${s.checkOut}&adults=2&collection=${s.slug}`}>All {s.ebcIds.length} hotels</Link>
            </div>
            {v.error ? <p className="nf-empty" role="alert">{v.error}</p> : <StaysFlow items={v.cards} nights={v.nights} checkedAt={v.checkedAt} qs={`in=${s.checkIn}&out=${s.checkOut}&adults=2`} label={s.title} tabs={false} />}
          </section>
        );
      })}

      <section className="nf-section plain" aria-labelledby="picks">
        <div className="nf-head">
          <div><h2 id="picks">Every hotel, {fmtDate(checkIn)} to {fmtDate(checkOut)}</h2>
            <p>{best} of {all.cards.length} are below the big sites for these dates. {adults} {adults === 1 ? "adult" : "adults"}, {all.nights} {all.nights === 1 ? "night" : "nights"}, tax included.</p></div>
          <Link href={`/stays?${qs}`}>See the list</Link>
        </div>
        {all.error ? <p className="nf-empty" role="alert">{all.error} <Link href={`/?${qs}`}>Try again</Link></p> : <StaysFlow items={all.cards} nights={all.nights} checkedAt={all.checkedAt} qs={qs} label="Every hotel" />}
      </section>

      <ExtrasRow />

      <section className="how" aria-labelledby="how-h">
        <h2 id="how-h">How booking here works</h2>
        <div className="how-cols">
          <div><h3>The price is checked</h3><p>Each hotel is priced against Booking.com and Expedia for your exact dates and guests. If we are not cheaper, the card says so.</p></div>
          <div><h3>You pay Nomadly</h3><p>Nomadly buys the room at trade rates and pays the hotel. Your confirmation and reference number arrive by email.</p></div>
          <div><h3>Free cancellation is real</h3><p>Flexible rates cancel free until the date on the rate. The refund goes back to your card.</p></div>
        </div>
      </section>
    </>
  );
}
