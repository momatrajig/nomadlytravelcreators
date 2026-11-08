import { LISBON, estimate, type CityProfile, type Mode } from "./model";

export interface Place { key: string; name: string; lat: number; lng: number; modes: Mode[] }
export const LISBON_PLACES: Place[] = [
  { key: "airport", name: "Lisbon Airport", lat: 38.7742, lng: -9.1342, modes: ["ride", "metro"] },
  { key: "baixa", name: "Baixa and Praça do Comércio", lat: 38.7077, lng: -9.1366, modes: ["ride", "metro", "walk"] },
  { key: "belem", name: "Belém Tower", lat: 38.6916, lng: -9.216, modes: ["ride", "tram"] },
  { key: "apolonia", name: "Santa Apolónia station", lat: 38.714, lng: -9.1226, modes: ["ride", "metro"] },
  { key: "oriente", name: "Oriente station", lat: 38.7676, lng: -9.0994, modes: ["ride", "metro"] },
];
export const PROFILES: Record<string, { profile: CityProfile; places: Place[] }> = { Lisbon: { profile: LISBON, places: LISBON_PLACES } };

export function km(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371, dLat = ((bLat - aLat) * Math.PI) / 180, dLng = ((bLng - aLng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Free flow base minutes per mode from straight line distance; a routing API replaces this in production. */
export function baseMinutes(mode: Mode, distKm: number): number {
  const road = distKm * 1.35; // detour factor
  switch (mode) {
    case "ride": return Math.round(4 + (road / 28) * 60);
    case "metro": return Math.round(9 + (road / 24) * 60); // includes walk to and from stations
    case "tram": return Math.round(7 + (road / 13) * 60);
    case "walk": return Math.round((road / 4.8) * 60);
  }
}

export function travelTable(city: string, lat: number, lng: number, departMin: number) {
  const cfg = PROFILES[city];
  if (!cfg) return null;
  return cfg.places.map((p) => {
    const d = km(lat, lng, p.lat, p.lng);
    const legs = p.modes.filter((m) => m !== "walk" || d <= 2.5).map((m) => estimate(cfg.profile, m, baseMinutes(m, d), departMin));
    return { place: p, km: Math.round(d * 10) / 10, legs };
  });
}
