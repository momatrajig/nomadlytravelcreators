import Link from "next/link";
import { Suspense } from "react";
import type { Storefront } from "@/lib/db/types";
import { notFound } from "next/navigation";
import RateList from "@/components/RateList";
import HotelMap from "@/components/StaticMap";
import TravelTimes from "@/components/TravelTimes";
import GalleryOpener from "@/components/GalleryOpener";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { checkedLabel, fmtDate, usd } from "@/lib/format";
import { readDates } from "@/lib/dates";
import { destination, stayView } from "@/lib/storefront/data";
import { requireStorefront } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function HotelPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sf = await requireStorefront();
  const { id } = await params;
  const ebcId = Number(id);
  if (!Number.isInteger(ebcId)) notFound();
  const { checkIn, checkOut, adults, qs } = readDates(await searchParams, env().EBC_MODE);
  const [hotel, pins] = await Promise.all([db().hotel(ebcId), db().pinnedHotels(sf.id)]);
  if (!hotel) notFound();
  const d = destination(hotel.destination);
  const pin = pins.find((p) => p.ebcId === ebcId);
  const first = sf.brandName.split(" ").pop();
  return (
    <>
      <nav className="crumbs" aria-label="Breadcrumb"><Link href={`/stays?${qs}`}>All hotels</Link>{d && <><span aria-hidden="true">/</span><Link href={`/stays?d=${d.slug}&${qs}`}>{d.name}</Link></>}<span aria-hidden="true">/</span><span aria-current="page">{hotel.name}</span></nav>
      <GalleryOpener photos={hotel.images} name={hotel.name} />
      <div className="hotel">
        <div className="hotel-main">
          <header className="hotel-head">
            <h1>{hotel.name}</h1>
            <p>{hotel.address}, {hotel.cityName}. {hotel.stars} star{hotel.rating ? `, rated ${hotel.rating.toFixed(1)} by ${hotel.ratingCount?.toLocaleString("en-US")} guests` : ""}.</p>
          </header>
          {pin?.tip && <blockquote className="tip"><p>{pin.tip}</p><footer>{first}{pin.stayedWhen ? `, stayed ${pin.stayedWhen}` : ""}</footer></blockquote>}

          <h2 className="rates-h">Rooms for {fmtDate(checkIn)} to {fmtDate(checkOut)}, {adults} {adults === 1 ? "adult" : "adults"}</h2>
          <Suspense fallback={<div className="list-wait" role="status" aria-label="Loading live rates">{[0, 1, 2].map((k) => <div key={k} style={{ gridTemplateColumns: "1fr 200px" }}><div><div className="skel line" style={{ width: "60%", height: 22 }} /><div className="skel line" style={{ width: "80%" }} /></div><div className="skel line" style={{ height: 32 }} /></div>)}</div>}>
            <Rates sf={sf} ebcId={ebcId} checkIn={checkIn} checkOut={checkOut} adults={adults} qs={qs} />
          </Suspense>
        </div>
        <aside className="hotel-side">
          {hotel.lat != null && hotel.lng != null && <HotelMap lat={hotel.lat} lng={hotel.lng} name={hotel.name} />}
          {hotel.lat != null && hotel.lng != null && <TravelTimes destination={hotel.destination} lat={hotel.lat} lng={hotel.lng} />}
        </aside>
      </div>
    </>
  );
}

async function Rates({ sf, ebcId, checkIn, checkOut, adults, qs }: { sf: Storefront; ebcId: number; checkIn: string; checkOut: string; adults: number; qs: string }) {
  const v = await stayView(sf, checkIn, checkOut, adults, [ebcId]);
  const offer = v.offers.find((o) => o.ebcId === ebcId);
  const card = v.cards.find((c) => c.ebcId === ebcId);
  const flex = offer?.rates.find((r) => r.refundable);
  return (
    <>
          {card?.saving != null && card.lowestReference && (
            <div className={`proof ${card.saving > 0 ? "" : "warn"}`}>
              {card.saving > 0
                ? <><b>{usd(card.saving, true)} less than {card.lowestReference.source}.</b> {card.lowestReference.source} showed {usd(card.lowestReference.price, true)} for the same room, dates and guests{v.checkedAt ? `, ${checkedLabel(v.checkedAt)}` : ""}, signed out.</>
                : <><b>{usd(-card.saving, true)} above {card.lowestReference.source} for these dates.</b> We show it so you can decide.</>}
            </div>
          )}
          {flex && <ul className="terms">
            <li>{flex.cancelDeadline ? <>Free cancellation until <b>{fmtDate(flex.cancelDeadline)}</b> on the cheapest flexible rate{flex.cancelCharge ? `, then ${usd(flex.cancelCharge)}` : ""}.</> : "Flexible rates are refundable; each one's exact deadline is shown at checkout, before you pay."}</li>
            <li>Taxes included. City tax, where there is one, is paid at the hotel.</li>
          </ul>}
          {v.error ? <div className="notice warn" role="alert">{v.error}</div> : offer ? <RateList ebcId={ebcId} rates={offer.rates} nights={v.nights} checkIn={checkIn} checkOut={checkOut} adults={adults} /> : <div className="empty"><p>No rooms for these dates.</p><Link className="btn" href={`/stays?${qs}`}>Try other dates</Link></div>}
    </>
  );
}
