import Link from "next/link";
import { Suspense } from "react";
import type { Hotel, PinnedHotel, Storefront } from "@/lib/db/types";
import type { StayCardData } from "@/components/StaysFlow";
import SearchBar from "@/components/SearchBar";
import CreatorMark from "@/components/CreatorMark";
import { env } from "@/lib/env";
import { checkedLabel } from "@/lib/format";
import { fmtDay, placeName, price, approxOf, type Dict, type ReaderFmt } from "@/lib/i18n";
import { readerOf } from "@/lib/storefront/reader";
import { nights as nightsOf } from "@/lib/booking/service";
import { readDates } from "@/lib/dates";
import { destination, stayView, storefrontDestinations } from "@/lib/storefront/data";
import { underPick, km } from "@/lib/storefront/similar";
import { requireStorefront } from "@/lib/tenant";
import { freeNow } from "@/lib/booking/policy";
import { db } from "@/lib/db";
import { photoSet, photoSrc } from "@/lib/media/photo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Results. Two modes:
 *  - a destination or season (the storefront's own hotels), sorted by saving
 *  - a pick (?pick=<hotel>): what a creator's hotel link opens. The creator's hotel comes first with a
 *    "Recommended by" badge, then their other picks nearby, then similar hotels from the whole supplier
 *    catalog, nearest first, like a search for one hotel by name on Booking.com.
 */
export default async function Stays({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sf = await requireStorefront();
  const { t, f } = await readerOf(sf);
  const fmtDate = (d: string) => fmtDay(d, f.lang);
  const sp = await searchParams;
  const { checkIn, checkOut, adults, qs } = readDates(sp, env().EBC_MODE);
  const pickId = Number(typeof sp.pick === "string" ? sp.pick : NaN);
  const [pins, collections, pick] = await Promise.all([db().pinnedHotels(sf.id), db().collections(sf.id), Number.isInteger(pickId) && pickId > 0 ? db().hotel(pickId) : Promise.resolve(null)]);
  const dests = storefrontDestinations(pins, f.lang);
  const d = typeof sp.d === "string" ? destination(sp.d) : pick ? destination(pick.destination) : null;
  const col = !pick && typeof sp.collection === "string" ? collections.find((c) => c.slug === sp.collection) ?? null : null;
  const only = col ? col.ebcIds : d ? pins.filter((p) => p.destination === d.slug).map((p) => p.ebcId) : undefined;
  const place = d ? placeName(d.slug, d.name, f.lang) : pick?.cityName ?? null;
  const title = col ? col.title : pick && place ? t.stayingIn(place) : d ? placeName(d.slug, d.name, f.lang) : t.everyHotel;
  const chip = (href: string, label: string, on: boolean) => <Link key={href} className="filter" href={href} aria-current={on ? "page" : undefined}>{label}</Link>;
  const datesQs = qs;
  return (
    <>
      <div className="page-search"><SearchBar lang={f.lang} checkIn={checkIn} checkOut={checkOut} adults={adults} dest={d?.slug ?? ""} destinations={dests.map((x) => ({ slug: x.slug, name: x.name }))} /></div>
      {!pick && (
        <nav className="filters" aria-label="Destinations and seasons">
          {chip(`/stays?${qs}`, t.all, !d && !col)}
          {collections.filter((c) => c.kind === "season").map((c) => chip(`/stays?in=${c.checkIn}&out=${c.checkOut}&adults=2&collection=${c.slug}`, c.title, col?.slug === c.slug))}
          {dests.map((x) => chip(`/stays?d=${x.slug}&${qs}`, x.name, d?.slug === x.slug && !col))}
        </nav>
      )}
      <header className="list-head">
        <h1>{title}</h1>
        <p>{t.listMeta(fmtDate(checkIn), fmtDate(checkOut), nightsOf(checkIn, checkOut), adults)}</p>
      </header>
      {pick ? (
        <>
          <Suspense key={`p${pick.ebcId}${checkIn}${checkOut}${adults}`} fallback={<ListWait n={1} />}>
            <PickBlock t={t} f={f} sf={sf} pick={pick} checkIn={checkIn} checkOut={checkOut} adults={adults} qs={datesQs} />
          </Suspense>
          <section className="similar" aria-labelledby="sim-h">
            <div className="similar-head"><h2 id="sim-h">{t.similarNearby}</h2><p>{t.similarSub}</p></div>
            <Suspense key={`s${pick.ebcId}${checkIn}${checkOut}${adults}`} fallback={<ListWait n={3} />}>
              <SimilarList t={t} f={f} sf={sf} pick={pick} pins={pins} checkIn={checkIn} checkOut={checkOut} adults={adults} qs={datesQs} />
            </Suspense>
          </section>
        </>
      ) : (
        <Suspense key={`${checkIn}${checkOut}${adults}${only?.join(".")}`} fallback={<ListWait n={3} />}>
          <StayList t={t} f={f} sf={sf} checkIn={checkIn} checkOut={checkOut} adults={adults} only={only} qs={qs} colIn={col?.checkIn ?? null} />
        </Suspense>
      )}
    </>
  );
}

function ListWait({ n }: { n: number }) {
  return (
    <div className="list-wait" role="status" aria-label="Loading live rates">
      {Array.from({ length: n }, (_, k) => <div key={k}><div className="skel pic" /><div><div className="skel line" style={{ width: "40%" }} /><div className="skel line" style={{ width: "70%", height: 26 }} /><div className="skel line" style={{ width: "55%" }} /></div><div><div className="skel line" style={{ width: "80%", height: 30, marginLeft: "auto" }} /></div></div>)}
    </div>
  );
}

async function PickBlock({ t, f, sf, pick, checkIn, checkOut, adults, qs }: { t: Dict; f: ReaderFmt; sf: Storefront; pick: Hotel; checkIn: string; checkOut: string; adults: number; qs: string }) {
  const v = await stayView(sf, checkIn, checkOut, adults, [pick.ebcId]);
  const card = v.cards.find((c) => c.ebcId === pick.ebcId);
  const pinned = v.pins.find((p) => p.ebcId === pick.ebcId);
  const fallback: StayCardData = { ebcId: pick.ebcId, name: pick.name, stars: pick.stars ?? 0, area: null, city: pick.cityName, rating: pick.rating, ratingCount: pick.ratingCount, photos: pick.images, readerPrice: 0, refundable: false, board: "", cancelDeadline: null, cancelCharge: null, onRequest: false, lowestReference: null, saving: null, booked: 0, tip: pinned?.tip ?? null, creatorPick: !!pinned };
  return (
    <>
      {v.error && <div className="notice warn" role="alert">{t.supplierDown} <Link href={`/stays?pick=${pick.ebcId}&${qs}`}>{t.tryAgain}</Link></div>}
      <ul className="list" role="list">
        <StayRow t={t} f={f} sf={sf} h={card ?? fallback} nights={v.nights} href={`/hotel/${pick.ebcId}?${qs}`} featured soldOut={!card && !v.error} />
      </ul>
      {!card && !v.error && <p className="mute small">{t.pickGone}</p>}
      {card && v.checkedAt && f.lang === "en" && card.lowestReference && <p className="mute small" style={{ marginTop: 6 }}>{t.bigChecked(checkedLabel(v.checkedAt))}</p>}
    </>
  );
}

async function SimilarList({ t, f, sf, pick, pins, checkIn, checkOut, adults, qs }: { t: Dict; f: ReaderFmt; sf: Storefront; pick: Hotel; pins: PinnedHotel[]; checkIn: string; checkOut: string; adults: number; qs: string }) {
  const { ids, pinIds, near } = await underPick(pick, pins);
  if (!ids.length) return <p className="mute">{t.noRoomsDates}</p>;
  // one search per hotel, in parallel: a combined search returns only the hotels the supplier answers within its
  // time limit (warm ones), and the per hotel answer is the same cache the hotel page reads, so a click opens at once
  const views = await Promise.all(ids.map((id) => stayView(sf, checkIn, checkOut, adults, [id])));
  const v = { cards: views.flatMap((x) => x.cards), nights: views[0]!.nights, error: views.every((x) => x.error) ? views[0]!.error : null };
  const hotels = await Promise.all(pinIds.map((id) => db().hotel(id).catch(() => null)));
  const dist = new Map<number, number>(near.map((n) => [n.ebcId, n.km]));
  for (const h of hotels) if (h?.lat != null && h.lng != null && pick.lat != null && pick.lng != null) dist.set(h.ebcId, km(pick.lat, pick.lng, h.lat, h.lng));
  // the creator's own nearby picks first, then the rest nearest first
  const sorted = [...v.cards].sort((a, b) => Number(!!b.creatorPick) - Number(!!a.creatorPick) || (dist.get(a.ebcId) ?? 99) - (dist.get(b.ebcId) ?? 99));
  // the creator's nearby picks, then the six nearest that have rooms on these dates
  const cards = [...sorted.filter((c) => c.creatorPick), ...sorted.filter((c) => !c.creatorPick).slice(0, 6)];
  return (
    <>
      {v.error && <div className="notice warn" role="alert">{t.supplierDown}</div>}
      <ul className="list" role="list">
        {cards.map((h) => <StayRow key={h.ebcId} t={t} f={f} sf={sf} h={h} nights={v.nights} href={`/hotel/${h.ebcId}?${qs}`} km={dist.get(h.ebcId)} />)}
      </ul>
      {!cards.length && !v.error && <p className="mute">{t.noRoomsDates}</p>}
    </>
  );
}

function StayRow({ t, f, sf, h, nights, href, featured, soldOut, km: away }: { t: Dict; f: ReaderFmt; sf: Storefront; h: StayCardData; nights: number; href: string; featured?: boolean; soldOut?: boolean; km?: number }) {
  const p = h.photos[0];
  const fmtDate = (d: string) => fmtDay(d, f.lang);
  const usd = (x: number) => price(f, x);
  return (
    <li className={`stay${featured ? " stay-pick" : ""}`}>
      {featured && <div className="pick-badge"><CreatorMark sf={sf} /><span>{t.recommendedBy(sf.brandName)}</span></div>}
      <Link href={href} className="stay-pic" tabIndex={-1} aria-hidden="true">{p && <img src={photoSrc(p.url, 960, p.w)} srcSet={photoSet(p.url, p.w)} sizes="(max-width: 700px) 100vw, 320px" alt="" loading={featured ? "eager" : "lazy"} />}</Link>
      <div className="stay-main">
        {!featured && h.creatorPick && <div className="also-pick"><CreatorMark sf={sf} size={16} /><span>{t.alsoPick(sf.brandName)}</span></div>}
        <div className="stay-where">{[h.area, h.city].filter(Boolean).join(", ")}{away != null ? `${h.area || h.city ? ". " : ""}${t.kmAway(away)}` : ""}</div>
        <h2><Link href={href}>{h.name}</Link></h2>
        <div className="stay-facts">{h.stars ? t.star(h.stars) : ""}{h.rating ? t.fromReviews(h.rating.toFixed(1), h.ratingCount?.toLocaleString(f.lang === "cs" ? "cs-CZ" : "en-US") ?? "") : ""}{freeNow(h) && h.cancelDeadline ? `. ${t.freeCancelUntil(fmtDate(h.cancelDeadline))}` : ""}</div>
        {h.tip && <p className="stay-tip">{h.tip}</p>}
      </div>
      <div className="stay-price">
        {soldOut ? <span className="above">{t.noRoomsDates}</span> : <>
          {h.saving !== null && h.lowestReference && (h.saving > 0
            ? <span className="save">{t.lessThan(usd(h.saving), h.lowestReference.source)}</span>
            : <span className="above">{t.above(usd(-h.saving), h.lowestReference.source)}</span>)}
          {h.saving && h.saving > 0 ? <span className="was"><s>{usd(h.lowestReference!.price)}</s><span className="save-pct">−{Math.round((h.saving / h.lowestReference!.price) * 100)}%</span></span> : null}
          <strong>{usd(h.readerPrice)}</strong>
          <span className="per">{t.aNight(usd(h.readerPrice / nights))}{approxOf(f, h.readerPrice) ? <><br />{approxOf(f, h.readerPrice)}</> : null}</span>
        </>}
        <Link className="btn btn-brand" href={href}>{t.seeRooms}</Link>
      </div>
    </li>
  );
}

async function StayList({ t, f, sf, checkIn, checkOut, adults, only, qs, colIn }: { t: Dict; f: ReaderFmt; sf: Storefront; checkIn: string; checkOut: string; adults: number; only?: number[]; qs: string; colIn: string | null }) {
  const v = await stayView(sf, checkIn, checkOut, adults, only);
  const cards = [...v.cards].sort((a, b) => (b.saving ?? -1e9) - (a.saving ?? -1e9));
  return (
    <>
      {v.checkedAt && f.lang === "en" && <p className="mute small" style={{ marginTop: -8, marginBottom: 12 }}>{t.bigChecked(checkedLabel(v.checkedAt))}</p>}
      {v.error && <div className="notice warn" role="alert">{t.supplierDown} <Link href={`/stays?${qs}`}>{t.tryAgain}</Link></div>}
      <ul className="list" role="list">
        {cards.map((h) => {
          const href = `/hotel/${h.ebcId}?${checkIn === colIn ? `in=${checkIn}&out=${checkOut}&adults=${adults}` : qs}`;
          return <StayRow key={h.ebcId} t={t} f={f} sf={sf} h={h} nights={v.nights} href={href} />;
        })}
      </ul>
      {!cards.length && !v.error && <div className="empty"><p>{t.noRoomsDates}</p><Link className="btn" href="/stays">{t.showEvery}</Link></div>}
    </>
  );
}
