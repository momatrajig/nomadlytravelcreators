import { describe, expect, it } from "vitest";
import { bookingClosedReason } from "./guard";

const base: { EBC_MODE: string; STRIPE_SECRET_KEY?: string } = { EBC_MODE: "mock", STRIPE_SECRET_KEY: "sk_test_x" };
describe("booking lock", () => {
  it("simulator with test payments is open (nothing real is reserved)", () => expect(bookingClosedReason(base)).toBeNull());
  it("live supplier with test payments is closed", () => expect(bookingClosedReason({ ...base, EBC_MODE: "live" })).toMatch(/not open/));
  it("live supplier with no Stripe key is closed", () => expect(bookingClosedReason({ ...base, EBC_MODE: "live", STRIPE_SECRET_KEY: undefined })).toMatch(/not open/));
  it("live supplier with live payments is open", () => expect(bookingClosedReason({ ...base, EBC_MODE: "live", STRIPE_SECRET_KEY: "sk_live_x" })).toBeNull());
});
