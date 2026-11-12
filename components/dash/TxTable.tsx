"use client";
import { Fragment, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, BedDouble, CarTaxiFront, ChevronDown, Columns3, Download, Luggage, Search, Smartphone, Timer, type LucideIcon } from "lucide-react";
import { Ico } from "@/components/Icon";

export interface TxLine { category: "hotel" | "transfer" | "esim" | "bag" | "delay"; info: string; price: number; margin: number; costs: number; commission: number }
export interface TxBooking {
  id: string; reference: string; date: string; hotel: string; source: string | null; checkIn: string | null; checkOut: string; nights: number | null;
  tx: "Pending" | "Approved" | "Canceled"; pay: "Pending" | "Ready" | "Paid" | "Canceled"; demo: boolean; lines: TxLine[];
  price: number; commission: number;
}
const ICON: Record<TxLine["category"], LucideIcon> = { hotel: BedDouble, transfer: CarTaxiFront, esim: Smartphone, bag: Luggage, delay: Timer };
const CAT: Record<TxLine["category"], string> = { hotel: "Hotel", transfer: "Airport ride", esim: "eSIM", bag: "Bag cover", delay: "Delay cover" };
type ColKey = "source" | "product" | "tx" | "pay" | "price" | "commission" | "date" | "stay" | "nights";
const COLS: Array<[ColKey, string]> = [["source", "Source"], ["product", "Products"], ["tx", "Transaction"], ["pay", "Payment"], ["price", "Booking value"], ["commission", "Commission"], ["date", "Booked"], ["stay", "Stay"], ["nights", "Nights"]];
const money = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", currencyDisplay: "narrowSymbol" }).format(v);
const day = (iso: string | null, y = true) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", ...(y ? { year: "numeric" } : {}), timeZone: "UTC" }) : "");

/**
 * Every booking from the creator's storefront, one row each: hotel and add ons together, statuses as chips, filters,
 * search, column picker, sort and CSV export. A row opens to the line by line money (price, our margin, costs,
 * commission), so the creator sees exactly how each dollar was earned.
 */
