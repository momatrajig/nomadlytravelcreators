"use client";
import { useMemo, useState } from "react";
import CoverFlow from "./CoverFlow";
import { I, esc } from "./icons";
import { openGallery } from "@/lib/flow/gallery";
import { photoSet, photoSrc, type Photo } from "@/lib/media/photo";
import { checkedLabel, fmtDate, usd } from "@/lib/format";

export interface StayCardData {
  ebcId: number; name: string; stars: number; area: string | null; city: string | null; rating: number | null; ratingCount: number | null; photos: Photo[];
  readerPrice: number; refundable: boolean; board: string; cancelDeadline: string | null; cancelCharge: number | null; onRequest: boolean;
  lowestReference: { source: string; price: number } | null; saving: number | null; booked: number; tip: string | null;
}
interface Props { items: StayCardData[]; nights: number; checkedAt: string | null; qs: string; label: string; tabs?: boolean }

function card(h: StayCardData, i: number, nights: number, checkedAt: string | null, qs: string) {
  const p = h.photos[0];
  const badge = h.saving === null ? "" : h.saving > 0
    ? `<span class="nf-badge save">${usd(h.saving, true)} below ${esc(h.lowestReference!.source)}</span>`
    : `<span class="nf-badge soft">${usd(-h.saving, true)} above ${esc(h.lowestReference!.source)}</span>`;
  const set = p ? photoSet(p.url, p.w) : undefined;
  const img = p ? `<img class="nf-img" ${i < 3 ? `src="${photoSrc(p.url, 960, p.w)}"${set ? ` srcset="${set}"` : ""}` : `data-src="${photoSrc(p.url, 960, p.w)}"`} sizes="(max-width: 600px) 80vw, 340px" alt="${esc(h.name)}">` : "";
  const count = h.photos.length > 1 ? `<span class="nf-badge soft nf-count">${h.photos.length} photos</span>` : "";
  return `<div class="nf-pic">${img}<div class="nf-shade"></div></div>
  <div class="nf-top">${badge}${count}</div>
  <div class="nf-body"><div class="nf-kicker">${esc([h.area, h.city].filter(Boolean).join(", "))}</div><div class="nf-title">${esc(h.name)}</div>
   <div class="nf-meta"><span>${I.star}${h.stars} star${h.rating ? `, ${h.rating.toFixed(1)}` : ""}</span>${h.refundable && h.cancelDeadline ? `<span>${I.clock}Free cancellation until ${fmtDate(h.cancelDeadline)}</span>` : h.refundable ? "" : `<span>${I.info}No refunds</span>`}</div>
   <div class="nf-price">${h.saving && h.saving > 0 ? `<span class="was">${usd(h.lowestReference!.price, true)}</span>` : ""}<span class="now">${usd(h.readerPrice, true)}</span><span class="per">${nights} ${nights === 1 ? "night" : "nights"}${checkedAt ? `, ${checkedLabel(checkedAt)}` : ""}</span></div>
   <div class="nf-cta"><a class="nf-primary" href="/hotel/${h.ebcId}?${qs}">See rooms ${I.arrow}</a>${h.photos.length ? `<button type="button" class="nf-ghost" data-nf-open aria-label="See all ${h.photos.length} photos of ${esc(h.name)}">Photos</button>` : ""}</div></div>`;
}

export default function StaysFlow({ items, nights, checkedAt, qs, label, tabs = true }: Props) {
  const [tab, setTab] = useState<"saving" | "booked">("saving");
  const sorted = useMemo(() => [...items].sort((a, b) => tab === "saving" ? (b.saving ?? -1e9) - (a.saving ?? -1e9) : b.booked - a.booked || (b.saving ?? 0) - (a.saving ?? 0)).slice(0, 10), [items, tab]);
  if (!items.length) return <p className="nf-empty">No rooms for these dates at these hotels. Try other dates.</p>;
  return (
    <>
      {tabs && (
        <div className="nf-tabs" role="tablist" aria-label="Sort">
          <button type="button" role="tab" aria-selected={tab === "saving"} onClick={() => setTab("saving")}>Biggest saving</button>
          <button type="button" role="tab" aria-selected={tab === "booked"} onClick={() => setTab("booked")}>Most booked by readers</button>
        </div>
      )}
      <CoverFlow key={tab} items={sorted} label={label} start={Math.min(1, sorted.length - 1)} renderCard={(h, i) => card(h, i, nights, checkedAt, qs)} onOpen={(h) => h.photos.length && openGallery({ title: h.name, photos: h.photos })} />
    </>
  );
}
