/**
 * Platform content: the destinations a storefront can feature. Shared by every creator, so it
 * lives in code next to the transit profiles rather than per tenant in the database.
 * Hero photos are Unsplash (free for commercial use under the Unsplash License).
 */
import media from "./media.json";

export interface Spot { name: string; lat: number; lng: number }
export interface Destination {
  slug: string; name: string; country: string; tz: string; lat: number; lng: number; blurb: string; hero: string;
  airport: Spot & { code: string; rail: string | null };
  /** the city's other airports a reader may fly into (budget and city airports) */
  moreAirports?: Array<Spot & { code: string; rail: string | null }>;
  centre: Spot;
  /** average door to door taxi speed off peak, km/h, and how much the rush slows it */
  rideKmh: number; rush: number;
  /** rail or metro hours as minutes after midnight, close may pass 1440; null where there is no useful line */
  metro: { open: number; close: number; label: string } | null;
}

const hero = (s: string) => (media.destinations as Record<string, string>)[s]!;
const h = (x: number, m = 0) => x * 60 + m;

export const DESTINATIONS: Destination[] = [
  { slug: "paris", name: "Paris", country: "France", tz: "Europe/Paris", lat: 48.8566, lng: 2.3522, blurb: "The palaces, the bistros, the walk home along the Seine.", hero: hero("paris"),
    moreAirports: [{ code: "ORY", name: "Orly Airport", lat: 48.7262, lng: 2.3652, rail: "Métro 14" }, { code: "BVA", name: "Beauvais Airport", lat: 49.4544, lng: 2.1128, rail: null }], airport: { code: "CDG", name: "Charles de Gaulle Airport", lat: 49.0097, lng: 2.5479, rail: "RER B" }, centre: { name: "The Louvre", lat: 48.8606, lng: 2.3376 }, rideKmh: 30, rush: 1.7, metro: { open: h(5, 30), close: h(24, 40), label: "Métro" } },
  { slug: "london", name: "London", country: "United Kingdom", tz: "Europe/London", lat: 51.5074, lng: -0.1278, blurb: "The grand hotels, done properly.", hero: hero("london"),
    moreAirports: [{ code: "LGW", name: "Gatwick Airport", lat: 51.1537, lng: -0.1821, rail: "Gatwick Express" }, { code: "STN", name: "Stansted Airport", lat: 51.885, lng: 0.235, rail: "Stansted Express" }, { code: "LCY", name: "London City Airport", lat: 51.5048, lng: 0.0495, rail: "DLR" }], airport: { code: "LHR", name: "Heathrow Airport", lat: 51.47, lng: -0.4543, rail: "Elizabeth line" }, centre: { name: "Trafalgar Square", lat: 51.508, lng: -0.1281 }, rideKmh: 26, rush: 1.6, metro: { open: h(5, 30), close: h(24, 30), label: "Tube" } },
  { slug: "dubai", name: "Dubai", country: "United Arab Emirates", tz: "Asia/Dubai", lat: 25.2048, lng: 55.2708, blurb: "Beach, desert and the tallest skyline on earth.", hero: hero("dubai"),
    airport: { code: "DXB", name: "Dubai International Airport", lat: 25.2532, lng: 55.3657, rail: "Metro red line" }, centre: { name: "Dubai Mall", lat: 25.1972, lng: 55.2796 }, rideKmh: 48, rush: 1.6, metro: { open: h(5), close: h(24), label: "Metro" } },
  { slug: "new-york", name: "New York", country: "United States", tz: "America/New_York", lat: 40.7128, lng: -74.006, blurb: "Fifth Avenue at Christmas, the park in the snow.", hero: hero("new-york"),
    moreAirports: [{ code: "LGA", name: "LaGuardia Airport", lat: 40.7769, lng: -73.874, rail: null }, { code: "EWR", name: "Newark Airport", lat: 40.6895, lng: -74.1745, rail: "NJ Transit" }], airport: { code: "JFK", name: "JFK Airport", lat: 40.6413, lng: -73.7781, rail: "AirTrain and subway" }, centre: { name: "Times Square", lat: 40.758, lng: -73.9855 }, rideKmh: 30, rush: 1.8, metro: { open: 0, close: h(24), label: "Subway" } },
  { slug: "singapore", name: "Singapore", country: "Singapore", tz: "Asia/Singapore", lat: 1.2903, lng: 103.852, blurb: "Hawker stalls, rooftop pools and the best airport on earth.", hero: hero("singapore"),
    airport: { code: "SIN", name: "Changi Airport", lat: 1.3644, lng: 103.9915, rail: "MRT" }, centre: { name: "Orchard Road", lat: 1.3048, lng: 103.8318 }, rideKmh: 45, rush: 1.4, metro: { open: h(5, 30), close: h(24), label: "MRT" } },
  { slug: "istanbul", name: "Istanbul", country: "Türkiye", tz: "Europe/Istanbul", lat: 41.0082, lng: 28.9784, blurb: "Two continents, one breakfast table.", hero: hero("istanbul"),
    moreAirports: [{ code: "SAW", name: "Sabiha Gökçen Airport", lat: 40.8986, lng: 29.3092, rail: null }], airport: { code: "IST", name: "Istanbul Airport", lat: 41.2753, lng: 28.7519, rail: "M11 metro" }, centre: { name: "Hagia Sophia", lat: 41.0086, lng: 28.9802 }, rideKmh: 34, rush: 1.9, metro: { open: h(6), close: h(24), label: "Metro and tram" } },
  { slug: "marrakech", name: "Marrakech", country: "Morocco", tz: "Africa/Casablanca", lat: 31.6295, lng: -7.9811, blurb: "Riads, palm groves and the Atlas behind them.", hero: hero("marrakech"),
    airport: { code: "RAK", name: "Marrakech Menara Airport", lat: 31.6069, lng: -8.0363, rail: null }, centre: { name: "Jemaa el-Fnaa", lat: 31.6258, lng: -7.9891 }, rideKmh: 28, rush: 1.3, metro: null },
  { slug: "amsterdam", name: "Amsterdam", country: "Netherlands", tz: "Europe/Amsterdam", lat: 52.3676, lng: 4.9041, blurb: "Canal houses turned into the quietest luxury in Europe.", hero: hero("amsterdam"),
    airport: { code: "AMS", name: "Schiphol Airport", lat: 52.3105, lng: 4.7683, rail: "Train to Centraal" }, centre: { name: "Dam Square", lat: 52.3731, lng: 4.8926 }, rideKmh: 34, rush: 1.5, metro: { open: h(6), close: h(24, 30), label: "Tram and metro" } },
  { slug: "barcelona", name: "Barcelona", country: "Spain", tz: "Europe/Madrid", lat: 41.3874, lng: 2.1686, blurb: "Gaudí, the sea and dinner at eleven.", hero: hero("barcelona"),
    airport: { code: "BCN", name: "Barcelona El Prat Airport", lat: 41.2974, lng: 2.0833, rail: "R2 train and metro" }, centre: { name: "Plaça de Catalunya", lat: 41.387, lng: 2.17 }, rideKmh: 32, rush: 1.6, metro: { open: h(5), close: h(24), label: "Metro" } },
  { slug: "rome", name: "Rome", country: "Italy", tz: "Europe/Rome", lat: 41.9028, lng: 12.4964, blurb: "Two thousand years in one afternoon walk.", hero: hero("rome"),
    moreAirports: [{ code: "CIA", name: "Ciampino Airport", lat: 41.7994, lng: 12.5949, rail: null }], airport: { code: "FCO", name: "Fiumicino Airport", lat: 41.8003, lng: 12.2389, rail: "Leonardo Express" }, centre: { name: "Trevi Fountain", lat: 41.9009, lng: 12.4833 }, rideKmh: 34, rush: 1.7, metro: { open: h(5, 30), close: h(23, 30), label: "Metro" } },
  { slug: "rio", name: "Rio de Janeiro", country: "Brazil", tz: "America/Sao_Paulo", lat: -22.9068, lng: -43.1729, blurb: "Copacabana at New Year, two million people in white.", hero: hero("rio"),
    moreAirports: [{ code: "SDU", name: "Santos Dumont Airport", lat: -22.9105, lng: -43.1631, rail: null }], airport: { code: "GIG", name: "Galeão International Airport", lat: -22.809, lng: -43.2506, rail: null }, centre: { name: "Sugarloaf cable car", lat: -22.9555, lng: -43.1661 }, rideKmh: 32, rush: 1.9, metro: { open: h(5), close: h(24), label: "Metro" } },
  { slug: "lisbon", name: "Lisbon", country: "Portugal", tz: "Europe/Lisbon", lat: 38.7223, lng: -9.1393, blurb: "Seven hills, tiled facades and the best light in Europe.", hero: hero("lisbon"),
    airport: { code: "LIS", name: "Lisbon Airport", lat: 38.7742, lng: -9.1342, rail: "Metro red line" }, centre: { name: "Praça do Comércio", lat: 38.7077, lng: -9.1366 }, rideKmh: 28, rush: 1.65, metro: { open: h(6, 30), close: h(25), label: "Metro" } },
  { slug: "madeira", name: "Madeira", country: "Portugal", tz: "Atlantic/Madeira", lat: 32.6669, lng: -16.9241, blurb: "Cliff hotels above the Atlantic, spring all year.", hero: hero("madeira"),
    airport: { code: "FNC", name: "Madeira Airport", lat: 32.6979, lng: -16.7745, rail: null }, centre: { name: "Funchal old town", lat: 32.6487, lng: -16.9027 }, rideKmh: 44, rush: 1.3, metro: null },
];

export const destination = (slug: string | null | undefined) => DESTINATIONS.find((d) => d.slug === slug) ?? null;
/** The destination a hotel belongs to, by its city name (fixtures and the database both carry the city). */
export const destinationForCity = (city: string | null | undefined) => DESTINATIONS.find((d) => d.name === city || (city === "Funchal" && d.slug === "madeira")) ?? null;
export const SEASON_HERO = media.seasons as Record<string, string>;
