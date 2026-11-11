import { describe, expect, it } from "vitest";
import { addDays, daysBetween, priceLevels } from "./calendar";

const day = (i: number, price: number | null) => ({ date: `2026-12-${String(i + 1).padStart(2, "0")}`, price });

describe("price calendar", () => {
  it("bands priced days into quarters, cheapest green, dearest red", () => {
    const l = priceLevels([100, 110, 120, 130, 200, 210, 220, 230].map((p, i) => day(i, p)));
    expect(l["2026-12-01"]).toBe("low");
    expect(l["2026-12-03"]).toBe("fair");
    expect(l["2026-12-05"]).toBe("high");
    expect(l["2026-12-08"]).toBe("peak");
  });
  it("leaves sold out days and too little data uncoloured", () => {
    expect(priceLevels([day(0, 100), day(1, null), day(2, 120)])).toEqual({});
    const l = priceLevels([day(0, 100), day(1, null), day(2, 120), day(3, 130), day(4, 140)]);
    expect(l["2026-12-02"]).toBeUndefined();
  });
  it("one price everywhere is neither cheap nor dear", () => {
    expect(new Set(Object.values(priceLevels([0, 1, 2, 3].map((i) => day(i, 150)))))).toEqual(new Set(["fair"]));
  });
  it("walks dates in UTC", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
  });
});
