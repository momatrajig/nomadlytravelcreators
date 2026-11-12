"use client";
import { BedDouble, Coffee, DoorClosed, Users } from "lucide-react";
import { Ico } from "@/components/Icon";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { approxOf, dict, fmtDay, price, type ReaderFmt } from "@/lib/i18n";
import { roomsDict } from "@/lib/i18n/checkout";
import { freeNow } from "@/lib/booking/policy";

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
  // bed details in brackets read as part of the name: "(king size bed)" -> ", king bed"; never adds or drops a bed
  const caps = x === x.toUpperCase();
  const beds: string[] = [];
  const bare = x.replace(/\s*\([^()]*\)/g, "").toLowerCase();
  x = x.replace(/\s*\(([^()]*\bbeds?\b[^()]*)\)/gi, (_, b: string) => {
    const n = b.trim().replace(/\bking[- ]size\b/i, "king").replace(/\bqueen[- ]size\b/i, "queen").replace(/\bfull\s+(double)\b/i, "$1");
    if (!beds.some((o) => o.toLowerCase() === n.toLowerCase()) && !bare.includes(n.toLowerCase())) beds.push(n);
    return "";
  });
  if (beds.length) x = `${x}, ${beds.join(", ")}`;
  return caps ? x.toLowerCase().replace(/(^|[\s,(/-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase()) : x;
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
 * Rooms as groups with aligned rate rows (stacked on phones): one group per room type,
 * its price options inside it (non refundable or free cancellation, room only or breakfast), the difference
 * between them spelled out. "Select rate" holds the chosen option on the server and opens checkout.
 */
export default function RateList({ ebcId, rates, nights, checkIn, checkOut, adults, f }: { ebcId: number; rates: RateView[]; nights: number; checkIn: string; checkOut: string; adults: number; f: ReaderFmt; photos?: Photo[] }) {
  const t = dict(f.lang);
  const rd = roomsDict(f.lang);
  const p$ = (v: number, whole = true) => price(f, v, whole);
  const r = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "flex" | "breakfast">("all");
  const rooms = useMemo(() => groupRooms(rates.filter((x) => filter === "all" || (filter === "flex" ? freeNow(x) : x.board !== "RO"))), [rates, filter]);
  const cheapest = Math.min(...rates.map((x) => x.readerPrice));
  const flexCount = rates.filter((x) => freeNow(x)).length, bbCount = rates.filter((x) => x.board !== "RO").length;

  const book = async (packageCode: string) => {
    setBusy(packageCode); setErr(null);
    try {
      const res = await fetch("/api/quote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ebcId, packageCode, checkIn, checkOut, adults, childrenAges: [] }) });
      const j = await res.json();
      if (!res.ok) { setErr(j.message ?? t.couldNotHold); setBusy(null); if (j.error === "PRICE_CHANGED" || j.error === "NO_AVAILABILITY") setTimeout(() => r.refresh(), 800); return; }
      r.push(`/checkout?q=${j.quote.id}`);
    } catch { setErr(t.noConnection); setBusy(null); }
  };
  const dl = (iso: string) => (iso.length > 15 && iso.slice(11, 16) !== "00:00" ? `${fmtDay(iso, f.lang)}, ${iso.slice(11, 16)}` : fmtDay(iso, f.lang));
  const count = (k: "flex" | "breakfast") => groupRooms(rates.filter((x) => (k === "flex" ? freeNow(x) : x.board !== "RO"))).length;

  // Room groups with aligned rate rows (stacked on phones): every price and every "Select rate" sits in the same
  // place, nothing is clipped, and no photo pretends to be a room it is not. Hotel photos stay in the gallery.
  return (
    <div className="rooms">
      <div className="rooms-bar">
        <div className="rooms-filters" role="group" aria-label={rd.choose}>
          <button type="button" className="chip-btn" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>{rd.all(groupRooms(rates).length)}</button>
          {flexCount > 0 && <button type="button" className="chip-btn" aria-pressed={filter === "flex"} onClick={() => setFilter("flex")}>{rd.flex} <span className="num mute">{count("flex")}</span></button>}
          {bbCount > 0 && <button type="button" className="chip-btn" aria-pressed={filter === "breakfast"} onClick={() => setFilter("breakfast")}>{rd.breakfast} <span className="num mute">{count("breakfast")}</span></button>}
        </div>
        <p className="rooms-basis small mute">{rd.total(nights)}</p>
      </div>
      {err && <div className="notice bad" role="alert" style={{ marginTop: 12 }}>{err}</div>}
      {!rooms.length && <div className="empty-inline"><p className="mute">{rd.none}</p><button type="button" className="btn" onClick={() => setFilter("all")}>{rd.all(groupRooms(rates).length)}</button></div>}
      <ul className="rg-list" role="list">
        {rooms.map((room) => {
          const isLowest = room.rates[0]!.readerPrice === cheapest;
          return (
            <li key={room.name} className="rg">
              <div className="rg-id">
                <h3>{room.name}</h3>
                <p className="rg-facts"><Ico of={Users} className="ic" />{rd.sleeps(adults)}</p>
                {room.bedNote && <p className="rg-facts"><Ico of={BedDouble} className="ic" />{rd.bedNote}</p>}
                {isLowest && <span className="rg-badge">{rd.lowest}</span>}
              </div>
              <ul className="rg-rates" role="list">
                {room.rates.map((o) => {
                  const tone = freeNow(o) ? "ok" : o.refundable ? "warn" : "bad";
                  return (
                    <li key={o.packageCode} className="rr">
                      <div className="rr-meal"><Ico of={o.board === "RO" ? DoorClosed : Coffee} className="ic" /><span>{t.board[o.board] ?? o.board}{o.onRequest ? <small>{rd.onReq}</small> : null}</span></div>
                      <div className={`rr-cancel ${tone}`}>
                        <b>{freeNow(o) ? (o.cancelDeadline ? rd.freeUntil(dl(o.cancelDeadline)) : rd.freeNoDate) : o.refundable ? rd.feeNow(p$(o.cancelCharge ?? o.readerPrice)) : rd.nonRef}</b>
                        {freeNow(o) && o.cancelCharge && o.cancelDeadline ? <small>{rd.after(dl(o.cancelDeadline), p$(o.cancelCharge))}</small> : !o.refundable ? <small>{rd.noRefundShort}</small> : null}
                      </div>
                      <div className="rr-price">
                        <b className="num">{p$(o.readerPrice)}</b>
                        <small className="num">{rd.perNight(p$(o.readerPrice / nights))}{approxOf(f, o.readerPrice) ? `, ${approxOf(f, o.readerPrice)}` : ""}</small>
                      </div>
                      <button className="btn btn-brand rr-go" type="button" onClick={() => book(o.packageCode)} aria-disabled={busy !== null} disabled={busy !== null} aria-label={`${rd.reserve}: ${room.name}, ${t.board[o.board] ?? o.board}, ${p$(o.readerPrice)}`}>{busy === o.packageCode ? rd.holding : rd.reserve}</button>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

