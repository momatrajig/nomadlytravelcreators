"use client";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { approxOf, dict, fmtDay, price, type ReaderFmt } from "@/lib/i18n";
import { roomsDict } from "@/lib/i18n/checkout";
import { freeNow } from "@/lib/booking/policy";
import { photoSrc, photoSet } from "@/lib/media/photo";

export interface RateView { packageCode: string; roomName: string; board: string; refundable: boolean; onRequest: boolean; cancelDeadline: string | null; cancelCharge: number | null; readerPrice: number }
type Photo = { url: string; w?: number };

/**
 * A room name a reader can read: "DELUXE ROOM, 1 KING BED(1 KING BED) - Advantage Rate" becomes "Deluxe Room, 1 King Bed".
 * Drops a bracket that repeats what is before it, rate and package names (they belong to the price option, not the
 * room) and stray punctuation; all capitals become title case; mixed case stays as the hotel wrote it.
 */
export function roomTitle(s: string) {
  let x = s.trim().replace(/\s+/g, " ").replace(/\s*\(\s*/g, " (").replace(/\s*\)/g, ")");
  // "1 King Bed (1 King Bed)": the bracket repeats the words before it
  x = x.replace(/([^,()]+?)\s*\(([^()]+)\)/g, (all, before: string, inside: string) => before.trim().toLowerCase().endsWith(inside.trim().toLowerCase()) ? before.replace(/\s+$/, "") : all);
  // small print belongs under the name, not in it
  x = x.replace(/\s*\((?:[^()]*\b(subject to availability|not guaranteed|on request|upon availability|depends on availability)\b[^()]*)\)/gi, "");
  // rate and package names after a separator, or at the end
  x = x.replace(/\s*(?:\s[-–|]\s|[-–|]\s)[^,|–]*\b(rate|offer|package|deal|promo(tion)?|special|advance purchase|non[- ]?refundable|flexible)\b[^,]*$/i, "");
  x = x.replace(/\s+\b(advantage|flexible|standard|best available|member|promo)\s+rate\b.*$/i, "").replace(/[\s,.-]+$/, "");
  return x === x.toUpperCase() ? x.toLowerCase().replace(/(^|[\s,(/-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase()) : x;
}
/** Non refundable options that cost as much as, or more than, a free cancellation option with the same meals are noise. */
export function dropDominated<T extends { refundable: boolean; board: string; readerPrice: number; cancelDeadline: string | null }>(rates: T[], free: (r: T) => boolean): T[] {
  return rates.filter((r) => free(r) || !rates.some((o) => o !== r && free(o) && o.board === r.board && o.readerPrice <= r.readerPrice));
}
/** Rates grouped by room, cheapest room first, each room's options cheapest first. */
export function groupRooms(rates: RateView[]) {
  const by = new Map<string, RateView[]>();
  for (const r of rates) { const k = roomTitle(r.roomName); by.set(k, [...(by.get(k) ?? []), r]); }
  return [...by.entries()].map(([name, rs]) => ({ name, bedNote: rs.some((r) => /bed type[^)]*availability/i.test(r.roomName)), rates: dropDominated(rs, (r) => freeNow(r)).sort((a, b) => a.readerPrice - b.readerPrice) })).sort((a, b) => a.rates[0]!.readerPrice - b.rates[0]!.readerPrice);
}

/**
 * Rooms as a row of cards you swipe through, the way streaming apps lay out a row: one card per room type,
 * its price options inside it (non refundable or free cancellation, room only or breakfast), the difference
 * between them spelled out. "Reserve" holds the chosen option on the server and opens checkout.
 */
export default function RateList({ ebcId, rates, nights, checkIn, checkOut, adults, f, photos = [] }: { ebcId: number; rates: RateView[]; nights: number; checkIn: string; checkOut: string; adults: number; f: ReaderFmt; photos?: Photo[] }) {
  const t = dict(f.lang);
  const rd = roomsDict(f.lang);
  const p$ = (v: number, whole = true) => price(f, v, whole);
  const r = useRouter();
  const row = useRef<HTMLUListElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "flex" | "breakfast">("all");
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const rooms = useMemo(() => groupRooms(rates.filter((x) => filter === "all" || (filter === "flex" ? freeNow(x) : x.board !== "RO"))), [rates, filter]);
  const cheapest = Math.min(...rates.map((x) => x.readerPrice));
  const flexCount = rates.filter((x) => freeNow(x)).length, bbCount = rates.filter((x) => x.board !== "RO").length;
  const pics = photos.length > 1 ? photos.slice(1) : photos;

  const book = async (packageCode: string) => {
    setBusy(packageCode); setErr(null);
    try {
      const res = await fetch("/api/quote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ebcId, packageCode, checkIn, checkOut, adults, childrenAges: [] }) });
      const j = await res.json();
      if (!res.ok) { setErr(j.message ?? t.couldNotHold); setBusy(null); if (j.error === "PRICE_CHANGED" || j.error === "NO_AVAILABILITY") setTimeout(() => r.refresh(), 800); return; }
      r.push(`/checkout?q=${j.quote.id}`);
    } catch { setErr(t.noConnection); setBusy(null); }
  };
  const scroll = (dir: number) => row.current?.scrollBy({ left: dir * (row.current.clientWidth * 0.85), behavior: "smooth" });

  return (
    <div className="rooms">
      <div className="rooms-bar">
        <div className="rooms-filters" role="group" aria-label="Filter rooms">
          <button type="button" className="chip-btn" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>{rd.all(groupRooms(rates).length)}</button>
          {flexCount > 0 && <button type="button" className="chip-btn" aria-pressed={filter === "flex"} onClick={() => setFilter("flex")}>{rd.flex}</button>}
          {bbCount > 0 && <button type="button" className="chip-btn" aria-pressed={filter === "breakfast"} onClick={() => setFilter("breakfast")}>{rd.breakfast}</button>}
        </div>
        {rooms.length > 1 && <div className="rooms-arrows"><button type="button" aria-label={rd.prev} onClick={() => scroll(-1)}>‹</button><button type="button" aria-label={rd.next} onClick={() => scroll(1)}>›</button></div>}
      </div>
      {err && <div className="notice bad" role="alert" style={{ marginTop: 12 }}>{err}</div>}
      {!rooms.length && <p className="mute">{rd.none}</p>}
      <ul className="rooms-row" ref={row} role="list">
        {rooms.map((room, i) => {
          const sel = room.rates.find((x) => x.packageCode === chosen[room.name]) ?? room.rates[0]!;
          const base = room.rates[0]!.readerPrice;
          const pic = pics.length ? pics[i % pics.length]! : null;
          const isLowest = room.rates[0]!.readerPrice === cheapest;
          const flexiest = !isLowest && room.rates.some((x) => freeNow(x) && x.board !== "RO");
          return (
            <li key={room.name} className="room">
              <div className="room-pic">
                {pic ? <img src={photoSrc(pic.url, 720, pic.w)} srcSet={photoSet(pic.url, pic.w)} sizes="340px" alt="" loading={i < 2 ? "eager" : "lazy"} /> : <span className="room-nopic" />}
                <span className="tag">{rd.photo}</span>
                {isLowest ? <span className="badge">{rd.lowest}</span> : flexiest ? <span className="badge alt">{rd.flexiest}</span> : null}
              </div>
              <div className="room-body">
                <h3>{room.name}</h3>
                <p className="room-facts">{rd.sleeps(adults)} · {rd.options(room.rates.length)}</p>
                <fieldset className="opts"><legend className="sr-only">{rd.choose}</legend>
                  {room.rates.map((o) => (
                    <label key={o.packageCode} className={`opt${o.packageCode === sel.packageCode ? " on" : ""}`}>
                      <input type="radio" name={`r-${i}`} checked={o.packageCode === sel.packageCode} onChange={() => setChosen({ ...chosen, [room.name]: o.packageCode })} />
                      <span className="opt-txt">
                        <b className={freeNow(o) ? "ok" : o.refundable ? "warn" : "bad"}>{freeNow(o) ? (o.cancelDeadline ? rd.freeUntil(fmtDay(o.cancelDeadline, f.lang)) : rd.freeNoDate) : o.refundable ? rd.feeNow(p$(o.cancelCharge ?? o.readerPrice)) : rd.nonRef}</b>
                        <span>{t.board[o.board] ?? o.board}{o.onRequest ? `. ${rd.onReq}` : ""}</span>
                      </span>
                      <span className="opt-price num">{o.readerPrice === base ? p$(o.readerPrice) : rd.more(p$(o.readerPrice - base))}</span>
                    </label>
                  ))}
                </fieldset>
                <div className="room-foot">
                  <div>
                    <b className="num">{p$(sel.readerPrice)}</b>
                    <span>{rd.total(nights)}</span>
                    <span className="num">{rd.perNight(p$(sel.readerPrice / nights))}{approxOf(f, sel.readerPrice) ? `, ${approxOf(f, sel.readerPrice)}` : ""}</span>
                  </div>
                  <button className="btn btn-brand" type="button" onClick={() => book(sel.packageCode)} aria-disabled={busy !== null} disabled={busy !== null}>{busy === sel.packageCode ? rd.holding : rd.reserve}</button>
                </div>
                {/* only what the option above does not already say: the charge after the free period */}
                {freeNow(sel) && sel.cancelCharge && sel.cancelDeadline ? <p className="small mute room-note">{rd.after(fmtDay(sel.cancelDeadline, f.lang), p$(sel.cancelCharge, false))}</p> : !sel.refundable ? <p className="small mute room-note">{rd.noRefundShort}</p> : null}
                {room.bedNote && <p className="small mute room-note">{rd.bedNote}</p>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
