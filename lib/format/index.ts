export const usd = (v: number, whole = false, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, currencyDisplay: "narrowSymbol", minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 }).format(whole ? Math.round(v) : v).replace(/ /g, " ");
export const fmtDate = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
export const fmtDateTime = (iso: string) => new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
export const plural = (n: number, s: string, p = `${s}s`) => `${n} ${n === 1 ? s : p}`;
export const BOARD: Record<string, string> = { RO: "Room only", BB: "Breakfast included", HB: "Half board", FB: "Full board", AI: "All inclusive", SC: "Self catering", RD: "Room" };

/** "checked 25 minutes ago", "checked 3 hours ago", "checked yesterday": the same words in every time zone, never "today" for an older read. */
export function checkedLabel(iso: string, now = Date.now()): string {
  const min = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (min < 2) return "checked just now";
  if (min < 60) return `checked ${min} minutes ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `checked ${h} ${h === 1 ? "hour" : "hours"} ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "checked yesterday" : `checked ${d} days ago`;
}
