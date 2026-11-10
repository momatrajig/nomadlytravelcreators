import { describe, expect, it } from "vitest";
import { airportsFor, priceExtra, recommendedCar, recommendedPlan } from "./catalog";
import { requestComments, splitPhone } from "@/lib/booking/service";

const paris = { destination: "paris", adults: 2, nights: 3 };

describe("configurable services", () => {
  it("prices a ride by car class, airport and direction", () => {
    expect(priceExtra({ kind: "transfer" }, paris)).toMatchObject({ option: "standard", price: 78, commission: 27.3 });
    expect(priceExtra({ kind: "transfer", option: "business", airport: "ORY" }, paris).price).toBe(Math.round(112 * 0.85));
    const both = priceExtra({ kind: "transfer", option: "standard", airport: "CDG", direction: "both", flight: "af 1234" }, paris);
    expect(both.price).toBe(156);
    expect(both.detail).toContain("Charles de Gaulle (CDG) and back");
    expect(both.detail).toContain("flight AF 1234");
  });
  it("refuses what is not offered: a foreign airport, a car too small, an unknown plan, a bad flight", () => {
    expect(() => priceExtra({ kind: "transfer", airport: "LHR" }, paris)).toThrow(RangeError);
    expect(() => priceExtra({ kind: "transfer", option: "first" }, { ...paris, adults: 3 })).toThrow(/seats 2/);
    expect(() => priceExtra({ kind: "esim", option: "999gb" }, paris)).toThrow(RangeError);
    expect(() => priceExtra({ kind: "transfer", flight: "DROP TABLE" }, paris)).toThrow(RangeError);
  });
  it("recommends the plan and car that fit the trip", () => {
    expect(recommendedPlan(3)).toBe("5gb-7d");
    expect(recommendedPlan(7)).toBe("10gb-30d");
    expect(recommendedPlan(20)).toBe("20gb-30d");
    expect(recommendedCar(2)).toBe("standard");
    expect(recommendedCar(5)).toBe("van");
    expect(priceExtra({ kind: "transfer" }, { ...paris, adults: 5 }).option).toBe("van");
  });
  it("eSIMs up to one per traveler", () => {
    expect(priceExtra({ kind: "esim", option: "10gb-30d", qty: 2 }, paris).price).toBe(24);
    expect(priceExtra({ kind: "esim", option: "10gb-30d", qty: 9 }, paris).price).toBe(24);
  });
  it("falls back to the nearest airport where we list none", () => {
    expect(airportsFor("nowhere")[0]!.name).toBe("Nearest airport");
    expect(priceExtra({ kind: "transfer" }, { ...paris, destination: null }).price).toBe(78);
  });
});

describe("hotel requests", () => {
  it("writes one line of comments for the hotel", () => {
    expect(requestComments({ items: ["early_checkin", "quiet"], note: "Anniversary trip", arrival: "11:00", bookedFor: "self", booker: null }))
      .toBe("Early check-in if possible. Quiet room. Arrival around 11:00. Anniversary trip. Requests subject to availability.");
    expect(requestComments({ items: [], note: "  ", arrival: null, bookedFor: "self", booker: null })).toBeNull();
    expect(requestComments(null)).toBeNull();
  });
  it("splits a phone number into dial code and number", () => {
    expect(splitPhone("+420 777 123 456")).toEqual({ phonePrefix: "+420", phone: "777123456" });
    expect(splitPhone("+1 (212) 555-1234")).toEqual({ phonePrefix: "+1", phone: "2125551234" });
    expect(splitPhone(null)).toEqual({});
  });
});
