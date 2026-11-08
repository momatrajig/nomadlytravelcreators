# Nomadly Ambassadors

White label hotel storefronts for travel creators. One Next.js app serves every creator's storefront by host name (`stays.wanderwithlina.com`, `lina.nomadly.app`), the creator dashboard on the platform host, and the server side that talks to eBooking Center (hotel supply), Stripe (reader payments) and Supabase (Postgres, auth, storage).

## Run it locally in two minutes, no credentials

```bash
pnpm install
cp .env.example .env.local      # EBC_MODE=mock and DATA_MODE=local are the defaults
pnpm dev                        # http://localhost:3000 is Lina's storefront, /dashboard is her dashboard
pnpm test                       # 26 tests: pricing, transit, eBooking client, full booking path
pnpm typecheck && pnpm lint
```

In mock mode the eBooking client answers from fixtures (the eight Lisbon hotels with real eBooking IDs), the database is in memory and seeded, and checkout completes without Stripe so the whole reader path can be walked: home, hotel, hold a rate, checkout, confirmation, cancel.

## Going live

1. **Supabase**: create a project, run `supabase/migrations/0001_init.sql`, `0002_rls.sql`, then `supabase/seed.sql` (or `pnpm db:reset` with `DATABASE_URL`). Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATA_MODE=supabase`.
2. **eBooking Center**: set `EBC_MODE=live`, `EBC_CLIENT_ID`, `EBC_CLIENT_SECRET`, `EBC_LEADER_NATIONALITY_ID` (Mapping API nationality id), `EBC_SELLING_CHANNEL=B2C`. Run the live test plan in `docs/ebc-integration-spec.md` section 8 against the test hotel before any real hotel is pinned. The "Veny XML (#23647)" agent must be reactivated by the supplier first.
3. **Stripe**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (endpoint `/api/webhooks/stripe`, event `payment_intent.succeeded` and `payment_intent.payment_failed`), `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
4. **Vercel**: deploy, add the creators' domains to the project, set `PLATFORM_HOST`, set `CRON_SECRET`; `vercel.json` schedules the Wednesday payout run.

Secrets live only in the hosting environment. Nothing in this repo reads them from disk.

## Layout

```
app/                      routes (storefront pages, dashboard, API, webhooks, cron)
components/               React components; CoverFlow wraps the vanilla engine
lib/pricing/engine.ts     option D money math, the only place that does price arithmetic
lib/booking/service.ts    search, hold quote, pay, confirm, cancel
lib/ebc/                  eBooking Center client, types, mock transport with fixtures
lib/db/                   data access interface, Supabase and in memory implementations
lib/transit/              travel time by time of day (city profiles) for the hotel map
lib/flow/engine.ts        the 2.5D cover flow (spring physics, idle life, reduced motion)
lib/payouts/run.ts        weekly payout statements
supabase/                 migrations, RLS, seed
docs/                     architecture and the eBooking integration spec
```

See `docs/ARCHITECTURE.md` for the data flow and the decisions behind it.
