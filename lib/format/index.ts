export const usd = (v: number, whole = false, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, currencyDisplay: "code", minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 }).format(whole ? Math.round(v) : v).replace(/ /g, " ");
export const fmtDate = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
export const fmtDateTime = (iso: string) => new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
export const plural = (n: number, s: string, p = `${s}s`) => `${n} ${n === 1 ? s : p}`;
export const BOARD: Record<string, string> = { RO: "Room only", BB: "Breakfast included", HB: "Half board", FB: "Full board", AI: "All inclusive", SC: "Self catering", RD: "Room" };

/** "checked at 19:12 today", "checked yesterday at 19:12", "checked Sun 8 Nov": never claims today for an older read. */
export function checkedLabel(iso: string, now = Date.now()): string {
  const d = new Date(iso), n = new Date(now);
  const day = (x: Date) => x.toISOString().slice(0, 10);
  if (day(d) === day(n)) return `checked at ${fmtTime(iso)} today`;
  if (day(d) === day(new Date(now - 86_400_000))) return `checked yesterday at ${fmtTime(iso)}`;
  return `checked ${fmtDate(iso)}`;
}
