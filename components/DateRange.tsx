"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addDays, daysBetween, priceLevels, type CalDay, type Level } from "@/lib/calendar";
import { type Lang } from "@/lib/i18n";

const W = {
  en: { in: "Check in", out: "Check out", nights: (n: number) => `${n} ${n === 1 ? "night" : "nights"}`, pickOut: "Now pick your check out day", pickIn: "Pick your check in day", done: "Done", clear: "Clear", prev: "Previous month", next: "Next month", low: "Good rate", fair: "Fair", high: "Higher", peak: "Peak", legend: "Price per night for", soldOut: "sold out", loading: "Checking prices", max: "Up to 30 nights", noPrice: "Pick a destination to see prices by date", adultsN: (n: number) => `${n} ${n === 1 ? "adult" : "adults"}`, compare: "Colours compare the days shown." },
  cs: { in: "Příjezd", out: "Odjezd", nights: (n: number) => `${n} ${n === 1 ? "noc" : n < 5 ? "noci" : "nocí"}`, pickOut: "Teď vyberte den odjezdu", pickIn: "Vyberte den příjezdu", done: "Hotovo", clear: "Zrušit", prev: "Předchozí měsíc", next: "Další měsíc", low: "Dobrá cena", fair: "Běžná", high: "Vyšší", peak: "Nejvyšší", legend: "Cena za noc pro", soldOut: "vyprodáno", loading: "Ověřuji ceny", max: "Nejvýše 30 nocí", noPrice: "Vyberte destinaci a uvidíte ceny podle dnů", adultsN: (n: number) => `${n} ${n === 1 ? "dospělého" : "dospělé"}`, compare: "Barvy porovnávají zobrazené dny." },
};
const LEVELS: Level[] = ["low", "fair", "high", "peak"];
const ymd = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/**
 * Check in and check out on one calendar, the way Hopper and Google Flights do it: every day carries its
 * one night price and a colour, green for the cheapest quarter of the days in view up to red for the dearest,
 * so a reader sees good dates before choosing. Prices arrive a week at a time and colour in as they land.
 * Give it a key that changes with the hotel, destination and party size: a new scope starts a fresh calendar.
 */
