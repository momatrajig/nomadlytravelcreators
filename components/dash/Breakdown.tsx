"use client";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Download, Globe, Hotel, Link2, Smartphone, type LucideIcon } from "lucide-react";
import { Ico } from "@/components/Icon";

export interface BRow { key: string; label: string; clicks: number; visitors: number; checkouts: number | null; bookings: number; canceled: number; value: number; commission: number; epc: number | null; conversion: number | null }
type Tab = "source" | "hotel" | "country" | "device";
type Col = { k: keyof BRow; label: string; money?: boolean; pct?: boolean; tabs?: Tab[] };
const TABS: Array<[Tab, string, LucideIcon, string]> = [
  ["source", "Sources", Link2, "Each link name you set (src=), usually the article."],
  ["hotel", "Hotels", Hotel, "Every hotel readers clicked, held a price at or booked."],
  ["country", "Countries", Globe, "Where the clicks came from."],
  ["device", "Devices", Smartphone, "Phone, tablet or computer."],
];
const COLS: Col[] = [
  { k: "clicks", label: "Clicks" }, { k: "visitors", label: "Visitors" }, { k: "checkouts", label: "Checkouts", tabs: ["hotel"] },
  { k: "bookings", label: "Bookings", tabs: ["source", "hotel"] }, { k: "canceled", label: "Canceled", tabs: ["source", "hotel"] },
  { k: "conversion", label: "Conversion", pct: true, tabs: ["source", "hotel"] }, { k: "value", label: "Booking value", money: true, tabs: ["source", "hotel"] },
  { k: "commission", label: "Commission", money: true, tabs: ["source", "hotel"] }, { k: "epc", label: "EPC", money: true, tabs: ["source", "hotel"] },
];
const money = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", currencyDisplay: "narrowSymbol" }).format(v);
const show = (c: Col, v: unknown) => (v == null ? "" : c.money ? money(v as number) : c.pct ? `${((v as number) * 100).toFixed(1)}%` : (v as number).toLocaleString("en-US"));

/** Where results come from, four ways, in one card: sortable by any column and exportable to CSV for the creator's own sheet. */
export default function Breakdown({ data, range }: { data: Record<Tab, BRow[]>; range: string }) {
  const [tab, setTab] = useState<Tab>("source");
  const [sort, setSort] = useState<{ k: keyof BRow; dir: 1 | -1 }>({ k: "commission", dir: -1 });
  const cols = COLS.filter((c) => !c.tabs || c.tabs.includes(tab));
  const rows = useMemo(() => {
    const k = cols.some((c) => c.k === sort.k) ? sort.k : "clicks";
    return [...data[tab]].sort((a, b) => ((b[k] as number ?? -1) - (a[k] as number ?? -1)) * -sort.dir || b.clicks - a.clicks);
  }, [data, tab, sort, cols]);
  const total = (k: keyof BRow) => rows.reduce((a, r) => a + ((r[k] as number) ?? 0), 0);
  const exportCsv = () => {
    const head = [TABS.find(([t]) => t === tab)![1].replace(/s$/, ""), ...cols.map((c) => c.label)];
    const esc = (v: unknown) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines = [head, ...rows.map((r) => [r.label, ...cols.map((c) => (r[c.k] == null ? "" : c.pct ? ((r[c.k] as number) * 100).toFixed(2) : r[c.k]))])].map((l) => l.map(esc).join(","));
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `nomadly-${tab}s-${range}.csv` });
    a.click(); URL.revokeObjectURL(url);
  };
  return (
    <section className="dcard" aria-labelledby="bd-h">
      <div className="card-head">
        <h2 id="bd-h">Breakdown</h2>
        <button type="button" className="btn btn-sm" onClick={exportCsv} disabled={!rows.length}><Ico of={Download} size={15} />Export CSV</button>
      </div>
      <div className="tabs" role="tablist" aria-label="Break down by">
        {TABS.map(([t, l, I]) => <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}><Ico of={I} size={15} />{l}<span className="num">{data[t].length}</span></button>)}
      </div>
      <p className="note" style={{ margin: "0 0 8px" }}>{TABS.find(([t]) => t === tab)![3]}</p>
      <div className="scroll"><table className="dtable">
        <thead><tr>
          <th>{TABS.find(([t]) => t === tab)![1].replace(/s$/, "")}</th>
          {cols.map((c) => (
            <th key={c.k} className="n" aria-sort={sort.k === c.k ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
              <button type="button" className="th-sort" onClick={() => setSort((s) => ({ k: c.k, dir: s.k === c.k ? (s.dir === 1 ? -1 : 1) : -1 }))}>{c.label}{sort.k === c.k && <Ico of={sort.dir === 1 ? ArrowUp : ArrowDown} size={12} />}</button>
            </th>
          ))}
        </tr></thead>
        <tbody>
          {rows.slice(0, 50).map((r) => <tr key={r.key}><td className="bd-name">{r.label}</td>{cols.map((c) => <td key={c.k} className={`n${c.k === "commission" ? " strong" : ""}`}>{show(c, r[c.k])}</td>)}</tr>)}
          {!rows.length && <tr><td colSpan={cols.length + 1} className="mute">Nothing in this period yet.</td></tr>}
        </tbody>
        {rows.length > 1 && <tfoot><tr className="total"><td>Total</td>{cols.map((c) => <td key={c.k} className="n">{c.k === "epc" || c.k === "conversion" || c.k === "visitors" ? "" : show(c, total(c.k))}</td>)}</tr></tfoot>}
      </table></div>
    </section>
  );
}
