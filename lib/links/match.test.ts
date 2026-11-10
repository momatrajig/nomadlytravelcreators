import { describe, expect, it } from "vitest";
import { bestMatch, cityQuery, displayName, normName, score } from "./match";

const rows = [
  "PROVIDENCE HOTEL", "LE PAVILLON DE LA REINE AND SPA", "PAVILLON BASTILLE HOTEL", "HOTEL DES GRANDS HOMMES", "LE PAVILLON HOTEL",
  "HOBOU(ALSO KNOWN AS HOTEL ACANTHE/QUALITY HOTEL ACANTHE BOULOGNE BILLANCOURT)", "PAVILLON OPERA BOURSE HOTEL", "PAVILLON OPERA GRANDS BOULEVARDS HOTEL",
].map((name, i) => ({ id: i, name, norm: normName(name) }));

describe("hotel name matching", () => {
  it("finds the hotels named in the Paris article", () => {
    expect(bestMatch("Hôtel Providence", rows)?.row.name).toBe("PROVIDENCE HOTEL");
    expect(bestMatch("Le Pavillon de la Reine", rows)?.row.name).toBe("LE PAVILLON DE LA REINE AND SPA");
    expect(bestMatch("Hôtel des Grands Hommes", rows)?.row.name).toBe("HOTEL DES GRANDS HOMMES");
    expect(bestMatch("Hôbou", rows)?.row.name).toMatch(/^HOBOU/);
  });
  it("does not guess between similar names", () => {
    expect(bestMatch("Pavillon Opera", rows)).toBeNull();
    expect(bestMatch("Hôtel Ritz", rows)).toBeNull();
  });
  it("matches a former name", () => {
    expect(score("Hotel Acanthe", normName(rows[5]!.name))).toBeGreaterThan(0.3);
  });
});

describe("places and names", () => {
  it("reads Czech place names", () => {
    expect(cityQuery("Paříž, Francie")).toBe("Paris");
    expect(cityQuery("Řím")).toBe("Rome");
    expect(cityQuery("Benátky, Itálie")).toBe("Venice");
    expect(cityQuery("Funchal, Madeira")).toBe("Funchal");
    expect(cityQuery("")).toBeNull();
  });
  it("writes supplier names the way people do", () => {
    expect(displayName("HOTEL DES GRANDS HOMMES")).toBe("Hotel des Grands Hommes");
    expect(displayName("HOBOU(ALSO KNOWN AS HOTEL ACANTHE)")).toBe("Hobou");
  });
});
