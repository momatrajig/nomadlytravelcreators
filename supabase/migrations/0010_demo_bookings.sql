-- Demo bookings: paid with a Stripe test card while hotel prices are live. The flow runs end to end,
-- no room is reserved with the supplier, and the booking never counts toward earnings or payouts.
alter table bookings add column if not exists demo boolean not null default false;
