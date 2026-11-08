"use client";
import { useMemo, useState } from "react";
import { LISBON, MODE_LABEL, bandFor } from "@/lib/transit/model";
import { travelTable } from "@/lib/transit/places";

/**
 * Travel time by time of day. The reader picks when they will set off (a landing at 07:40 is a
 * different trip from one at 23:10). Times come from the transit model; in production the model
 * sits in front of the routing API and this component does not change.
 */
export default function TravelTimes({ city, lat, lng, hotelName }: { city: string; lat: number; lng: number; hotelName: string }) {
  const [time, setTime] = useState("12:00");
  const [h, m] = time.split(":").map(Number);
  const dep = (h ?? 12) * 60 + (m ?? 0);
  const band = bandFor(LISBON, dep);
  const rows = useMemo(() => travelTable(city, lat, lng, dep), [city, lat, lng, dep]);
  if (!rows) return null;
  const presets = [["07:30", "Morning arrival"], ["12:00", "Midday"], ["17:30", "Evening rush"], ["23:00", "Late landing"]] as const;
  return (
    <div className="body">
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <b>Getting there from {hotelName.split(" ")[0]}</b>
          <label className="small mute">Setting off at <input type="time" value={time} onChange={(e) => e.target.value && setTime(e.target.value)} style={{ font: "inherit", background: "var(--surface-2)", color: "var(--fg)", border: "1px solid var(--line-2)", borderRadius: 8, padding: "3px 6px" }} aria-label="Departure time" /></label>
        </div>
        <div className="segs" style={{ marginTop: 8 }} role="group" aria-label="Typical departure times">
          {presets.map(([t, l]) => <button key={t} type="button" aria-pressed={time === t} onClick={() => setTime(t)}>{l}</button>)}
        </div>
        <p className="small mute" style={{ margin: "8px 0 0" }}>{band.label}. {band.hint}</p>
      </div>
      <div className="times">
        {rows.map((r) => (
          <div key={r.place.key} style={{ display: "grid", gap: 4 }}>
            <span><b>{r.place.name}</b> <span className="mute small">{r.km} km</span></span>
            <span className="small" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{r.legs.map((l) => <span key={l.mode} className={l.available ? "" : "off"} title={l.note}>{MODE_LABEL[l.mode]}: {l.available ? <b>{l.minutes} min</b> : <i>not running</i>}</span>)}</span>
          </div>
        ))}
      </div>
      <p className="small mute" style={{ margin: 0 }}>Estimates for a typical {band.label.toLowerCase()}, from the hotel entrance. Live traffic can move them by 10 to 15 minutes.</p>
    </div>
  );
}
