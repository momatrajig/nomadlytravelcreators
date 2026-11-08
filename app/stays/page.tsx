import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import { env } from "@/lib/env";
import { fmtDate, usd } from "@/lib/format";
import { readDates } from "@/lib/dates";
import { stayView } from "@/lib/storefront/data";
import { requireStorefront } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function Stays({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sf = await requireStorefront();
  const { checkIn, checkOut, adults, qs } = readDates(await searchParams, env().EBC_MODE);
  const v = await stayView(sf, checkIn, checkOut, adults);
  const cards = [...v.cards].sort((a, b) => (b.saving ?? -1e9) - (a.saving ?? -1e9));
  return (
    <>
      <div style={{ marginTop: 18 }}><SearchBar checkIn={checkIn} checkOut={checkOut} adults={adults} city={sf.cityName ?? ""} /></div>
      <h1 style={{ fontSize: 28, margin: "22px 0 6px" }}>{sf.cityName}, {fmtDate(checkIn)} to {fmtDate(checkOut)}</h1>
      <p className="mute" style={{ margin: 0 }}>{cards.length} hotels I stayed in. Prices are for {v.nights} {v.nights === 1 ? "night" : "nights"}, {adults} {adults === 1 ? "adult" : "adults"}, tax included.</p>
      {v.error && <div className="notice warn" role="alert" style={{ marginTop: 14 }}>{v.error}</div>}
      <div style={{ display: "grid", gap: 14, marginTop: 18 }}>
        {cards.map((h) => (
          <article key={h.ebcId} className="panel" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "140px 1fr auto", gap: 16, alignItems: "center" }}>
              <Link href={`/hotel/${h.ebcId}?${qs}`} style={{ borderRadius: 12, overflow: "hidden", aspectRatio: "4/3", background: "var(--surface-2)" }}>{h.images[0] && <img src={h.images[0]} alt={h.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />}</Link>
              <div>
                <div className="small mute">{h.area}</div>
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
