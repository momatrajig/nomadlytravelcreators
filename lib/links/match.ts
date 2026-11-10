/**
 * Hotel and city name matching for creator links. Pure functions, unit tested.
 *
 * A creator's article names a hotel the way readers know it ("Hôtel des Grands Hommes") and a place in the
 * article's language ("Paříž, Francie"). The supplier lists "HOTEL DES GRANDS HOMMES" in "Paris", often with
 * former names in brackets ("HOBOU(ALSO KNOWN AS HOTEL ACANTHE ...)"). Matching runs on accent free word sets.
 */

const STOP = new Set(["hotel", "hotels", "hôtel", "the", "and", "spa", "le", "la", "les", "l", "de", "des", "du", "d", "by", "a", "et", "&", "paris", "boutique", "resort", "il", "el", "da", "di", "der", "die", "das", "am", "an", "of", "formerly", "also", "known", "as"]);

export const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[^a-z0-9]+/g, " ").trim();
export const words = (s: string) => fold(s).split(" ").filter((w) => w && !STOP.has(w));

/** the name and every former name in brackets, as separate candidates */
export function aliases(supplierName: string): string[] {
  const out = [supplierName.replace(/\(.*$/s, "")];
  const inner = /\((.*)\)?/s.exec(supplierName)?.[1];
  if (inner) out.push(...inner.replace(/also known as|formerly|ex\b/gi, "").split(/[/,:]| or /i));
  return out.map((x) => x.trim()).filter(Boolean);
}

/** directory norm: every alias folded, joined by " | " */
export const normName = (supplierName: string) => aliases(supplierName).map(fold).join(" | ");

/** 0..1: every query word must appear in one alias; then the share of that alias the query covers */
export function score(query: string, norm: string): number {
  const q = words(query);
  if (!q.length) return 0;
  let best = 0;
  for (const alias of norm.split(" | ")) {
    const a = alias.split(" ").filter((w) => w && !STOP.has(w));
    if (!a.length) continue;
    if (q.every((w) => a.includes(w))) best = Math.max(best, q.length / a.length);
    else {
      // tolerate one missing word in long names ("Hotel Le Pavillon de la Reine Paris")
      const hit = q.filter((w) => a.includes(w)).length;
      if (q.length >= 3 && hit === q.length - 1) best = Math.max(best, (hit / a.length) * 0.6);
    }
  }
  return best;
}

export function bestMatch<T extends { norm: string }>(query: string, rows: T[], min = 0.5): { row: T; score: number } | null {
  let top: { row: T; score: number } | null = null, second = 0;
  for (const r of rows) {
    const s = score(query, r.norm);
    if (!top || s > top.score) { second = top?.score ?? 0; top = { row: r, score: s }; }
    else if (s > second) second = s;
  }
  if (!top || top.score < min) return null;
  // an exact name wins; otherwise the best must clearly beat the next one, or we do not guess
  if (top.score < 1 - 1e-9 && top.score - second < 0.25) return null;
  return top;
}

/** Place names as Czech (and a few other) articles write them, to the supplier's English city names. */
const EXONYMS: Record<string, string> = {
  pariz: "Paris", rim: "Rome", londyn: "London", benatky: "Venice", viden: "Vienna", mnichov: "Munich", lisabon: "Lisbon", atény: "Athens", ateny: "Athens",
  florencie: "Florence", neapol: "Naples", milan: "Milan", krakov: "Krakow", budapest: "Budapest", berlin: "Berlin", drazdany: "Dresden", amsterodam: "Amsterdam",
  brusel: "Brussels", kodan: "Copenhagen", stockholm: "Stockholm", stokholm: "Stockholm", dubaj: "Dubai", istanbul: "Istanbul", nice: "Nice", dubrovnik: "Dubrovnik",
  janov: "Genoa", turin: "Turin", bruggy: "Bruges", lublan: "Ljubljana", lublana: "Ljubljana", varsava: "Warsaw", vratislav: "Wroclaw", kolin: "Cologne", "kolin nad rynem": "Cologne",
  cury: "Zurich", curych: "Zurich", zeneva: "Geneva", sevilla: "Seville", "new york": "New York", "novy york": "New York", pekin: "Beijing", soul: "Seoul", tokio: "Tokyo",
  bangkok: "Bangkok", praha: "Prague", brno: "Brno", bratislava: "Bratislava", salcburk: "Salzburg", innsbruck: "Innsbruck", edinburgh: "Edinburgh", dublin: "Dublin",
  barcelona: "Barcelona", madrid: "Madrid", valencie: "Valencia", malaga: "Malaga", porto: "Porto", marrakes: "Marrakech", kahira: "Cairo", jeruzalem: "Jerusalem",
  krakow: "Krakow", gdansk: "Gdansk", split: "Split", zadar: "Zadar", kreta: "Crete", korfu: "Corfu", rhodos: "Rhodes", santorini: "Santorini", mallorca: "Mallorca", malorka: "Mallorca",
};

/** "Paříž, Francie" -> "Paris"; unknown names pass through with their accents removed */
export function cityQuery(address: string | null | undefined): string | null {
  if (!address) return null;
  const first = address.split(",")[0]!.trim();
  if (!first) return null;
  const k = fold(first);
  return EXONYMS[k] ?? EXONYMS[k.replace(/ /g, "")] ?? first.normalize("NFD").replace(/\p{M}/gu, "");
}

/** Supplier names are upper case; show them the way a person writes them. */
export function displayName(supplierName: string): string {
  const base = aliases(supplierName)[0] ?? supplierName;
  return base.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_, p: string, c: string) => p + c.toUpperCase()).replace(/\b(And|De|La|Le|Des|Du|Of|The)\b/g, (w, _1, i) => (i === 0 ? w : w.toLowerCase())).trim();
}
