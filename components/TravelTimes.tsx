"use client";
import { useMemo, useState } from "react";
import { bandFor } from "@/lib/transit/model";
import { travelTable } from "@/lib/transit/places";
import { dict, type Lang } from "@/lib/i18n";

const PRESETS = ["06:00", "08:00", "13:00", "17:30", "23:30"] as const;

/**
 * Travel time by time of day. A landing at 07:40 is a different trip from one at 23:10, so the
 * reader picks when they set off. Estimates come from the transit model; production puts a
 * routing API behind the same model and this component does not change.
 */
export default function TravelTimes({ destination, lat, lng, lang = "en" }: { destination: string | null; lat: number; lng: number; lang?: Lang }) {
  const w = dict(lang);
  const [time, setTime] = useState("13:00");
  const [h, m] = time.split(":").map(Number);
  const dep = (h ?? 12) * 60 + (m ?? 0);
  const t = useMemo(() => travelTable(destination, lat, lng, dep), [destination, lat, lng, dep]);
  if (!t) return null;
  const band = bandFor(t.profile, dep);
  return (
    <section className="travel" aria-labelledby="travel-h">
      <div className="travel-head">
        <h2 id="travel-h">{w.gettingThere}</h2>
        <label>{w.leavingAt} <input type="time" value={time} onChange={(e) => e.target.value && setTime(e.target.value)} /></label>
      </div>
      <div className="seg" role="group" aria-label={w.timeOfDay}>
        {PRESETS.map((v, i) => <button key={v} type="button" aria-pressed={time === v} onClick={() => setTime(v)}>{w.presets[i]}</button>)}
      </div>
      <p className="travel-hint">{w.bandHint?.[band.key] ?? band.hint}</p>
      <ul className="travel-rows">
        {t.rows.map((r) => (
          <li key={r.place.key}>
            <div className="travel-place"><span>{r.place.name}</span><span className="mute">{r.km} km</span></div>
            <div className="travel-legs">
              {r.legs.map((l) => (
                <span key={l.mode} className={l.available ? "" : "off"} title={l.mode === "metro" && r.place.via ? r.place.via : undefined}>
                  <span className="mute">{l.mode === "metro" && r.place.via ? r.place.via : w.modes[l.mode]}</span>
                  <b>{l.available ? `${l.minutes} ${w.min}` : w.notRunning}</b>
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <p className="fine">{w.travelFine}</p>
    </section>
  );
}
