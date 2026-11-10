-- Creator links and the net revenue share model.
--
-- 1. Pricing model "net": Nomadly sets the reader price (supplier net plus a markup per storefront). Nomadly's
--    net revenue is the margin less transaction costs (card fees); the creator takes a share of it
--    (55 percent on hotels, 50 percent on add ons by default). Rows priced under the old model keep
--    pricing_model 'v1' and the old invariant.
-- 2. Tracked links: every click on a creator's link is logged (no IP stored, a salted daily visitor hash only),
--    and the booking it leads to carries the click and its source (the article).
-- 3. Hotel directory: the supplier's hotel list per city, cached, so a link can name a hotel instead of an ID.

alter table storefronts
  add column if not exists locale text not null default 'en' check (locale in ('en', 'cs')),
  add column if not exists display_currency char(3),
  add column if not exists markup numeric(5,4) not null default 0.1500 check (markup >= 0 and markup <= 0.6000),
  add column if not exists hotel_share numeric(5,4) not null default 0.5500 check (hotel_share >= 0 and hotel_share <= 1),
  add column if not exists extras_share numeric(5,4) not null default 0.5000 check (extras_share >= 0 and extras_share <= 1),
  add column if not exists site_url text;

alter table quotes
  add column if not exists pricing_model text not null default 'v1' check (pricing_model in ('v1', 'net')),
  add column if not exists margin numeric(12,2),
  add column if not exists costs numeric(12,2);

create table if not exists clicks (
  id uuid primary key default gen_random_uuid(),
  storefront_id uuid not null references storefronts(id) on delete cascade,
  created_at timestamptz not null default now(),
  source text,                 -- campaign or article slug given in the link
  article text,                -- referring page (path only, no query string)
  target text not null,        -- hotel | city | home
  ebc_id int,
  query jsonb,                 -- what the link asked for (hotel name, address), for unresolved links
  country char(2),
  device text,                 -- mobile | desktop | tablet
  visitor text,                -- sha256(salt, day, ip, user agent): counts unique visitors per day, cannot be reversed to an IP
  bot boolean not null default false
);
create index if not exists clicks_storefront_time on clicks (storefront_id, created_at desc);
create index if not exists clicks_source on clicks (storefront_id, source);

alter table bookings
  add column if not exists pricing_model text not null default 'v1' check (pricing_model in ('v1', 'net')),
  add column if not exists margin numeric(12,2),
  add column if not exists costs numeric(12,2),
  add column if not exists click_id uuid references clicks(id) on delete set null,
  add column if not exists source text;
create index if not exists bookings_click on bookings (click_id);

-- ledger invariant per model
create or replace function check_booking_ledger() returns trigger language plpgsql as $$
begin
  if new.pricing_model = 'net' then
    if new.margin is null or new.costs is null then raise exception 'net model needs margin and costs'; end if;
    if round(new.margin - new.costs, 2) <> new.nomadly_net then
      raise exception 'nomadly_net must equal margin - costs (got % vs %)', new.nomadly_net, round(new.margin - new.costs, 2);
    end if;
    if round(greatest(new.nomadly_net, 0) * new.creator_rate, 2) <> new.creator_share then
      raise exception 'creator_share must equal max(nomadly_net, 0) * creator_rate';
    end if;
    if round(new.supplier_net + new.margin - new.promo_discount, 2) <> new.reader_price then
      raise exception 'reader_price must equal supplier_net + margin - promo_discount';
    end if;
    return new;
  end if;
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

create table if not exists hotel_directory (
  ebc_id int primary key,
  name text not null,
  norm text not null,          -- lower case, no accents, no punctuation: what name matching runs on
  city_id int not null,
  address text,
  zip text,
  stars smallint,
  lat double precision,
  lng double precision,
  synced_at timestamptz not null default now()
);
create index if not exists hotel_directory_city on hotel_directory (city_id);

create table if not exists directory_cities (
  city_id int primary key,
  name text not null,
  pages int not null default 0,
  pages_done int not null default 0,
  total int not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

-- readers never read these directly; the dashboard reads its own clicks
alter table clicks enable row level security;
alter table hotel_directory enable row level security;
alter table directory_cities enable row level security;
create policy clicks_owner_read on clicks for select using (storefront_id in (select id from storefronts where creator_id = current_creator_id()));
grant select (source, click_id) on bookings to authenticated;
