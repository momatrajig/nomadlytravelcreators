export interface Storefront {
  id: string; creatorId: string; slug: string; customDomain: string | null; brandName: string; brandColor: string; logoPath: string | null;
  template: "postcard" | "editorial" | "grid"; headline: string; cityId: number | null; cityName: string | null; currency: string;
  creatorRate: number; flightFee: number; live: boolean;
}
export interface Hotel {
  ebcId: number; name: string; stars: number | null; address: string | null; cityName: string | null; lat: number | null; lng: number | null;
  images: Array<{ url: string; w?: number; h?: number }>; rating: number | null; ratingCount: number | null;
}
export interface PinnedHotel extends Hotel { position: number; tip: string | null; stayedWhen: string | null }
export interface PriceCheck { ebcId: number; source: "booking" | "expedia" | "agoda" | "tripcom" | "hotel"; checkIn: string; checkOut: string; adults: number; price: number; currency: string; checkedAt: string }
export interface Quote {
  id: string; storefrontId: string; ebcId: number; checkIn: string; checkOut: string; occupancy: Array<{ adults: number; childrenAges: number[] }>;
  srk: string; resultsToken: string; hotelIndex: number; offerIndex: string; packageCode: string; packageToken: string; roomTokens: string[];
  board: string | null; refundable: boolean; cancelDeadline: string | null; cancelCharge: number | null;
  supplierNet: number; currency: string; creatorRate: number; nomadlyNet: number; creatorShare: number; readerPrice: number;
  lowestReference: number | null; lowestReferenceSource: string | null;
  availabilityToken: string | null; availabilityAt: string | null; autocancelAt: string | null; expiresAt: string; createdAt: string;
}
export type BookingStatus = "quoted" | "paying" | "booked" | "on_request" | "confirmed" | "completed" | "canceled" | "failed";
export interface Booking {
  id: string; reference: string; clientRef: string; storefrontId: string; creatorId: string; quoteId: string | null; ebcId: number;
  ebcReservationId: number | null; hotelConfirmation: string | null; status: BookingStatus; checkIn: string; checkOut: string; nights: number;
  guests: Array<{ firstName: string; lastName: string; type: "adult" | "child"; lead: boolean }>; leadEmail: string; leadPhone: string | null;
  roomName: string | null; board: string | null; refundable: boolean; cancelDeadline: string | null; cancelCharge: number | null; currency: string;
  supplierNet: number; nomadlyNet: number; creatorRate: number; creatorShare: number; readerPrice: number; cardFee: number | null;
  extras: Array<{ kind: string; name: string; price: number; commission: number; creatorShare: number }>;
  lowestReference: number | null; lowestReferenceSource: string | null; promoCode: string | null; promoDiscount: number;
  stripePaymentIntent: string | null; paidAt: string | null; canceledAt: string | null; voucherToken: string | null; createdAt: string;
}
export interface PromoCode { storefrontId: string; code: string; amountOff: number; maxUses: number | null; uses: number; active: boolean; startsAt: string | null; endsAt: string | null }

export interface Payout { id: string; creatorId: string; periodStart: string; periodEnd: string; amount: number; currency: string; status: "scheduled" | "paid" | "held" | "failed"; scheduledFor: string; paidAt: string | null; items: Array<{ bookingId: string; amount: number }> }
export interface Creator { id: string; userId: string | null; displayName: string; email: string }

export interface Db {
  creatorByUserId(userId: string): Promise<Creator | null>;
  creator(id: string): Promise<Creator | null>;
  storefrontsForCreator(creatorId: string): Promise<Storefront[]>;
  updateStorefront(id: string, patch: Partial<Pick<Storefront, "brandName" | "brandColor" | "template" | "headline" | "creatorRate" | "flightFee" | "live">>): Promise<void>;
  updatePin(storefrontId: string, ebcId: number, patch: { tip?: string | null; stayedWhen?: string | null; position?: number }): Promise<void>;
  payoutsForCreator(creatorId: string): Promise<Payout[]>;
  /** completed stays (check out plus hold days before now) not yet in a payout */
  payableBookings(creatorId: string, before: string): Promise<Booking[]>;
  createPayout(p: Omit<Payout, "id">): Promise<Payout>;
  storefrontByHost(host: string, platformHost: string): Promise<Storefront | null>;
  storefrontBySlug(slug: string): Promise<Storefront | null>;
  pinnedHotels(storefrontId: string): Promise<PinnedHotel[]>;
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
}
