/**
 * Reader facing words, per storefront language. English is the source; Czech mirrors it key for key
 * (TypeScript enforces the same shape). Creator dashboard copy stays English.
 *
 * Money: rooms are charged in the supplier's currency (USD). A storefront can show an approximate amount in
 * its readers' currency next to it (CZK, EUR), labeled as approximate, from the day's ECB rate.
 */
export type Lang = "en" | "cs";
export const langOf = (v: string | null | undefined): Lang => (v === "cs" ? "cs" : "en");

const plural = (lang: Lang, n: number, one: string, few: string, many: string = few) =>
  lang === "cs" ? (n === 1 ? one : n >= 2 && n <= 4 ? few : many) : n === 1 ? one : few;

export const locale = (lang: Lang) => (lang === "cs" ? "cs-CZ" : "en-US");

export function money(v: number, opts: { lang?: Lang; currency?: string; whole?: boolean } = {}): string {
  const { lang = "en", currency = "USD", whole = false } = opts;
  const s = new Intl.NumberFormat(lang === "cs" ? "cs-CZ" : "en-US", { style: "currency", currency, currencyDisplay: currency === "CZK" || (currency === "USD" && lang !== "cs") || currency === "EUR" ? "narrowSymbol" : "symbol", minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 }).format(whole ? Math.round(v) : v);
  return s.replace(/ /g, " ").replace(/ /g, " ");
}

/** "about 4 900 Kč": rounded so it never reads as an exact charge */
export function approx(v: number, rate: number | null | undefined, currency: string | null | undefined, lang: Lang): string | null {
  if (!rate || !currency || currency === "USD") return null;
  const x = v * rate;
  const step = currency === "CZK" ? (x > 2000 ? 100 : 10) : x > 200 ? 5 : 1;
  return `${lang === "cs" ? "asi" : "about"} ${money(Math.round(x / step) * step, { lang, currency, whole: true })}`;
}

/**
 * A day as the hotel wrote it. Deadlines arrive as timestamps in the hotel's local time; the date part is the day
 * that applies there, whoever reads it and wherever the page renders (server in UTC, reader anywhere).
 */
