import { describe, expect, it } from "vitest";
import { feeNow, freeNow } from "./policy";

describe("free cancellation is only free while it is", () => {
  const now = Date.parse("2026-11-11T12:00:00Z");
  it("free before the deadline, a fee after it, never for a non refundable rate", () => {
    expect(freeNow({ refundable: true, cancelDeadline: "2026-12-05T23:59:00" }, now)).toBe(true);
    expect(freeNow({ refundable: true, cancelDeadline: "2026-11-07T17:17:00" }, now)).toBe(false);
    expect(feeNow({ refundable: true, cancelDeadline: "2026-11-07T17:17:00" }, now)).toBe(true);
    expect(freeNow({ refundable: false, cancelDeadline: null }, now)).toBe(false);
    expect(freeNow({ refundable: true, cancelDeadline: null }, now)).toBe(true);
  });
});
