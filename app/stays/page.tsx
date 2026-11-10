import Link from "next/link";
import { Suspense } from "react";
import type { Storefront } from "@/lib/db/types";
import SearchBar from "@/components/SearchBar";
import { env } from "@/lib/env";
import { checkedLabel } from "@/lib/format";
import { fmtDay, price, approxOf, type Dict, type ReaderFmt } from "@/lib/i18n";
import { readerOf } from "@/lib/storefront/reader";
import { nights as nightsOf } from "@/lib/booking/service";
import { readDates } from "@/lib/dates";
import { destination, stayView, storefrontDestinations } from "@/lib/storefront/data";
import { requireStorefront } from "@/lib/tenant";
import { db } from "@/lib/db";
import { photoSet, photoSrc } from "@/lib/media/photo";

export const dynamic = "force-dynamic";

export default async function Stays({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sf = await requireStorefront();
  const { t, f } = await readerOf(sf);
  const fmtDate = (d: string) => fmtDay(d, f.lang);
  const sp = await searchParams;
  const { checkIn, checkOut, adults, qs } = readDates(sp, env().EBC_MODE);
  const [pins, collections] = await Promise.all([db().pinnedHotels(sf.id), db().collections(sf.id)]);
  const dests = storefrontDestinations(pins);
  const d = typeof sp.d === "string" ? destination(sp.d) : null;
  const col = typeof sp.collection === "string" ? collections.find((c) => c.slug === sp.collection) ?? null : null;
  const only = col ? col.ebcIds : d ? pins.filter((p) => p.destination === d.slug).map((p) => p.ebcId) : undefined;
  const title = col ? col.title : d ? d.name : t.everyHotel;
  const chip = (href: string, label: string, on: boolean) => <Link key={href} className="filter" href={href} aria-current={on ? "page" : undefined}>{label}</Link>;
  return (
    <>
      <div className="page-search"><SearchBar lang={f.lang} checkIn={checkIn} checkOut={checkOut} adults={adults} dest={d?.slug ?? ""} destinations={dests.map((x) => ({ slug: x.slug, name: x.name }))} /></div>
      <nav className="filters" aria-label="Destinations and seasons">
        {chip(`/stays?${qs}`, t.all, !d && !col)}
        {collections.filter((c) => c.kind === "season").map((c) => chip(`/stays?in=${c.checkIn}&out=${c.checkOut}&adults=2&collection=${c.slug}`, c.title, col?.slug === c.slug))}
        {dests.map((x) => chip(`/stays?d=${x.slug}&${qs}`, x.name, d?.slug === x.slug && !col))}
      </nav>
      <header className="list-head">
        <h1>{title}</h1>
        <p>{t.listMeta(fmtDate(checkIn), fmtDate(checkOut), nightsOf(checkIn, checkOut), adults)}</p>
      </header>
      <Suspense key={`${checkIn}${checkOut}${adults}${only?.join(".")}`} fallback={<ListWait />}>
        <StayList t={t} f={f} sf={sf} checkIn={checkIn} checkOut={checkOut} adults={adults} only={only} qs={qs} colIn={col?.checkIn ?? null} />
      </Suspense>
    </>
  );
}

function ListWait() {
  return (
    <div className="list-wait" role="status" aria-label="Loading live rates">
      {[0, 1, 2].map((k) => <div key={k}><div className="skel pic" /><div><div className="skel line" style={{ width: "40%" }} /><div className="skel line" style={{ width: "70%", height: 26 }} /><div className="skel line" style={{ width: "55%" }} /></div><div><div className="skel line" style={{ width: "80%", height: 30, marginLeft: "auto" }} /></div></div>)}
    </div>
  );
}

async function StayList({ t, f, sf, checkIn, checkOut, adults, only, qs, colIn }: { t: Dict; f: ReaderFmt; sf: Storefront; checkIn: string; checkOut: string; adults: number; only?: number[]; qs: string; colIn: string | null }) {
  const v = await stayView(sf, checkIn, checkOut, adults, only);
  const fmtDate = (d: string) => fmtDay(d, f.lang);
  const usd = (x: number) => price(f, x);
  const cards = [...v.cards].sort((a, b) => (b.saving ?? -1e9) - (a.saving ?? -1e9));
  return (
    <>
      {v.checkedAt && f.lang === "en" && <p className="mute small" style={{ marginTop: -8, marginBottom: 12 }}>{t.bigChecked(checkedLabel(v.checkedAt))}</p>}
      {v.error && <div className="notice warn" role="alert">{t.supplierDown} <Link href={`/stays?${qs}`}>{t.tryAgain}</Link></div>}
      <ul className="list" role="list">
        {cards.map((h) => {
          const p = h.photos[0];
          const href = `/hotel/${h.ebcId}?${checkIn === colIn ? `in=${checkIn}&out=${checkOut}&adults=${adults}` : qs}`;
          return (
            <li key={h.ebcId} className="stay">
              <Link href={href} className="stay-pic" tabIndex={-1} aria-hidden="true">{p && <img src={photoSrc(p.url, 960, p.w)} srcSet={photoSet(p.url, p.w)} sizes="(max-width: 700px) 100vw, 320px" alt="" loading="lazy" />}</Link>
              <div className="stay-main">
                <div className="stay-where">{[h.area, h.city].filter(Boolean).join(", ")}</div>
                <h2><Link href={href}>{h.name}</Link></h2>
                <div className="stay-facts">{h.stars ? t.star(h.stars) : ""}{h.rating ? t.fromReviews(h.rating.toFixed(1), h.ratingCount?.toLocaleString(f.lang === "cs" ? "cs-CZ" : "en-US") ?? "") : ""}{h.refundable && h.cancelDeadline ? `. ${t.freeCancelUntil(fmtDate(h.cancelDeadline))}` : ""}</div>
                {h.tip && <p className="stay-tip">{h.tip}</p>}
              </div>
              <div className="stay-price">
                {h.saving !== null && h.lowestReference && (h.saving > 0
                  ? <span className="save">{t.lessThan(usd(h.saving), h.lowestReference.source)}</span>
                  : <span className="above">{t.above(usd(-h.saving), h.lowestReference.source)}</span>)}
                {h.saving && h.saving > 0 ? <s>{usd(h.lowestReference!.price)}</s> : null}
                <strong>{usd(h.readerPrice)}</strong>
                <span className="per">{t.aNight(usd(h.readerPrice / v.nights))}{approxOf(f, h.readerPrice) ? <><br />{approxOf(f, h.readerPrice)}</> : null}</span>
                <Link className="btn btn-brand" href={href}>{t.seeRooms}</Link>
              </div>
            </li>
          );
        })}
      </ul>
      {!cards.length && !v.error && <div className="empty"><p>{t.noRoomsDates}</p><Link className="btn" href="/stays">{t.showEvery}</Link></div>}
    </>
  );
}
