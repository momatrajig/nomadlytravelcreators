"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarRange, RotateCcw } from "lucide-react";
import { Ico } from "@/components/Icon";

const PRESETS: Array<[string, string]> = [["7d", "7D"], ["30d", "30D"], ["90d", "90D"], ["ytd", "YTD"], ["12m", "12M"]];
const GRAINS: Array<[string, string]> = [["day", "Daily"], ["week", "Weekly"], ["month", "Monthly"]];

/**
 * The date controls, one row: quick presets, a custom from/to that applies in place, and how the chart groups days.
 * Everything lives in the URL (?r= or ?from=&to=, ?g=), so a view can be bookmarked or sent to the partner manager.
 */
export default function RangeBar({ from, to, preset, grain, label, today }: { from: string; to: string; preset: string | null; grain: string; label: string; today: string }) {
  const router = useRouter(), path = usePathname(), sp = useSearchParams();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(from), [t, setT] = useState(to);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", off);
    return () => document.removeEventListener("mousedown", off);
  }, [open]);
  const go = (patch: Record<string, string | null>) => {
    const q = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) v == null ? q.delete(k) : q.set(k, v);
    router.push(`${path}?${q}`, { scroll: false });
  };
  const custom = !preset;
  return (
    <div className="rbar">
      <div className="seg" role="group" aria-label="Quick ranges">
        {PRESETS.map(([k, l]) => <button key={k} type="button" aria-pressed={preset === k} onClick={() => go({ r: k, from: null, to: null, g: null })}>{l}</button>)}
      </div>
      <div className="rpick" ref={box}>
        <button type="button" className={`rbtn${custom ? " on" : ""}`} aria-expanded={open} aria-haspopup="dialog" onClick={() => { setF(from); setT(to); setOpen((o) => !o); }}><Ico of={CalendarRange} size={16} />{label}</button>
        {open && (
          <div className="rpop" role="dialog" aria-label="Custom dates" onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
            <label>From<input type="date" value={f} max={t || today} onChange={(e) => setF(e.target.value)} /></label>
            <label>To<input type="date" value={t} min={f} max={today} onChange={(e) => setT(e.target.value)} /></label>
            <button type="button" className="btn btn-brand" disabled={!f || !t || f > t} onClick={() => { setOpen(false); go({ from: f, to: t, r: null, g: null }); }}>Apply</button>
          </div>
        )}
      </div>
      <div className="seg" role="group" aria-label="Group by">
        {GRAINS.map(([k, l]) => <button key={k} type="button" aria-pressed={grain === k} onClick={() => go({ g: k })}>{l}</button>)}
      </div>
      {(custom || preset !== "30d" || sp.get("g")) && <button type="button" className="rreset" onClick={() => go({ r: null, from: null, to: null, g: null })}><Ico of={RotateCcw} size={14} />Reset</button>}
    </div>
  );
}
