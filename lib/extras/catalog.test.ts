import { describe, expect, it } from "vitest";
import { EXTRAS } from "./catalog";
import { extraLedger } from "@/lib/pricing/engine";

describe("extras", () => {
  it("every extra is cheaper than elsewhere and the creator gets half of the net commission", () => {
    for (const x of EXTRAS) {
      expect(x.price).toBeLessThan(x.elsewhere);
      const l = extraLedger(x.price, x.commission);
      expect(l.creatorShare).toBe(Math.round(Math.max(l.net, 0) * 50) / 100);
      expect(l.creatorShare + l.nomadlyKeeps).toBeCloseTo(l.net, 2);
    }
  });
});
