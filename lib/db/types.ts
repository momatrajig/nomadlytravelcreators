import type { Photo } from "@/lib/media/photo";
export interface Storefront {
  id: string; creatorId: string; slug: string; customDomain: string | null; brandName: string; brandColor: string; logoPath: string | null;
  template: "postcard" | "editorial" | "grid"; headline: string; cityId: number | null; cityName: string | null; currency: string;
  creatorRate: number; flightFee: number; live: boolean;
  /** storefront language for readers */
  locale?: "en" | "cs";
  /** prices are charged in the supplier currency; this one is shown next to them as an approximation (CZK, EUR) */
  displayCurrency?: string | null;
  /** commercial terms set by Nomadly: markup on the supplier net, creator share of net revenue on hotels and add ons */
  markup?: number; hotelShare?: number; extrasShare?: number;
  /** the creator's own site (articles link from here) */
  siteUrl?: string | null;
  /** set by Nomadly once the creator's domain resolves to us and has a certificate */
  domainVerifiedAt?: string | null;
}
export interface Hotel {
  ebcId: number; name: string; stars: number | null; address: string | null; cityName: string | null; lat: number | null; lng: number | null;
  images: Photo[]; rating: number | null; ratingCount: number | null;
  /** destination slug (lib/content/destinations) */
  destination: string | null;
}
/** A creator's pick. `images` lead with the creator's chosen cover (coverUrl) when there is one. */
export interface PinnedHotel extends Hotel { position: number; tip: string | null; stayedWhen: string | null; coverUrl?: string | null }
/** A curated set shown as its own band: a season (Christmas and New Year) or a destination. Dates are the band's default search. */
export interface Collection { id: string; storefrontId: string; slug: string; kind: "season" | "destination"; title: string; subtitle: string | null; checkIn: string | null; checkOut: string | null; ebcIds: number[]; position: number; heroUrl: string | null }
export interface PriceCheck { ebcId: number; source: "booking" | "expedia" | "agoda" | "tripcom" | "hotel"; checkIn: string; checkOut: string; adults: number; price: number; currency: string; checkedAt: string }
export interface Quote {
  id: string; storefrontId: string; ebcId: number; checkIn: string; checkOut: string; occupancy: Array<{ adults: number; childrenAges: number[] }>;
  srk: string; resultsToken: string; hotelIndex: number; offerIndex: string; packageCode: string; packageToken: string; roomTokens: string[];
  board: string | null; refundable: boolean; cancelDeadline: string | null; cancelCharge: number | null;
  supplierNet: number; currency: string; creatorRate: number; nomadlyNet: number; creatorShare: number; readerPrice: number;
  pricingModel?: "v1" | "net"; margin?: number | null; costs?: number | null;
  lowestReference: number | null; lowestReferenceSource: string | null;
  availabilityToken: string | null; availabilityAt: string | null; autocancelAt: string | null; expiresAt: string; createdAt: string;
}
export type BookingStatus = "quoted" | "paying" | "booked" | "on_request" | "confirmed" | "completed" | "canceled" | "failed";
export interface Booking {
  id: string; reference: string; clientRef: string; storefrontId: string; creatorId: string; quoteId: string | null; ebcId: number;
  ebcReservationId: number | null; hotelConfirmation: string | null; status: BookingStatus;
  /** paid with a test card while hotel prices were live: the flow ran, no room was reserved, never paid out */
  demo?: boolean; checkIn: string; checkOut: string; nights: number;
  guests: Array<{ firstName: string; lastName: string; type: "adult" | "child"; lead: boolean }>; leadEmail: string; leadPhone: string | null;
  roomName: string | null; board: string | null; refundable: boolean; cancelDeadline: string | null; cancelCharge: number | null; currency: string;
  supplierNet: number; nomadlyNet: number; creatorRate: number; creatorShare: number; readerPrice: number; cardFee: number | null;
  pricingModel?: "v1" | "net"; margin?: number | null; costs?: number | null;
  /** the tracked link click this booking came from, and its source (article or campaign) */
  clickId?: string | null; source?: string | null;
  extras: Array<{ kind: string; name: string; price: number; commission: number; creatorShare: number; detail?: string | null; option?: string | null }>;
  /** what the reader asked the hotel for; sent with the reservation as comments */
  requests?: BookingRequests | null;
  leadCountry?: string | null;
  lowestReference: number | null; lowestReferenceSource: string | null; promoCode: string | null; promoDiscount: number;
  stripePaymentIntent: string | null; paidAt: string | null; canceledAt: string | null; voucherToken: string | null; createdAt: string;
}
export interface BookingRequests {
  /** early_checkin, late_checkout, quiet, high_floor, low_floor, twin, double, cot, accessible, connecting */
  items: string[];
  note: string | null;
  /** expected arrival hour at the hotel, "HH:00", or null when unknown */
  arrival: string | null;
  /** "self" when the person paying is the guest; "other" with the booker's name when booking for someone */
  bookedFor: "self" | "other";
  booker: { firstName: string; lastName: string } | null;
}
export interface PromoCode { storefrontId: string; code: string; amountOff: number; maxUses: number | null; uses: number; active: boolean; startsAt: string | null; endsAt: string | null }

