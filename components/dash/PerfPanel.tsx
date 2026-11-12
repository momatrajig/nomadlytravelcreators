"use client";
import { useMemo, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight, CalendarCheck, MousePointerClick, ShoppingCart, Users, Wallet, type LucideIcon } from "lucide-react";
import { Ico } from "@/components/Icon";

type Metric = "clicks" | "visitors" | "checkouts" | "bookings" | "commission";
type Row = Record<Metric, number>;
const DEF: Record<Metric, { label: string; desc: string; icon: LucideIcon; tint: string; money?: boolean }> = {
  clicks: { label: "Clicks", desc: "Times a reader opened one of your links.", icon: MousePointerClick, tint: "#4f46e5" },
  visitors: { label: "Visitors", desc: "Different people behind those clicks.", icon: Users, tint: "#0e7490" },
  checkouts: { label: "Checkouts", desc: "Readers who picked a room and held a price.", icon: ShoppingCart, tint: "#b45309" },
  bookings: { label: "Bookings", desc: "Paid hotel stays, cancellations left out.", icon: CalendarCheck, tint: "#15803d" },
  commission: { label: "Commission", desc: "What you earn on stays and add ons.", icon: Wallet, tint: "#be185d", money: true },
};
const ORDER: Metric[] = ["clicks", "visitors", "checkouts", "bookings", "commission"];
const money = (v: number, whole = false) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", currencyDisplay: "narrowSymbol", maximumFractionDigits: whole ? 0 : 2, minimumFractionDigits: whole ? 0 : 2 }).format(v);
const fmt = (m: Metric, v: number, whole = false) => (DEF[m].money ? money(v, whole) : v.toLocaleString("en-US", { maximumFractionDigits: 1 }));

/**
 * The metric cards and the chart, as one control: each card shows the total, the daily average and the change on
 * the period before; pressing a card puts that metric on the chart, drawn against the period before (dashed).
 * Hovering, or moving with the arrow keys, reads any day out exactly.
 */
export default function PerfPanel({ totals, prev, series, prevSeries, labels, days, prevLabel }: { totals: Row; prev: Row; series: Row[]; prevSeries: Row[]; labels: string[]; days: number; prevLabel: string }) {
  const [m, setM] = useState<Metric>("clicks");
  return (
    <section className="perf" aria-label="Performance">
      <div className="mcards" role="tablist" aria-label="Metric on the chart">
        {ORDER.map((k) => {
          const d = DEF[k], cur = totals[k], was = prev[k];
          const ch = was > 0 ? (cur - was) / was : null;
          return (
            <button key={k} type="button" role="tab" aria-selected={m === k} className="mcard" style={{ ["--t" as string]: d.tint }} onClick={() => setM(k)}>
              <span className="mc-h"><span className="mc-ic"><Ico of={d.icon} size={17} /></span>{d.label}</span>
              <span className="mc-d">{d.desc}</span>
              <b className="mc-v">{fmt(k, cur)}</b>
              <span className="mc-f">
                <span>{fmt(k, cur / days)} a day</span>
                {ch != null ? <span className={`delta ${ch >= 0 ? "up" : "down"}`} title={`${prevLabel}: ${fmt(k, was)}`}><Ico of={ch >= 0 ? ArrowUpRight : ArrowDownRight} size={13} />{Math.abs(Math.round(ch * 100))}%</span> : <span className="delta flat">New</span>}
              </span>
            </button>
          );
        })}
      </div>
      <Chart m={m} cur={series.map((r) => r[m])} was={prevSeries.map((r) => r[m])} labels={labels} prevLabel={prevLabel} />
    </section>
  );
}

function ticks(max: number, money: boolean) {
  if (max <= 0) return [0, 1];
  const raw = max / 4, p = 10 ** Math.floor(Math.log10(raw)), n = raw / p;
  let step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
  if (!money && step < 1) step = 1;
  const out: number[] = [];
  for (let v = 0; v <= max + step * 0.001; v += step) out.push(v);
  if (out[out.length - 1]! < max) out.push(out[out.length - 1]! + step);
  return out;
}