export function fmtDay(iso: string, lang: Lang): string {
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString(lang === "cs" ? "cs-CZ" : "en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

const en = {
  lang: "en" as Lang,
  // header, footer, nav
  hotels: "Hotels", yourBooking: "Your booking", home: "Home", creatorDashboard: "Creator dashboard", forCreators: "For creators", chooseRoom: "Choose your room", reviewsN: (n: string) => `${n} reviews`, scoreWord: (r: number): string => r >= 9 ? "Exceptional" : r >= 8.5 ? "Excellent" : r >= 8 ? "Very good" : r >= 7 ? "Good" : "Reviewed", fromWord: "from", dashboard: "Dashboard",
  recommendedBy: (b: string) => `Recommended by ${b}`, alsoPick: (b: string) => `Also a ${b} pick`, similarNearby: "Similar stays nearby", similarSub: "Same class of hotel, closest first, priced for your dates.",
  kmAway: (km: number) => km < 1 ? `${Math.round(km * 1000 / 50) * 50} m away` : `${km.toFixed(1)} km away`, pickGone: "Your pick has no rooms on these dates. Try other dates, or one of the stays below.",
  stayingIn: (p: string) => `Stays in ${p}`, theirPicks: (b: string) => `${b}'s picks`, seePicks: "See all picks", picksSub: (n: number, p: number) => `${n} ${n === 1 ? "hotel" : "hotels"} in ${p} ${p === 1 ? "place" : "places"}, each chosen and stayed in.`,
  footRuns: (brand: string) => `${brand} runs on Nomadly, a Veny Inc. company. Nomadly takes the payment and pays the hotel. Support every day, 08:00 to 22:00 UTC.`,
  photoCredits: "Photo credits", findBooking: "Find your booking",
  bannerMock: "Preview: prices are simulated and cards run in Stripe test mode, so nothing here is a real booking.",
  bannerDemo: "Live hotel prices, demo checkout: pay with Stripe test card 4242 4242 4242 4242. No room is reserved and no money moves.",
  metaTitle: (brand: string) => `${brand}: hotels with live rates`,
  // home
  heroSub: (who: string) => `Live rates for the hotels from ${who}, booked in one payment, with the airport ride and data if you want them.`,
  whereStayed: "Where we stay", placesHotels: (p: number, h: number) => `${p} ${p === 1 ? "place" : "places"}, ${h} ${h === 1 ? "hotel" : "hotels"}.`,
  pricesFor: (a: string, b: string) => `Prices per night for ${a} to ${b}.`,
  hotelsN: (n: number) => `${n} ${n === 1 ? "hotel" : "hotels"}`, fromNight: (p: string) => `, from ${p} a night`,
  everyHotel: "Every hotel", everyHotelDates: (a: string, b: string) => `Every hotel, ${a} to ${b}`, askingRates: "Asking the hotels for live rates.",
  belowBig: (best: number, of: number) => `${best} of ${of} compared are below the big sites for these dates. `,
  withRooms: (n: number) => `${n} with rooms.`, guestsNights: (a: number, n: number) => `${a} ${a === 1 ? "adult" : "adults"}, ${n} ${n === 1 ? "night" : "nights"}, tax included.`,
  seeList: "See the list", tryAgain: "Try again", allN: (n: number) => `All ${n} hotels`, noRoomsLeft: "These hotels have no rooms left for these dates.",
  howTitle: "How booking here works",
  how: [["A saving only when it is real", "When we have checked Booking.com or Expedia for the same room, dates and guests, you see their price and your saving. No check, no claim."], ["You pay Nomadly", "Nomadly buys the room at trade rates and pays the hotel. Your confirmation and reference number arrive by email."], ["Free cancellation is real", "Flexible rates cancel free until the date on the rate. The refund goes back to your card."]] as Array<[string, string]>,
  fromArticle: "From the article", readArticle: "Read the article",
  // search
  where: "Where", anywhere: "Anywhere", checkIn: "Check in", checkOut: "Check out", guests: "Guests", adultsN: (n: number) => `${n} ${n === 1 ? "adult" : "adults"}`,
  seePrices: "See prices", searching: "Searching", nightsRange: "Check out has to be 1 to 30 nights after check in.",
  // cards and list
  biggestSaving: "Biggest saving", lowestPrice: "Lowest price", mostBooked: "Most booked by readers", seeRooms: "See rooms", photos: "Photos", photosN: (n: number) => `${n} photos`,
  allPhotosOf: (n: number, name: string) => `See all ${n} photos of ${name}`, star: (n: number) => `${n} star`, freeCancelUntil: (d: string) => `Free cancellation until ${d}`, noRefunds: "No refunds",
  nightsN: (n: number) => `${n} ${n === 1 ? "night" : "nights"}`, aNight: (p: string) => `${p} a night`, below: (p: string, src: string) => `${p} below ${src}`, above: (p: string, src: string) => `${p} above ${src}`,
  lessThan: (p: string, src: string) => `${p} less than ${src}`, noRoomsDates: "No rooms for these dates at these hotels. Try other dates.", showEvery: "Show every hotel",
  all: "All", stayLine: (a: string, b: string, n: number, ad: number) => `${a} to ${b}, ${n} ${n === 1 ? "night" : "nights"}, ${ad} ${ad === 1 ? "adult" : "adults"}`, listMeta: (a: string, b: string, n: number, ad: number) => `${a} to ${b}, ${n} ${n === 1 ? "night" : "nights"}, ${ad} ${ad === 1 ? "adult" : "adults"}. Total prices, tax included.`,
  bigChecked: (l: string) => `Big site prices ${l}.`, supplierDown: "The hotel system did not answer. Try again in a moment.",
  ratedBy: (r: string, n: string) => `, rated ${r} by ${n} guests`, fromReviews: (r: string, n: string) => `, ${r} from ${n} reviews`,
  // hotel page
  allHotels: "All hotels", roomsFor: (a: string, b: string, ad: number) => `Rooms for ${a} to ${b}, ${ad} ${ad === 1 ? "adult" : "adults"}`,
  stayed: (w: string) => `, stayed ${w}`, cheapestFlexUntil: (d: string, then: string | null) => `Free cancellation until ${d} on the cheapest flexible rate${then ? `, then ${then}` : ""}.`,
  flexNoDate: "Flexible rates are refundable; each one's exact deadline is shown at checkout, before you pay.", taxNote: "Taxes included. City tax, where there is one, is paid at the hotel.",
  tryOtherDates: "Try other dates", noRooms: "No rooms for these dates.", openPhoto: (i: number, n: number) => `Open photo ${i} of ${n}`, fullMap: "Open the full map", mapOf: (n: string) => `Map of ${n}`, allPhotos: (n: number) => `All ${n} photos`,
  // rates
  freeCancel: "Free cancellation", cancelFreeUntil: (d: string, then: string | null) => `Cancel free until ${d}${then ? `, then ${then} is charged` : ""}.`,
  refundableNoDate: "Refundable. The hotel's exact cancellation deadline is shown at checkout, before you pay.",
  noRefundKept: (p: string) => `No refund or change after booking. The full ${p} is kept if plans change.`, onRequest: " The hotel confirms within a few hours; nothing is charged until it does.",
  forNights: (n: number) => `for ${n} ${n === 1 ? "night" : "nights"}, tax included`, bookRate: "Book this rate", holding: "Holding this rate…", couldNotHold: "Could not hold this rate.", noConnection: "No connection. Check your network and try again.",
  board: { RO: "Room only", BB: "Breakfast included", HB: "Half board", FB: "Full board", AI: "All inclusive", SC: "Self catering", RD: "Room" } as Record<string, string>,
  // travel
  gettingThere: "Getting there", leavingAt: "Leaving at", timeOfDay: "Time of day", notRunning: "not running", min: "min", travelFine: "Typical times for this hour, from the hotel door. Live traffic can add 10 to 15 minutes.",
  presets: ["Early", "Morning rush", "Midday", "Evening rush", "Late"], modes: { ride: "Taxi", metro: "Rail", tram: "Tram", walk: "Walk" } as Record<string, string>, bandHint: null as Record<string, string> | null,
  // extras
  extrasTitle: "Add the trip around the room", extrasSub: "Added at checkout, in the same payment, and canceled with the stay.", onItsOwn: (p: string) => `${p} on its own`,
  extras: null as Record<string, { name: string; short: string }> | null,
  // checkout
  checkout: "Checkout", heldExpired: "This price was held for 20 minutes and has expired.", freshPrice: "Get a fresh price", roomNights: (n: number) => `Room, ${n} ${n === 1 ? "night" : "nights"}, tax included`,
  showed: (s: string) => `${s} showed`, payNow: "You pay now", cityTax: "At the hotel, city tax", perPersonNight: "per person per night",
  freeUntilShort: (d: string, then: string | null) => `Free cancellation until ${d}${then ? `, then ${then}` : ""}.`, checkInWord: "check in", rateNoRefunds: "This rate has no refunds.",
  heldFor: "Price held for 20 minutes.", heldLeft: (m: string) => `Price held for ${m} more. After that we re-check it.`, whoTravels: "Who is traveling", firstName: "First name", lastName: "Last name", emailVoucher: "Email, for the voucher", mobileOpt: "Mobile, optional",
  errFirst: "Enter the first name as on the passport.", errLast: "Enter the last name.", errEmail: "Enter a valid email; the voucher goes there.", errTerms: "Please confirm you have read the cancellation terms.",
  addTrip: "Add to your trip", addTripSub: "Veny services, booked with the stay, one payment. Each one costs less than on its own site.", cancellation: "Cancellation",
  cancelTerms: (until: string, then: string | null, total: string) => `Cancel free until ${until}${then ? `. After that ${then} is charged` : ""}. If you do not turn up, the full ${total} is charged.`,
  noRefundTerms: (total: string) => `This rate has no refunds. The full ${total} is kept if your plans change.`, readTerms: "I have read the cancellation terms.", promo: "Promotion code, optional", promoPh: "Enter code",
  payNote: (desc: string) => `You pay Nomadly today and Nomadly pays the hotel. Your card statement will show NOMADLY*${desc}. City tax is paid at the hotel, not now.`, oneMoment: "One moment…", continuePay: (p: string) => `Continue to payment, ${p}`,
  noPayConfig: "Payment is not configured in this environment.", couldNotStart: "Could not start the payment.", noConnNothing: "No connection. Nothing was charged.", payment: "Payment", charging: "Charging…", payConfirm: (p: string) => `Pay ${p} and confirm`, declined: "The card was declined. Nothing was charged.",
  chargedIn: (cur: string) => `Charged in ${cur}; your bank converts it.`,
  // booking
  lookupTitle: "Your booking", lookupSub: "Enter the reference from your confirmation email and the email you booked with.", reference: "Reference", email: "Email", findMy: "Find my booking",
  status: {
    paying: ["Payment in progress", "We are waiting for the card confirmation. This page refreshes itself."], booked: ["Booking the hotel", "Payment received. Confirming with the hotel now."],
    on_request: ["Waiting for the hotel", "The hotel confirms within a few hours. We email you the moment it does."], confirmed: ["Confirmed", "Your room is booked. The voucher is in your email."],
    completed: ["Stay completed", "We hope it was a good one."], canceled: ["Canceled", "This booking is canceled. Any refund reaches your card in 5 to 10 working days."], failed: ["Did not go through", "The hotel could not confirm. If a charge shows on your card it is being refunded."],
  } as Record<string, [string, string]>,
  demoBooking: "Demo booking: paid with a Stripe test card while hotel prices are live. No room is reserved at the hotel and no money was taken.", demoSuffix: ", demo", room: "Room",
  yourRef: "Your reference", hotelConf: "Hotel confirmation", paid: "Paid", freeUntil: (d: string) => `Free until ${d}`, ifCanceledNow: (p: string) => `${p} if canceled now`,
  ifWrong: "If anything goes wrong", ifWrongText: "If the hotel cannot find your booking, show them the reference above and the voucher in your email. Nomadly support answers 7 days a week, 08:00 to 22:00 UTC, by phone and WhatsApp.",
  backStore: "Back to the storefront", cancelThis: "Cancel this booking", cancelFull: (p: string) => `Cancel now and the full ${p} goes back to your card.`, cancelCost: (pen: string, ref: string) => `Canceling now costs ${pen}; ${ref} goes back to your card.`,
  cannotUndo: " This cannot be undone.", couldNotCancel: "Could not cancel.", yesCancel: "Yes, cancel it", canceling: "Canceling…", keepIt: "Keep my booking",
  galleryOf: "of", closePhotos: "Close photos", prevPhoto: "Previous photo", nextPhoto: "Next photo",
};
export type Dict = typeof en;

const cs: Dict = {
  lang: "cs",
  hotels: "Hotely", yourBooking: "Moje rezervace", home: "Domů", creatorDashboard: "Přehled pro autory", forCreators: "Pro autory", chooseRoom: "Vyberte pokoj", reviewsN: (n: string) => `${n} hodnocení`, scoreWord: (r: number) => r >= 9 ? "Výjimečné" : r >= 8.5 ? "Vynikající" : r >= 8 ? "Velmi dobré" : r >= 7 ? "Dobré" : "Hodnoceno", fromWord: "od", dashboard: "Přehled",
  recommendedBy: (b) => `Doporučuje ${b}`, alsoPick: (b) => `Také tip: ${b}`, similarNearby: "Podobná ubytování poblíž", similarSub: "Hotely stejné třídy, od nejbližšího, s cenou na vaše termíny.",
  kmAway: (km) => km < 1 ? `${Math.round(km * 1000 / 50) * 50} m odsud` : `${km.toFixed(1).replace(".", ",")} km odsud`, pickGone: "Doporučený hotel nemá na tyto termíny volné pokoje. Zkuste jiné termíny nebo ubytování níže.",
  stayingIn: (p) => `Ubytování: ${p}`, theirPicks: (b) => `Tipy: ${b}`, seePicks: "Všechny tipy", picksSub: (n, p) => `${n} ${plural("cs", n, "hotel", "hotely", "hotelů")} v ${p} ${plural("cs", p, "místě", "místech", "místech")}, všechny vybrané a vyzkoušené.`,
  footRuns: (brand) => `${brand} běží na platformě Nomadly (Veny Inc.). Nomadly přijímá platbu a platí hotelu. Podpora každý den 08:00 až 22:00 UTC.`,
  photoCredits: "Autoři fotografií", findBooking: "Najít rezervaci",
  bannerMock: "Náhled: ceny jsou simulované a karty běží v testovacím režimu Stripe, nejde o skutečnou rezervaci.",
  bannerDemo: "Skutečné ceny hotelů, ukázková platba: zaplaťte testovací kartou Stripe 4242 4242 4242 4242. Žádný pokoj se nerezervuje a žádné peníze se nestrhnou.",
  metaTitle: (brand) => `${brand}: hotely s aktuálními cenami`,
  heroSub: (who) => `Aktuální ceny hotelů od ${who}, zaplacené jednou platbou, s odvozem z letiště a daty, pokud chcete.`,
  whereStayed: "Kde bydlet", placesHotels: (p, h) => `${p} ${plural("cs", p, "místo", "místa", "míst")}, ${h} ${plural("cs", h, "hotel", "hotely", "hotelů")}.`,
  pricesFor: (a, b) => `Ceny za noc, ${a} až ${b}`,
  hotelsN: (n) => `${n} ${plural("cs", n, "hotel", "hotely", "hotelů")}`, fromNight: (p) => `, od ${p} za noc`,
  everyHotel: "Všechny hotely", everyHotelDates: (a, b) => `Všechny hotely, ${a} až ${b}`, askingRates: "Zjišťujeme aktuální ceny v hotelech.",
  belowBig: (best, of) => `${best} z ${of} porovnaných je pro tento termín levnějších než velké portály. `,
  withRooms: (n) => `${n} s volnými pokoji.`, guestsNights: (a, n) => `${a} ${plural("cs", a, "dospělý", "dospělí", "dospělých")}, ${n} ${plural("cs", n, "noc", "noci", "nocí")}, včetně daní.`,
  seeList: "Zobrazit seznam", tryAgain: "Zkusit znovu", allN: (n) => `Všech ${n} hotelů`, noRoomsLeft: "Tyto hotely nemají pro zvolený termín volné pokoje.",
  howTitle: "Jak rezervace funguje",
  how: [["Úspora, jen když je skutečná", "Když máme ověřenou cenu z Booking.com nebo Expedie pro stejný pokoj, termín a počet hostů, uvidíte ji i svou úsporu. Bez ověření nic netvrdíme."], ["Platíte Nomadly", "Nomadly nakupuje pokoje za velkoobchodní ceny a platí hotelu. Potvrzení a číslo rezervace vám přijdou e-mailem."], ["Storno zdarma platí", "Flexibilní ceny lze zrušit zdarma do data uvedeného u ceny. Peníze se vrátí na kartu."]],
  fromArticle: "Z článku", readArticle: "Přečíst článek",
  where: "Kam", anywhere: "Kamkoli", checkIn: "Příjezd", checkOut: "Odjezd", guests: "Hosté", adultsN: (n) => `${n} ${plural("cs", n, "dospělý", "dospělí", "dospělých")}`,
  seePrices: "Zobrazit ceny", searching: "Hledáme", nightsRange: "Odjezd musí být 1 až 30 nocí po příjezdu.",
  biggestSaving: "Největší úspora", lowestPrice: "Nejnižší cena", mostBooked: "Nejčastěji rezervované", seeRooms: "Zobrazit pokoje", photos: "Fotky", photosN: (n) => `${n} ${plural("cs", n, "fotka", "fotky", "fotek")}`,
  allPhotosOf: (n, name) => `Zobrazit všech ${n} fotek hotelu ${name}`, star: (n) => `${n}${" "}★`, freeCancelUntil: (d) => `Storno zdarma do ${d}`, noRefunds: "Bez vrácení peněz",
  nightsN: (n) => `${n} ${plural("cs", n, "noc", "noci", "nocí")}`, aNight: (p) => `${p} za noc`, below: (p, src) => `o ${p} levněji než ${src}`, above: (p, src) => `o ${p} dráž než ${src}`,
  lessThan: (p, src) => `o ${p} levněji než ${src}`, noRoomsDates: "V těchto hotelech nejsou pro zvolený termín volné pokoje. Zkuste jiný termín.", showEvery: "Zobrazit všechny hotely",
  all: "Vše", stayLine: (a, b, n, ad) => `${a} až ${b}, ${n} ${plural("cs", n, "noc", "noci", "nocí")}, ${ad} ${plural("cs", ad, "dospělý", "dospělí", "dospělých")}`, listMeta: (a, b, n, ad) => `${a} až ${b}, ${n} ${plural("cs", n, "noc", "noci", "nocí")}, ${ad} ${plural("cs", ad, "dospělý", "dospělí", "dospělých")}. Celkové ceny včetně daní.`,
  bigChecked: (l) => `Ceny velkých portálů: ${l}.`, supplierDown: "Rezervační systém hotelů neodpověděl. Zkuste to prosím za chvíli.",
  ratedBy: (r, n) => `, hodnocení ${r} od ${n} hostů`, fromReviews: (r, n) => `, ${r} z ${n} recenzí`,
  allHotels: "Všechny hotely", roomsFor: (a, b, ad) => `Pokoje pro ${a} až ${b}, ${ad} ${plural("cs", ad, "dospělý", "dospělí", "dospělých")}`,
  stayed: (w) => `, bydleli jsme ${w}`, cheapestFlexUntil: (d, then) => `U nejlevnější flexibilní ceny storno zdarma do ${d}${then ? `, potom ${then}` : ""}.`,
  flexNoDate: "Flexibilní ceny lze zrušit; přesný termín storna u každé z nich uvidíte v pokladně před platbou.", taxNote: "Včetně daní. Městskou daň, pokud se platí, hradíte v hotelu.",
  tryOtherDates: "Zkusit jiný termín", noRooms: "Pro tento termín nejsou volné pokoje.", openPhoto: (i, n) => `Otevřít fotku ${i} z ${n}`, fullMap: "Otevřít celou mapu", mapOf: (n) => `Mapa: ${n}`, allPhotos: (n) => `Všech ${n} fotek`,
  freeCancel: "Storno zdarma", cancelFreeUntil: (d, then) => `Storno zdarma do ${d}${then ? `, potom se účtuje ${then}` : ""}.`,
  refundableNoDate: "Vratná cena. Přesný termín storna hotelu uvidíte v pokladně před platbou.",
  noRefundKept: (p) => `Po rezervaci nelze zrušit ani změnit. Při změně plánů propadá celých ${p}.`, onRequest: " Hotel potvrdí do několika hodin; do té doby se nic neúčtuje.",
  forNights: (n) => `za ${n} ${plural("cs", n, "noc", "noci", "nocí")}, včetně daní`, bookRate: "Rezervovat", holding: "Držíme cenu…", couldNotHold: "Tuto cenu se nepodařilo podržet.", noConnection: "Bez připojení. Zkontrolujte síť a zkuste to znovu.",
  board: { RO: "Bez stravy", BB: "Se snídaní", HB: "Polopenze", FB: "Plná penze", AI: "All inclusive", SC: "Vlastní stravování", RD: "Pokoj" },
  gettingThere: "Jak se dostat", leavingAt: "Odjezd v", timeOfDay: "Denní doba", notRunning: "nejezdí", min: "min", travelFine: "Obvyklé časy pro tuto hodinu, od dveří hotelu. Aktuální provoz může přidat 10 až 15 minut.",
  presets: ["Brzy ráno", "Ranní špička", "Poledne", "Odpolední špička", "Pozdě večer"], modes: { ride: "Taxi", metro: "Vlak", tram: "Tramvaj", walk: "Pěšky" },
  bandHint: { night: "Silnice jsou prázdné, MHD omezeně.", early: "Klidné silnice, nejrychlejší cesta na letiště.", amrush: "Hustý provoz do centra. Vlak nebo metro bývá rychlejší.", midday: "Běžný provoz.", pmrush: "Nejpomalejší doba na cestu autem přes město.", evening: "Provoz slábne.", late: "Pozdě v noci, ověřte poslední spoje." },
  extrasTitle: "Přidejte k pokoji celou cestu", extrasSub: "Přidáte v pokladně, v jedné platbě, a zruší se spolu s pobytem.", onItsOwn: (p) => `${p} samostatně`,
  extras: {
    transfer: { name: "Odvoz z letiště, soukromé auto", short: "Řidič čeká v příletové hale se jménem. Sleduje váš let." },
    esim: { name: "eSIM s daty", short: "Data hned po přistání. Instalace QR kódem ještě před odletem." },
    bag: { name: "Pojištění zavazadla", short: "Ztracené nebo zpožděné zavazadlo: USD 500 do 48 hodin, bez formulářů." },
    delay: { name: "Pojištění zpoždění letu", short: "Zpoždění přes 3 hodiny: USD 150 automaticky." },
  },
  checkout: "Pokladna", heldExpired: "Cenu jsme drželi 20 minut a vypršela.", freshPrice: "Získat aktuální cenu", roomNights: (n) => `Pokoj, ${n} ${plural("cs", n, "noc", "noci", "nocí")}, včetně daní`,
  showed: (s) => `${s} ukazoval`, payNow: "Platíte nyní", cityTax: "V hotelu, městská daň", perPersonNight: "za osobu a noc",
  freeUntilShort: (d, then) => `Storno zdarma do ${d}${then ? `, potom ${then}` : ""}.`, checkInWord: "příjezdu", rateNoRefunds: "Tato cena je nevratná.",
  heldFor: "Cenu držíme 20 minut.", heldLeft: (m) => `Cenu držíme ještě ${m}. Potom ji znovu ověříme.`, whoTravels: "Kdo cestuje", firstName: "Jméno", lastName: "Příjmení", emailVoucher: "E-mail pro voucher", mobileOpt: "Mobil, nepovinné",
  errFirst: "Zadejte jméno jako v pase.", errLast: "Zadejte příjmení.", errEmail: "Zadejte platný e-mail; přijde na něj voucher.", errTerms: "Potvrďte prosím, že jste si přečetli storno podmínky.",
  addTrip: "Přidat k cestě", addTripSub: "Služby Veny, rezervované s pobytem, v jedné platbě. Každá stojí méně než samostatně.", cancellation: "Storno podmínky",
  cancelTerms: (until, then, total) => `Storno zdarma do ${until}${then ? `. Potom se účtuje ${then}` : ""}. Pokud nedorazíte, účtuje se celých ${total}.`,
  noRefundTerms: (total) => `Tato cena je nevratná. Při změně plánů propadá celých ${total}.`, readTerms: "Přečetl(a) jsem si storno podmínky.", promo: "Slevový kód, nepovinné", promoPh: "Zadejte kód",
  payNote: (desc) => `Dnes platíte Nomadly a Nomadly platí hotelu. Na výpisu z karty uvidíte NOMADLY*${desc}. Městská daň se platí v hotelu, ne teď.`, oneMoment: "Moment…", continuePay: (p) => `Pokračovat k platbě, ${p}`,
  noPayConfig: "Platby nejsou v tomto prostředí nastavené.", couldNotStart: "Platbu se nepodařilo zahájit.", noConnNothing: "Bez připojení. Nic nebylo strženo.", payment: "Platba", charging: "Platíme…", payConfirm: (p) => `Zaplatit ${p} a potvrdit`, declined: "Karta byla zamítnuta. Nic nebylo strženo.",
  chargedIn: (cur) => `Účtujeme v ${cur}; převod na koruny provede vaše banka.`,
  lookupTitle: "Moje rezervace", lookupSub: "Zadejte číslo rezervace z potvrzovacího e-mailu a e-mail, se kterým jste rezervovali.", reference: "Číslo rezervace", email: "E-mail", findMy: "Najít rezervaci",
  status: {
    paying: ["Probíhá platba", "Čekáme na potvrzení karty. Stránka se obnoví sama."], booked: ["Rezervujeme hotel", "Platba přijata. Potvrzujeme s hotelem."],
    on_request: ["Čekáme na hotel", "Hotel potvrdí do několika hodin. Hned vám napíšeme."], confirmed: ["Potvrzeno", "Pokoj je zarezervovaný. Voucher máte v e-mailu."],
    completed: ["Pobyt proběhl", "Doufáme, že se vám líbilo."], canceled: ["Zrušeno", "Rezervace je zrušená. Případná refundace dorazí na kartu do 5 až 10 pracovních dnů."], failed: ["Nepodařilo se", "Hotel rezervaci nepotvrdil. Pokud vidíte platbu na kartě, vracíme ji."],
  },
  demoBooking: "Ukázková rezervace: zaplaceno testovací kartou Stripe při skutečných cenách. V hotelu se nic nerezervovalo a žádné peníze se nestrhly.", demoSuffix: ", ukázka", room: "Pokoj",
  yourRef: "Číslo rezervace", hotelConf: "Potvrzení hotelu", paid: "Zaplaceno", freeUntil: (d) => `Zdarma do ${d}`, ifCanceledNow: (p) => `${p} při zrušení nyní`,
  ifWrong: "Když se něco pokazí", ifWrongText: "Pokud hotel vaši rezervaci nenajde, ukažte mu číslo rezervace výše a voucher z e-mailu. Podpora Nomadly odpovídá 7 dní v týdnu, 08:00 až 22:00 UTC, telefonicky i přes WhatsApp.",
  backStore: "Zpět na hotely", cancelThis: "Zrušit rezervaci", cancelFull: (p) => `Při zrušení nyní se vám vrátí celých ${p}.`, cancelCost: (pen, ref) => `Zrušení nyní stojí ${pen}; na kartu se vrátí ${ref}.`,
  cannotUndo: " Tuto akci nelze vrátit.", couldNotCancel: "Rezervaci se nepodařilo zrušit.", yesCancel: "Ano, zrušit", canceling: "Rušíme…", keepIt: "Ponechat rezervaci",
  galleryOf: "z", closePhotos: "Zavřít fotky", prevPhoto: "Předchozí fotka", nextPhoto: "Další fotka",
};

export const dict = (lang: Lang): Dict => (lang === "cs" ? cs : en);

/** Destination names the way Czech readers write them. */
const CS_PLACES: Record<string, string> = { paris: "Paříž", london: "Londýn", dubai: "Dubaj", "new-york": "New York", singapore: "Singapur", istanbul: "Istanbul", marrakech: "Marrákeš", amsterdam: "Amsterdam", barcelona: "Barcelona", rome: "Řím", rio: "Rio de Janeiro", lisbon: "Lisabon", madeira: "Madeira" };
export const placeName = (slug: string, fallback: string, lang: Lang) => (lang === "cs" ? CS_PLACES[slug] ?? fallback : fallback);
export const plurals = plural;

/** Everything a page needs to write prices and dates for its readers; serializable, so client components get it as a prop. */
export interface ReaderFmt { lang: Lang; currency: string; disp: string | null; rate: number | null }
export const price = (f: ReaderFmt, v: number, whole = true) => money(v, { lang: f.lang, currency: f.currency, whole });
export const approxOf = (f: ReaderFmt, v: number) => approx(v, f.rate, f.disp, f.lang);
