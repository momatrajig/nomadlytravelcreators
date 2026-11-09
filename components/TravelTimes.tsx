"use client";
import { useMemo, useState } from "react";
import { bandFor } from "@/lib/transit/model";
import { travelTable } from "@/lib/transit/places";

const PRESETS = [["06:00", "Early"], ["08:00", "Morning rush"], ["13:00", "Midday"], ["17:30", "Evening rush"], ["23:30", "Late"]] as const;
const LABEL: Record<string, string> = { ride: "Taxi", metro: "Rail", tram: "Tram", walk: "Walk" };

/**
 * Travel time by time of day. A landing at 07:40 is a different trip from one at 23:10, so the
 * reader picks when they set off. Estimates come from the transit model; production puts a
 * routing API behind the same model and this component does not change.
 */
export default function TravelTimes({ destination, lat, lng }: { destination: string | null; lat: number; lng: number }) {
  const [time, setTime] = useState("13:00");
  const [h, m] = time.split(":").map(Number);
  const dep = (h ?? 12) * 60 + (m ?? 0);
  const t = useMemo(() => travelTable(destination, lat, lng, dep), [destination, lat, lng, dep]);
  if (!t) return null;
  const band = bandFor(t.profile, dep);
  return (
    <section className="travel" aria-labelledby="travel-h">
      <div className="travel-head">
        <h2 id="travel-h">Getting there</h2>
        <label>Leaving at <input type="time" value={time} onChange={(e) => e.target.value && setTime(e.target.value)} /></label>
      </div>
      <div className="seg" role="group" aria-label="Time of day">
        {PRESETS.map(([v, l]) => <button key={v} type="button" aria-pressed={time === v} onClick={() => setTime(v)}>{l}</button>)}
      </div>
      <p className="travel-hint">{band.hint}</p>
      <ul className="travel-rows">
        {t.rows.map((r) => (
          <li key={r.place.key}>
            <div className="travel-place"><span>{r.place.name}</span><span className="mute">{r.km} km</span></div>
            <div className="travel-legs">
              {r.legs.map((l) => (
                <span key={l.mode} className={l.available ? "" : "off"} title={l.mode === "metro" && r.place.via ? r.place.via : undefined}>
                  <span className="mute">{l.mode === "metro" && r.place.via ? r.place.via : LABEL[l.mode]}</span>
                  <b>{l.available ? `${l.minutes} min` : "not running"}</b>
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <p className="fine">Typical times for this hour, from the hotel door. Live traffic can add 10 to 15 minutes.</p>
    </section>
  );
}
