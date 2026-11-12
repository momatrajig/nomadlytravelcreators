import { describe, expect, it } from "vitest";
import { bucketOf, buckets, parseRange } from "./range";

describe("dashboard range", () => {
  it("defaults to the last 30 days, both ends included, grouped by day", () => {
    const r = parseRange({}, "2026-11-12");
    expect([r.from, r.to, r.days, r.grain, r.preset]).toEqual(["2026-10-14", "2026-11-12", 30, "day", "30d"]);
    expect(r.prev).toMatchObject({ from: "2026-09-14", to: "2026-10-13" });
    expect(r.untilIso).toBe("2026-11-13T00:00:00.000Z");
  });
  it("year to date, 12 months group by week and month", () => {
    expect(parseRange({ r: "ytd" }, "2026-11-12")).toMatchObject({ from: "2026-01-01", grain: "month" });
    expect(parseRange({ r: "90d" }, "2026-11-12").grain).toBe("week");
  });
  it("takes a custom range, clamps the future and ignores garbage", () => {
    expect(parseRange({ from: "2026-03-01", to: "2027-01-01" }, "2026-11-12")).toMatchObject({ from: "2026-03-01", to: "2026-11-12", preset: null });
    expect(parseRange({ from: "2026-05-01", to: "2026-04-01" }, "2026-11-12").preset).toBe("30d");
    expect(parseRange({ from: "x", to: "y", g: "hour" }, "2026-11-12").grain).toBe("day");
    expect(parseRange({ r: "7d", g: "month" }, "2026-11-12").grain).toBe("month");
  });
  it("buckets by Monday weeks and calendar months", () => {
    expect(buckets("2026-11-04", "2026-11-12", "week")).toEqual(["2026-11-02", "2026-11-09"]);
    expect(buckets("2026-01-15", "2026-03-02", "month")).toEqual(["2026-01-01", "2026-02-01", "2026-03-01"]);
    expect(bucketOf("2026-11-08T23:00:00Z", "week")).toBe("2026-11-02");
    expect(bucketOf("2026-11-09T01:00:00Z", "week")).toBe("2026-11-09");
  });
});
