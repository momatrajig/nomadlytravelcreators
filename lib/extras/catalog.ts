/**
 * Veny services sold alongside a stay, as configurable products: a ride is an airport, a direction and a car
 * class; an eSIM is a data plan; covers are flat. The server prices every pick from this file (the browser only
 * sends choices), and the creator earns half of the net commission on each (lib/pricing/engine extraLedger).
 *
 * PILOT PRICES: the car classes follow KOI's ride classes and the eSIM plans Veny's catalogue, but every figure
 * here stays a pilot price until the live KOI and eSIM rate cards are loaded. "elsewhere" is what the same
 * service costs bought on its own, shown struck through; it must be replaced by checked prices before launch.
 */
export type ExtraKind = "transfer" | "esim" | "bag" | "delay";
export type Direction = "arrival" | "departure" | "both";

export interface ExtraOption {
  id: string;
  name: string;
  sub: string;
  price: number;
  elsewhere: number;
  commission: number;
  /** passengers and bags the car takes (rides only) */
  seats?: number;
}
export interface ExtraProduct {
  kind: ExtraKind;
  name: string;
  short: string;
  detail: string;
  /** "from" figures: the cheapest option, kept for the storefront row and older callers */
  price: number;
  elsewhere: number;
  commission: number;
  icon: "car" | "sim" | "luggage" | "umbrella";
  options: ExtraOption[];
}

const RIDES: ExtraOption[] = [
  { id: "standard", name: "Standard", sub: "Toyota Camry or similar", price: 78, elsewhere: 95, commission: 27.3, seats: 3 },
  { id: "business", name: "Business", sub: "Mercedes E-Class or similar", price: 112, elsewhere: 139, commission: 39.2, seats: 3 },
  { id: "van", name: "Van", sub: "Mercedes V-Class or similar", price: 124, elsewhere: 155, commission: 43.4, seats: 6 },
  { id: "first", name: "First class", sub: "Mercedes S-Class or similar", price: 189, elsewhere: 240, commission: 66.15, seats: 2 },
];
const PLANS: ExtraOption[] = [
  { id: "5gb-7d", name: "5 GB, 7 days", sub: "Maps, messages and a few calls", price: 8, elsewhere: 12, commission: 2.7 },
  { id: "10gb-30d", name: "10 GB, 30 days", sub: "Everyday use, photos and video calls", price: 12, elsewhere: 18, commission: 4 },
  { id: "20gb-30d", name: "20 GB, 30 days", sub: "Streaming, hotspot for a laptop", price: 19, elsewhere: 28, commission: 6.3 },
  { id: "unl-10d", name: "Unlimited, 10 days", sub: "No counting, full speed", price: 29, elsewhere: 45, commission: 9.7 },
];

export const EXTRAS: ExtraProduct[] = [
  { kind: "transfer", name: "Airport pickup, private car", short: "Driver waits at arrivals with your name. Flight tracked.", detail: "A licensed driver meets you at arrivals with a name board, tracks your flight so a delay costs you nothing, and takes you straight to the hotel. Cancel free up to 24 hours before landing.", price: 78, elsewhere: 95, commission: 27.3, icon: "car", options: RIDES },
  { kind: "esim", name: "eSIM data plan", short: "Data the moment you land. Installed by QR code before you fly.", detail: "An eSIM installed from a QR code we email you, live when you land. Your own number stays active for calls and messages.", price: 8, elsewhere: 12, commission: 2.7, icon: "sim", options: PLANS },
  { kind: "bag", name: "Bag protection", short: "Lost or delayed bag: USD 500 paid within 48 hours, no forms.", detail: "If the airline loses or delays your checked bag more than 8 hours, you receive USD 500 within 48 hours of the claim, by card, with no receipts to collect. Covers the whole trip.", price: 9, elsewhere: 31, commission: 4, icon: "luggage", options: [{ id: "trip", name: "Whole trip", sub: "Every checked bag on the booking", price: 9, elsewhere: 31, commission: 4 }] },
  { kind: "delay", name: "Flight delay cover", short: "Delay over 3 hours: USD 150 paid automatically.", detail: "We watch your flights. If one is delayed more than 3 hours, USD 150 lands on your card automatically, usually before you take off. Nothing to claim.", price: 11, elsewhere: 36, commission: 5, icon: "umbrella", options: [{ id: "trip", name: "Whole trip", sub: "Outbound and return flights", price: 11, elsewhere: 36, commission: 5 }] },
];

export const extraByKind = (k: string) => EXTRAS.find((e) => e.kind === k) ?? null;

