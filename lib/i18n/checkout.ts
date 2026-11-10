/** Checkout wording, English and Czech. Kept apart from the main dictionary: it is only loaded on checkout. */
import type { Lang } from "@/lib/i18n";

const en = {
  steps: ["Your selection", "Your details", "Payment"],
  required: "Required",
  detailsH: "Enter your details",
  detailsSub: "Almost done. Fill in the fields marked * so the hotel has your booking.",
  forWhom: "Who is the booking for?",
  forMe: "I am the main guest",
  forOther: "Someone else",
  yourName: "Your name (the person booking)",
  guestName: "Guest name, as on their passport",
  firstName: "First name", lastName: "Last name",
  email: "Email address", emailHint: "Your confirmation and hotel voucher are sent here.",
  country: "Country or region", phone: "Phone number", phoneHint: "The hotel and driver use it only if they need to reach you.",
  dial: "Country code",
  addH: "Add to your trip", addSub: "Veny services, paid with the stay in one payment. Each one costs less than bought on its own.",
  add: "Add", added: "Added", remove: "Remove", from: "from", onItsOwn: "on its own",
  airport: "Airport", direction: "Ride", toHotel: "Airport to hotel", toAirport: "Hotel to airport", both: "Both ways",
  car: "Car", seats: (n: number) => `${n} people, ${n} bags`, tooSmall: (n: number) => `Seats ${n}`,
  flight: "Flight number", flightPh: "AF 1234", flightHint: "Optional now; add it later from your booking. We track it, so a delay costs nothing.",
  minutes: (m: number) => `about ${m} min`,
  plan: "Data plan", recommended: (n: number) => `Best for ${n} ${n === 1 ? "night" : "nights"}`, howMany: "eSIMs", perPhone: "One per phone",
  requestsH: "Special requests",
  requestsSub: "The hotel receives these with your booking. They are not guaranteed, but hotels honour most of them.",
  req: { early_checkin: "Early check-in", late_checkout: "Late check-out", quiet: "Quiet room", high_floor: "High floor", low_floor: "Low floor", twin: "Twin beds", double: "Double bed", cot: "Baby cot", accessible: "Accessible room", connecting: "Connecting rooms" } as Record<string, string>,
  note: "Anything else for the hotel", notePh: "A celebration, a dietary need, a late arrival…",
  arrival: "Your arrival time", arrivalUnknown: "I do not know yet",
  policyH: "Cancellation", freeUntil: "Free cancellation", then: "After that", noShow: "No show",
  fullCharge: "Full price", noRefund: "This rate cannot be refunded or changed.",
  terms: "I have read the cancellation terms and the hotel's rules.",
  promoQ: "Have a code?", promo: "Code", apply: "Apply",
  next: "Next: payment", change: "Change details", nextHint: "Nothing is charged yet. The card form opens on the next step.",
  payH: "How do you want to pay?", paySub: "Pay by card, Apple Pay or Google Pay. Your card details go straight to Stripe; we never see them.",
  pay: (v: string) => `Pay ${v} and book`, paying: "Paying…", secure: "Secure payment by Stripe",
  summaryH: "Your booking", checkIn: "Check-in", checkOut: "Check-out", stay: (n: number, a: number) => `${n} ${n === 1 ? "night" : "nights"}, ${a} ${a === 1 ? "adult" : "adults"}`,
  room: "Room", hotelPhoto: "Hotel photo", total: "Total", taxesIn: "Includes taxes and charges",
  cityTax: "City tax, paid at the hotel", perPN: "per person per night",
  held: (t: string) => `Price held for ${t}`, heldGone: "The held price has expired.",
  errFirst: "Enter a first name.", errLast: "Enter a last name.", errEmail: "Enter a valid email address.", errPhone: "Enter a phone number.",
  errCountry: "Choose a country or region.", errTerms: "Tick the box to confirm you read the terms.", errBooker: "Enter your own name.",
  errFix: (n: number) => `${n} ${n === 1 ? "field needs" : "fields need"} attention.`,
  freeCancel: "Free cancellation", nonRef: "Non refundable",
};
type Co = typeof en;

