# Architecture

## One truth for money

`lib/pricing/engine.ts` is the only module allowed to compute a price. The storefront card, the hotel page, the quote, the Stripe amount, the dashboard worked example, the calculator and the payout statement all call it. The database enforces the same invariant with a trigger (`check_booking_ledger`), so a wrong number cannot be written even by a bug elsewhere.

Option D: `nomadlyNet = supplierNet * 1.07`; `creatorShare = nomadlyNet * creatorRate` (0 to 8 percent, the creator's dial); `readerPrice = nomadlyNet + creatorShare`; the card fee is paid by Nomadly. The parity guard computes the highest creator rate at which every pinned hotel with a live big site quote stays at or below that quote, and the dial stops there.

## Reader path

1. `GET /` or `/stays` (server components) call `searchStays`: one synchronous eBooking search for the pinned hotel IDs, priced by the engine, joined with the latest `price_checks` for the same dates. Tokens never leave the server.
2. `POST /api/quote` re-runs the search server side, prebooks the chosen package (`availability`), verifies the supplier price did not move, stores a `quotes` row with the availability token and a 20 minute expiry.
3. `POST /api/checkout` validates the guest, applies a promo (paid from the creator share, never below Nomadly's net), inserts the booking in `paying`, creates a Stripe PaymentIntent for the server computed amount with an idempotency key.
4. Stripe webhook `payment_intent.succeeded` calls `confirmPaid`: double booking check, `book` on reseller credit, subscribe the reservation webhook, fetch the voucher token, booking becomes `confirmed` or `on_request`. Replays are idempotent. If the hotel booking fails after payment the booking is marked `failed` and the refund job reads that state.
5. eBooking reservation webhook `/api/webhooks/ebc/[bookingId]` never trusts the payload: it re-reads the reservation and updates status and voucher.
6. `/booking/[reference]?email=` is the reader's page, gated by the lead email. Cancel computes the penalty from the stored policy, cancels at eBooking, refunds the difference through Stripe.

## Multi tenant

`middleware.ts` tags the host; `lib/tenant.ts` resolves the storefront (`custom_domain` or `<slug>.<PLATFORM_HOST>`). The dashboard lives only on the platform host. Row level security keeps one creator's rows invisible to another; readers never touch the database directly.

## Supplier client

`lib/ebc/client.ts` follows the integration spec: one cached OAuth token for the union of scopes, Bearer on every call, RFC 7807 problems wrapped in `EbcError` with the machine code surfaced (`AVAILABILITY_TOKEN_EXPIRED`, `OFFER_RECONFIGURED`, `ROOM_UNAVAILABLE`), exponential backoff with jitter on 429 and 5xx only, one token refresh on 401, rate limit headers exposed. `EBC_MODE=mock` swaps the transport for fixtures that reproduce the same shapes and failure cases, so tests and local development need no credentials.

## Time of day travel

`lib/transit/model.ts` defines the bands (night, early, morning rush, midday, evening rush, evening, late), a city profile with multipliers per mode per band and service hours (Lisbon metro 06:30 to 01:00), and `estimate()` which turns a free flow base time into what the reader should expect when they set off. In production the base time comes from a routing API; the model stays in front of it so the page still prints an honest estimate when the API has no data.

## What is deliberately not here yet

- Flights (Duffel) and extras (airport rides, eSIM, insurance): the ledger functions exist in the engine; the supplier clients and UI do not.
- Automated big site price reading: `price_checks` is the table and the storefront reads it; the writer is a product and legal decision (scraping Booking.com breaks its terms; a licensed price feed or manual checks are the options).
- Wise transfers: payouts are computed and itemized; the money movement reads `payouts` with status `scheduled`.
- Image pipeline: `hotels.images` expects high resolution URLs in Supabase Storage; the mapping API's image `url` and `source` fields need a size check with IRIX before go live.
