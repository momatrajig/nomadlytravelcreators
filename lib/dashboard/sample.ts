/**
 * Sample numbers for the public demo dashboard only, so a creator considering Nomadly can see what a year of
 * traffic looks like on every chart and table. Generated in code from a fixed seed (the same every visit), never
 * stored, never mixed with real rows, and always shown under a "Sample data" banner. Real creators never see it.
 */
import type { Click } from "@/lib/db/types";
import { payoutDateFor, type Tx } from "./metrics";

const SOURCES = ["best-hotels-paris", "london-on-a-budget", "dubai-family-guide", "nyc-first-timers", "istanbul-3-days", "rome-where-to-stay", "newsletter", "instagram-bio", null];
const COUNTRIES = ["US", "CA", "GB", "DE", "FR", "AU", "AE", "CZ", "NL", "IE"];
const DEVICES = ["mobile", "mobile", "mobile", "desktop", "desktop", "tablet"];
const EXTRAS: Array<[Tx["category"], string, number, number]> = [["transfer", "Airport ride, Business", 112, 7.5], ["esim", "eSIM, 10 GB, 30 days", 12, 1.2], ["bag", "Bag cover", 9, 1.1], ["delay", "Delay cover", 14, 1.6]];

function rng(seed: number) { return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }; }

export function sampleData(hotels: Array<{ ebcId: number; name: string }>, today: string): { clicks: Click[]; checkouts: Array<{ createdAt: string; ebcId: number }>; txs: Tx[] } {
  const r = rng(20261112);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)]!;
  const clicks: Click[] = [], checkouts: Array<{ createdAt: string; ebcId: number }> = [], txs: Tx[] = [];
  const end = Date.parse(`${today}T00:00:00Z`);
  const hs = hotels.length ? hotels : [{ ebcId: 1, name: "Sample hotel" }];
  let ref = 400000;
  for (let d = 400; d >= 0; d--) {
    const day = end - d * 86_400_000, dow = new Date(day).getUTCDay();
    // growth through the year, a summer and December lift, quieter mid week
    const base = 2 + (400 - d) / 28, season = 1 + 0.18 * Math.sin(((new Date(day).getUTCMonth() + 1) / 12) * Math.PI * 2 - 1.2), week = dow === 0 || dow === 6 ? 1.25 : 0.92;
    const n = Math.max(0, Math.round(base * season * week + (r() - 0.5) * 4));
    for (let i = 0; i < n; i++) {
      const at = new Date(day + Math.floor(r() * 86_400_000)).toISOString();
      const h = pick(hs), src = pick(SOURCES);
      const id = `s${d}-${i}`;
      clicks.push({ id, storefrontId: "sample", createdAt: at, source: src, article: null, target: "hotel", ebcId: h.ebcId, query: null, country: pick(COUNTRIES), device: pick(DEVICES), visitor: r() < 0.22 ? `v${d}-${Math.max(0, i - 1)}` : `v${d}-${i}`, bot: false });
      if (r() < 0.06) {
        checkouts.push({ createdAt: new Date(Date.parse(at) + 4 * 60_000).toISOString(), ebcId: h.ebcId });
        if (r() < 0.42) {
          const nights = 1 + Math.floor(r() * 5), price = Math.round((140 + r() * 280) * nights * 100) / 100;
          const checkIn = new Date(Date.parse(at) + (7 + Math.floor(r() * 80)) * 86_400_000).toISOString().slice(0, 10);
          const checkOut = new Date(Date.parse(checkIn) + nights * 86_400_000).toISOString().slice(0, 10);
          const canceled = r() < 0.08, approved = !canceled && checkOut < today;
          const payDate = payoutDateFor(checkOut);
          const tx: Tx["tx"] = canceled ? "Canceled" : approved ? "Approved" : "Pending";
          const pay: Tx["pay"] = canceled ? "Canceled" : !approved ? "Pending" : payDate <= today ? "Paid" : "Ready";
          const bid = `sample-${ref}`, reference = `NMD ${ref++}`;
          const margin = Math.round(price * 0.11 * 100) / 100, costs = Math.round(price * 0.029 * 100) / 100;
          const base0 = { bookingId: bid, ebcId: h.ebcId, date: new Date(Date.parse(at) + 9 * 60_000).toISOString(), reference, source: src, tx, pay, demo: false, checkOut, checkIn, nights };
          txs.push({ ...base0, id: `${bid}:hotel`, category: "hotel", info: `${h.name}, ${nights} ${nights === 1 ? "night" : "nights"}`, price, margin: canceled ? 0 : margin, costs: canceled ? 0 : costs, commission: canceled ? 0 : Math.round((margin - costs) * 0.6 * 100) / 100 });
          if (r() < 0.38) {
            const [cat, info, xp, xm] = pick(EXTRAS);
            txs.push({ ...base0, id: `${bid}:${cat}`, category: cat, info, price: xp, margin: canceled ? 0 : xm, costs: canceled ? 0 : Math.round(xp * 0.029 * 100) / 100, commission: canceled ? 0 : Math.round(xm * 0.5 * 100) / 100 });
          }
        }
      }
    }
  }
  return { clicks: clicks.reverse(), checkouts, txs: txs.sort((a, b) => b.date.localeCompare(a.date)) };
}
