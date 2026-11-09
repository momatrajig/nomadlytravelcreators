-- Curated bands on a storefront: a season (Christmas and New Year) or a destination.
create table collections (
  id uuid primary key default gen_random_uuid(),
  storefront_id uuid not null references storefronts(id) on delete cascade,
  slug text not null,
  kind text not null check (kind in ('season', 'destination')),
  title text not null,
  subtitle text,
  check_in date,
  check_out date,
  ebc_ids int[] not null default '{}',
  position int not null default 0,
  hero_url text,
  unique (storefront_id, slug)
);
alter table collections enable row level security;
create policy collections_owner on collections for all
  using (storefront_id in (select id from storefronts where creator_id = current_creator_id()))
  with check (storefront_id in (select id from storefronts where creator_id = current_creator_id()));
