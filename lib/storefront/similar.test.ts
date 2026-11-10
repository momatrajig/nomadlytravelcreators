import { describe, expect, it } from "vitest";
import { km, rankNearby } from "./similar";
import type { DirectoryHotel } from "@/lib/db/types";

const row = (ebcId: number, lat: number, lng: number, stars: number | null): DirectoryHotel => ({ ebcId, name: `H${ebcId}`, norm: `h${ebcId}`, cityId: 1, address: null, zip: null, stars, lat, lng });

describe("similar stays nearby", () => {
  const pick = { ebcId: 1, lat: 48.8693, lng: 2.3566, stars: 4 };
  it("measures distance in km", () => {
    expect(km(48.8693, 2.3566, 48.8693, 2.3566)).toBe(0);
    expect(km(48.8566, 2.3522, 48.8584, 2.2945)).toBeCloseTo(4.2, 1);
  });
  it("keeps the same class within the radius, nearest first, never the pick or the creator's own hotels", () => {
    const rows = [row(1, 48.8693, 2.3566, 4), row(2, 48.875, 2.36, 4), row(3, 48.87, 2.357, 5), row(4, 48.87, 2.357, 2), row(5, 48.80, 2.30, 4), row(6, 48.8695, 2.3568, 3), row(7, 48.8694, 2.3567, 4)];
    const r = rankNearby(pick, rows, new Set([7]));
    expect(r.map((x) => x.ebcId)).toEqual([6, 3, 2]);
    expect(r[0]!.km).toBeLessThan(r[2]!.km);
  });
  it("leaves out flats and rooms listed as hotels", () => {
    expect(rankNearby(pick, [row(9, 48.87, 2.357, 4), { ...row(10, 48.87, 2.357, 4), name: "Exclusive Loft In le Marais" }, { ...row(12, 48.87, 2.357, 4), name: "Blue Nights Appartements 108" }, { ...row(11, 48.87, 2.357, 4), name: "5 Rue de Moussy" }], new Set()).map((x) => x.ebcId)).toEqual([9]);
  });
  it("any class when the pick has no stars", () => {
    expect(rankNearby({ ...pick, stars: null }, [row(4, 48.87, 2.357, 2), row(8, 48.87, 2.357, null)], new Set()).map((x) => x.ebcId)).toEqual([4, 8]);
  });
});
