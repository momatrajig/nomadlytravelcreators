"use client";
import { freeNow } from "@/lib/booking/policy";
import { useMemo, useState } from "react";
import CoverFlow from "./CoverFlow";
import { I, esc } from "./icons";
import { openGallery } from "@/lib/flow/gallery";
import { photoSet, photoSrc, type Photo } from "@/lib/media/photo";
import { checkedLabel } from "@/lib/format";
import { approxOf, dict, fmtDay, price, type ReaderFmt } from "@/lib/i18n";

export interface StayCardData {
  ebcId: number; name: string; stars: number; area: string | null; city: string | null; rating: number | null; ratingCount: number | null; photos: Photo[];
  readerPrice: number; refundable: boolean; board: string; cancelDeadline: string | null; cancelCharge: number | null; onRequest: boolean;
  lowestReference: { source: string; price: number } | null; saving: number | null; booked: number; tip: string | null;
  /** on the creator's own list (shown with the Recommended by badge) */
  creatorPick?: boolean;
}
const EN_FMT: ReaderFmt = { lang: "en", currency: "USD", disp: null, rate: null };
interface Props { items: StayCardData[]; nights: number; checkedAt: string | null; qs: string; label: string; tabs?: boolean; f?: ReaderFmt }

function card(h: StayCardData, i: number, nights: number, checkedAt: string | null, qs: string, f: ReaderFmt) {
  const t = dict(f.lang);
  const p = h.photos[0];
  const badge = h.saving === null ? "" : h.saving > 0
    ? `<span class="nf-badge save">${esc(t.below(price(f, h.saving), h.lowestReference!.source))}</span>`
    : `<span class="nf-badge soft">${esc(t.above(price(f, -h.saving), h.lowestReference!.source))}</span>`;
  const set = p ? photoSet(p.url, p.w) : undefined;
  const img = p ? `<img class="nf-img" ${i < 3 ? `src="${photoSrc(p.url, 960, p.w)}"${set ? ` srcset="${set}"` : ""}` : `data-src="${photoSrc(p.url, 960, p.w)}"`} sizes="(max-width: 600px) 80vw, 340px" alt="${esc(h.name)}">` : "";
  const count = h.photos.length > 1 ? `<span class="nf-badge soft nf-count">${esc(t.photosN(h.photos.length))}</span>` : "";
  const ap = approxOf(f, h.readerPrice);
  const checked = checkedAt && f.lang === "en" ? `, ${checkedLabel(checkedAt)}` : "";
  return `<div class="nf-pic">${img}<div class="nf-shade"></div></div>
  <div class="nf-top">${badge}${count}</div>
  <div class="nf-body"><div class="nf-kicker">${esc([h.area, h.city].filter(Boolean).join(", "))}</div><div class="nf-title">${esc(h.name)}</div>
   <div class="nf-meta">${h.stars ? `<span>${I.star}${esc(f.lang === "cs" ? `${h.stars}` : `${h.stars} star`)}${h.rating ? `, ${h.rating.toFixed(1)}` : ""}</span>` : ""}${freeNow(h) && h.cancelDeadline ? `<span>${I.clock}${esc(t.freeCancelUntil(fmtDay(h.cancelDeadline, f.lang)))}</span>` : h.refundable ? "" : `<span>${I.info}${esc(t.noRefunds)}</span>`}</div>
   <div class="nf-price">${h.saving && h.saving > 0 ? `<span class="was">${esc(price(f, h.lowestReference!.price))}</span>` : ""}<span class="now">${esc(price(f, h.readerPrice))}</span><span class="per">${esc(t.nightsN(nights))}${ap ? `, ${esc(ap)}` : ""}${checked}</span></div>
   <div class="nf-cta"><a class="nf-primary" href="/hotel/${h.ebcId}?${qs}">${esc(t.seeRooms)} ${I.arrow}</a>${h.photos.length ? `<button type="button" class="nf-ghost" data-nf-open aria-label="${esc(t.allPhotosOf(h.photos.length, h.name))}">${esc(t.photos)}</button>` : ""}</div></div>`;
}

export default function StaysFlow({ items, nights, checkedAt, qs, label, tabs = true, f = EN_FMT }: Props) {
  const t = dict(f.lang);
  const [tab, setTab] = useState<"saving" | "booked">("saving");
  const sorted = useMemo(() => [...items].sort((a, b) => tab === "saving" ? (b.saving ?? -1e9) - (a.saving ?? -1e9) : b.booked - a.booked || (b.saving ?? 0) - (a.saving ?? 0)).slice(0, 10), [items, tab]);
  if (!items.length) return <p className="nf-empty">{t.noRoomsDates}</p>;
  return (
    <>
      {tabs && (
        <div className="nf-tabs" role="tablist" aria-label="Sort">
          <button type="button" role="tab" aria-selected={tab === "saving"} onClick={() => setTab("saving")}>{t.biggestSaving}</button>
          <button type="button" role="tab" aria-selected={tab === "booked"} onClick={() => setTab("booked")}>{t.mostBooked}</button>
        </div>
      )}
      <CoverFlow key={tab} items={sorted} label={label} start={Math.min(1, sorted.length - 1)} renderCard={(h, i) => card(h, i, nights, checkedAt, qs, f)} onOpen={(h) => h.photos.length && openGallery({ title: h.name, photos: h.photos })} />
    </>
  );
}
