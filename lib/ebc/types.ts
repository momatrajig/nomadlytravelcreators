/** eBooking Center (DCS Plus IRIX 4.7.4) wire types. Only the fields Nomadly reads. */

export interface Price { value: number; currency: string }
export interface ExtendedPrice { selling: Price; components?: { supplier?: Price; markup?: Price; commission?: Price } }

export type Availability = "OK" | "RQ";
export type BoardCode = "RO" | "SC" | "BB" | "HB" | "FB" | "AI" | "RD";
export type RefundCode = "nonrefundable" | "refundable" | "unknown";

export interface Occupancy { adults: number; childrenAges: number[] }

export interface SearchRequest {
  accommodation: number[];
  checkIn: string;
  checkOut: string;
  occupancy: { leaderNationality: number; rooms: Occupancy[] };
  sellingChannel: "B2B" | "B2C";
  language?: string;
  timeout?: number;
  availableOnly?: boolean;
  cancellationDeadline?: boolean;
  completeOffersOnly?: boolean;
}

export interface RoomRef { roomCode: string; roomToken: string; selected: boolean }
export interface PackageRoom { packageRoomCode: string; occupancy: Occupancy; roomReferences: RoomRef[] }
export interface Package {
  packageCode: string;
  packageToken: string;
  status: Availability;
  complete: boolean;
  price: ExtendedPrice;
  packageRooms: PackageRoom[];
}
export interface Room {
  index: string;
  name: string;
  status: Availability;
  board?: string;
  boardBasis: BoardCode;
  nonRefundable: boolean;
  price: ExtendedPrice;
  rateTags?: string[];
  info?: string;
  supplierReferences?: { roomTypeCode?: string; hotelId?: string };
  cancellationDeadline?: { date: string; charge: Price };
}
export interface Offer {
  id: string;
  recommended?: boolean;
  specialDeal?: boolean;
  minPrice: ExtendedPrice | Price;
  boardBasis?: Array<{ code: BoardCode; price: Price }>;
  nonRefundable?: Array<{ code: RefundCode; price: Price }>;
  rateTags?: string[];
  rooms: Room[];
  packages: Package[];
  system: { code: string; alias: string };
}
export interface SearchHotel {
  index: number;
  name: string;
  stars: number;
  recommended?: boolean;
  specialDeal?: boolean;
  minPrice: ExtendedPrice | Price;
  rateTags?: string[];
  nonRefundable?: Array<{ code: RefundCode; price: Price }>;
  boardBasis?: Array<{ code: BoardCode; price: Price }>;
  offers: Offer[];
}
export interface SearchResponse { srk: string; tokens: { results: string; async?: string; progress?: string }; hotels: SearchHotel[] }

export interface CancellationPolicyEntry { type: "standard" | "noshow" | "limit" | "lock" | "penalty"; date?: string; startDate?: string; charge?: Price }
export interface AvailabilityResponse {
  availabilityToken: string;
  serviceDates: { startDate: string; endDate: string; duration: number; type: string };
  system: { code: string; alias: string };
  supplierHotelId?: string;
  package: Package & { rate?: { name?: string; description?: string } };
  rooms: Room[];
  paymentMethods: Record<string, unknown>;
  autocancelDate?: string;
  cancellationPolicy?: { date?: string; policies: CancellationPolicyEntry[] };
  price: ExtendedPrice;
  taxes?: Array<{ type: string; name: string; amount: number; currency: string; isIncluded: boolean; description?: string }>;
  remarks?: Array<{ group: string; list: string[] }>;
  termsAndConditions?: Array<{ type: string; text?: string; url?: string }>;
  offerConfiguration?: {
    contactDetails?: Record<string, { required: boolean }>;
    identificationDocument?: Record<string, { required: boolean }>;
    priceModifiers?: { allowed: boolean; components?: string[] };
    birthdate?: { adults: boolean; children: boolean };
    supplierBookingForm?: Array<{ name: string; required: boolean; restrictions?: Record<string, unknown> }>;
  };
}

export interface Traveler {
  reference: string;
  type: "adult" | "child" | "infant";
  lead: boolean;
  title: "mr" | "mrs" | "miss" | "ms" | "mstr";
  firstName: string;
  lastName: string;
  email?: string;
  phonePrefix?: string;
  phone?: string;
  birthDate?: string;
  country?: string;
  city?: string;
  address?: string;
  postalCode?: string;
}
export interface BookRequest {
  availabilityToken: string;
  clientRef: string;
  rooms: Array<{ packageRoomToken: string; travelers: Traveler[] }>;
  payment: { method: "credit" | "prepaid" | "paynow" | "supplier" | "reception"; token?: string; data?: Record<string, unknown>; order?: { id: string } };
  comments?: string;
}
export interface BookResponse {
  id: number;
  clientRef: string;
  type: "hotel";
  status: Availability;
  price: { net?: Price; commission?: Price; selling: Price };
  notifications?: Array<{ type: string; code: string; text: string }>;
}

export type ReservationStatus = "OK" | "RQ" | "XX" | "XP" | "AM";
export interface Reservation {
  id: number;
  clientRef: string;
  hotelConfirmationNumber?: string;
  service: { status: ReservationStatus };
  payment: { status: "OK" | "PR" | "NR"; type: string; paymentDeadline?: string };
  prices: { currency: string; issue: Record<string, number>; total: Record<string, number> };
  autocancelDate?: string;
  cancellationPolicy?: { date?: string; policies: CancellationPolicyEntry[] };
  serviceDates: { startDate: string; endDate: string; duration: number; type: string };
  hotel: { id: number; cityId: number; countryId: number; name: string; stars: number };
  rooms: Array<{ id: string; name: string; board?: string; boardBasis: BoardCode }>;
}

export interface Credit { resellerId: number; enabled: boolean; active: boolean; unlimited: boolean; available: Price }

export interface HotelImage { id: number; hotelId: number; url: string; source: string; name?: string }
export interface HotelDetails {
  id: number; name: string; type?: string; address?: string; zipCode?: string; stars: number;
  geolocation?: { latitude: number; longitude: number };
  city?: { id: number; name: string }; country?: { id: number; name: string; iso: string };
}

export interface Problem { title: string; type?: string; status: number; detail?: string; instance?: string }