const cs: Co = {
  steps: ["Váš výběr", "Vaše údaje", "Platba"],
  required: "Povinné",
  detailsH: "Zadejte své údaje",
  detailsSub: "Skoro hotovo. Vyplňte pole označená *, aby hotel měl vaši rezervaci.",
  forWhom: "Pro koho je rezervace?",
  forMe: "Jsem hlavní host",
  forOther: "Pro někoho jiného",
  yourName: "Vaše jméno (kdo rezervuje)",
  guestName: "Jméno hosta, jako v pasu",
  firstName: "Jméno", lastName: "Příjmení",
  email: "E-mail", emailHint: "Sem pošleme potvrzení a voucher pro hotel.",
  country: "Země nebo oblast", phone: "Telefon", phoneHint: "Hotel a řidič ho použijí, jen když vás potřebují zastihnout.",
  dial: "Předvolba",
  addH: "Přidejte k cestě", addSub: "Služby Veny, zaplacené spolu s ubytováním jednou platbou. Každá vyjde levněji než samostatně.",
  add: "Přidat", added: "Přidáno", remove: "Odebrat", from: "od", onItsOwn: "samostatně",
  airport: "Letiště", direction: "Jízda", toHotel: "Z letiště do hotelu", toAirport: "Z hotelu na letiště", both: "Tam i zpět",
  car: "Vůz", seats: (n) => `${n} osoby, ${n} zavazadla`, tooSmall: (n) => `Pro ${n}`,
  flight: "Číslo letu", flightPh: "OK 1234", flightHint: "Nepovinné; můžete doplnit později v rezervaci. Let sledujeme, zpoždění vás nic nestojí.",
  minutes: (m) => `asi ${m} min`,
  plan: "Datový tarif", recommended: (n) => `Nejlepší na ${n} ${n === 1 ? "noc" : n < 5 ? "noci" : "nocí"}`, howMany: "eSIM", perPhone: "Jedna na telefon",
  requestsH: "Zvláštní požadavky",
  requestsSub: "Hotel je dostane spolu s rezervací. Nejsou zaručené, ale hotely většině vyhoví.",
  req: { early_checkin: "Dřívější příjezd", late_checkout: "Pozdější odjezd", quiet: "Tichý pokoj", high_floor: "Vyšší patro", low_floor: "Nižší patro", twin: "Oddělené postele", double: "Manželská postel", cot: "Dětská postýlka", accessible: "Bezbariérový pokoj", connecting: "Propojené pokoje" },
  note: "Něco dalšího pro hotel", notePh: "Oslava, dieta, pozdní příjezd…",
  arrival: "Čas příjezdu", arrivalUnknown: "Ještě nevím",
  policyH: "Storno", freeUntil: "Storno zdarma", then: "Poté", noShow: "Nedostavení",
  fullCharge: "Plná cena", noRefund: "Tuto cenu nelze vrátit ani změnit.",
  terms: "Přečetl(a) jsem storno podmínky a pravidla hotelu.",
  promoQ: "Máte kód?", promo: "Kód", apply: "Použít",
  next: "Dále: platba", change: "Upravit údaje", nextHint: "Zatím se nic neúčtuje. Formulář karty se otevře v dalším kroku.",
  payH: "Jak chcete zaplatit?", paySub: "Kartou, přes Apple Pay nebo Google Pay. Údaje o kartě jdou přímo do Stripe; my je nevidíme.",
  pay: (v) => `Zaplatit ${v} a rezervovat`, paying: "Platím…", secure: "Bezpečná platba přes Stripe",
  summaryH: "Vaše rezervace", checkIn: "Příjezd", checkOut: "Odjezd", stay: (n, a) => `${n} ${n === 1 ? "noc" : n < 5 ? "noci" : "nocí"}, ${a} ${a === 1 ? "dospělý" : "dospělí"}`,
  room: "Pokoj", hotelPhoto: "Foto hotelu", total: "Celkem", taxesIn: "Včetně daní a poplatků",
  cityTax: "Městská taxa, platí se v hotelu", perPN: "za osobu a noc",
  held: (t) => `Cena držena ještě ${t}`, heldGone: "Držená cena vypršela.",
  errFirst: "Zadejte jméno.", errLast: "Zadejte příjmení.", errEmail: "Zadejte platný e-mail.", errPhone: "Zadejte telefon.",
  errCountry: "Vyberte zemi nebo oblast.", errTerms: "Potvrďte, že jste četli podmínky.", errBooker: "Zadejte své jméno.",
  errFix: (n) => `${n} ${n === 1 ? "pole potřebuje" : n < 5 ? "pole potřebují" : "polí potřebuje"} opravit.`,
  freeCancel: "Storno zdarma", nonRef: "Bez možnosti storna",
};

