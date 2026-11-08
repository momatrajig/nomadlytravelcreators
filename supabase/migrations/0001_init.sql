-- Nomadly Ambassadors: core schema. Postgres 15+ (Supabase).
-- Money is numeric(12,2) in the selling currency stored next to it. Never float.
-- Every table that a creator can see carries creator_id for RLS (0002_rls.sql).

create extension if not exists pgcrypto;

-- Supabase provides auth.users. Locally we create a stand in so the FK compiles.
do $outer$ begin
  if not exists (select 1 from pg_namespace where nspname = 'auth') then
    create schema auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text);
    create function auth.uid() returns uuid language sql stable as $f$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $f$;
  end if;
end $outer$;

create type booking_status as enum ('quoted', 'paying', 'booked', 'on_request', 'confirmed', 'completed', 'canceled', 'failed');
create type payout_status as enum ('scheduled', 'paid', 'held', 'failed');
create type price_source as enum ('booking', 'expedia', 'agoda', 'tripcom', 'hotel');

-- ---------- creators and storefronts ----------
create table creators (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  display_name text not null,
  email text not null unique,
  country text,
  payout_method jsonb,                      -- {type:'wise', account_ref:'...'}; never card or IBAN in full
  created_at timestamptz not null default now()
);

create table storefronts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(id) on delete cascade,
  slug text not null unique,                -- lina -> lina.nomadly.app
  custom_domain text unique,                -- stays.wanderwithlina.com
  domain_verified_at timestamptz,
  brand_name text not null,
  brand_color text not null default '#2458d6',
  logo_path text,
  template text not null default 'postcard' check (template in ('postcard', 'editorial', 'grid')),
  headline text not null default 'Book the hotels I actually stayed in, below the big sites.',
  city_id int,                              -- eBooking city id the storefront is anchored to
  city_name text,
  currency char(3) not null default 'USD',
  creator_rate numeric(5,4) not null default 0.0800 check (creator_rate >= 0 and creator_rate <= 0.0800),
  flight_fee numeric(8,2) not null default 5.00,
  live boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on storefronts (creator_id);

-- ---------- hotel content cache (from the eBooking mapping API) ----------
create table hotels (
  ebc_id int primary key,
  name text not null,
  stars smallint,
  address text,
  city_id int,
  city_name text,
  country_iso char(2),
  lat double precision,
  lng double precision,
  description text,
  facilities jsonb,
  images jsonb not null default '[]'::jsonb,   -- [{url, w, h, source}] in display order; high resolution only
  rating numeric(3,1),
  rating_count int,
  synced_at timestamptz not null default now()
);

create table storefront_hotels (
  storefront_id uuid not null references storefronts(id) on delete cascade,
  ebc_id int not null references hotels(ebc_id),
  position int not null default 0,
  tip text check (char_length(tip) <= 240),
  stayed_when text,                          -- "March 2026"
  pinned_at timestamptz not null default now(),
  primary key (storefront_id, ebc_id)
);

-- ---------- reference prices read from the big sites ----------
create table price_checks (
  id bigint generated always as identity primary key,
  ebc_id int not null references hotels(ebc_id),
  source price_source not null,
  check_in date not null,
  check_out date not null,
  adults smallint not null default 2,
  price numeric(12,2) not null,
  currency char(3) not null,
  signed_out boolean not null default true,
  checked_at timestamptz not null default now(),
  raw jsonb
);
create index price_checks_lookup on price_checks (ebc_id, check_in, check_out, adults, checked_at desc);

