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
alter table destinations enable row level security;
create policy destinations_read on destinations for select using (true);

-- collections (0003) get a destination link and the hotel verification flag lands on hotels
alter table collections add column if not exists destination_slug text references destinations(slug);
alter table hotels add column if not exists ebc_id_verified boolean not null default true;
update hotels set ebc_id_verified = (ebc_id not between 900000 and 999999);  -- 9000xx are placeholders until the eBooking id is looked up

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
