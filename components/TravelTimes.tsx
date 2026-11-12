"use client";
import { useMemo, useState } from "react";
import { bandFor } from "@/lib/transit/model";
import { travelTable, type TravelRow } from "@/lib/transit/places";
import { dict, type Lang } from "@/lib/i18n";

const PRESETS = ["06:00", "08:00", "13:00", "17:30", "23:30"] as const;
/** line icons, one stroke weight, drawn on a 24 grid */
const ICON = {
  plane: "M2.5 13.5l8-2.2L14.6 4c.5-.9 1.8-1 2.3-.2.3.4.3 1 .1 1.4l-2.7 5.8 5.7 1.6c.9.3 1 1.5.2 1.9l-6.6 1.1-3.4 4.6-1.6-.4 1.3-4.7-4.2.7-1.4 1.8-1.4-.4.5-2.6",
  landmark: "M3 20h18M5 20v-8M9 20v-8M15 20v-8M19 20v-8M3.5 10L12 4l8.5 6z",
  ride: "M5 11l1.6-4.2A2 2 0 018.5 5.5h7a2 2 0 011.9 1.3L19 11M3.5 11h17v5.5h-2M3.5 11v5.5h2m0 0a1.8 1.8 0 103.6 0m-3.6 0h3.6m0 0h6m0 0a1.8 1.8 0 103.6 0",
  metro: "M7 3.5h10a2 2 0 012 2V15a3 3 0 01-3 3H8a3 3 0 01-3-3V5.5a2 2 0 012-2zM5 10.5h14M8.5 14.5h.01M15.5 14.5h.01M8 18l-2 3M16 18l2 3",
  tram: "M7 5.5h10a2 2 0 012 2V15a3 3 0 01-3 3H8a3 3 0 01-3-3V7.5a2 2 0 012-2zM9 2.5h6M12 2.5v3M5 11h14M8 18l-2 3M16 18l2 3",
  walk: "M13 4.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM10.5 8.5L8 13l3 1.5 1 6.5M10.5 8.5l3 1 2 3.5M10.5 8.5L12 14M11 14.5L8 20",
  // time of day
  t0: "M3 18h18M7 18a5 5 0 0110 0M12 7v2M5.6 10.6l1.4 1.4M18.4 10.6L17 12",
  t1: "M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M16 12a4 4 0 11-8 0 4 4 0 018 0z",
  t2: "M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8M17 12a5 5 0 11-10 0 5 5 0 0110 0z",
  t3: "M3 18h18M7 18a5 5 0 0110 0M12 13v-2M8 6l1.5 1.5M16 6l-1.5 1.5",
  t4: "M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z",
} as const;
const Icon = ({ d, className }: { d: string; className?: string }) => <svg className={className ?? "ic"} viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>;

const W = {
  en: { airport: "Flying in", centre: "In town", set: "or pick a time", times: ["Early", "Morning rush", "Midday", "Evening rush", "Late"], fine: "Door to door estimates for that hour. Live traffic can add 10 to 15 minutes." },
  cs: { airport: "Přílet", centre: "Ve městě", set: "nebo zvolte čas", times: ["Brzy ráno", "Ranní špička", "Poledne", "Večerní špička", "Pozdě"], fine: "Odhad od dveří ke dveřím pro danou hodinu. Provoz může přidat 10 až 15 minut." },
};

/**
 * Getting there, by time of day: a landing at 07:40 is a different trip from one at 23:10. The reader picks the
 * hour and the airport they fly into; estimates come from the transit model (a routing API can sit behind it).
 */
export default function TravelTimes({ destination, lat, lng, lang = "en" }: { destination: string | null; lat: number; lng: number; lang?: Lang }) {
  const w = dict(lang);
  const L = W[lang] ?? W.en;
  const [time, setTime] = useState("13:00");
  const [h, m] = time.split(":").map(Number);
  const dep = (h ?? 12) * 60 + (m ?? 0);
  const t = useMemo(() => travelTable(destination, lat, lng, dep), [destination, lat, lng, dep]);
  const airports = t?.rows.filter((r) => r.place.kind === "airport") ?? [];
  const [ap, setAp] = useState<string | null>(null);
  if (!t) return null;
  const band = bandFor(t.profile, dep);
  const air = airports.find((r) => r.place.key === ap) ?? airports[0];
  const centre = t.rows.find((r) => r.place.kind === "landmark");

  return (
    <section className="travel" aria-labelledby="travel-h">
      <h2 id="travel-h">{w.gettingThere}</h2>
      <div className="tod" role="group" aria-label={w.timeOfDay}>
        {PRESETS.map((v, i) => (
          <button key={v} type="button" aria-pressed={time === v} onClick={() => setTime(v)} title={L.times[i]}>
            <Icon d={ICON[`t${i}` as "t0"]} /><span>{v.replace(/^0/, "")}</span>
          </button>
        ))}
      </div>
      <div className="tod-now">
        <b>{PRESETS.includes(time as (typeof PRESETS)[number]) ? L.times[PRESETS.indexOf(time as (typeof PRESETS)[number])] : time}</b>
        <span>{w.bandHint?.[band.key] ?? band.hint}</span>
        <label className="tod-set"><span>{L.set}</span><input type="time" value={time} onChange={(e) => e.target.value && setTime(e.target.value)} aria-label={w.leavingAt} /></label>
      </div>

      {air && (
        <div className="trip-card">
          <div className="trip-top"><span className="place-ic"><Icon d={ICON.plane} /></span><div><small>{L.airport}</small><b>{air.place.name}</b></div><span className="km">{air.km} km</span></div>
          {airports.length > 1 && (
            <div className="ap-pick" role="group" aria-label={L.airport}>
              {airports.map((r) => <button key={r.place.key} type="button" aria-pressed={r === air} onClick={() => setAp(r.place.key)}>{r.place.code}</button>)}
            </div>
          )}
          <Legs row={air} w={w} />
        </div>
      )}
      {centre && (
        <div className="trip-card">
          <div className="trip-top"><span className="place-ic"><Icon d={ICON.landmark} /></span><div><small>{L.centre}</small><b>{centre.place.name}</b></div><span className="km">{centre.km} km</span></div>
          <Legs row={centre} w={w} />
        </div>
      )}
      <p className="fine">{L.fine}</p>
    </section>
  );
}

function Legs({ row, w }: { row: TravelRow; w: ReturnType<typeof dict> }) {
  return (
    <ul className="legs" role="list">
      {row.legs.map((l) => {
        const label = l.mode === "metro" && row.place.via ? row.place.via : w.modes[l.mode];
        return (
          <li key={l.mode} className={l.available ? "" : "off"}>
            <Icon d={ICON[l.mode]} />
            <span className="lg-name">{label}</span>
            <b className="num">{l.available ? `${l.minutes} ${w.min}` : w.notRunning}</b>
          </li>
        );
      })}
    </ul>
  );
}
