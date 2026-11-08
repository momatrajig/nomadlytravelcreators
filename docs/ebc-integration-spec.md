# Nomadly Stays to eBooking Center (DCS Plus IRIX v4.7.4) integration specification

Version 1.1, 5 November 2026. Sources: eBooking Center reseller API documentation (Hotels API 1.3.4, Mapping API 1.2.3, Reservations API 1.2.15, Credit API 1.0.3) plus supplier emails. Where the documentation is silent, this spec says so explicitly rather than guessing.


## 1. Overview and authentication

Base URL for every API: `https://www.ebookingcenter.com/tbs/reseller/api`. Paths below are relative to it. All responses are `application/hal+json`.

Token endpoint: `https://www.ebookingcenter.com/tbs/reseller/oauth2/token`, OAuth 2.0 client credentials grant (an authorization code flow also exists at `/tbs/reseller/oauth2/authorize` but is not needed for a server to server adapter). Send `Authorization: Bearer {token}` on every call.

| API | Scopes (as listed in the docs) |
|---|---|
| Hotels | `read:hotels-search` (search, results, availability), `write:hotels-book` (book; requires `read:hotels-search`) |
| Mapping | `read:mapping`, `read:mapping-archive` (archive export), `read:mapping-components` (component matching data; no endpoint for it appears in the dump) |
| Credit | `read:resellerCredit` |
| Reservations | `read:reservations`, `write:reservations` (cancel, sync status), `write:reservations-switch-to-credit`, `read:reservations-documents`, `read:reservations-comments`, `write:reservations-comments`, `read:reservations-webhooks`, `write:reservations-webhooks`, `read:reservations-backOfficeRemarks`, `write:reservations-backOfficeRemarks`, `write:reservations-air-void`, `write:reservations-air-refund`, `write:reservations-air-reissue` |

Token caching rules (the Hotels doc calls per call token requests "a severe anti-pattern" that triggers rate limiting and account restrictions): request one token with the union of scopes needed, cache it in memory with `expires_in`, reuse it across APIs, refresh proactively before expiry and on a 401. The docs do not state the token lifetime; the supplier says tokens expire every 12 or 24 hours. Treat `expires_in` as authoritative.