-- ---------- live quotes (search sessions are cache, quotes are what the reader saw) ----------
create table quotes (
  id uuid primary key default gen_random_uuid(),
  storefront_id uuid not null references storefronts(id),
  ebc_id int not null references hotels(ebc_id),
  check_in date not null,
  check_out date not null,
  occupancy jsonb not null,                  -- [{adults, childrenAges}]
  srk text not null,
  results_token text not null,
  hotel_index int not null,
  offer_index text not null,
  package_code text not null,
  package_token text not null,
  room_tokens jsonb not null,
  board text,
  refundable boolean not null,
  cancel_deadline timestamptz,
  cancel_charge numeric(12,2),
  supplier_net numeric(12,2) not null,
  currency char(3) not null,
  creator_rate numeric(5,4) not null,
  nomadly_net numeric(12,2) not null,
  creator_share numeric(12,2) not null,
  reader_price numeric(12,2) not null,
  lowest_reference numeric(12,2),
  lowest_reference_source price_source,
  availability_token text,
  availability_at timestamptz,
  autocancel_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index on quotes (storefront_id, created_at desc);

-- ---------- bookings ----------
create table bookings (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,            -- NMD 231821, shown to the reader
  client_ref text not null unique,           -- nomadly-<id>, sent to eBooking
  storefront_id uuid not null references storefronts(id),
  creator_id uuid not null references creators(id),
  quote_id uuid references quotes(id),
  ebc_id int not null references hotels(ebc_id),
  ebc_reservation_id bigint unique,
  hotel_confirmation text,
  status booking_status not null default 'quoted',
  check_in date not null,
  check_out date not null,
  nights smallint not null,
  guests jsonb not null,                     -- [{firstName,lastName,type,lead}] no documents here
  lead_email text not null,
  lead_phone text,
  room_name text,
  board text,
  refundable boolean not null,
  cancel_deadline timestamptz,
  cancel_charge numeric(12,2),
  currency char(3) not null,
  supplier_net numeric(12,2) not null,
  nomadly_net numeric(12,2) not null,
  creator_rate numeric(5,4) not null,
  creator_share numeric(12,2) not null,
  reader_price numeric(12,2) not null,
  card_fee numeric(12,2),
  extras jsonb not null default '[]'::jsonb, -- [{kind, name, price, commission, creator_share}]
  lowest_reference numeric(12,2),
  lowest_reference_source price_source,
  promo_code text,
  promo_discount numeric(12,2) not null default 0,
  stripe_payment_intent text unique,
  paid_at timestamptz,
  canceled_at timestamptz,
  voucher_token text,
  webhook_id int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on bookings (storefront_id, created_at desc);
create index on bookings (creator_id, status);

create table booking_events (
  id bigint generated always as identity primary key,
  booking_id uuid not null references bookings(id) on delete cascade,
  kind text not null,                        -- quote, payment_intent, booked, webhook:status.change, canceled, payout
  payload jsonb,
  created_at timestamptz not null default now()
);
create index on booking_events (booking_id, created_at);

-- ---------- promotions ----------
create table promo_codes (
  id uuid primary key default gen_random_uuid(),
  storefront_id uuid not null references storefronts(id) on delete cascade,
  code text not null,
  amount_off numeric(12,2) not null check (amount_off > 0),
  max_uses int,
  uses int not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  unique (storefront_id, code)
);

-- ---------- payouts ----------
create table payouts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(id),
  period_start date not null,
  period_end date not null,
  amount numeric(12,2) not null,
  currency char(3) not null default 'USD',
  status payout_status not null default 'scheduled',
  scheduled_for date not null,
  paid_at timestamptz,
  provider_ref text,
  created_at timestamptz not null default now()
);
create table payout_items (
  payout_id uuid not null references payouts(id) on delete cascade,
  booking_id uuid not null references bookings(id),
  amount numeric(12,2) not null,
  primary key (payout_id, booking_id)
);

-- ---------- storefront analytics (aggregated, no PII) ----------
create table storefront_daily (
  storefront_id uuid not null references storefronts(id) on delete cascade,
  day date not null,
  source text not null default 'direct',
  clicks int not null default 0,
  hotel_views int not null default 0,
  checkouts int not null default 0,
  bookings int not null default 0,
  primary key (storefront_id, day, source)
);

-- ---------- helpers ----------
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger storefronts_updated before update on storefronts for each row execute function set_updated_at();
create trigger bookings_updated before update on bookings for each row execute function set_updated_at();

-- Invariant: the ledger on a booking must be internally consistent (option D).
create or replace function check_booking_ledger() returns trigger language plpgsql as $$
begin
  if round(new.supplier_net * 1.07, 2) <> new.nomadly_net then
    raise exception 'nomadly_net must equal supplier_net * 1.07 (got % vs %)', new.nomadly_net, round(new.supplier_net * 1.07, 2);
  end if;
  if round(new.nomadly_net * new.creator_rate, 2) <> new.creator_share then
    raise exception 'creator_share must equal nomadly_net * creator_rate';
  end if;
  if round(new.nomadly_net + new.creator_share - new.promo_discount, 2) <> new.reader_price then
    raise exception 'reader_price must equal nomadly_net + creator_share - promo_discount';
  end if;
  return new;
end $$;
create trigger bookings_ledger before insert or update on bookings for each row execute function check_booking_ledger();

-- Parity view: latest reference per hotel and date range
create view latest_price_checks as
select distinct on (ebc_id, source, check_in, check_out, adults) *
from price_checks
order by ebc_id, source, check_in, check_out, adults, checked_at desc;
