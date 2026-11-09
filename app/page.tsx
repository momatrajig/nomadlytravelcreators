import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import StaysFlow from "@/components/StaysFlow";
import ExtrasRow from "@/components/ExtrasRow";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { fmtDate, fmtTime } from "@/lib/format";
import { readDates } from "@/lib/dates";
import { stayView } from "@/lib/storefront/data";
import { requireStorefront } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sf = await requireStorefront();
  const { checkIn, checkOut, adults, qs } = readDates(await searchParams, env().EBC_MODE);
  const [pins, collections] = await Promise.all([db().pinnedHotels(sf.id), db().collections(sf.id)]);
  const homeIds = pins.filter((p) => p.cityName === sf.cityName).map((p) => p.ebcId);
  const season = collections.find((c) => c.kind === "season");
  const destinations = collections.filter((c) => c.kind === "destination");
  const [v, sv] = await Promise.all([
    stayView(sf, checkIn, checkOut, adults, homeIds),
    season?.checkIn && season.checkOut ? stayView(sf, season.checkIn, season.checkOut, 2, season.ebcIds) : Promise.resolve(null),
  ]);
  const hero = v.pins[0]?.images[0]?.url;
  const first = sf.brandName.split(" ").pop();
  const [lead, ...rest] = sf.headline.split(", ");
  return (
    <>
      <section className="hero" aria-label="Welcome">
        {hero && <img src={hero} alt="" fetchPriority="high" />}
        <div className="shade" />
        <div className="copy">
          <h1 style={{ color: "#fff" }}>{lead}{rest.length ? <>, <em>{rest.join(", ")}</em></> : null}</h1>
          <p>Every price here is checked against Booking.com, Expedia and Agoda, and you see the difference before you book. I stayed in each of these hotels and I tell you what I would ask for.</p>
        </div>
      </section>
      <div style={{ marginTop: -28, position: "relative", zIndex: 2 }}><SearchBar checkIn={checkIn} checkOut={checkOut} adults={adults} city={sf.cityName ?? ""} /></div>

      <section className="nf-section" aria-labelledby="picks">
        <div className="nf-head">
          <div><h2 id="picks">{first}&apos;s {sf.cityName} picks, <em>priced below the big sites.</em></h2>
            <p>{fmtDate(checkIn)} to {fmtDate(checkOut)}, {adults} {adults === 1 ? "adult" : "adults"}, {v.nights} {v.nights === 1 ? "night" : "nights"}.{v.checkedAt ? ` Prices on the big sites were read at ${fmtTime(v.checkedAt)} today.` : ""}</p></div>
          <Link href={`/stays?${qs}&city=${encodeURIComponent(sf.cityName ?? "")}`}>See all {sf.cityName} stays</Link>
        </div>
        {v.error ? <div className="notice warn" role="alert">{v.error} <Link href={`/?${qs}`}>Retry</Link></div> : <StaysFlow items={v.cards} nights={v.nights} checkedAt={v.checkedAt} qs={qs} label={`${sf.cityName} picks`} />}
      </section>

      {season && sv && (
        <section className="nf-section" aria-labelledby="season" style={{ background: "radial-gradient(120% 90% at 20% 0%, #2a1434 0%, #0b1020 60%)" }}>
          <div className="nf-head">
            <div><h2 id="season">{season.title}, <em>already priced for the dates.</em></h2><p>{season.subtitle}</p></div>
            <Link href={`/stays?in=${season.checkIn}&out=${season.checkOut}&adults=2&collection=${season.slug}`}>See the whole list</Link>
          </div>
          {sv.error ? <div className="notice warn" role="alert">{sv.error}</div> : <StaysFlow items={sv.cards} nights={sv.nights} checkedAt={sv.checkedAt} qs={`in=${season.checkIn}&out=${season.checkOut}&adults=2`} label={season.title} tabs={false} />}
        </section>
      )}

      {destinations.length > 0 && (
        <section aria-labelledby="dest" style={{ marginTop: 26 }}>
          <h2 id="dest" style={{ fontSize: 24 }}>Where else I stayed</h2>
          <p className="mute" style={{ margin: "4px 0 14px" }}>The same promise everywhere: a hotel I slept in, priced below the big sites, with the one tip I would give a friend.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
            {destinations.map((c) => (
              <Link key={c.id} href={`/stays?${qs}&collection=${c.slug}`} style={{ position: "relative", display: "block", aspectRatio: "4/3", borderRadius: "var(--r-lg)", overflow: "hidden", textDecoration: "none", color: "#fff", background: "#0b1020" }}>
                {c.heroUrl && <img src={c.heroUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />}
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,.75))" }} />
                <div style={{ position: "absolute", left: 16, right: 16, bottom: 14 }}><div style={{ fontFamily: "var(--font-display)", fontSize: 24 }}>{c.title}</div><div className="small" style={{ opacity: .85 }}>{c.ebcIds.length} {c.ebcIds.length === 1 ? "hotel" : "hotels"}{c.subtitle ? `. ${c.subtitle}` : ""}</div></div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <ExtrasRow />

      <section className="panel" style={{ marginTop: 22 }}>
        <h2 style={{ fontSize: 22 }}>How this works</h2>
        <p className="mute" style={{ margin: "8px 0 0" }}>Nomadly buys these rooms at trade rates and adds a small fee. The price you see already includes it, and it still lands below the big sites on most dates; when it does not, we say so on the card. You pay Nomadly, Nomadly pays the hotel, and you can cancel free until the date shown on the rate.</p>
      </section>
    </>
  );
}
