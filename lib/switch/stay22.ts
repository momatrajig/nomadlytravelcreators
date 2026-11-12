/**
 * "Switch from Stay22": reads the files a creator can export from Stay22 and compares what their hotel traffic
 * earned there with what the same bookings earn on Nomadly. Pure functions, run in the browser: the file never
 * leaves the creator's computer.
 *
 * Two Stay22 exports are understood:
 *  - Performance by campaign (stats_overall.csv): campaign_name, redirects, bookings_paid, bookings_processing,
 *    bookings_cancelled, total_profit, ...
 *  - Transactions: Provider, Transaction status, Commission, Start date, End date, Quantity, ...
 * Column names are matched loosely (case, spaces, underscores), so small format changes do not break it.
 */
import { stayLedger, HOTEL_SHARE, DEFAULT_MARKUP, MIN_MARKUP } from "@/lib/pricing/engine";

export type Kind = "hotel" | "other";
/** providers whose links Nomadly replaces (stays); everything else (tours, cars, flights) the creator keeps */
const HOTEL = /booking|expedia|hotels\.?com|trip\.?com|agoda|vrbo|priceline|hostelworld|kayak|marriott|hilton|accor|ihg|hyatt|lastminute|hotelbeds|airbnb|plum ?guide|homestay|tripadvisor(?!.*experien)/i;
export const kindOf = (provider: string): Kind => (HOTEL.test(provider) ? "hotel" : "other");

export interface ProviderRow { provider: string; kind: Kind; clicks: number; bookings: number; canceled: number; commission: number }
export interface Parsed { format: "campaigns" | "transactions"; rows: ProviderRow[]; period: { from: string | null; to: string | null }; warnings: string[] }

/** RFC 4180 CSV (quotes, escaped quotes, CRLF, BOM), comma or semicolon separated */
export function parseCsv(text: string): string[][] {
  const t = text.replace(/^﻿/, "");
  const firstLine = t.slice(0, t.indexOf("\n") === -1 ? t.length : t.indexOf("\n"));
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : t.includes("\t") && !firstLine.includes(",") ? "\t" : ",";
  const out: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]!;
    if (q) {
      if (ch === '"' && t[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && t[i + 1] === "\n") i++; row.push(cell); cell = ""; if (row.some((c) => c.trim() !== "")) out.push(row); row = []; }
    else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) out.push(row);
  return out;
}

