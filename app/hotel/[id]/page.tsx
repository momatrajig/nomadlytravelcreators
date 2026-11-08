import Link from "next/link";
import { notFound } from "next/navigation";
import RateList from "@/components/RateList";
import StaticMap from "@/components/StaticMap";
import TravelTimes from "@/components/TravelTimes";
import GalleryOpener from "@/components/GalleryOpener";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { fmtDate, fmtTime, usd } from "@/lib/format";
import { readDates } from "@/lib/dates";
import { stayView } from "@/lib/storefront/data";
import { requireStorefront } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function HotelPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sf = await requireStorefront();
  const { id } = await params;
  const ebcId = Number(id);
  if (!Number.isInteger(ebcId)) notFound();
  const { checkIn, checkOut, adults, qs } = readDates(await searchParams, env().EBC_MODE);
  const [hotel, v] = await Promise.all([db().hotel(ebcId), stayView(sf, checkIn, checkOut, adults)]);
  if (!hotel) notFound();
  const offer = v.offers.find((o) => o.ebcId === ebcId);
  const card = v.cards.find((c) => c.ebcId === ebcId);
  const pin = v.pins.find((p) => p.ebcId === ebcId);
  const imgs = hotel.images.map((i) => i.url);
  const flex = offer?.rates.find((r) => r.refundable);
  return (
    <>
      <p className="small mute" style={{ margin: "14px 0 8px" }}><Link href={`/stays?${qs}`}>{sf.cityName} stays</Link> / {hotel.name}</p>
      <div className="two">
        <div>
          <GalleryOpener images={imgs} name={hotel.name} />
          <h1 style={{ fontSize: 30, marginTop: 16 }}>{hotel.name}</h1>
          <p className="mute" style={{ margin: "4px 0 0" }}>{hotel.address}, {hotel.cityName}. {hotel.stars} star{hotel.rating ? `, ${hotel.rating.toFixed(1)} from ${hotel.ratingCount?.toLocaleString("en-US")} guest reviews` : ""}.</p>
          {pin?.tip && <div className="panel" style={{ marginTop: 14, borderLeft: "3px solid var(--brand)" }}><b>{sf.brandName.split(" ").pop()}&apos;s tip</b>{pin.stayedWhen ? <span className="mute small">, stayed {pin.stayedWhen}</span> : null}<p style={{ margin: "6px 0 0" }}>{pin.tip}</p></div>}

          <h2 style={{ fontSize: 22, margin: "22px 0 10px" }}>Rates for {fmtDate(checkIn)} to {fmtDate(checkOut)}, {adults} {adults === 1 ? "adult" : "adults"}</h2>
          {card?.saving !== null && card?.lowestReference && (
            <div className={`notice ${card.saving! > 0 ? "" : "warn"}`} style={{ marginBottom: 12 }}>
              <span>{card.saving! > 0 ? <><b>{usd(card.saving!, true)} less than {card.lowestReference.source}.</b> {card.lowestReference.source} showed {usd(card.lowestReference.price, true)} for the same room, dates and guests{v.checkedAt ? `, checked at ${fmtTime(v.checkedAt)}` : ""}, signed out.</> : <><b>{usd(-card.saving!, true)} above {card.lowestReference.source} right now.</b> We show it so you can decide.</>}</span>
            </div>
          )}
          {flex && <div className="facts" style={{ marginBottom: 6 }}>
            <div>Free cancellation until <b>&nbsp;{flex.cancelDeadline ? fmtDate(flex.cancelDeadline) : "check in"}</b>&nbsp;on flexible rates{flex.cancelCharge ? `, then ${usd(flex.cancelCharge)} is charged` : ""}. If you do not turn up, the full price is charged.</div>
            <div>Tax included. The city tourist tax is paid at the hotel, per person per night.</div>
          </div>}
          {v.error ? <div className="notice warn" role="alert">{v.error}</div> : offer ? <RateList ebcId={ebcId} rates={offer.rates} nights={v.nights} checkIn={checkIn} checkOut={checkOut} adults={adults} /> : <div className="panel"><p className="mute">No rooms for these dates. <Link href={`/stays?${qs}`}>Try other dates</Link>.</p></div>}
        </div>
        <aside>
          <div className="mapcard">
            {hotel.lat && hotel.lng && <StaticMap lat={hotel.lat} lng={hotel.lng} name={hotel.name} />}
            {hotel.lat && hotel.lng && <TravelTimes city={hotel.cityName ?? ""} lat={hotel.lat} lng={hotel.lng} hotelName={hotel.name} />}
          </div>
        </aside>
      </div>
    </>
  );
}
