import { describe, expect, it } from "vitest";
import { sampleData } from "./sample";

describe("sample data", () => {
  it("is the same every time and only ever dated up to today", () => {
    const a = sampleData([{ ebcId: 1, name: "A" }], "2026-11-12"), b = sampleData([{ ebcId: 1, name: "A" }], "2026-11-12");
    expect(a.clicks.length).toBe(b.clicks.length);
    expect(a.txs.length).toBeGreaterThan(50);
    expect(a.clicks.every((c) => c.createdAt < "2026-11-13")).toBe(true);
    expect(a.txs.filter((t) => t.tx === "Canceled").every((t) => t.commission === 0)).toBe(true);
  });
});
