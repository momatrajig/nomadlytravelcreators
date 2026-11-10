/** Default stay dates for a storefront visit: in mock mode the fixture dates (so price checks exist), otherwise four weeks out, two nights. */
export function defaultDates(mode: string): { checkIn: string; checkOut: string } {
  if (mode === "mock") return { checkIn: "2026-12-03", checkOut: "2026-12-05" };
  const d = new Date(); d.setUTCDate(d.getUTCDate() + 28);
  const a = d.toISOString().slice(0, 10); d.setUTCDate(d.getUTCDate() + 2);
  return { checkIn: a, checkOut: d.toISOString().slice(0, 10) };
}
export function readDates(sp: Record<string, string | string[] | undefined>, mode: string) {
  const d = defaultDates(mode);
  const ok = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const checkIn = ok(sp.in) ? sp.in : d.checkIn, checkOut = ok(sp.out) ? sp.out : d.checkOut;
  const adults = Math.min(9, Math.max(1, Number(sp.adults ?? 2) || 2));
  return { checkIn, checkOut, adults, qs: `in=${checkIn}&out=${checkOut}&adults=${adults}` };
}