export default function DateRange({ checkIn, checkOut, onChange, lang = "en", adults = 2, hotel, dest, currency = "USD", inline = false }: {
  checkIn: string; checkOut: string; onChange: (a: string, b: string) => void; lang?: Lang; adults?: number; hotel?: number; dest?: string; currency?: string; inline?: boolean;
}) {
  const w = W[lang] ?? W.en;
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [open, setOpen] = useState(inline);
  const [a, setA] = useState(checkIn), [b, setB] = useState<string | null>(checkOut);
  const [hover, setHover] = useState<string | null>(null);
  const [view, setView] = useState(() => { const d = new Date(`${checkIn}T12:00:00Z`); return { y: d.getUTCFullYear(), m: d.getUTCMonth() }; });
  const [prices, setPrices] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const asked = useRef(new Set<string>());
  const box = useRef<HTMLDivElement>(null);
  const scope = hotel ? `hotel=${hotel}` : dest ? `d=${dest}` : "";
  const loc = lang === "cs" ? "cs-CZ" : "en-GB";
  const fmtShort = (iso: string) => new Intl.DateTimeFormat(loc, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));
  const compact = (v: number) => new Intl.NumberFormat(lang === "cs" ? "cs-CZ" : "en-US", { style: "currency", currency, currencyDisplay: "narrowSymbol", notation: v >= 10000 ? "compact" : "standard", maximumFractionDigits: v >= 10000 ? 1 : 0 }).format(v);

  const months = [view, view.m === 11 ? { y: view.y + 1, m: 0 } : { y: view.y, m: view.m + 1 }];
  // ask for the visible months a week at a time, two weeks in flight, skipping what was asked already
  const load = useCallback(async () => {
    if (!scope) return;
    const starts: string[] = [];
    for (const mo of months) {
      const last = new Date(Date.UTC(mo.y, mo.m + 1, 0)).getUTCDate();
      for (let d = 1; d <= last; d += 7) { const s = ymd(mo.y, mo.m, d); const e = addDays(s, 6); if (e >= today && !asked.current.has(`${scope}:${s}`)) starts.push(s); }
    }
    const queue = [...starts];
    const run = async () => {
      for (let s = queue.shift(); s; s = queue.shift()) {
        asked.current.add(`${scope}:${s}`);
        const span = Array.from({ length: 7 }, (_, i) => addDays(s!, i));
        setLoading((l) => new Set([...l, ...span]));
        try {
          const r = await fetch(`/api/calendar?${scope}&from=${s}&days=7&adults=${adults}`);
          const j = (await r.json()) as { days?: CalDay[] };
          setPrices((p) => ({ ...p, ...Object.fromEntries((j.days ?? []).map((d) => [d.date, d.price])) }));
        } catch { asked.current.delete(`${scope}:${s}`); }
        setLoading((l) => { const n = new Set(l); span.forEach((x) => n.delete(x)); return n; });
      }
    };
    await Promise.all([run(), run()]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, adults, view.y, view.m, today]);
  useEffect(() => { if (open) void load(); }, [open, load]);
  useEffect(() => {
    if (!open || inline) return;
    const off = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", off); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", off); document.removeEventListener("keydown", esc); };
  }, [open, inline]);

  const visible = months.flatMap((mo) => Array.from({ length: new Date(Date.UTC(mo.y, mo.m + 1, 0)).getUTCDate() }, (_, i) => ymd(mo.y, mo.m, i + 1)));
  const levels = priceLevels(visible.map((date) => ({ date, price: prices[date] ?? null })));
  const pick = (d: string) => {
    if (!b && d > a) {
      if (daysBetween(a, d) > 30) return;
      setB(d); onChange(a, d); if (!inline) setTimeout(() => setOpen(false), 180);
    } else { setA(d); setB(null); }
  };
  const end = b ?? (hover && hover > a && daysBetween(a, hover) <= 30 ? hover : null);
  const nights = b ? daysBetween(a, b) : end ? daysBetween(a, end) : 0;
  const shift = (k: number) => setView((v) => { const m = v.m + k; return { y: v.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 }; });
  const canPrev = ymd(view.y, view.m, 1) > today.slice(0, 8) + "01" || false;

  const panel = (
    <div className={`dr-pop${inline ? " inline" : ""}`} role="dialog" aria-label={`${w.in}, ${w.out}`}>
      <div className="dr-status" aria-live="polite">{b ? <><b>{fmtShort(a)}</b> → <b>{fmtShort(b)}</b>, {w.nights(daysBetween(a, b))}</> : <>{w.pickOut}{nights ? `: ${w.nights(nights)}` : ""}</>}</div>
      <div className="dr-nav">
        <button type="button" aria-label={w.prev} onClick={() => shift(-1)} disabled={!canPrev}>‹</button>
        <button type="button" aria-label={w.next} onClick={() => shift(1)}>›</button>
      </div>
      <div className="dr-months">
        {months.map((mo, mi) => {
          const first = new Date(Date.UTC(mo.y, mo.m, 1)).getUTCDay();
          const lead = (first + 6) % 7;
          const last = new Date(Date.UTC(mo.y, mo.m + 1, 0)).getUTCDate();
          return (
            <div key={`${mo.y}-${mo.m}`} className={`dr-month${mi ? " second" : ""}`}>
              <h4>{new Intl.DateTimeFormat(loc, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(mo.y, mo.m, 15)))}</h4>
              <div className="dr-grid" role="grid">
                {Array.from({ length: 7 }, (_, i) => <span key={`h${i}`} className="dr-dow" aria-hidden="true">{new Intl.DateTimeFormat(loc, { weekday: "narrow", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 10, 2 + i)))}</span>)}
                {Array.from({ length: lead }, (_, i) => <span key={`l${i}`} />)}
                {Array.from({ length: last }, (_, i) => {
                  const d = ymd(mo.y, mo.m, i + 1);
                  const past = d < today;
                  const tooFar = !b && d > a && daysBetween(a, d) > 30;
                  const p = prices[d];
                  const lvl = levels[d];
                  const inRange = end && d > a && d < end;
                  const cls = ["dr-day", lvl ? `lv-${lvl}` : "", d === a ? "start" : "", end && d === end ? "end" : "", inRange ? "mid" : "", d === today ? "today" : "", p === null ? "sold" : ""].filter(Boolean).join(" ");
                  return (
                    <button key={d} type="button" className={cls} disabled={past || tooFar} onClick={() => pick(d)} onMouseEnter={() => setHover(d)}
                      aria-pressed={d === a || d === b} aria-label={`${fmtShort(d)}${p ? `, ${compact(p)}${lvl ? `, ${w[lvl]}` : ""}` : p === null ? `, ${w.soldOut}` : ""}`}>
                      <span className="n">{i + 1}</span>
                      <span className="p">{past ? "" : p ? compact(p) : p === null ? "–" : loading.has(d) ? <i className="dr-dot" /> : ""}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="dr-foot">
        {scope ? (
          <div className="dr-legend"><span>{w.legend} {w.adultsN(adults)}:</span>{LEVELS.map((l) => <span key={l} className={`lg lv-${l}`}><i />{w[l]}</span>)}</div>
        ) : <span className="small mute">{w.noPrice}</span>}
        {!inline && <button type="button" className="btn btn-brand" onClick={() => setOpen(false)} disabled={!b}>{w.done}</button>}
      </div>
      {scope && <p className="dr-note">{w.compare} {w.max}.</p>}
    </div>
  );
  if (inline) return <div className="dr" ref={box}>{panel}</div>;
  return (
    <div className="dr" ref={box}>
      <button type="button" className="dr-trigger" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="dr-f"><small>{w.in}</small><b>{fmtShort(a)}</b></span>
        <span className="dr-arrow" aria-hidden="true">→</span>
        <span className="dr-f"><small>{w.out}</small><b>{b ? fmtShort(b) : "…"}</b></span>
        <span className="dr-n">{b ? w.nights(daysBetween(a, b)) : ""}</span>
      </button>
      {open && panel}
    </div>
  );
}