export const coDict = (lang: Lang): Co => (lang === "cs" ? cs : en);
export type { Co };

/** Dial codes by country; names come from Intl.DisplayNames in the reader's language. */
export const DIAL: Record<string, string> = {
  AE: "971", AR: "54", AT: "43", AU: "61", BE: "32", BG: "359", BH: "973", BR: "55", CA: "1", CH: "41", CL: "56", CN: "86", CO: "57", CY: "357",
  CZ: "420", DE: "49", DK: "45", EE: "372", EG: "20", ES: "34", FI: "358", FR: "33", GB: "44", GR: "30", HK: "852", HR: "385", HU: "36", ID: "62",
  IE: "353", IL: "972", IN: "91", IQ: "964", IS: "354", IT: "39", JO: "962", JP: "81", KR: "82", KW: "965", KZ: "7", LB: "961", LT: "370", LU: "352",
  LV: "371", MA: "212", MT: "356", MX: "52", MY: "60", NG: "234", NL: "31", NO: "47", NZ: "64", OM: "968", PE: "51", PH: "63", PK: "92", PL: "48",
  PT: "351", QA: "974", RO: "40", RS: "381", SA: "966", SE: "46", SG: "65", SI: "386", SK: "421", TH: "66", TN: "216", TR: "90", TW: "886", UA: "380",
  US: "1", VN: "84", ZA: "27",
};
export function countryList(lang: Lang): Array<{ code: string; name: string; dial: string }> {
  let names: Intl.DisplayNames | null = null;
  try { names = new Intl.DisplayNames([lang === "cs" ? "cs" : "en"], { type: "region" }); } catch { /* old browsers: codes */ }
  return Object.entries(DIAL).map(([code, dial]) => ({ code, dial, name: names?.of(code) ?? code })).sort((a, b) => a.name.localeCompare(b.name, lang));
}

/** Room selection wording (hotel page). */
const roomsEn = {
  all: (n: number) => `All rooms (${n})`, flex: "Free cancellation", breakfast: "Breakfast included",
  lowest: "Lowest price", flexiest: "Most flexible", options: (n: number) => `${n} ${n === 1 ? "option" : "options"}`,
  sleeps: (n: number) => `For ${n} ${n === 1 ? "adult" : "adults"}`, choose: "Choose your option",
  more: (v: string) => `+${v}`, perNight: (v: string) => `${v} a night`, reserve: "Reserve", holding: "Holding the price…",
  photo: "Hotel photo", prev: "Previous rooms", next: "More rooms", none: "No rooms match. Clear the filter to see all.",
  freeUntil: (d: string) => `Free cancellation until ${d}`, nonRef: "Non refundable", onReq: "Confirmed by the hotel within 24 hours",
  total: (n: number) => `Total for ${n} ${n === 1 ? "night" : "nights"}, taxes included`,
};
const roomsCs: typeof roomsEn = {
  all: (n) => `Všechny pokoje (${n})`, flex: "Storno zdarma", breakfast: "Se snídaní",
  lowest: "Nejnižší cena", flexiest: "Nejflexibilnější", options: (n) => `${n} ${n === 1 ? "možnost" : n < 5 ? "možnosti" : "možností"}`,
  sleeps: (n) => `Pro ${n} ${n === 1 ? "dospělého" : "dospělé"}`, choose: "Vyberte možnost",
  more: (v) => `+${v}`, perNight: (v) => `${v} za noc`, reserve: "Rezervovat", holding: "Držím cenu…",
  photo: "Foto hotelu", prev: "Předchozí pokoje", next: "Další pokoje", none: "Žádný pokoj neodpovídá. Zrušte filtr.",
  freeUntil: (d) => `Storno zdarma do ${d}`, nonRef: "Bez možnosti storna", onReq: "Hotel potvrdí do 24 hodin",
  total: (n) => `Celkem za ${n} ${n === 1 ? "noc" : n < 5 ? "noci" : "nocí"} vč. daní`,
};
export const roomsDict = (lang: Lang) => (lang === "cs" ? roomsCs : roomsEn);