function Chart({ m, cur, was, labels, prevLabel }: { m: Metric; cur: number[]; was: number[]; labels: string[]; prevLabel: string }) {
  const d = DEF[m];
  const W = 900, H = 260, L = 52, R = 12, T = 14, B = 30;
  const n = cur.length;
  const tk = useMemo(() => ticks(Math.max(...cur, ...was.slice(0, n), 0), !!d.money), [cur, was, n, d.money]);
  const top = tk[tk.length - 1]!;
  const x = (i: number) => L + (n <= 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (n - 1));
  const y = (v: number) => T + (H - T - B) * (1 - v / top);
  const path = (vals: number[]) => vals.slice(0, n).map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const area = `${path(cur)}L${x(n - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z`;
  const [hi, setHi] = useState<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const every = Math.max(1, Math.ceil(n / 7));
  // a label every few points, and the last one unless it would crowd the label before it
  const shown = Array.from({ length: n }, (_, i) => i).filter((i) => i % every === 0 || (i === n - 1 && (n - 1) % every >= every / 2));
  const pick = (clientX: number) => {
    const r = svg.current?.getBoundingClientRect(); if (!r || n === 0) return;
    const px = ((clientX - r.left) / r.width) * W;
    setHi(Math.max(0, Math.min(n - 1, Math.round(((px - L) / (W - L - R)) * (n - 1)))));
  };
  const total = cur.reduce((a, v) => a + v, 0);
  return (
    <div className="pchart" style={{ ["--t" as string]: d.tint }}>
      <div className="pc-legend">
        <span><i className="sw cur" />{d.label}</span>
        <span><i className="sw prev" />{prevLabel}</span>
      </div>
      <div className="pc-wrap">
        <svg ref={svg} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${d.label} over the period: ${fmt(m, total)} in total`} tabIndex={0}
          onMouseMove={(e) => pick(e.clientX)} onMouseLeave={() => setHi(null)} onTouchStart={(e) => pick(e.touches[0]!.clientX)} onTouchMove={(e) => pick(e.touches[0]!.clientX)}
          onKeyDown={(e) => { if (e.key === "ArrowRight") setHi((h) => Math.min(n - 1, (h ?? -1) + 1)); if (e.key === "ArrowLeft") setHi((h) => Math.max(0, (h ?? n) - 1)); }} onBlur={() => setHi(null)}>
          <defs><linearGradient id="pc-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--t)" stopOpacity=".22" /><stop offset="1" stopColor="var(--t)" stopOpacity="0" /></linearGradient></defs>
          {tk.map((v) => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="grid" /><text x={L - 8} y={y(v) + 4} textAnchor="end" className="axis">{fmt(m, v, true)}</text></g>)}
          {shown.map((i) => <text key={i} x={x(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} className="axis">{labels[i]}</text>)}
          <path d={path(was)} className="prev" />
          <path d={area} fill="url(#pc-g)" />
          <path d={path(cur)} className="cur" />
          {n === 1 && <circle cx={x(0)} cy={y(cur[0]!)} r={4} className="dot" />}
          {hi != null && <g><line x1={x(hi)} x2={x(hi)} y1={T} y2={H - B} className="cross" /><circle cx={x(hi)} cy={y(cur[hi]!)} r={4.5} className="dot" />{was[hi] != null && <circle cx={x(hi)} cy={y(was[hi]!)} r={3} className="dot prev" />}</g>}
        </svg>
        {hi != null && (
          <div className="pc-tip" style={{ left: `${(x(hi) / W) * 100}%` }} role="status">
            <b>{labels[hi]}</b>
            <span><i className="sw cur" />{fmt(m, cur[hi]!)}</span>
            {was[hi] != null && <span className="mute"><i className="sw prev" />{fmt(m, was[hi]!)}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
