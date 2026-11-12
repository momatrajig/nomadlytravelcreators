-- The cover photo a creator picks for each pinned hotel (one of the hotel's own images).
alter table storefront_hotels add column if not exists cover_url text;
