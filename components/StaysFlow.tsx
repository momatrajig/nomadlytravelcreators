"use client";
import { useMemo, useState } from "react";
import CoverFlow from "./CoverFlow";
import { I, esc } from "./icons";
import { openSheet } from "@/lib/flow/engine";
import { BOARD, fmtDate, fmtTime, usd } from "@/lib/format";

export interface StayCardData {
  ebcId: number; name: string; stars: number; area: string | null; rating: number | null; ratingCount: number | null; images: string[];
  readerPrice: number; refundable: boolean; board: string; cancelDeadline: string | null; cancelCharge: number | null; onRequest: boolean;
  lowestReference: { source: string; price: number } | null; saving: number | null; booked: number; tip: string | null;
}
interface Props { items: StayCardData[]; nights: number; checkedAt: string | null; qs: string; label: string; tabs?: boolean }

function card(h: StayCardData, i: number, nights: number, checkedAt: string | null, qs: string) {
  const badge = h.saving === null ? "" : h.saving > 0
    ? `<span class="nf-badge save">${usd(h.saving, true)} less than ${esc(h.lowestReference!.source)}</span>`
    : `<span class="nf-badge soft">${usd(-h.saving, true)} above ${esc(h.lowestReference!.source)}</span>`;
  return `<div class="nf-pic"><img class="nf-img" ${i < 3 ? `src="${h.images[0]}"` : `data-src="${h.images[0]}"`} alt="${esc(h.name)}"><div class="nf-shade"></div></div>
  <div class="nf-top">${badge}</div>
  <div class="nf-body"><div class="nf-kicker">${esc(h.area ?? "")}</div><div class="nf-title">${esc(h.name)}</div>
   <div class="nf-meta"><span>${I.star}${h.stars} star${h.rating ? `, ${h.rating.toFixed(1)}` : ""}</span>${h.refundable && h.cancelDeadline ? `<span>${I.clock}Free cancel until ${fmtDate(h.cancelDeadline)}</span>` : h.refundable ? "" : `<span>${I.info}No refunds</span>`}${h.booked ? `<span>${I.users}Booked ${h.booked} ${h.booked === 1 ? "time" : "times"} by readers</span>` : ""}</div>
   <div class="nf-price">${h.saving && h.saving > 0 ? `<span class="was">${usd(h.lowestReference!.price, true)}</span>` : ""}<span class="now">${usd(h.readerPrice, true)}</span><span class="per">${nights} ${nights === 1 ? "night" : "nights"}${checkedAt ? `, checked ${fmtTime(checkedAt)} today` : ""}</span></div>
   <div class="nf-cta"><a class="nf-primary" href="/hotel/${h.ebcId}?${qs}">See rates ${I.arrow}</a><button type="button" class="nf-ghost" data-nf-open>Photos</button></div></div>`;
}

function sheet(h: StayCardData, nights: number, checkedAt: string | null, qs: string) {
  openSheet({
    title: h.name, images: h.images, alts: h.images.map((_, k) => `${h.name}, photo ${k + 1}`),
    body: `<h3>${esc(h.name)}</h3>
      <div class="nf-meta"><span>${I.star}${h.stars} star${h.rating ? `, ${h.rating.toFixed(1)} from ${h.ratingCount?.toLocaleString("en-US") ?? ""} guest reviews` : ""}</span>${h.cancelDeadline && h.refundable ? `<span>${I.clock}Free cancellation until ${fmtDate(h.cancelDeadline)}</span>` : ""}</div>
      ${h.saving !== null && h.lowestReference ? (h.saving > 0
        ? `<div class="proof"><b>${usd(h.saving, true)} less than ${esc(h.lowestReference.source)}.</b> ${esc(h.lowestReference.source)} showed ${usd(h.lowestReference.price, true)} for the same room, dates and guests${checkedAt ? `, checked at ${fmtTime(checkedAt)}` : ""}, signed out.</div>`
        : `<div class="proof"><b>${usd(-h.saving, true)} above ${esc(h.lowestReference.source)} right now.</b> We show it anyway so you can decide.</div>`) : ""}
      ${h.tip ? `<p class="plain">${esc(h.tip)}</p>` : ""}
      <div class="nf-price">${h.saving && h.saving > 0 ? `<span class="was">${usd(h.lowestReference!.price, true)}</span>` : ""}<span class="now">${usd(h.readerPrice, true)}</span><span class="per">${nights} nights, ${(BOARD[h.board] ?? h.board).toLowerCase()}</span></div>
      <div class="nf-cta"><a class="nf-primary" href="/hotel/${h.ebcId}?${qs}">See rates and book ${I.arrow}</a></div>`,
  });
}

export default function StaysFlow({ items, nights, checkedAt, qs, label, tabs = true }: Props) {
  const [tab, setTab] = useState<"saving" | "booked">("saving");
  const sorted = useMemo(() => [...items].sort((a, b) => tab === "saving" ? (b.saving ?? -1e9) - (a.saving ?? -1e9) : b.booked - a.booked).slice(0, 8), [items, tab]);
  if (!items.length) return <div className="panel"><p className="mute">No rooms for these dates at the pinned hotels. Try different dates.</p></div>;
  return (
    <>
      {tabs && (
        <div className="nf-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "saving"} onClick={() => setTab("saving")}>Biggest saving</button>
          <button type="button" role="tab" aria-selected={tab === "booked"} onClick={() => setTab("booked")}>Most booked by readers</button>
        </div>
      )}
      <CoverFlow key={tab} items={sorted} label={label} start={1} renderCard={(h, i) => card(h, i, nights, checkedAt, qs)} onOpen={(h) => sheet(h, nights, checkedAt, qs)} />
    </>
  );
}
