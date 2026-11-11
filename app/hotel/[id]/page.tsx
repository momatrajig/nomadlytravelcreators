import Link from "next/link";
import { Suspense } from "react";
import type { Storefront } from "@/lib/db/types";
import { notFound } from "next/navigation";
import RateList from "@/components/RateList";
import HotelMap from "@/components/StaticMap";
import TravelTimes from "@/components/TravelTimes";
import GalleryOpener from "@/components/GalleryOpener";
import CreatorMark from "@/components/CreatorMark";
import HotelDates from "@/components/HotelDates";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { checkedLabel } from "@/lib/format";
import { approxOf, fmtDay, placeName, price, type Dict, type ReaderFmt } from "@/lib/i18n";
import { readerOf } from "@/lib/storefront/reader";
import { readDates } from "@/lib/dates";
import { destination, stayView } from "@/lib/storefront/data";
import { requireStorefront } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function HotelPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sf = await requireStorefront();
  const { t, f } = await readerOf(sf);
  const fmtDate = (d: string) => fmtDay(d, f.lang);
  const { id } = await params;
  const ebcId = Number(id);
  if (!Number.isInteger(ebcId)) notFound();
  const { checkIn, checkOut, adults, qs } = readDates(await searchParams, env().EBC_MODE);
  const [hotel, pins] = await Promise.all([db().hotel(ebcId), db().pinnedHotels(sf.id)]);
  if (!hotel) notFound();
  const d = destination(hotel.destination);
  const pin = pins.find((p) => p.ebcId === ebcId);
  const first = f.lang === "cs" ? sf.brandName : sf.brandName.split(" ").pop();
  return (
    <>
      <nav className="crumbs" aria-label="Breadcrumb"><Link href={pin ? `/stays?pick=${ebcId}&${qs}` : `/stays?${qs}`}>{pin && d ? t.stayingIn(placeName(d.slug, d.name, f.lang)) : t.allHotels}</Link>{d && !pin && <><span aria-hidden="true">/</span><Link href={`/stays?d=${d.slug}&${qs}`}>{placeName(d.slug, d.name, f.lang)}</Link></>}<span aria-hidden="true">/</span><span aria-current="page">{hotel.name}</span></nav>
      <GalleryOpener lang={f.lang} photos={hotel.images} name={hotel.name} />
      <div className="hotel">
        <div className="hotel-main">
          <header className="hotel-head">
            {pin && <div className="also-pick" style={{ fontSize: 14 }}><CreatorMark sf={sf} size={20} /><span>{t.recommendedBy(sf.brandName)}</span></div>}
            <h1>{hotel.name}</h1>
            <p>{[hotel.address, hotel.address?.includes(hotel.cityName ?? "\u0000") ? null : hotel.cityName].filter(Boolean).join(", ")}.{hotel.stars ? ` ${t.star(hotel.stars)}` : ""}{hotel.rating ? t.ratedBy(hotel.rating.toFixed(1), hotel.ratingCount?.toLocaleString(f.lang === "cs" ? "cs-CZ" : "en-US") ?? "") : ""}{hotel.stars || hotel.rating ? "." : ""}</p>
          </header>
          {pin?.tip && <blockquote className="tip"><p>{pin.tip}</p><footer>{first}{pin.stayedWhen ? t.stayed(pin.stayedWhen) : ""}</footer></blockquote>}

          <h2 className="rates-h" id="rooms">{t.roomsFor(fmtDate(checkIn), fmtDate(checkOut), adults)}</h2>
          <HotelDates ebcId={ebcId} checkIn={checkIn} checkOut={checkOut} adults={adults} lang={f.lang} currency={sf.currency || "USD"} />
          <Suspense fallback={<div className="list-wait" role="status" aria-label="Loading live rates">{[0, 1, 2].map((k) => <div key={k} style={{ gridTemplateColumns: "1fr 200px" }}><div><div className="skel line" style={{ width: "60%", height: 22 }} /><div className="skel line" style={{ width: "80%" }} /></div><div className="skel line" style={{ height: 32 }} /></div>)}</div>}>
            <Rates t={t} f={f} sf={sf} ebcId={ebcId} checkIn={checkIn} checkOut={checkOut} adults={adults} qs={qs} photos={hotel.images} />
          </Suspense>
        </div>
        <aside className="hotel-side">
          {hotel.lat != null && hotel.lng != null && <HotelMap lat={hotel.lat} lng={hotel.lng} name={hotel.name} labels={[t.mapOf(hotel.name), t.fullMap]} />}
          {hotel.lat != null && hotel.lng != null && <TravelTimes lang={f.lang} destination={hotel.destination} lat={hotel.lat} lng={hotel.lng} />}
        </aside>
      </div>
    </>
  );
}

async function Rates({ t, f, sf, ebcId, checkIn, checkOut, adults, qs, photos }: { t: Dict; f: ReaderFmt; sf: Storefront; ebcId: number; checkIn: string; checkOut: string; adults: number; qs: string; photos: Array<{ url: string; w?: number }> }) {
  const v = await stayView(sf, checkIn, checkOut, adults, [ebcId]);
  const offer = v.offers.find((o) => o.ebcId === ebcId);
  const card = v.cards.find((c) => c.ebcId === ebcId);
  const flex = offer?.rates.find((r) => r.refundable);
  const usd = (x: number, whole = true) => price(f, x, whole);
  const fmtDate = (d: string) => fmtDay(d, f.lang);
  void approxOf;
  return (
    <>
          {card?.saving != null && card.lowestReference && (
            <div className={`proof ${card.saving > 0 ? "" : "warn"}`}>
              {card.saving > 0
                ? <><b>{t.lessThan(usd(card.saving), card.lowestReference.source)}.</b> {card.lowestReference.source}: {usd(card.lowestReference.price)}{v.checkedAt && f.lang === "en" ? `, ${checkedLabel(v.checkedAt)}` : ""}.</>
                : <><b>{t.above(usd(-card.saving), card.lowestReference.source)}.</b></>}
            </div>
          )}
          {flex && <ul className="terms">
            <li>{flex.cancelDeadline ? t.cheapestFlexUntil(fmtDate(flex.cancelDeadline), flex.cancelCharge ? usd(flex.cancelCharge, false) : null) : t.flexNoDate}</li>
            <li>{t.taxNote}</li>
          </ul>}
          {v.error ? <div className="notice warn" role="alert">{t.supplierDown}</div> : offer ? <RateList f={f} ebcId={ebcId} rates={offer.rates} nights={v.nights} checkIn={checkIn} checkOut={checkOut} adults={adults} photos={photos} /> : <div className="empty"><p>{t.noRooms}</p><Link className="btn" href={`/stays?${qs}`}>{t.tryOtherDates}</Link></div>}
    </>
  );
}
