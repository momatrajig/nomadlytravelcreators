-- Reader requests for the hotel (early check-in, late check-out, bed type, arrival time, free text) and the
-- lead guest's country. Requests are sent to the supplier as booking comments; the hotel honours them if it can.
alter table public.bookings add column if not exists requests jsonb, add column if not exists lead_country text;
comment on column public.bookings.requests is 'Reader requests for the hotel: items (early check-in, late check-out...), note, arrival time, who the booking is for. Sent to the supplier as booking comments.';