/** The airports a ride can start or end at, per destination; factor scales the ride price by distance (main airport = 1). */
export interface Airport { code: string; name: string; factor: number; minutes: number }
const AIRPORTS: Record<string, Airport[]> = {
  paris: [{ code: "CDG", name: "Charles de Gaulle", factor: 1, minutes: 45 }, { code: "ORY", name: "Orly", factor: 0.85, minutes: 35 }, { code: "BVA", name: "Beauvais", factor: 1.9, minutes: 80 }],
  london: [{ code: "LHR", name: "Heathrow", factor: 1, minutes: 55 }, { code: "LGW", name: "Gatwick", factor: 1.25, minutes: 75 }, { code: "STN", name: "Stansted", factor: 1.3, minutes: 70 }, { code: "LCY", name: "London City", factor: 0.6, minutes: 30 }],
  dubai: [{ code: "DXB", name: "Dubai International", factor: 1, minutes: 25 }, { code: "DWC", name: "Al Maktoum", factor: 1.6, minutes: 50 }],
  "new-york": [{ code: "JFK", name: "John F. Kennedy", factor: 1, minutes: 60 }, { code: "LGA", name: "LaGuardia", factor: 0.85, minutes: 40 }, { code: "EWR", name: "Newark", factor: 1.1, minutes: 50 }],
  singapore: [{ code: "SIN", name: "Changi", factor: 1, minutes: 25 }],
  istanbul: [{ code: "IST", name: "Istanbul Airport", factor: 1, minutes: 50 }, { code: "SAW", name: "Sabiha Gökçen", factor: 1.1, minutes: 60 }],
  marrakech: [{ code: "RAK", name: "Menara", factor: 1, minutes: 20 }],
  amsterdam: [{ code: "AMS", name: "Schiphol", factor: 1, minutes: 25 }],
  barcelona: [{ code: "BCN", name: "El Prat", factor: 1, minutes: 30 }],
  rome: [{ code: "FCO", name: "Fiumicino", factor: 1, minutes: 45 }, { code: "CIA", name: "Ciampino", factor: 0.8, minutes: 35 }],
  rio: [{ code: "GIG", name: "Galeão", factor: 1, minutes: 45 }, { code: "SDU", name: "Santos Dumont", factor: 0.6, minutes: 20 }],
  lisbon: [{ code: "LIS", name: "Humberto Delgado", factor: 1, minutes: 20 }],
  madeira: [{ code: "FNC", name: "Cristiano Ronaldo", factor: 1, minutes: 25 }],
};
export const airportsFor = (destination: string | null | undefined): Airport[] => (destination && AIRPORTS[destination]) || [{ code: "", name: "Nearest airport", factor: 1, minutes: 0 }];

/** The plan most travelers on a stay this long need: a short city break, a normal trip, a long one. */
export function recommendedPlan(nights: number): string {
  return nights <= 5 ? "5gb-7d" : nights <= 14 ? "10gb-30d" : "20gb-30d";
}
/** The smallest car that seats the party. */
export function recommendedCar(adults: number): string {
  return adults <= 3 ? "standard" : "van";
}

/** What the reader chose for one service. Older callers send just the kind; the defaults below fill the rest. */
export interface ExtraPick { kind: ExtraKind; option?: string; airport?: string; direction?: Direction; flight?: string; qty?: number }
export interface PricedExtra { kind: ExtraKind; option: string; name: string; detail: string; price: number; elsewhere: number; commission: number }

const r2 = (v: number) => Math.round(v * 100) / 100;
const FLIGHT = /^[A-Z0-9]{2}\s?\d{1,4}[A-Z]?$/;

/**
 * Prices one pick from the catalogue. Throws RangeError on anything not offered (an unknown car, an airport that
 * does not serve the destination, a car too small for the party), so a tampered request never sets a price.
 */
export function priceExtra(pick: ExtraPick, ctx: { destination: string | null; adults: number; nights: number }): PricedExtra {
  const p = extraByKind(pick.kind);
  if (!p) throw new RangeError(`unknown service ${pick.kind}`);
  const fallback = p.kind === "transfer" ? recommendedCar(ctx.adults) : p.kind === "esim" ? recommendedPlan(ctx.nights) : p.options[0]!.id;
  const o = p.options.find((x) => x.id === (pick.option ?? fallback));
  if (!o) throw new RangeError(`unknown option ${pick.option} for ${pick.kind}`);
  if (p.kind === "transfer") {
    if (o.seats && ctx.adults > o.seats) throw new RangeError(`${o.name} seats ${o.seats}; the booking is for ${ctx.adults}`);
    const list = airportsFor(ctx.destination);
    const ap = pick.airport ? list.find((a) => a.code === pick.airport) : list[0];
    if (!ap) throw new RangeError(`airport ${pick.airport} does not serve this destination`);
    const dir: Direction = pick.direction ?? "arrival";
    const legs = dir === "both" ? 2 : 1;
    const flight = pick.flight?.trim().toUpperCase().replace(/\s+/g, " ") || null;
    if (flight && !FLIGHT.test(flight)) throw new RangeError("flight number format");
    const k = ap.factor * legs;
    const where = ap.code ? `${ap.name} (${ap.code})` : ap.name;
    const route = dir === "arrival" ? `${where} to the hotel` : dir === "departure" ? `Hotel to ${where}` : `${where} and back`;
    return { kind: p.kind, option: o.id, name: `${p.name}, ${o.name}`, detail: [route, o.sub, flight ? `flight ${flight}` : null].filter(Boolean).join(", "), price: Math.round(o.price * k), elsewhere: Math.round(o.elsewhere * k), commission: r2(o.commission * k) };
  }
  const qty = p.kind === "esim" ? Math.min(Math.max(Math.trunc(pick.qty ?? 1), 1), Math.max(ctx.adults, 1)) : 1;
  return { kind: p.kind, option: o.id, name: p.kind === "esim" ? `eSIM, ${o.name}` : p.name, detail: [o.sub, qty > 1 ? `${qty} eSIMs` : null].filter(Boolean).join(", "), price: r2(o.price * qty), elsewhere: r2(o.elsewhere * qty), commission: r2(o.commission * qty) };
}
