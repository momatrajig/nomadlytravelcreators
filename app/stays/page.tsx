import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import { env } from "@/lib/env";
import { fmtDate, usd } from "@/lib/format";
import { readDates } from "@/lib/dates";
import { stayView } from "@/lib/storefront/data";
import { requireStorefront } from "@/lib/tenant";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Stays({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sf = await requireStorefront();
  const sp = await searchParams;
  const { checkIn, checkOut, adults, qs } = readDates(sp, env().EBC_MODE);
  const [pins, collections] = await Promise.all([db().pinnedHotels(sf.id), db().collections(sf.id)]);
  const city = typeof sp.city === "string" ? sp.city : null;
  const col = typeof sp.collection === "string" ? collections.find((c) => c.slug === sp.collection) ?? null : null;
  const only = col ? col.ebcIds : city ? pins.filter((p) => p.cityName === city).map((p) => p.ebcId) : undefined;
  const v = await stayView(sf, checkIn, checkOut, adults, only);
  const cities = [...new Set(pins.map((p) => p.cityName).filter((c): c is string => !!c))];
  const title = col ? col.title : city ?? "Every stay";
  const cards = [...v.cards].sort((a, b) => (b.saving ?? -1e9) - (a.saving ?? -1e9));
  return (
    <>
      <div style={{ marginTop: 18 }}><SearchBar checkIn={checkIn} checkOut={checkOut} adults={adults} city={sf.cityName ?? ""} /></div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 18 }}>
        <Link className="chip" href={`/stays?${qs}`} aria-current={!city && !col ? "page" : undefined} style={{ background: !city && !col ? "var(--navy)" : undefined, color: !city && !col ? "#fff" : undefined }}>All</Link>
        {cities.map((c) => <Link key={c} className="chip" href={`/stays?${qs}&city=${encodeURIComponent(c)}`} style={{ background: city === c ? "var(--navy)" : undefined, color: city === c ? "#fff" : undefined }}>{c}</Link>)}
        {collections.filter((c) => c.kind === "season").map((c) => <Link key={c.slug} className="chip" href={`/stays?in=${c.checkIn}&out=${c.checkOut}&adults=2&collection=${c.slug}`} style={{ background: col?.slug === c.slug ? "var(--navy)" : undefined, color: col?.slug === c.slug ? "#fff" : undefined }}>{c.title}</Link>)}
      </div>
      <h1 style={{ fontSize: 28, margin: "14px 0 6px" }}>{title}, {fmtDate(checkIn)} to {fmtDate(checkOut)}</h1>
      <p className="mute" style={{ margin: 0 }}>{cards.length} {cards.length === 1 ? "hotel" : "hotels"} I stayed in. Prices are for {v.nights} {v.nights === 1 ? "night" : "nights"}, {adults} {adults === 1 ? "adult" : "adults"}, tax included.</p>
      {v.error && <div className="notice warn" role="alert" style={{ marginTop: 14 }}>{v.error}</div>}
      <div style={{ display: "grid", gap: 14, marginTop: 18 }}>
        {cards.map((h) => (
          <article key={h.ebcId} className="panel" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "140px 1fr auto", gap: 16, alignItems: "center" }}>
              <Link href={`/hotel/${h.ebcId}?${qs}`} style={{ borderRadius: 12, overflow: "hidden", aspectRatio: "4/3", background: "var(--surface-2)" }}>{h.images[0] && <img src={h.images[0]} alt={h.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />}</Link>
              <div>
                <div className="small mute">{h.area}{h.city ? `, ${h.city}` : ""}</div>
                <h2 style={{ fontSize: 20 }}><Link href={`/hotel/${h.ebcId}?${qs}`} style={{ textDecoration: "none" }}>{h.name}</Link></h2>
                <div className="small mute">{h.stars} star{h.rating ? `, ${h.rating.toFixed(1)} from ${h.ratingCount?.toLocaleString("en-US")} reviews` : ""}{h.refundable && h.cancelDeadline ? `. Free cancellation until ${fmtDate(h.cancelDeadline)}` : ""}</div>
                {h.saving !== null && h.lowestReference && <span className={`chip ${h.saving > 0 ? "chip-ok" : "chip-warn"}`} style={{ marginTop: 6 }}>{h.saving > 0 ? `${usd(h.saving, true)} less than ${h.lowestReference.source}` : `${usd(-h.saving, true)} above ${h.lowestReference.source}`}</span>}
              </div>
              <div style={{ textAlign: "right" }}>
                {h.saving && h.saving > 0 && <div className="small mute" style={{ textDecoration: "line-through" }}>{usd(h.lowestReference!.price, true)}</div>}
                <div className="price">{usd(h.readerPrice, true)}</div>
                <Link className="btn btn-brand" href={`/hotel/${h.ebcId}?${qs}`}>See rates</Link>
              </div>
            </div>
          </article>
        ))}
        {!cards.length && !v.error && <div className="panel"><p className="mute">No rooms at the pinned hotels for these dates. Try other dates.</p></div>}
      </div>
    </>
  );
}
