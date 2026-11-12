/**
 * The dashboard's date range: a preset (7, 30, 90 days, year to date, 12 months) or any custom from/to, plus how
 * the chart groups days (day, week, month). Everything is in UTC calendar days, inclusive of both ends, read from
 * the URL so a range can be bookmarked or shared with the partner manager.
 */
export type Grain = "day" | "week" | "month";
export const PRESETS = [["7d", "7 days"], ["30d", "30 days"], ["90d", "90 days"], ["ytd", "Year to date"], ["12m", "12 months"]] as const;
export type Preset = (typeof PRESETS)[number][0];

export interface Range {
  /** first day, YYYY-MM-DD */ from: string;
  /** last day, YYYY-MM-DD, inclusive */ to: string;
  preset: Preset | null; grain: Grain; days: number;
  /** ISO instants for queries: [sinceIso, untilIso) */ sinceIso: string; untilIso: string;
  /** the period of the same length right before, for comparison */ prev: { from: string; to: string; sinceIso: string; untilIso: string };
}

const DAY = 86_400_000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const at = (d: string) => Date.parse(`${d}T00:00:00Z`);
const valid = (d: string | undefined) => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(at(d));

export function parseRange(sp: Record<string, string | undefined>, today = iso(Date.now())): Range {
  let from: string, to: string, preset: Preset | null = null;
  if (valid(sp.from) && valid(sp.to) && sp.from! <= sp.to!) {
    to = sp.to! > today ? today : sp.to!;
    from = sp.from! > to ? to : sp.from!;
    // keep queries bounded: 3 years is more than any creator dashboard needs
    if (at(to) - at(from) > 3 * 366 * DAY) from = iso(at(to) - 3 * 366 * DAY);
  } else {
    preset = (PRESETS.some(([k]) => k === sp.r) ? sp.r : "30d") as Preset;
    to = today;
    from = preset === "ytd" ? `${today.slice(0, 4)}-01-01` : iso(at(today) - ({ "7d": 6, "30d": 29, "90d": 89, "12m": 364 }[preset] * DAY));
  }
  const days = Math.round((at(to) - at(from)) / DAY) + 1;
  const auto: Grain = days <= 45 ? "day" : days <= 200 ? "week" : "month";
  const grain: Grain = sp.g === "day" || sp.g === "week" || sp.g === "month" ? sp.g : auto;
  const pTo = iso(at(from) - DAY), pFrom = iso(at(from) - days * DAY);
  return {
    from, to, preset, grain: grain === "day" && days > 400 ? "week" : grain, days,
    sinceIso: `${from}T00:00:00.000Z`, untilIso: new Date(at(to) + DAY).toISOString(),
    prev: { from: pFrom, to: pTo, sinceIso: `${pFrom}T00:00:00.000Z`, untilIso: `${from}T00:00:00.000Z` },
  };
}

/** Bucket starts (YYYY-MM-DD) covering [from, to]: days, Monday weeks or calendar months. */
export function buckets(from: string, to: string, grain: Grain): string[] {
  const out: string[] = [];
  let t = at(from);
  if (grain === "week") { const dow = (new Date(t).getUTCDay() + 6) % 7; t -= dow * DAY; }
  if (grain === "month") t = at(`${from.slice(0, 7)}-01`);
  const end = at(to);
  while (t <= end) {
    out.push(iso(t));
    if (grain === "day") t += DAY;
    else if (grain === "week") t += 7 * DAY;
    else { const d = new Date(t); t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1); }
  }
  return out;
}

/** Which bucket an instant falls in. */
export function bucketOf(isoInstant: string, grain: Grain): string {
  const d = isoInstant.slice(0, 10);
  if (grain === "day") return d;
  if (grain === "month") return `${d.slice(0, 7)}-01`;
  const t = at(d), dow = (new Date(t).getUTCDay() + 6) % 7;
  return iso(t - dow * DAY);
}

export function rangeLabel(r: Range): string {
  const f = (d: string, y: boolean) => new Date(at(d)).toLocaleDateString("en-US", { month: "short", day: "numeric", ...(y ? { year: "numeric" } : {}), timeZone: "UTC" });
  return `${f(r.from, r.from.slice(0, 4) !== r.to.slice(0, 4))} to ${f(r.to, true)}`;
}

export function bucketLabel(start: string, grain: Grain): string {
  const d = new Date(at(start));
  if (grain === "month") return d.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
