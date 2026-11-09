-- Shared cache for supplier searches (server only: RLS on, no policies, the service role bypasses it).
create table if not exists search_cache (
  key text primary key,
  payload jsonb not null,
  expires_at timestamptz not null
);
create index if not exists search_cache_expires_idx on search_cache (expires_at);
alter table search_cache enable row level security;

-- The live supplier is on. The Booking.com and Expedia prices stored for the preview were simulator values;
-- next to real hotel prices they would be invented comparisons, so they go. Real checks get recorded by the price checker.
delete from price_checks;