export default function TxTable({ rows, range }: { rows: TxBooking[]; range: string }) {
  const [q, setQ] = useState(""), [tx, setTx] = useState(""), [pay, setPay] = useState(""), [prod, setProd] = useState("");
  const [sort, setSort] = useState<{ k: "date" | "commission" | "price" | "checkIn"; dir: 1 | -1 }>({ k: "date", dir: -1 });
  const [hide, setHide] = useState<Set<ColKey>>(new Set(["nights"])), [pickOpen, setPickOpen] = useState(false);
  const [open, setOpen] = useState<string | null>(null), [limit, setLimit] = useState(25);
  const on = (k: ColKey) => !hide.has(k);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => (!tx || r.tx === tx) && (!pay || r.pay === pay) && (!prod || r.lines.some((l) => l.category === prod))
      && (!s || [r.hotel, r.reference, r.source ?? "direct"].some((v) => v.toLowerCase().includes(s))))
      .sort((a, b) => {
        const v = (r: TxBooking) => (sort.k === "date" ? r.date : sort.k === "checkIn" ? r.checkIn ?? "" : r[sort.k]);
        const x = v(a), y = v(b);
        return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
      });
  }, [rows, q, tx, pay, prod, sort]);
  const th = (k: typeof sort.k, label: string, n = false) => (
    <th className={n ? "n" : undefined} aria-sort={sort.k === k ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
      <button type="button" className="th-sort" onClick={() => setSort((s) => ({ k, dir: s.k === k ? (s.dir === 1 ? -1 : 1) : -1 }))}>{label}{sort.k === k && <Ico of={sort.dir === 1 ? ArrowUp : ArrowDown} size={12} />}</button>
    </th>
  );
  const exportCsv = () => {
    const head = ["Reference", "Booked", "Hotel", "Source", "Products", "Check in", "Check out", "Nights", "Transaction status", "Payment status", "Booking value", "Commission", "Demo"];
    const esc = (v: unknown) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const body = list.map((r) => [r.reference, r.date.slice(0, 10), r.hotel, r.source ?? "direct", r.lines.map((l) => CAT[l.category]).join(" + "), r.checkIn?.slice(0, 10) ?? "", r.checkOut.slice(0, 10), r.nights ?? "", r.tx, r.pay, r.price.toFixed(2), r.commission.toFixed(2), r.demo ? "yes" : ""]);
    const url = URL.createObjectURL(new Blob([[head, ...body].map((l) => l.map(esc).join(",")).join("\n")], { type: "text/csv" }));
    Object.assign(document.createElement("a"), { href: url, download: `nomadly-transactions-${range}.csv` }).click();
    URL.revokeObjectURL(url);
  };
  const cols = COLS.filter(([k]) => on(k)).length + 2;
  return (
    <section className="dcard" aria-label="Transactions">
      <div className="txbar">
        <label className="tx-search"><Ico of={Search} size={16} /><input type="search" placeholder="Hotel, reference or source" value={q} onChange={(e) => { setQ(e.target.value); setLimit(25); }} aria-label="Search transactions" /></label>
        <select value={tx} onChange={(e) => setTx(e.target.value)} aria-label="Transaction status"><option value="">All transactions</option><option>Pending</option><option>Approved</option><option>Canceled</option></select>
        <select value={pay} onChange={(e) => setPay(e.target.value)} aria-label="Payment status"><option value="">All payments</option><option>Pending</option><option>Ready</option><option>Paid</option><option>Canceled</option></select>
        <select value={prod} onChange={(e) => setProd(e.target.value)} aria-label="Product"><option value="">All products</option>{Object.entries(CAT).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <div className="rpick">
          <button type="button" className="btn btn-sm" aria-expanded={pickOpen} onClick={() => setPickOpen((o) => !o)}><Ico of={Columns3} size={15} />Columns</button>
          {pickOpen && <div className="rpop cols" role="group" aria-label="Columns">{COLS.map(([k, l]) => <label key={k} className="check"><input type="checkbox" checked={on(k)} onChange={() => setHide((h) => { const n = new Set(h); if (n.has(k)) n.delete(k); else n.add(k); return n; })} /><span>{l}</span></label>)}</div>}
        </div>
        <button type="button" className="btn btn-sm btn-brand" onClick={exportCsv} disabled={!list.length}><Ico of={Download} size={15} />Export</button>
      </div>
      <p className="small mute" style={{ margin: "0 0 8px" }}>{list.length} {list.length === 1 ? "booking" : "bookings"}{list.length !== rows.length ? ` of ${rows.length}` : ""}. Times in UTC.</p>
      <div className="scroll"><table className="dtable txt">
        <thead><tr>
          <th>Booking</th>
          {on("source") && <th>Source</th>}
          {on("product") && <th>Products</th>}
          {on("tx") && <th>Transaction</th>}
          {on("pay") && <th>Payment</th>}
          {on("price") && th("price", "Booking value", true)}
          {on("commission") && th("commission", "Commission", true)}
          {on("date") && th("date", "Booked")}
          {on("stay") && th("checkIn", "Stay")}
          {on("nights") && <th className="n">Nights</th>}
          <th aria-label="Details" />
        </tr></thead>
        <tbody>
          {list.slice(0, limit).map((r) => (
            <Fragment key={r.id}>
              <tr className={open === r.id ? "open" : undefined}>
                <td className="bk-cell"><b>{r.hotel}</b><div className="small mute">{r.reference}{r.demo && <span className="chip chip-demo">demo</span>}</div></td>
                {on("source") && <td className="small src" title={r.source ?? "direct"}>{r.source ?? <span className="mute">direct</span>}</td>}
                {on("product") && <td><span className="prods">{r.lines.map((l, i) => <span key={i} className={`prod p-${l.category}`} title={CAT[l.category]}><Ico of={ICON[l.category]} size={14} /></span>)}</span></td>}
                {on("tx") && <td><span className={`status st-${r.tx}`}>{r.tx}</span></td>}
                {on("pay") && <td><span className={`status st-${r.pay}`}>{r.pay}</span></td>}
                {on("price") && <td className="n">{money(r.price)}</td>}
                {on("commission") && <td className="n strong">{money(r.commission)}</td>}
                {on("date") && <td className="nowrap">{day(r.date)}</td>}
                {on("stay") && <td className="nowrap">{day(r.checkIn, false)} to {day(r.checkOut)}</td>}
                {on("nights") && <td className="n">{r.nights ?? ""}</td>}
                <td className="n"><button type="button" className="row-x" aria-expanded={open === r.id} aria-label={`Details for ${r.reference}`} onClick={() => setOpen((o) => (o === r.id ? null : r.id))}><Ico of={ChevronDown} size={16} /></button></td>
              </tr>
              {open === r.id && (
                <tr className="tx-detail"><td colSpan={cols}>
                  <table className="lines"><thead><tr><th>Line</th><th className="n">Price</th><th className="n">Our margin</th><th className="n">Card and payout costs</th><th className="n">Your commission</th></tr></thead>
                    <tbody>{r.lines.map((l, i) => <tr key={i}><td><Ico of={ICON[l.category]} size={14} /> {l.info}</td><td className="n">{money(l.price)}</td><td className="n">{money(l.margin)}</td><td className="n">{money(l.costs)}</td><td className="n strong">{money(l.commission)}</td></tr>)}</tbody>
                  </table>
                </td></tr>
              )}
            </Fragment>
          ))}
          {!list.length && <tr><td colSpan={cols} className="empty-cell">{rows.length ? "No booking matches these filters." : "No bookings in this period yet. The first one shows here the moment it is paid."}</td></tr>}
        </tbody>
      </table></div>
      {list.length > limit && <div style={{ textAlign: "center", marginTop: 12 }}><button type="button" className="btn btn-sm" onClick={() => setLimit((l) => l + 50)}>Show {Math.min(50, list.length - limit)} more</button></div>}
    </section>
  );
}