const key = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");
const num = (v: string | undefined) => {
  if (v == null) return 0;
  const s = v.replace(/[^0-9.,-]/g, "");
  // "1.234,56" (European) vs "1,234.56"
  const n = s.includes(",") && s.lastIndexOf(",") > s.lastIndexOf(".") ? Number(s.replace(/\./g, "").replace(",", ".")) : Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const isoDay = (v: string | undefined): string | null => {
  const t = v?.trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const dmy = t.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]!.padStart(2, "0")}-${dmy[1]!.padStart(2, "0")}`;
  // "Oct 19, 2026" read as a UTC calendar day, whatever the computer's time zone
  const d = Date.parse(`${t} UTC`);
  return Number.isNaN(d) ? null : new Date(d).toISOString().slice(0, 10);
};

export function parseStay22(text: string): Parsed {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error("The file has no rows. Export it again from Stay22 and pick that file.");
  const head = rows[0]!.map(key);
  const col = (...names: string[]) => { for (const n of names) { const i = head.indexOf(key(n)); if (i >= 0) return i; } return -1; };
  const warnings: string[] = [];

  // Performance by campaign
  const cName = col("campaign_name", "campaign", "provider_name"), cRedir = col("redirects", "clicks"), cPaid = col("bookings_paid"), cProc = col("bookings_processing"), cCanc = col("bookings_cancelled", "bookings_canceled"), cProfit = col("total_profit", "profit", "commission");
  if (cName >= 0 && cRedir >= 0 && (cPaid >= 0 || cProfit >= 0)) {
    const pend = head.findIndex((h) => h.startsWith("bookingspending"));
    const out: ProviderRow[] = rows.slice(1).filter((r) => (r[cName] ?? "").trim()).map((r) => {
      const provider = r[cName]!.trim();
      return {
        provider, kind: kindOf(provider), clicks: num(r[cRedir]),
        bookings: num(r[cPaid]) + (cProc >= 0 ? num(r[cProc]) : 0) + (pend >= 0 ? num(r[pend]) : 0),
        canceled: cCanc >= 0 ? num(r[cCanc]) : 0, commission: cProfit >= 0 ? num(r[cProfit]) : 0,
      };
    });
    return { format: "campaigns", rows: out, period: { from: null, to: null }, warnings };
  }

  // Transactions
  const tProv = col("provider", "partner", "merchant"), tCom = col("commission", "commission_usd", "earnings"), tStatus = col("transaction status", "status"), tDate = col("transaction date", "date", "created");
  if (tProv >= 0 && tCom >= 0) {
    const by = new Map<string, ProviderRow>();
    let from: string | null = null, to: string | null = null, blank = 0;
    for (const r of rows.slice(1)) {
      let provider = (r[tProv] ?? "").trim();
      if (!provider) { blank++; provider = "Unknown provider"; }
      const canceled = tStatus >= 0 && /cancel|declin|reject/i.test(r[tStatus] ?? "");
      const row = by.get(provider) ?? { provider, kind: kindOf(provider), clicks: 0, bookings: 0, canceled: 0, commission: 0 };
      if (canceled) row.canceled++; else { row.bookings++; row.commission += num(r[tCom]); }
      by.set(provider, row);
      const d = tDate >= 0 ? isoDay(r[tDate]) : null;
      if (d) { if (!from || d < from) from = d; if (!to || d > to) to = d; }
    }
    if (blank) warnings.push(`${blank} rows had no provider name (Stay22 shows some providers as a logo only). They count as "Unknown provider"; set them below.`);
    warnings.push("A transactions export has no click counts. Add your clicks below, or upload the performance export (stats_overall.csv) for those.");
    return { format: "transactions", rows: [...by.values()].map((r) => ({ ...r, commission: Math.round(r.commission * 100) / 100 })), period: { from, to }, warnings };
  }
  throw new Error("This does not look like a Stay22 export. Use Performance (by campaign) or Transactions, then Export.");
}

export interface Projection {
  theirs: { clicks: number; bookings: number; commission: number; perBooking: number; epc: number | null };
  ours: Array<{ label: string; markup: number; perBooking: number; total: number; epc: number | null; vsTheirs: number | null }>;
}

/**
 * The same hotel bookings at the same average booking value, earned on Nomadly. Two prices are shown: our
 * standard price (default markup) and the floor price we drop to when we must match a cheaper OTA. Same number of
 * bookings is an assumption, stated on the page: our conversion is not known until the creator's links run on us.
 */
export function project(hotel: { clicks: number; bookings: number; commission: number }, avgValue: number, share = HOTEL_SHARE, markups = [DEFAULT_MARKUP, MIN_MARKUP]): Projection {
  const perB = hotel.bookings ? hotel.commission / hotel.bookings : 0;
  const theirs = { ...hotel, perBooking: Math.round(perB * 100) / 100, epc: hotel.clicks ? Math.round((hotel.commission / hotel.clicks) * 100) / 100 : null };
  const ours = markups.map((m) => {
    const l = avgValue > 0 ? stayLedger(avgValue / (1 + m), m, share) : null;
    const per = l ? l.creatorShare : 0, total = Math.round(per * hotel.bookings * 100) / 100;
    return { label: m === DEFAULT_MARKUP ? "Our standard price" : "Our lowest price, when we match a cheaper site", markup: m, perBooking: per, total, epc: hotel.clicks ? Math.round((total / hotel.clicks) * 100) / 100 : null, vsTheirs: hotel.commission > 0 ? total / hotel.commission - 1 : null };
  });
  return { theirs, ours };
}
