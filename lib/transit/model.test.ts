import { describe, expect, it } from "vitest";
import { LISBON, bandFor, estimate, parseHHMM } from "./model";

describe("time of day travel model", () => {
  it("places times in the right band", () => {
    expect(bandFor(LISBON, parseHHMM("08:15")).key).toBe("amrush");
    expect(bandFor(LISBON, parseHHMM("17:30")).key).toBe("pmrush");
    expect(bandFor(LISBON, parseHHMM("02:00")).key).toBe("night");
    expect(bandFor(LISBON, parseHHMM("23:30")).key).toBe("late");
  });
  it("rush hour makes the airport ride slower, night faster", () => {
    const base = 20;
    expect(estimate(LISBON, "ride", base, parseHHMM("08:00")).minutes).toBe(32);
    expect(estimate(LISBON, "ride", base, parseHHMM("03:00")).minutes).toBe(16);
    expect(estimate(LISBON, "ride", base, parseHHMM("12:00")).minutes).toBe(20);
  });
  it("metro is closed at night and carries a wait otherwise", () => {
    expect(estimate(LISBON, "metro", 25, parseHHMM("02:30")).available).toBe(false);
    const e = estimate(LISBON, "metro", 25, parseHHMM("22:00"));
    expect(e.available).toBe(true);
    expect(e.minutes).toBe(32);
    // 00:30 is before the 01:00 close
    expect(estimate(LISBON, "metro", 25, parseHHMM("00:30")).available).toBe(true);
  });
  it("walking does not change", () => {
    expect(estimate(LISBON, "walk", 12, parseHHMM("08:00")).minutes).toBe(12);
  });
  it("rejects bad times", () => {
    expect(() => parseHHMM("25:00")).toThrow();
  });
});