export interface Payout { id: string; creatorId: string; periodStart: string; periodEnd: string; amount: number; currency: string; status: "scheduled" | "paid" | "held" | "failed"; scheduledFor: string; paidAt: string | null; items: Array<{ bookingId: string; amount: number }> }
export interface Creator { id: string; userId: string | null; displayName: string; email: string }
export interface Click {
  id: string; storefrontId: string; createdAt: string; source: string | null; article: string | null; target: "hotel" | "city" | "home";
  ebcId: number | null; query: Record<string, string> | null; country: string | null; device: string | null; visitor: string | null; bot: boolean;
}
export interface DirectoryHotel { ebcId: number; name: string; norm: string; cityId: number; address: string | null; zip: string | null; stars: number | null; lat: number | null; lng: number | null }

export interface Db {
  creatorByUserId(userId: string): Promise<Creator | null>;
  creator(id: string): Promise<Creator | null>;
  creatorByEmail(email: string): Promise<Creator | null>;
  linkCreatorUser(creatorId: string, userId: string): Promise<void>;
  storefrontsForCreator(creatorId: string): Promise<Storefront[]>;
  updateStorefront(id: string, patch: Partial<Pick<Storefront, "brandName" | "brandColor" | "template" | "headline" | "creatorRate" | "flightFee" | "live" | "locale" | "displayCurrency" | "siteUrl" | "customDomain">>): Promise<void>;
  updatePin(storefrontId: string, ebcId: number, patch: { tip?: string | null; stayedWhen?: string | null; position?: number; coverUrl?: string | null }): Promise<void>;
  payoutsForCreator(creatorId: string): Promise<Payout[]>;
  /** completed stays (check out plus hold days before now) not yet in a payout */
  payableBookings(creatorId: string, before: string): Promise<Booking[]>;
  createPayout(p: Omit<Payout, "id">): Promise<Payout>;
  storefrontByHost(host: string, platformHost: string): Promise<Storefront | null>;
  /** short lived shared cache (supplier search results); null when missing or expired */
  cacheGet<T>(key: string): Promise<T | null>;
  cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  storefrontBySlug(slug: string): Promise<Storefront | null>;
  pinnedHotels(storefrontId: string): Promise<PinnedHotel[]>;
  collections(storefrontId: string): Promise<Collection[]>;
  hotel(ebcId: number): Promise<Hotel | null>;
  latestPriceChecks(ebcIds: number[], checkIn: string, checkOut: string, adults: number): Promise<PriceCheck[]>;
  saveQuote(q: Omit<Quote, "id" | "createdAt">): Promise<Quote>;
  quote(id: string): Promise<Quote | null>;
  updateQuote(id: string, patch: Partial<Quote>): Promise<void>;
  promo(storefrontId: string, code: string): Promise<PromoCode | null>;
  createBooking(b: Omit<Booking, "id" | "createdAt">): Promise<Booking>;
  booking(id: string): Promise<Booking | null>;
  bookingByReference(reference: string): Promise<Booking | null>;
  bookingByPaymentIntent(pi: string): Promise<Booking | null>;
  updateBooking(id: string, patch: Partial<Booking>): Promise<void>;
  addEvent(bookingId: string, kind: string, payload?: unknown): Promise<void>;
  bookingsForCreator(creatorId: string, limit?: number): Promise<Booking[]>;
  /** confirmed or completed bookings per hotel since a date, for the honest "booked N times by readers" signal */
  bookedCountsByHotel(storefrontId: string, sinceIso: string): Promise<Map<number, number>>;
  storefrontSlugs(): Promise<string[]>;
  creatorIdsWithStorefronts(): Promise<string[]>;
  // ---------- tracked links ----------
  logClick(c: Omit<Click, "id" | "createdAt">): Promise<Click>;
  click(id: string): Promise<Click | null>;
  clicksForStorefront(storefrontId: string, sinceIso: string): Promise<Click[]>;
  /** each "Select rate" a reader pressed (a held price at checkout), for the funnel */
  checkoutsForStorefront(storefrontId: string, sinceIso: string): Promise<Array<{ createdAt: string; ebcId: number }>>;
  // ---------- hotel content and directory ----------
  upsertHotel(h: Hotel & { cityId?: number | null; countryIso?: string | null; description?: string | null }): Promise<void>;
  pinHotel(storefrontId: string, ebcId: number, patch?: { tip?: string | null; position?: number }): Promise<void>;
  unpinHotel(storefrontId: string, ebcId: number): Promise<void>;
  directoryCity(cityId: number): Promise<{ cityId: number; name: string; pages: number; pagesDone: number; total: number; finishedAt: string | null } | null>;
  saveDirectoryCity(c: { cityId: number; name: string; pages: number; pagesDone: number; total: number; finishedAt: string | null }): Promise<void>;
  saveDirectoryHotels(rows: DirectoryHotel[]): Promise<void>;
  directoryHotels(cityId: number): Promise<DirectoryHotel[]>;
  /** directory hotels inside a box around a point (degrees), any city */
  directoryNear(lat: number, lng: number, dLat: number, dLng: number, limit?: number): Promise<DirectoryHotel[]>;
}
