import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import StaysFlow from "@/components/StaysFlow";
import { env } from "@/lib/env";
import { fmtDate, fmtTime } from "@/lib/format";
import { readDates } from "@/lib/dates";
import { stayView } from "@/lib/storefront/data";
import { requireStorefront } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sf = await requireStorefront();
  const { checkIn, checkOut, adults, qs } = readDates(await searchParams, env().EBC_MODE);
  const v = await stayView(sf, checkIn, checkOut, adults);
  const hero = v.pins[0]?.images[0]?.url;
  const [lead, ...rest] = sf.headline.split(", ");
  return (
    <>
      <section className="hero" aria-label="Welcome">
        {hero && <img src={hero} alt="" fetchPriority="high" />}
        <div className="shade" />
        <div className="copy">
          <h1>{lead}{rest.length ? <>, <em>{rest.join(", ")}</em></> : null}</h1>
          <p>Every price here is checked against Booking.com, Expedia and Agoda, and you see the difference before you book. I stayed in each of these hotels and I tell you what I would ask for.</p>
        </div>
      </section>
      <div style={{ marginTop: -28, position: "relative", zIndex: 2 }}><SearchBar checkIn={checkIn} checkOut={checkOut} adults={adults} city={sf.cityName ?? ""} /></div>

      <section className="nf-section" aria-labelledby="picks">
        <div className="nf-head">
          <div><h2 id="picks">{sf.brandName.split(" ").pop()}&apos;s picks, <em>priced below the big sites.</em></h2>
            <p>{sf.cityName}, {fmtDate(checkIn)} to {fmtDate(checkOut)}, {adults} {adults === 1 ? "adult" : "adults"}, {v.nights} {v.nights === 1 ? "night" : "nights"}.{v.checkedAt ? ` Prices on the big sites were read at ${fmtTime(v.checkedAt)} today.` : ""}</p></div>
          <Link href={`/stays?${qs}`}>See all {sf.cityName} stays</Link>
        </div>
        {v.error ? <div className="notice warn" role="alert">{v.error} <Link href={`/?${qs}`}>Retry</Link></div> : <StaysFlow items={v.cards} nights={v.nights} checkedAt={v.checkedAt} qs={qs} label="Picks" />}
      </section>

      <section className="panel" style={{ marginTop: 22 }}>
        <h2 style={{ fontSize: 22 }}>How this works</h2>
        <p className="mute" style={{ margin: "8px 0 0" }}>Nomadly buys these rooms at trade rates and adds a small fee. The price you see already includes it, and it still lands below the big sites on most dates; when it does not, we say so on the card. You pay Nomadly, Nomadly pays the hotel, and you can cancel free until the date shown on the rate.</p>
      </section>
    </>
  );
}
