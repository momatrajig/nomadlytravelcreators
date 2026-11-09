import { describe, expect, it } from "vitest";
import world from "@/lib/ebc/fixtures/world.json";
import plan from "./lina.json";
import { DESTINATIONS, destination } from "./destinations";
import { photoSet, photoSrc, photoThumb } from "@/lib/media/photo";
import { checkedLabel } from "@/lib/format";
import { travelTable } from "@/lib/transit/places";

describe("world content", () => {
  it("every pinned world hotel has licensed high resolution photos and a known destination", () => {
    for (const h of world) {
      expect(h.images.length, h.name).toBeGreaterThanOrEqual(2);
      for (const p of h.images) { expect(p.url).toMatch(/^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/[0-9a-f]\/[0-9a-f]{2}\//); expect(p.license).toBeTruthy(); expect(p.credit).toBeTruthy(); expect(p.w).toBeGreaterThanOrEqual(1280); }
      expect(destination(h.destination), h.name).not.toBeNull();
    }
    expect(plan.pins.length).toBe(23);
  });
  it("seasons reference pinned hotels only", () => {
    const pinned = new Set(plan.pins.map((p) => p.ebcId));
    for (const c of plan.collections) for (const id of c.ebcIds) expect(pinned.has(id)).toBe(true);
  });
  it("every destination has a hero photo and an airport", () => {
    for (const d of DESTINATIONS) { expect(d.hero).toMatch(/^https:\/\/images\.unsplash\.com\/photo-/); expect(d.airport.code).toMatch(/^[A-Z]{3}$/); }
  });
});

describe("photo urls", () => {
  const c = "https://upload.wikimedia.org/wikipedia/commons/7/74/Fa%C3%A7adeThePeninsulaParis.jpg";
  it("uses Commons standard thumbnail widths only, never above the original", () => {
    expect(photoSrc(c, 700)).toBe("https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/Fa%C3%A7adeThePeninsulaParis.jpg/960px-Fa%C3%A7adeThePeninsulaParis.jpg");
    expect(photoSrc(c, 2400)).toContain("/1920px-");
    expect(photoSrc(c, 2400, 1280)).toContain("/1280px-");
    expect(photoSet(c, 1280)).toBe(`${photoSrc(c, 960)} 960w, ${photoSrc(c, 1280)} 1280w`);
    expect(photoThumb(c)).toContain("/330px-");
  });
  it("sizes Unsplash with imgix parameters", () => {
    expect(photoSrc("https://images.unsplash.com/photo-1", 1600)).toBe("https://images.unsplash.com/photo-1?w=1600&q=78&auto=format&fit=crop");
  });
});

describe("checked label never says today for an older read", () => {
  const now = Date.parse("2026-11-09T10:00:00Z");
  it("labels", () => {
    expect(checkedLabel("2026-11-09T08:12:00Z", now)).toMatch(/today$/);
    expect(checkedLabel("2026-11-08T17:12:00Z", now)).toMatch(/^checked yesterday at/);
    expect(checkedLabel("2026-11-01T17:12:00Z", now)).toBe("checked Sun 1 Nov");
  });
});

describe("travel times outside Lisbon", () => {
  it("Paris: rush hour is slower than midday, and the RER is closed at 03:00", () => {
    const mid = travelTable("paris", 48.8705, 2.2933, 13 * 60)!, rush = travelTable("paris", 48.8705, 2.2933, 8 * 60)!, night = travelTable("paris", 48.8705, 2.2933, 3 * 60)!;
    const ride = (t: typeof mid) => t.rows[0]!.legs.find((l) => l.mode === "ride")!.minutes!;
    expect(ride(rush)).toBeGreaterThan(ride(mid));
    expect(night.rows[0]!.legs.find((l) => l.mode === "metro")!.available).toBe(false);
    expect(mid.rows[0]!.place.via).toBe("RER B");
  });
  it("Marrakech has no rail, taxi only to the airport", () => {
    expect(travelTable("marrakech", 31.6215, -7.9988, 600)!.rows[0]!.legs.map((l) => l.mode)).toEqual(["ride"]);
  });
});
