"use client";
import { useMemo, useState } from "react";
import { CarTaxiFront, Footprints, Landmark, Moon, Plane, Sun, SunMedium, Sunrise, Sunset, TrainFront, TramFront, type LucideIcon } from "lucide-react";
import { bandFor } from "@/lib/transit/model";
import { travelTable, type TravelRow } from "@/lib/transit/places";
import { dict, type Lang } from "@/lib/i18n";
import { Ico } from "@/components/Icon";

const PRESETS = ["06:00", "08:00", "13:00", "17:30", "23:30"] as const;
/** one icon family (Lucide), one stroke weight, set in CSS */
const MODE: Record<string, LucideIcon> = { plane: Plane, landmark: Landmark, ride: CarTaxiFront, metro: TrainFront, tram: TramFront, walk: Footprints };
const TOD: LucideIcon[] = [Sunrise, Sun, SunMedium, Sunset, Moon];

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
            <Ico of={TOD[i]!} /><span>{v.replace(/^0/, "")}</span>
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
          <div className="trip-top"><span className="place-ic"><Ico of={Plane} size={20} /></span><div><small>{L.airport}</small><b>{air.place.name}</b></div><span className="km">{air.km} km</span></div>
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
          <div className="trip-top"><span className="place-ic"><Ico of={Landmark} size={20} /></span><div><small>{L.centre}</small><b>{centre.place.name}</b></div><span className="km">{centre.km} km</span></div>
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
            <Ico of={MODE[l.mode] ?? Footprints} className="ic" />
            <span className="lg-name">{label}</span>
            <b className="num">{l.available ? `${l.minutes} ${w.min}` : w.notRunning}</b>
          </li>
        );
      })}
    </ul>
  );
}
