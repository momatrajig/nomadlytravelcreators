import { describe, expect, it } from "vitest";
import { performance } from "./perf";
import { parseRange } from "./range";
import type { Click } from "@/lib/db/types";
import type { Tx } from "./metrics";

const click = (id: string, at: string, o: Partial<Click> = {}): Click => ({ id, storefrontId: "s", createdAt: at, source: null, article: null, target: "hotel", ebcId: 1, query: null, country: "CA", device: "mobile", visitor: id, bot: false, ...o });
const tx = (id: string, at: string, o: Partial<Tx> = {}): Tx => ({ id: `${id}:hotel`, bookingId: id, ebcId: 1, date: at, reference: id, category: "hotel", info: "H", source: null, price: 500, margin: 50, costs: 10, commission: 20, tx: "Pending", pay: "Pending", demo: false, checkOut: "2026-12-01", ...o });

describe("performance", () => {
  const r = parseRange({ from: "2026-11-01", to: "2026-11-07" }, "2026-11-12");
  const clicks = [click("a", "2026-11-01T10:00:00Z", { source: "nyc" }), click("b", "2026-11-03T10:00:00Z", { source: "nyc", visitor: "a" }), click("c", "2026-11-05T10:00:00Z"), click("bot", "2026-11-05T10:00:00Z", { bot: true }), click("old", "2026-10-28T10:00:00Z")];
  const checkouts = [{ createdAt: "2026-11-03T11:00:00Z", ebcId: 1 }, { createdAt: "2026-11-05T11:00:00Z", ebcId: 2 }];
  const txs = [tx("b1", "2026-11-03T12:00:00Z", { source: "nyc" }), tx("b1x", "2026-11-03T12:00:00Z", { bookingId: "b1", category: "esim", commission: 2, price: 12, source: "nyc" }), tx("b2", "2026-11-06T12:00:00Z", { tx: "Canceled", commission: 0 }), tx("d", "2026-11-04T12:00:00Z", { demo: true })];
  const p = performance(clicks, checkouts, txs, r, { includeDemo: false, hotelName: (id) => `Hotel ${id}` });

  it("totals leave out bots, other dates, demo and canceled money", () => {
    expect(p.totals).toMatchObject({ clicks: 3, visitors: 2, checkouts: 2, bookings: 1, commission: 22, value: 512, canceled: 1, addOns: 1 });
    expect(p.prev.clicks).toBe(1);
  });
  it("a series point per day and the funnel", () => {
    expect(p.series).toHaveLength(7);
    expect(p.series[2]).toMatchObject({ start: "2026-11-03", clicks: 1, checkouts: 1, bookings: 1, commission: 22 });
    expect(p.funnel).toEqual({ clicks: 3, checkouts: 2, bookings: 1 });
  });
  it("breaks down by source, hotel, country and device", () => {
    expect(p.bySource[0]).toMatchObject({ key: "nyc", clicks: 2, bookings: 1, commission: 22, epc: 11 });
    expect(p.byHotel.find((h) => h.key === "2")).toMatchObject({ label: "Hotel 2", checkouts: 1, clicks: 0 });
    expect(p.byCountry[0]).toMatchObject({ label: "Canada", clicks: 3 });
    expect(p.byDevice[0]).toMatchObject({ label: "Mobile", clicks: 3 });
  });
});
