-- Row level security. Readers never touch the database directly: the storefront reads through
-- server routes with the service role. RLS protects the creator dashboard (anon key plus the
-- creator's JWT) so one creator can never see another creator's bookings or payouts.

alter table creators enable row level security;
alter table storefronts enable row level security;
alter table storefront_hotels enable row level security;
alter table quotes enable row level security;
alter table bookings enable row level security;
alter table booking_events enable row level security;
alter table promo_codes enable row level security;
alter table payouts enable row level security;
alter table payout_items enable row level security;
alter table storefront_daily enable row level security;
alter table hotels enable row level security;
alter table price_checks enable row level security;

create or replace function current_creator_id() returns uuid language sql stable security definer set search_path = public as $$
  select id from creators where user_id = auth.uid()
$$;

-- creators: see and edit yourself only
create policy creators_self on creators for select using (user_id = auth.uid());
create policy creators_self_update on creators for update using (user_id = auth.uid());

-- storefronts and their children: the owning creator
create policy storefronts_owner on storefronts for all using (creator_id = current_creator_id()) with check (creator_id = current_creator_id());
create policy storefront_hotels_owner on storefront_hotels for all
  using (storefront_id in (select id from storefronts where creator_id = current_creator_id()))
  with check (storefront_id in (select id from storefronts where creator_id = current_creator_id()));
create policy promo_owner on promo_codes for all
  using (storefront_id in (select id from storefronts where creator_id = current_creator_id()))
  with check (storefront_id in (select id from storefronts where creator_id = current_creator_id()));
create policy daily_owner on storefront_daily for select
  using (storefront_id in (select id from storefronts where creator_id = current_creator_id()));

-- bookings: read only for the creator; writes happen server side with the service role
create policy bookings_owner_read on bookings for select using (creator_id = current_creator_id());
create policy booking_events_owner_read on booking_events for select
  using (booking_id in (select id from bookings where creator_id = current_creator_id()));
create policy quotes_owner_read on quotes for select
  using (storefront_id in (select id from storefronts where creator_id = current_creator_id()));

-- payouts: read only
create policy payouts_owner_read on payouts for select using (creator_id = current_creator_id());
create policy payout_items_owner_read on payout_items for select
  using (payout_id in (select id from payouts where creator_id = current_creator_id()));

-- hotel content and price checks are not secret, but only signed in creators read them directly
create policy hotels_read on hotels for select using (auth.uid() is not null);
create policy price_checks_read on price_checks for select using (auth.uid() is not null);

do $$ begin if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if; end $$;

-- Column level: the dashboard must never read guest documents or Stripe ids. They are not stored
-- (guests jsonb holds names only) and stripe_payment_intent is revoked from authenticated.
revoke all on bookings from authenticated;
grant select (id, reference, storefront_id, creator_id, ebc_id, status, check_in, check_out, nights, room_name, board, refundable,
  cancel_deadline, currency, supplier_net, nomadly_net, creator_rate, creator_share, reader_price, extras, lowest_reference,
  lowest_reference_source, promo_code, promo_discount, paid_at, canceled_at, created_at, updated_at) on bookings to authenticated;
