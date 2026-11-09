import { describe, expect, it } from "vitest";
import { bookingMode } from "./guard";

describe("booking mode", () => {
  it("simulator: real (the simulator reserves nothing)", () => expect(bookingMode({ EBC_MODE: "mock", STRIPE_SECRET_KEY: "sk_test_x" })).toBe("real"));
  it("live supplier with test payments: demo", () => expect(bookingMode({ EBC_MODE: "live", STRIPE_SECRET_KEY: "sk_test_x" })).toBe("demo"));
  it("live supplier with no Stripe key: demo", () => expect(bookingMode({ EBC_MODE: "live" })).toBe("demo"));
  it("live supplier with live payments: real", () => expect(bookingMode({ EBC_MODE: "live", STRIPE_SECRET_KEY: "sk_live_x" })).toBe("real"));
});
