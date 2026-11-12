import { describe, expect, it } from "vitest";
import { kindOf, parseCsv, parseStay22, project } from "./stay22";

const STATS = `﻿campaign_id,campaign_name,inits,redirects,bookings_processing,bookings_cancelled,bookings_paid,ecpc,total_profit,bookings_pending_payment
594,Expedia,0,17549,0,2,0,0,0,0
47,Viator,2083,16926,0,15,18,0.01,232.53,0
121,Trip.com,489,4510,0,2,4,0,15.53,0
84,Booking.com,0,3863,0,1,2,0.01,25.06,0
149,"Tripadvisor – Experiences",0,1235,0,0,1,0,1.71,0
104,Agoda,912,285,0,0,0,0,0,0`;

describe("Stay22 import", () => {
  it("reads quoted CSV with a BOM, semicolons and CRLF", () => {
    expect(parseCsv('a;b\r\n"x;1";"he said ""hi"""\r\n')).toEqual([["a", "b"], ["x;1", 'he said "hi"']]);
  });
  it("tells hotels from tours", () => {
    expect(["Booking.com", "Expedia", "Trip.com", "Agoda", "Vrbo", "Hotels.com"].every((p) => kindOf(p) === "hotel")).toBe(true);
    expect(["Viator", "GetYourGuide", "Klook", "DiscoverCars", "Kiwi.com", "Tripadvisor – Experiences", "Tiqets"].every((p) => kindOf(p) === "other")).toBe(true);
  });
  it("parses the performance export", () => {
    const p = parseStay22(STATS);
    expect(p.format).toBe("campaigns");
    const hotels = p.rows.filter((r) => r.kind === "hotel");
    expect(hotels.map((r) => r.provider)).toEqual(["Expedia", "Trip.com", "Booking.com", "Agoda"]);
    expect(hotels.reduce((a, r) => a + r.clicks, 0)).toBe(26207);
    expect(hotels.reduce((a, r) => a + r.bookings, 0)).toBe(6);
    expect(p.rows.find((r) => r.provider === "Viator")).toMatchObject({ kind: "other", bookings: 18, canceled: 15, commission: 232.53 });
  });
  it("parses a transactions export and leaves canceled ones out", () => {
    const p = parseStay22(`Source,Provider,Campaign IDs,Transaction status,Payment status,Commission,Transaction date,Start date,End date,Quantity
LMA,Booking.com,"a, b",Approved,Pending,$18.70,"Oct 19, 2026",Nov 05 2026,Nov 08 2026,3
LMA,Booking.com,a,Cancelled,Pending,$5.00,"Oct 20, 2026",,,1
LMA,,a,Approved,Paid,$3.25,"Oct 21, 2026",,,1`);
    expect(p.format).toBe("transactions");
    expect(p.rows.find((r) => r.provider === "Booking.com")).toMatchObject({ bookings: 1, canceled: 1, commission: 18.7 });
    expect(p.period).toEqual({ from: "2026-10-19", to: "2026-10-21" });
    expect(p.warnings[0]).toMatch(/no provider name/);
  });
  it("refuses a file that is not a Stay22 export", () => {
    expect(() => parseStay22("name,age\nx,1")).toThrow(/Stay22 export/);
  });
  it("projects the same bookings on Nomadly at both of our prices", () => {
    const p = project({ clicks: 1000, bookings: 10, commission: 100 }, 400);
    expect(p.theirs).toMatchObject({ perBooking: 10, epc: 0.1 });
    expect(p.ours[0]!.perBooking).toBeGreaterThan(p.ours[1]!.perBooking);
    expect(p.ours[0]!.total).toBeCloseTo(p.ours[0]!.perBooking * 10, 1);
    expect(p.ours[0]!.vsTheirs).toBeGreaterThan(0);
  });
});
