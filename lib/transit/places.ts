import { LISBON, estimate, type CityProfile, type Estimate, type Mode } from "./model";
import { DESTINATIONS, destination, type Destination } from "@/lib/content/destinations";

export interface Place { key: string; name: string; lat: number; lng: number; modes: Mode[]; via?: string }

export function km(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371, dLat = ((bLat - aLat) * Math.PI) / 180, dLng = ((bLng - aLng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

const m = (h: number, mi = 0) => h * 60 + mi;

/**
 * A city profile from the destination record: the same seven bands everywhere (rush hours are
 * close enough across these cities for an estimate), the destination's own rush severity and
 * rail hours. Lisbon keeps its hand tuned profile.
 */
export function profileFor(d: Destination): CityProfile {
  if (d.slug === "lisbon") return LISBON;
  const r = d.rush;
  const railNote = d.metro ? `${d.metro.label} runs about ${hhmm(d.metro.open)} to ${hhmm(d.metro.close)}.` : "";
  return {
    city: d.name, tz: d.tz,
    bands: [
      { key: "night", label: "Night", from: m(0), to: m(5, 30), hint: `Roads are empty. ${d.metro ? railNote : "Taxi only."}` },
      { key: "early", label: "Early morning", from: m(5, 30), to: m(7), hint: "Quiet roads, the fastest airport run of the day." },
      { key: "amrush", label: "Morning rush", from: m(7), to: m(10), hint: `Heavy traffic into the centre. ${d.metro ? `${d.metro.label} is usually faster.` : "Allow extra time."}` },
      { key: "midday", label: "Midday", from: m(10), to: m(16), hint: "Normal traffic." },
      { key: "pmrush", label: "Evening rush", from: m(16), to: m(19, 30), hint: "The slowest time to cross the city by car." },
      { key: "evening", label: "Evening", from: m(19, 30), to: m(23), hint: "Traffic eases." },
      { key: "late", label: "Late night", from: m(23), to: m(24), hint: d.metro ? railNote : "Taxi only at this hour." },
    ],
    factor: {
      ride: { night: 0.8, early: 0.88, amrush: r, midday: 1, pmrush: r * 1.05, evening: 0.95, late: 0.85 },
      metro: { night: 1, early: 1, amrush: 1, midday: 1, pmrush: 1, evening: 1, late: 1 },
      tram: { night: 1, early: 1, amrush: 1.25, midday: 1.1, pmrush: 1.3, evening: 1, late: 1 },
      walk: { night: 1, early: 1, amrush: 1, midday: 1, pmrush: 1, evening: 1, late: 1 },
    },
    service: d.metro ? { metro: { open: d.metro.open, close: d.metro.close, note: railNote } } : {},
    wait: { metro: { night: 0, early: 7, amrush: 3, midday: 4, pmrush: 3, evening: 6, late: 9 } },
  };
}

const hhmm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** Free flow base minutes per mode from straight line distance; a routing API replaces this in production. */
export function baseMinutes(mode: Mode, distKm: number, rideKmh = 28): number {
  const road = distKm * 1.35; // detour factor
  switch (mode) {
    case "ride": return Math.round(4 + (road / rideKmh) * 60);
    case "metro": return Math.round(10 + (road / 32) * 60); // includes the walk to and from stations and one change
    case "tram": return Math.round(7 + (road / 13) * 60);
    case "walk": return Math.round((road / 4.8) * 60);
  }
}

export function placesFor(d: Destination): Place[] {
  return [
    { key: "airport", name: d.airport.name, lat: d.airport.lat, lng: d.airport.lng, modes: d.airport.rail && d.metro ? ["ride", "metro"] : ["ride"], via: d.airport.rail ?? undefined },
    { key: "centre", name: d.centre.name, lat: d.centre.lat, lng: d.centre.lng, modes: d.metro ? ["ride", "metro", "walk"] : ["ride", "walk"], via: d.metro?.label },
  ];
}

export interface TravelRow { place: Place; km: number; legs: Estimate[] }

export function travelTable(dest: string | null, lat: number, lng: number, departMin: number): { profile: CityProfile; rows: TravelRow[] } | null {
  const d = destination(dest) ?? DESTINATIONS.find((x) => km(x.lat, x.lng, lat, lng) < 40) ?? null;
  if (!d) return null;
  const profile = profileFor(d);
  const rows = placesFor(d).map((p) => {
    const dist = km(lat, lng, p.lat, p.lng);
    const legs = p.modes.filter((mode) => mode !== "walk" || dist <= 2.5).map((mode) => estimate(profile, mode, baseMinutes(mode, dist, d.rideKmh), departMin));
    return { place: p, km: Math.round(dist * 10) / 10, legs };
  });
  return { profile, rows };
}
