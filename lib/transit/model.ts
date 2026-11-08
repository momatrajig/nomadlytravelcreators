/**
 * Travel time by time of day.
 *
 * Production reads live times from a routing API with a departure time. This model is the
 * deterministic layer in front of it: it defines the time bands shown to the reader, applies a
 * city profile (multipliers per mode per band, service hours) to a free flow base time, and
 * produces the sentence we print. If the routing API is down or has no transit data for a
 * band, the storefront still prints an honest estimate labeled as such.
 */

export type Mode = "ride" | "metro" | "tram" | "walk";

export interface Band {
  key: string;
  label: string; // shown on the selector
  from: number; // minutes after midnight, inclusive
  to: number; // exclusive; may exceed 1440 to wrap past midnight
  hint: string; // one short line under the selector
}

export interface CityProfile {
  city: string;
  tz: string;
  bands: Band[];
  /** multiplier on free flow time, per mode, per band key */
  factor: Record<Mode, Record<string, number>>;
  /** service windows, minutes after midnight; outside them the mode is unavailable */
  service: Partial<Record<Mode, { open: number; close: number; note: string }>>;
  /** extra wait added for transit modes outside peak, per band key */
  wait: Partial<Record<Mode, Record<string, number>>>;
}

const m = (h: number, mi = 0) => h * 60 + mi;

export const LISBON: CityProfile = {
  city: "Lisbon",
  tz: "Europe/Lisbon",
  bands: [
    { key: "night", label: "Night", from: m(0), to: m(5, 30), hint: "Roads empty. Metro closed from 01:00." },
    { key: "early", label: "Early morning", from: m(5, 30), to: m(7), hint: "Quiet roads. Metro from 06:30." },
    { key: "amrush", label: "Morning rush", from: m(7), to: m(10), hint: "Heaviest traffic of the day on the airport road." },
    { key: "midday", label: "Midday", from: m(10), to: m(16), hint: "Normal traffic." },
    { key: "pmrush", label: "Evening rush", from: m(16), to: m(19, 30), hint: "Slow on the Segunda Circular and the bridges." },
    { key: "evening", label: "Evening", from: m(19, 30), to: m(23), hint: "Traffic eases. Metro every 6 to 9 minutes." },
    { key: "late", label: "Late night", from: m(23), to: m(24), hint: "Metro until 01:00, then taxi only." },
  ],
  factor: {
    ride: { night: 0.8, early: 0.9, amrush: 1.6, midday: 1.0, pmrush: 1.7, evening: 0.95, late: 0.85 },
    metro: { night: 1, early: 1, amrush: 1, midday: 1, pmrush: 1, evening: 1, late: 1 },
    tram: { night: 1, early: 1, amrush: 1.3, midday: 1.1, pmrush: 1.35, evening: 1, late: 1 },
    walk: { night: 1, early: 1, amrush: 1, midday: 1, pmrush: 1, evening: 1, late: 1 },
  },
  service: {
    metro: { open: m(6, 30), close: m(25), note: "Metro runs 06:30 to 01:00." },
    tram: { open: m(6), close: m(23, 30), note: "Trams run about 06:00 to 23:30." },
  },
  wait: {
    metro: { night: 0, early: 6, amrush: 3, midday: 4, pmrush: 3, evening: 7, late: 9 },
    tram: { night: 0, early: 10, amrush: 6, midday: 8, pmrush: 6, evening: 12, late: 15 },
  },
};

export function bandFor(profile: CityProfile, minutesAfterMidnight: number): Band {
  const t = ((minutesAfterMidnight % 1440) + 1440) % 1440;
  return profile.bands.find((b) => t >= b.from && t < b.to) ?? profile.bands[0]!;
}

export interface Estimate {
  mode: Mode;
  available: boolean;
  minutes: number | null;
  band: Band;
  note: string;
}

/**
 * @param baseMinutes free flow or timetable time for this mode (what a routing API returns at 3 am)
 * @param departMin departure time as minutes after midnight, local
 */
export function estimate(profile: CityProfile, mode: Mode, baseMinutes: number, departMin: number): Estimate {
  const band = bandFor(profile, departMin);
  const svc = profile.service[mode];
  if (svc) {
    const t = ((departMin % 1440) + 1440) % 1440;
    // a close past midnight (for example 25:00) keeps the service open through the wrap
    const open = (t >= svc.open && t < svc.close) || (svc.close > 1440 && t < svc.close - 1440);
    if (!open) return { mode, available: false, minutes: null, band, note: svc.note };
  }
  const f = profile.factor[mode][band.key] ?? 1;
  const wait = profile.wait[mode]?.[band.key] ?? 0;
  const minutes = Math.round(baseMinutes * f + wait);
  return { mode, available: true, minutes, band, note: band.hint };
}

export const MODE_LABEL: Record<Mode, string> = { ride: "Taxi or ride", metro: "Metro", tram: "Tram or bus", walk: "On foot" };

export function describe(e: Estimate): string {
  if (!e.available) return `${MODE_LABEL[e.mode]}: not running. ${e.note}`;
  return `${MODE_LABEL[e.mode]}: about ${e.minutes} min`;
}

/** Parse "07:45" to minutes after midnight. */
export function parseHHMM(s: string): number {
  const mm = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!mm) throw new Error(`bad time ${s}`);
  const h = Number(mm[1]), mi = Number(mm[2]);
  if (h > 23 || mi > 59) throw new Error(`bad time ${s}`);
  return h * 60 + mi;
}