Rate limiting: headers `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` (Unix timestamp) appear only when a limiter is active. Named limiters: `hotels-search-limiter`, `mapping-limiter`, `mapping-archive-limiter`, `mapping-hotelDetails-limiter`, `reservations-limiter`. No numeric limits are published (the Mapping doc's 1000 per window is an illustration). Limits are per client credential. Retry: exponential backoff from 1 second, doubling, 3 to 5 attempts, 25 percent jitter, retry on 429 and 5xx only.

Error format is RFC 7807: `{ "title", "type": "https://httpstatus.es/400", "status", "detail", "instance": "/hotels/v1/search/sync" }`. Standard codes 400, 401, 403, 404, 429, 500; the cancel endpoint can also return 423 Locked.

Postman collection: `https://github.com/10n/irix-reseller-postman`.

## 2. Static data load (Mapping API, 27 endpoints)

### 2.1 Archive export (the supplier's required path for the full hotel list)

The reference section documents `GET /mapping/v1/archive/export` with query parameters (the narrative says POST once; the parameter table and every worked example use GET with a query string, so use GET). It is asynchronous: the response is only `{ "id": 50, "status": "requested", "message": null }`, and the file is announced later by webhook.

| Parameter | Meaning |
|---|---|
| `notificationUrl` | Public HTTPS endpoint that receives the completion POST |
| `countries`, `cities`, `hotels`, `hotelDetails`, `locations`, `airlines`, `nationalities`, `regions`, `facilities` | Booleans (`=1` or `=true`); at least one required |
| `languages[]` | Locale codes such as `en_GB` (full locale, not `en`); affects only `Facilities.xml` and `HotelDetails/*.xml`; get the list from `GET /mapping/v1/languages` |
| `incrementalFromDate` | `YYYY-MM-DD`, inclusive; filters on each record's `LastUpdated` |
| `incrementalTarget[]` | `details` (content changes, default) and/or `components` (supplier mapping changes); docs recommend both |
| `fullListIds` | Adds `{DataType}IDs.xml` files with the complete ID list regardless of incremental filters |

Status values: `requested`, `generating`, `generated`, `pushed_ok`, `pushed_error`, `generate_error`. Generation takes 5 to 60 minutes. The webhook POST carries `id`, `status`, `filename`, `filesize`, `md5` and `_links.download.href` (an authenticated link that expires after 24 hours). The webhook must answer HTTP 200 with body `{"received": true}`. Verify the MD5 before import. Do not submit concurrent export requests.

Delivery is a ZIP of XML files (the narrative says JSON in two places; the structure section and every sample are XML): `Countries.xml`, `Cities.xml`, `Hotels.xml`, `Locations.xml`, `Airlines.xml`, `Nationalities.xml`, `Regions.xml`, `Facilities.xml`, and `HotelDetails/{countryId}.xml` (one file per country).

`Hotels.xml` record: `<Hotel ID CountryID CityID Name Stars Address Latitude Longitude Type LastUpdated/>`. `HotelDetails/{countryId}.xml` record: `<HotelDetails ID CountryID CityID Name Stars>` with `<Descriptions>` (ShortDescription, FullDescription), optional `<Translations><Language code>` (TranslatedName, ShortDescription, FullDescription, Location, Facilities, RoomsDescription), and language neutral `<Contact>`, `<Gallery>`, `<MatchedComponents>`, `<Facilities>`. The content of `<MatchedComponents>` is not documented (shown as an ellipsis). `Cities.xml`: `ID CountryID Name Code Searchable SearchableOn`. `Countries.xml`: `ID Name ISO Searchable SearchableOn`. `Nationalities.xml`: `ID Name ISO` (the `leaderNationality` search parameter is this ID).

Refresh cadence from the docs: complete archive monthly or quarterly; hotels plus details weekly; geographic data weekly; reference data monthly; incremental exports daily or weekly. Cache guidance: countries 48 to 72 hours, cities 24 to 48 hours, hotel basic info 6 to 12 hours, hotel details 2 to 4 hours, images 24 hours, components 1 to 2 hours, all to be confirmed with the IRIX administrator. Recommended for Nomadly: one full export at go live (`hotels=1&hotelDetails=1&cities=1&countries=1&nationalities=1&facilities=1&languages[]=en_GB&fullListIds=1`), a weekly incremental with both `incrementalTarget[]` values from the last successful sync date, and a quarterly full reload.

### 2.2 Per entity endpoints

All list endpoints paginate with `page` (1 based) and `perPage` (default 10, max 100) and return `_total_items`, `_page`, `_page_count`, `_links`, `_embedded`.

| Endpoint | Key parameters and fields |
|---|---|
| `GET /mapping/v1/countries`, `GET /mapping/v1/countries/{countryId}` | `id`, `name`, `iso`, `services[]` (hotel, car, air, insurance, package, transfer, activity) |
| `GET /mapping/v1/nationalities`, `GET /mapping/v1/nationalities/{nationalityId}` | `id`, `name`, `iso` |
| `GET /mapping/v1/cities`, `GET /mapping/v1/cities/{cityId}` | filters `countryId`, `cityIds`, `name` (partial, case insensitive), `code`; fields `id`, `countryId`, `name`, `code`, `geolocation{latitude,longitude}`, `services[]` |
| `GET /mapping/v1/locations`, `GET /mapping/v1/locations/{locationId}` | airports, stations, points of interest; `Type` airport, trainstation, busstation, other; `Code`, position, linked cities |
| `GET /mapping/v1/regions`, `GET /mapping/v1/regions/{regionId}` | `Type` Region or Island, member cities |
| `GET /mapping/v1/airlines`, `GET /mapping/v1/airlines/{airlineCode}`, `GET /mapping/v1/languages` | reference data; languages returns `{code, name}` |
| `GET /mapping/v1/hotels` | filters `countryId`, `cityId`, `hotelIds` (comma list, max 50, invalid IDs silently dropped), `perPage` 3 to 100 |
| `GET /mapping/v1/hotels/{id}/details` | `id`, `name`, `type`, `address`, `telephone`, `fax`, `email`, `zipCode`, `stars` (1 to 5), `recommended`, `specialDeal`, `country{id,name,iso}`, `city{id,countryId,name,code,geolocation}`, `geolocation{latitude,longitude}`; extra limiter `mapping-hotelDetails-limiter` |
| `GET /mapping/v1/hotels/{id}/descriptions?language=` | `hotelId`, `language`, `name`, `address`, `roomDescription`, `locationDescription`, `facilitiesDescription` and their `...Source` fields |
| `GET /mapping/v1/hotels/{id}/images`, `GET /mapping/v1/hotels/{id}/mainImage`, `GET /mapping/v1/hotels/images/{id}` | `id`, `hotelId`, `url`, `source`, `name` |
| `GET /mapping/v1/hotels/{id}/facilities`, `GET /mapping/v1/hotels/facilities/{id}` | `id`, parent id, `language`, `name`, `priority`, `visible` |
| `GET /mapping/v1/hotels/{id}/categories`, `GET /mapping/v1/hotels/categories/{id}`, `GET /mapping/v1/hotels/types`, `GET /mapping/v1/hotels/types/{id}` | classification and accommodation type lists (`id`, `name`, `language`, `priority`) |
| `GET /mapping/v1/hotels/{id}/contact` | contact block |

### 2.3 Fields for hotel matching against Expedia Rapid and LiteAPI

Available for matching: hotel `ID` (the same value as `index` in search and `hotelId` in reservations), `Name`, `Address`, `Latitude`, `Longitude`, `CityID`, `CountryID`, `Stars`, `Type`, plus `zipCode`, `telephone`, `email` from the details endpoint. Not available: GIATA is not mentioned anywhere in the three documents, and no field in `Hotels.xml` or `/hotels/{id}/details` carries a cross supplier identifier. The only supplier IDs exposed are `supplierReferences.hotelId` and `roomTypeCode` inside search offer rooms and reservation rooms, and only when the account's "Show supplier" configuration is on. `<MatchedComponents>` in the archive may hold supplier mappings but is undocumented. Nomadly's matcher must rely on name, coordinates and address, with `supplierReferences.hotelId` as a confirmation signal after a search (if it equals the Expedia Rapid property ID Nomadly already stores, the match is exact).

## 3. Search (Hotels API, 24 endpoints)

Hotel search is a two tier model: a hotel contains offers, an offer belongs to one supplier `system` and contains `rooms` and `packages`; a package is a room combination that satisfies the requested occupancies and is the unit that gets prebooked and booked. Availability status at room, package and offer level is `OK` (immediate booking) or `RQ` (on request, supplier confirmation may take 24 to 48 hours).

### 3.1 Synchronous search

`POST /hotels/v1/search/sync`, scope `read:hotels-search`, limiter `hotels-search-limiter`. Hotel IDs only, maximum 200 IDs, no destination search, client timeout 30 to 60 seconds recommended.

Request body: `accommodation` (1 to 200 unique integers, required), `checkIn`, `checkOut` (`YYYY-MM-DD`, required), `occupancy` (required) with `leaderNationality` (Mapping nationality ID, required) and `rooms` (1 to 10 items, each `adults` 1 to 9 and `childrenAges` up to 8 ages of 0 to 18, relative to check in), `sellingChannel` (`B2B` or `B2C`, required), `language` (`en_GB`), `timeout` (seconds), `availableOnly`, `cancellationDeadline` (true asks the API to compute room `cancellationDeadline`), `completeOffersOnly`, `travelPurpose` (`leisure`, `business`), `providers[]` (codes in examples: `expediarapid`, `hotelbeds`, `bronevik`, `hotelbookpro`, `travelgatex`), `providerParameters` (must be enabled per client; `GET /hotels/v1/provider-parameters` lists them and needs special access). Neither search body takes a currency; currency is a query parameter of the results endpoint (3.2) and the account configuration decides the default.

Example:

```json
{
  "accommodation": [1230, 9821016],
  "checkIn": "2026-12-12", "checkOut": "2026-12-15",
  "occupancy": { "leaderNationality": 158,
    "rooms": [ { "adults": 2, "childrenAges": [] }, { "adults": 1, "childrenAges": [6] } ] },
  "language": "en_GB", "timeout": 10, "sellingChannel": "B2B",
  "cancellationDeadline": true, "availableOnly": true
}
```

Response: `srk` (search results key), `tokens.results`, `hotels[]`, `_links.self`. Each hotel: `index` (hotel ID, same as the Mapping ID), `name`, `stars`, `recommended`, `specialDeal`, `minPrice{value,currency}` (or `PriceTypeWithProviderCode` carrying the supplier code since 1.3.4), `rateTags[]` (`negotiated`, `package`, `members-only`, `business-friendly`, custom), `nonRefundable[]{code: nonrefundable | refundable | unknown, price}`, `boardBasis[]{code, price}` with codes `RO` room only, `SC` self catering, `BB` bed and breakfast, `HB` half board, `FB` full board, `AI` all inclusive, `RD` room description (board unknown), `offers[]`, `offerLimiter{mode: "offerPackages", total, count}`. Each offer: `id` (string, may be alphanumeric), `recommended`, `specialDeal`, `minPrice`, `boardBasis`, `nonRefundable`, `rateTags`, `rooms[]`, `packages[]`, `system{code, alias}`.

### 3.2 Asynchronous search and result endpoints

Every endpoint below takes `token=` as a query parameter: the `progress` token for progress, summary, stop and cancel; the `async` token for streaming; the `results` token for everything else. Sample tokens in the docs carry a 10 hour expiry (`iat` to `exp`), so a search context is reusable for a working session but not for days.

| Endpoint | Notes |
|---|---|
| `POST /hotels/v1/search/start` | Body as sync, except `destination` replaces `accommodation` and is one of `accommodation[]` (max 200), `city{id}` or `city{code}`, `location{id}` or `location{code}`, `region{id}`, or a geolocation point with radius (example 10 km); optional `filters{name (min 2 chars), classification[] 1 to 5}`. Returns `status`, `progress`, `countOffers`, `countHotels`, `srk`, `tokens{async, progress, results}`, `_links{async, progress, summary}` |
| `GET /hotels/v1/search/progress` | `status` `IN_PROGRESS`, `COMPLETED`, `ERROR`; `progress` 0 to 100 (narrative examples use 0.0 to 1.0; handle both); `progressDetails{general, systems{code: pct}}`; optional `_embedded.summary{count, hotels[]{id, name, stars, type, address, zipCode, country, city, geolocation, minPrice, boardBasis, nonRefundable, rateTags}}` |
| `GET /hotels/v1/search/progress/summary` | Lightweight variant for frequent polling |
| `POST /hotels/v1/search/stop`, `POST /hotels/v1/search/cancel` | Stop keeps collected results; cancel discards the search |
| `GET /hotels/v1/search/async/{srk}` | Streaming results, same hotel and offer structure as sync; follow `tokens.next` until null with 2 to 3 seconds between calls |
| `GET /hotels/v1/search/results/{srk}` | Final hotel list, paginated: `page`, `perPage` (default 30, max 100), `sortField` (`price`, `stars`, `pointOfInterest`, `name`, `recommended`, `specialDeal`), `sortOrder`, `currency` (ISO 4217), `includeHotelDetails` 0 or 1, `excludeNonRefundable` 0 or 1, filters `hotelIds`, `hotelCategoryIds`, `hotelTypeIds`, `hotelFacilityIds`, `hotelLocationIds`, `boardBasis[]`, `hotelClassifications[]`, `hotelName`, `hotelAddress`, `priceRange`, `geofence`. Response `pages{current, total, itemsPerPage, totalItems}` and `hotels[]` with `index`, `minPrice`, flags and tags; offers are not included here |
| `GET .../results/{srk}/searchFilters`, `GET .../results/{srk}/refinedFilters` | The search input as stored, and the filter values present in the results (`stars`, `types`, `categories`, `facilities`, `boardBasis`, price range) for building the filter rail |
| `GET .../results/{srk}/hotels/{hotelIndex}/details` | `languages[]`, `includeExtendedDetails` 0 or 1; returns `id`, `name`, `stars`, `type`, `address`, `zipCode`, `country`, `city`, `geolocation`, `telephone`, `fax`, `email`, flags; the docs promise images, amenities and reviews with extended details |
| `GET .../hotels/{hotelIndex}/offers` | All offers of one hotel; no pagination; sorted by price and availability |
| `GET .../offers/{offerIndex}` | `rooms[]{index, name, status, board, boardBasis, nonRefundable (boolean), price, rateTags, info, supplierReferences{roomTypeCode, hotelId}, cancellationDeadline{date, charge}}` and `packages[]{packageCode, packageToken, status, complete, price, packageRooms[]{packageRoomCode, occupancy, roomReferences[]{roomCode, roomToken, selected}}}` |
| `GET .../offers/{offerIndex}/rooms`, `GET .../rooms/{roomIndex}` | Room descriptions, amenities, images |
| `GET .../offers/{offerIndex}/price?packageToken=&roomTokens[]=` | Package price for a chosen room combination before prebook |

Prices everywhere are `ExtendedPriceType`: `selling{value, currency}` plus optional `components{supplier, markup, commission}`. The `selling` figure is the reseller's selling price; `supplier` is the cost. Which components are published depends on the account configuration. Pricing rule: use `packages[].price` when present, otherwise sum the referenced `rooms[].price`. Note that children may come back in a different order than searched; always read `packageRooms[].occupancy`.

## 4. Availability (prebook), payment and book

Path pattern for all steps: `/hotels/v1/search/results/{srk}/hotels/{hotelIndex}/offers/{offerIndex}/...` with `?token={results token}`; `hotelIndex` is `hotels[].index`, `offerIndex` is `offers[].id`.

### 4.1 Availability

`POST .../availability` (mandatory before any booking). Request body: `packageToken` (required), `roomTokens[]` (required, one per occupancy, chosen from `roomReferences`), optional `extraServices[]{packageRoomCode, services[]{serviceId, rate, periods[], travellers{"18-99": 2}}}`.

Response fields: `availabilityToken` (single use, tied to this exact configuration), `serviceDates{startDate, endDate, duration, type: "nights"}`, `system{code, alias}`, `supplierHotelId` (the supplier's component ID, when configured), `package{packageCode, packageToken, status OK | RQ, complete, packageRooms[], price, rate{name, description}}`, `rooms[]` (same shape as 3.2, `nonRefundable` boolean must be revalidated here), `paymentMethods` (4.2), `bookingOptions[]{optionCode, title, value or options[]{label, value}, included}` (for example `early_checkin`), `autocancelDate` (when the reservation is auto cancelled if unpaid), `cancellationPolicy{date, policies[]{type: standard | noshow | limit | lock, date, charge{value, currency}}}` (the response sample uses `startDate` and `type: "penalty"`, contradicting the schema; parse both), `price{selling, components{supplier, markup, commission}}` (the revalidated total), `priceBreakdown{packages[]{price, date}, rooms[]{roomCode, dates[]}}` (per day), `remarks[]{group, list[]}` with groups `CATEGORY_PROMOTION`, `CATEGORY_CHECKIN_CHECKOUT_NOTES`, `CATEGORY_CANCELLATION_NOTES`, `CATEGORY_TAXES_FEES`, `CATEGORY_AMENDMENT_POLICIES`, `CATEGORY_SPECIAL_REQUIREMENTS`, `CATEGORY_ESSENTIAL_INFORMATION`, `CATEGORY_EMERGENCY_NUMBERS`, `CATEGORY_VOUCHER_REMARKS`, `CATEGORY_ROOM_DESCRIPTION`, `CATEGORY_TRADER_INFORMATION`, `CATEGORY_GENERAL_REMARKS`, `taxes[]{type: general | sales | property | resort | mandatory, name, amount, currency, isIncluded, description}`, `termsAndConditions[]{type: "supplierTerms", text, url}`, `boardBreakdown[]`, `offerConfiguration`, `extraServices[]`, `_links{self, credit, payment}`.

`offerConfiguration` drives the guest form: `contactDetails{email, phone, address, city, country, postalCode}` each `{required}`, `identificationDocument{fiscalIdentificationNumber, personalIdentificationNumber}`, `priceModifiers{allowed, components[]: markup | commission | sellingPrice}`, `birthdate{adults, children}` (which passenger types must supply a birth date), and `supplierBookingForm` (a dynamic form: field name, `required`, `restrictions{type: string | numeric | enum | date | email, pattern, format, options}`). Child birth dates must fall in the range implied by the searched age: for age 4 and check in 2023-12-25 the docs give 2018-12-26 to 2019-12-25.

`extraServices[].services[]`: `serviceId`, `name`, `perRoom`, `mandatory`, `payableAtReception`, `price`, `referencePrices` (granular prices such as `per_person_per_day`, optionally per age band), `info`, `ageGroupList`, `rateList`, `periods`, `configuration`.

Two helper endpoints: `GET .../availability/price/modifiers?availabilityToken=&markup=&commission=&sellingPrice=&ignoreMinimumSellingPrice=` previews the selling price with an agency markup or commission applied (`sellingPrice` is exclusive of the other two), and `GET .../availability/back-office-remarks?availabilityToken=` returns `configurations[]{id, label, prefix, isMandatory}` that the book call may have to fill.

Any difference between the search offer and the prebook response means the offer was reconfigured; the old `availabilityToken` is invalid and prebook must be repeated. Documented error codes: `AVAILABILITY_TOKEN_EXPIRED`, `OFFER_RECONFIGURED`, `PAYMENT_GATEWAY_ERROR`, `PAYMENT_ORDER_INVALID`, `ROOM_UNAVAILABLE`.

### 4.2 Payment options

`paymentMethods` is an envelope with one key per method: `credit`, `prepaid`, `paynow`, `supplier`, `reception`. The book call's `payment.method` enum is the same five values.

```json
"paymentMethods": {
  "credit": { "code": "credit",
    "info": { "resellerId": 1701, "active": true, "enabled": true, "startDate": "2020-01-01",
              "endDate": "2030-12-31", "unlimited": false,
              "available": { "value": 8500, "currency": "EUR" },
              "creditSource": { "identifier": "dcsplus-irix-default", "name": "IRIX (default)" } } },
  "paynow": { "code": "paynow",
    "options": [ { "id": "testGateway-EUR-netPrice", "name": "TestGateway", "type": "redirect",
                   "token": "...", "provider": "testGateway", "amountType": "netPrice",
                   "price": { "value": 410.84, "currency": "EUR" } } ],
    "configurations": { "requiresAuthorisationBeforeBook": true } }
}
```

`credit`: book directly, billed against the reseller credit line (`info` mirrors the Credit API). `supplier`: book with `payment.method: "supplier"`, the option `token`, and `payment.data` filled per `paymentMethods.supplier.options[].fields` (card details for pay at hotel). `reception` and `prepaid` have no extra body documented. `paynow`: `POST .../payment` with `{ availabilityToken, provider, paymentToken, params{successUrl, failureUrl, notificationUrl} }` (all URLs nullable) returns `{ id, type, amount, status, provider{id, name, type}, _links{authorisation{type: "redirect", href}, authorisationQrCode} }`; `amountType` is `netPrice` or `sellingPrice`; payment tokens are valid for 30 minutes; redirect the payer, then poll `GET /payment/v1/orders/{paymentId}`. `PaymentStatusType` values: `initiated`, `authorisation_pending`, `authorised`, `authorisation_failed`, `authorisation_refused`, `cancelled`, `release_pending`, `released`, `release_failed`, `confirmation_pending`, `confirmed`, `confirmation_failed`, `refund_pending`, `refunded`, `refund_failed`. Gateways named: KnPay, EuPlatesc.ro, MintEFT, TestGateway, Vindi. Nomadly should book on `credit` and treat `paynow` as a later phase.

### 4.3 Double booking check and book

`POST .../double-booking-verification` (1.3.4): body `{ availabilityToken, rooms[]{packageRoomToken, travelers[]{firstName, lastName}} }` (names at least 2 characters). Response `hasDoubleBookings`, `count`, `reservations[]{id, serviceDates{startDate, endDate, duration, durationType}, origin, destination, passengers[]{paxId, type, lead, title, firstName, lastName, dateOfBirth, email, phone, phonePrefix}, added}`. Run it before every book and show the agent any match.

`POST .../book`, scope `write:hotels-book`. Body:

- `availabilityToken`; `clientRef` (pattern `^[a-z0-9\-_:.]+$`, case insensitive, unique across all reservations); optional `bosRef`, `agentRef`.
- `rooms[]{packageRoomToken, travelers[]}` with traveler `reference` (up to 12 characters, pattern `^[a-z0-9\-_:.]{1,12}$`, unique per traveler), `type` (`adult`, `child`, `infant`), `lead` (exactly one true), `title` (`mr`, `mrs`, `miss`, `ms`, `mstr`), `firstName`, `lastName`, `email`, `phonePrefix`, `phone`, `identificationNumbers`, `occupation`, `address`, `country`, `city`, `postalCode`, `birthDate` (mandatory for children; verify child order against the availability response).
- `payment{method, token, data, order{id}}` as in 4.2.
- `priceModifiers{markup, commission, sellingPrice, ignoreMinimumSellingPrice}` when `offerConfiguration.priceModifiers.allowed` is true (`sellingPrice` cannot be combined with `markup`).
- `bookingOptions[]{optionCode, value}`, `supplierBookingForm{field: value}`, `comments`, `backOfficeRemarks[]{id, text}`.

Response: `id` (reservation ID), `clientRef`, `type: "hotel"`, `status` (`OK` or `RQ`), `price{net, commission, selling}`, `notifications[]{type: warning | error | info | success, code, text}`, `added{time, user}`, `_links.reservation`. Vouchers come from the Reservations documents endpoints, not from book.

## 5. Reservations lifecycle (Reservations API, 38 endpoints, 24 hotel relevant)

| Endpoint | Method | Use for hotels |
|---|---|---|
| `/reservationsApi/v1/reservations` | GET | List with filters `id`, `clientRef`, `service=hotel`, `status`, `paymentStatus`, `paymentType[]`, `serviceDate` (single or `YYYY-MM-DD|YYYY-MM-DD`), `reservationDate`, `hotelId`, `destinationCityId`, `supplierConfirmationNumber`, `voucherGenerated`, `cancelPenalty`, `autocancelDate`, `text`, `page`, `perPage` (max 100), `orderField`, `orderDirection` |
| `/reservations/{id}` | GET | Full reservation |
| `/reservations/reference/{clientRef}` | GET | Lookup by Nomadly reference |
| `/reservations/{id}/sync-status` | POST | Forces a status refresh from the supplier; returns the reservation |
| `/reservations/{id}` | DELETE | Cancel; irreversible; applies the cancellation policy; 423 if locked |
| `/reservations/{id}/payment-details` | GET | `payment{status, type, deadline}`, `operations[]{id, type, price{net, commission, currency}, paymentStatus, service, addTime, payments[]}` |
| `/reservations/{id}/switch-to-credit` | PUT | Moves a reservation to credit payment; scope `write:reservations-switch-to-credit` |
| `/reservations/{id}/documents` | GET | `documents[]{code, name, documents[]{filename, description, token, references[]}}`; codes seen: `resDetails`, `voucher` |
| `/reservations/{id}/documents/generate?token=` | GET | Returns `name`, `token`, `size`, `md5`, `_links.download.href` for the PDF |
| `/reservations/{id}/comments` | GET, PUT | PUT body is a plain JSON string; response `commentId`, `comment`, `senderUser`, `readByUser`, `addTime`, `readTime` |
| `/reservations/{id}/comments/{commentId}` and `.../read` | GET, PUT | Read one, mark read |
| `/reservations/{id}/backOfficeRemarks[...]` | GET, POST, PATCH, DELETE | Internal remarks keyed by `remarkCode` |
| `/reservations/{id}/webhooks` | PUT, GET | Subscribe `{ "url": "https://..." }` (HTTPS required); list with `isActive` |
| `/reservations/{id}/webhooks/{webhookId}` | GET, DELETE | Manage one subscription |
| `/reservations/{id}/webhooks/{webhookId}/test` | POST | Sends `{ "id", "event": "test", "data": { "message", "timestamp" } }` |
| `/reservations/{id}/webhooks/{webhookId}/logs`, `.../logs/{logId}` | GET | Delivery logs |
| `/reservations/{id}/air/...` (issue-methods, issue-tickets, void-details, void-tickets, refund-details, refund-tickets, reissue-details, reissue-shopping and offers, fareRules) | various | Air only; 14 endpoints, not used by Nomadly Stays |

Key fields on a reservation: `id`, `clientRef`, `type`, `source` (`app`, `reseller`, `webservice`), `reference{external, confirmation}`, `hotelConfirmationNumber`, `userConfirmations{status: REQUIRED | PENDING | CONFIRMED | REJECTED | UNKNOWN, list[]{id, title, status, url}}` (3D Secure and similar), `service.status` with `OK` confirmed, `RQ` on request, `XX` cancelled, `XP` cancellation pending, `AM` amended, `payment{status: OK paid | PR payment required | NR not required, type: prepaid | credit | reception | paynow | supplier, paymentDeadline}`, `prices{currency, issue{supplier, markup, net, commission, selling}, total{...}}` (issue is the booking time price, total the current price after amendment or cancellation; components depend on client permissions), `autocancelDate`, `cancellationPolicy{date, policies[]{type: standard | noshow | limit | lock, date, charge{value,currency}}}`, `serviceDates{startDate, endDate, duration, type}`, `hotel{id, cityId, countryId, name, stars}`, `rooms[]{id, name, board, boardBasis, info, type, supplierReferences{roomTypeCode, hotelId}}`, `passengers[]`, `_links{syncStatus, switchToCredit, cancel, documents, comments}`.

Cancellation fee preview: there is no quote endpoint; the DELETE response is the full reservation, so the fee is only known afterwards. Nomadly must compute the expected penalty from `cancellationPolicy.policies[]` on the GET (`standard` entries carry a `charge` from their `date`; `limit` means cancellation is impossible from that date; `lock` means not via API) and show it to the agent before calling DELETE.

Webhooks are registered per reservation, not per account, so Nomadly must call `PUT /reservations/{id}/webhooks` right after each booking. Events: `status.change`, `payment_status.change`, `reference_confirmation.change`, `comment.add`, `voucher.generated`, plus callbacks named "Hotel Confirmation Number Changed" and "User Confirmation Required"; `ticket.*`, `pnr.changed` and `time_limit.changed` are air only. The receiver must return HTTP 200 with `{"received": true}`; failed deliveries are retried with exponential backoff.

## 6. Credit API

`GET /credit/v1/get`, scope `read:resellerCredit`. Returns `resellerId`, `enabled`, `active`, `startDate`, `endDate`, `unlimited`, `available{value, currency}`, `creditSource{identifier, name}`. Cache the balance for 2 to 5 minutes; the prebook response also carries `paymentMethods.credit.info.available`, which is the authoritative figure at booking time. Same rate limit headers.

## 7. Nomadly adapter mapping

| Nomadly Stays operation | eBooking Center call sequence |
|---|---|
| Static import | `GET /mapping/v1/archive/export` (full, then weekly incremental) via webhook; `GET /mapping/v1/hotels/{id}/images` and `/descriptions` on demand with the documented cache windows |
| Resolve destination | Local city table from `Cities.xml`; fallback `GET /mapping/v1/cities?name=` |
| Search by city | `POST /hotels/v1/search/start` with `destination.city.id`; poll `GET /search/progress?token=`; `GET /search/results/{srk}?token=&currency=&sortField=price&perPage=` for the hotel list and `GET .../refinedFilters` for the filter rail; `GET .../hotels/{hotelIndex}/offers` when a hotel is opened; map `nonRefundable`, `boardBasis`, `minPrice`, `system.code` into the Rates by source table |
| Search by hotel IDs (up to 200) | `POST /hotels/v1/search/sync` with `accommodation[]`; for more than 200, chunk and merge |
| Offer, room and property detail | `GET .../offers/{offerIndex}`, `GET .../rooms/{roomIndex}`, `GET .../hotels/{hotelIndex}/details?includeExtendedDetails=1`; `GET .../offers/{offerIndex}/price` when the agent changes the room combination |
| Quote or prebook | `POST .../availability` with `packageToken` and `roomTokens[]`; compare `price.selling` to the searched price; surface `cancellationPolicy`, `autocancelDate`, `taxes`, `remarks`, `termsAndConditions`, `bookingOptions` and the `offerConfiguration` requirements; if the agent sets a markup and `priceModifiers.allowed` is true, preview with `GET .../availability/price/modifiers`; if `OFFER_RECONFIGURED` or the price differs, re-quote and require agent approval |
| Book | `POST .../double-booking-verification`, then `POST .../book` with `payment.method: "credit"`, a Nomadly `clientRef`, one `lead` traveler, `birthDate` for children and `priceModifiers` when used; then `PUT /reservations/{id}/webhooks`; then `GET /reservations/{id}` to capture `hotelConfirmationNumber`, `cancellationPolicy`, `prices` |
| Booking status | Webhook `status.change` plus `GET /reservations/{id}`; `POST /reservations/{id}/sync-status` when the agent asks for a refresh or status is `RQ` |
| Voucher | `GET /reservations/{id}/documents`, pick code `voucher`, then `GET /documents/generate?token=` and download `_links.download.href`; listen for `voucher.generated` |
| Cancel | `GET /reservations/{id}` to compute the penalty, agent confirms, `DELETE /reservations/{id}`, assert `service.status` becomes `XX` or `XP` |
| Supplier balance | `GET /credit/v1/get`, cached 2 to 5 minutes |
| Lookup by reference | `GET /reservations/reference/{clientRef}` |
| Notes to supplier | `PUT /reservations/{id}/comments` |

Fields Nomadly must persist per supplier booking: `srk`, `hotelIndex`, `offerIndex`, `packageCode`, `packageToken`, `packageRoomCode` and `roomToken` per room, `availabilityToken` with its receipt time, `autocancelDate`, `supplierHotelId`, reservation `id`, `clientRef`, traveler `reference` values, `reference.external`, `reference.confirmation`, `hotelConfirmationNumber`, `service.status`, `payment.type`, `payment.status`, `paymentDeadline`, `prices.currency`, `prices.issue` and `prices.total` (supplier, markup, net, commission, selling as published), any `priceModifiers` sent, `cancellationPolicy` (date plus the full `policies[]`), the derived cancellation deadline (the earliest `standard` policy date with a non zero charge), `taxes[]` with `isIncluded`, `boardBasis` per room, `supplierReferences.hotelId` and `roomTypeCode`, `system.code`, `webhookId`, and the voucher document `token`. Search tokens (`results`, `async`, `progress`) expire in hours and belong in a cache, not the database.

## 8. Test plan on the live account

The account runs on LIVE settings. Every test must use city "Test, Lebanon" and hotel "Test Hotel For Connectivity Purposes", must select a refundable rate, and must never touch a non refundable rate (a real penalty applies). The "Veny XML (#23647)" agent account was deactivated for inactivity on 2 November 2026 and must be reactivated by the supplier before step 1.

1. Token: POST client credentials with all needed scopes. Assert 200, `access_token`, `expires_in`; record the lifetime.
2. Credit: `GET /credit/v1/get`. Assert `enabled` and `active` are true; note `available`.
3. Static: `GET /mapping/v1/countries?name=Lebanon`, then `GET /mapping/v1/cities?countryId={id}&name=Test`, then `GET /mapping/v1/hotels?cityId={cityId}`. Assert "Test Hotel For Connectivity Purposes" is present; store its `id`. Submit a small archive export (`countries=1&cities=1`) and assert the webhook arrives with `status: generated` and a matching MD5.
4. Sync search: `POST /hotels/v1/search/sync` with `accommodation: [testHotelId]`, dates two to three weeks out, one room of two adults, `cancellationDeadline: true`. Assert `srk`, `tokens.results` and at least one offer with `nonRefundable[].code == "refundable"`.
5. Async search: `POST /search/start` with `destination.city.id`; poll to `COMPLETED`; `GET /search/results/{srk}`. Assert the test hotel appears with the same `index`.
6. Offer detail: assert a package with `complete == true`, a `packageToken` and `roomToken`.
7. Prebook: `POST .../availability`. Assert `availabilityToken`, `price` equal to the searched price, `paymentMethods.credit` present, and that every `standard` policy with a non zero `charge` has a `date` in the future (otherwise stop; the rate is effectively non refundable today).
8. Book: `POST .../double-booking-verification` (assert `hasDoubleBookings == false`), then `POST .../book` with `payment.method: "credit"`, one `lead` traveler and a `clientRef` prefixed `nomadly-test-` (the pattern is lower case). Assert `status == "OK"` and `id`.
9. Post book: `PUT /reservations/{id}/webhooks` and `POST .../webhooks/{webhookId}/test`; assert delivery. `GET /reservations/{id}`; assert `service.status` is `OK` or `RQ` and `payment.type == "credit"`. `GET /reservations/reference/{clientRef}`; assert the same `id`. `GET /documents` then `/documents/generate`; assert a PDF downloads with matching `md5`.
10. Cancel the same day: re-read `cancellationPolicy`, assert the computed penalty is zero, `DELETE /reservations/{id}`, assert `service.status == "XX"` (or `XP` then `XX` after `sync-status`), `prices.total` shows no charge, and the `status.change` webhook arrived. `GET /credit/v1/get`; assert `available` is back to the step 2 value.

Keep alive: the supplier deactivates any agent account with no booking in 30 days. Schedule a job on the first of each month that runs steps 1, 4, 7, 8 and 10 against the test hotel on a refundable rate, cancels within the hour, and alerts on any failure or on `credit.enabled == false`. Get written confirmation from the supplier that a booked and cancelled test reservation counts as activity.

## 9. Risks and open questions for the supplier

Resolved by the full Hotels API documentation: the double booking endpoint is `POST .../offers/{offerIndex}/double-booking-verification`; currency can be requested per results page with the `currency` query parameter on `GET /search/results/{srk}` (search, prebook and book still take none); prices are explicit selling prices with optional `components{supplier, markup, commission}`, so net versus gross is a matter of which components the account is allowed to see; the agency markup goes in the book call's `priceModifiers` when `offerConfiguration.priceModifiers.allowed` is true, previewed with `.../availability/price/modifiers`; and the cancellation fee data is on the availability response (`cancellationPolicy.policies[]` with `charge`, plus `remarks` group `CATEGORY_CANCELLATION_NOTES`).

Still open:

1. Account state: the "Veny XML (#23647)" agent is deactivated; nothing can be tested until it is restored. Is the API client credential tied to that agent, and does the 30 day rule count cancelled test bookings?
2. Price components: will this account see `components.supplier`, `markup` and `commission`, or only `selling`? Is `priceModifiers.allowed` on for the account, and which of `markup`, `commission`, `sellingPrice` are permitted? Is there a minimum selling price rule behind `ignoreMinimumSellingPrice`?
3. Currency: what is the account's default currency, which values does `currency` on the results endpoint accept, and does the prebook and book price follow the currency chosen at results time?
4. Cancellation fee at cancel time: DELETE applies penalties without confirmation and the availability sample uses `startDate` and `type: "penalty"` while the schema says `date` and `standard`. Which is live, and what does status `XP` mean operationally?
5. OAuth token lifetime and rate limits: the docs only say to honour `expires_in`; the supplier states 12 or 24 hours. Confirm the value and the numeric limits for `hotels-search-limiter`, `mapping-hotelDetails-limiter` and `reservations-limiter`.
6. Webhooks are per reservation. Is there an account level subscription, and do `status.change`, `reference_confirmation.change` and the hotel confirmation number callback fire for hotel bookings from every supplier?
7. Hotel matching: does `<MatchedComponents>` list supplier component IDs, is GIATA available anywhere, and can "Show supplier" be enabled so `supplierReferences`, `supplierHotelId` and `system` are populated?
8. Archive export: confirm the method (GET per the reference, POST per the narrative), the file format (XML per the structure section, JSON per two narrative lines), and generation time for a full `hotelDetails=1` export.
9. Provider coverage: which `providers[]` codes are active, is `expediarapid` among them (double sourcing risk against Nomadly's direct Rapid connection), and is `provider-parameters` access granted?
10. Guest data: which suppliers set `birthdate.adults`, `identificationDocument` or a `supplierBookingForm`, so Nomadly can decide whether to collect passport and fiscal numbers up front.
11. `RQ` handling: how long do on request bookings stay `RQ`, is the credit line reserved during that time, and does `autocancelDate` apply to them?
