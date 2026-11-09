-- Destinations, collections and richer hotel content.
create table destinations (
  slug text primary key,                 -- lisbon, paris, dubai
  name text not null,
  country text not null,
  country_iso char(2),
  tz text not null,                      -- Europe/Lisbon
  ebc_city_id int,                       -- eBooking city id once resolved
  lat double precision,
  lng double precision,
  blurb text,
  hero_image text,
  position int not null default 0
);

alter table hotels add column if not exists destination_slug text references destinations(slug);
alter table hotels add column if not exists slug text unique;
alter table hotels add column if not exists booking_url text;
alter table hotels add column if not exists nightly_net_sample numeric(10,2);   -- demo pricing only; null once live rates flow
create index if not exists hotels_destination on hotels (destination_slug);

-- A collection is a curated, date driven set: "Christmas in Lisbon" = destination + dates + hotels
create table collections (
  id uuid primary key default gen_random_uuid(),
  storefront_id uuid not null references storefronts(id) on delete cascade,
  slug text not null,
  title text not null,
  kicker text,                           -- "Christmas week", "New Year's Eve"
  destination_slug text not null references destinations(slug),
  check_in date not null,
  check_out date not null,
  blurb text,
  hero_image text,
  position int not null default 0,
  unique (storefront_id, slug)
);
create table collection_hotels (
  collection_id uuid not null references collections(id) on delete cascade,
  ebc_id int not null references hotels(ebc_id),
  position int not null default 0,
  primary key (collection_id, ebc_id)
);

alter table collections enable row level security;
alter table collection_hotels enable row level security;
alter table destinations enable row level security;
create policy collections_owner on collections for all
  using (storefront_id in (select id from storefronts where creator_id = current_creator_id()))
  with check (storefront_id in (select id from storefronts where creator_id = current_creator_id()));
create policy collection_hotels_owner on collection_hotels for all
  using (collection_id in (select id from collections where storefront_id in (select id from storefronts where creator_id = current_creator_id())));
create policy destinations_read on destinations for select using (true);

-- Veny services sold alongside stays. Prices are what the reader pays; commission is Nomadly's; creator gets half of it.
create table services (
  key text primary key,                  -- ride, esim, bag, delay
  name text not null,
  blurb text not null,
  price numeric(10,2) not null,
  elsewhere numeric(10,2),               -- typical price on the provider's own site, checked monthly
  commission numeric(10,2) not null,
  unit text not null default 'per trip',
  active boolean not null default true
);
alter table services enable row level security;
create policy services_read on services for select using (true);
