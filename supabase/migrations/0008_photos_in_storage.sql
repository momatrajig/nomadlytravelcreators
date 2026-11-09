-- Photos now live in our own storage (bucket "media", public read), copied at fixed sizes:
--   hotels  photos/h/<ebc_id>/<n>-330.jpg, -960.jpg, -1920.jpg
--   places  photos/p/<slug>-800.jpg, -1600.jpg, -2400.jpg
-- The stored url is the base; the app adds the size. The original Commons file stays in "origin" for the credit.
update hotels h set images = (
  select jsonb_agg(e || jsonb_build_object('url', 'https://yssrtmwluzgbviiqnxvu.supabase.co/storage/v1/object/public/media/photos/h/' || h.ebc_id || '/' || (o - 1), 'origin', e->>'url') order by o)
  from jsonb_array_elements(h.images) with ordinality as t(e, o))
where jsonb_array_length(h.images) > 0 and h.images->0->>'url' like 'https://upload.wikimedia.org/%';
update destinations set hero_image = 'https://yssrtmwluzgbviiqnxvu.supabase.co/storage/v1/object/public/media/photos/p/' || slug where hero_image like 'https://images.unsplash.com/%';
update collections set hero_url = 'https://yssrtmwluzgbviiqnxvu.supabase.co/storage/v1/object/public/media/photos/p/' || slug where kind = 'season';
update collections c set hero_url = d.hero_image from destinations d where c.kind = 'destination' and d.slug = c.destination_slug;
-- the upload window used during the copy is closed
drop policy if exists tmp_media_seed_20261109 on storage.objects;
