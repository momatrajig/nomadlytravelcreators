-- Proximity lookups for "similar stays nearby" (bounding box on lat, lng).
create index if not exists hotel_directory_lat_lng on public.hotel_directory (lat, lng);
