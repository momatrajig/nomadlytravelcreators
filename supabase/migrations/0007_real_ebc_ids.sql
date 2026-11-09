-- Re-key the world hotels from simulator placeholders to their real eBooking hotel IDs,
-- looked up in the eBooking portal (hotel autocomplete, exact name and city) on 9 November 2026.
create temporary table ebc_map (old_id int primary key, new_id int not null unique);
insert into ebc_map values
 (910001,483658),(910002,284785),(910003,284440),(910004,285550),(910005,303974),(910006,287987),(910007,1919916),
 (910008,288903),(910009,210858),(910010,805571),(910011,421077),(910012,421119),(910013,4865),(910014,283296),
 (910015,308854),(910016,324773),(910017,309521),(910018,309165),(910019,72202),(910020,356072),(910021,393287),
 (900004,1700418),(900006,322834);

-- the slug is unique, so free it on the old row before the new row takes it
update hotels h set slug = h.slug || '-placeholder' from ebc_map m where h.ebc_id = m.old_id and h.slug is not null;
insert into hotels (ebc_id, name, stars, address, city_id, city_name, country_iso, lat, lng, description, facilities, images, rating, rating_count, synced_at, destination_slug, slug, booking_url, nightly_net_sample, ebc_id_verified)
select m.new_id, h.name, h.stars, h.address, h.city_id, h.city_name, h.country_iso, h.lat, h.lng, h.description, h.facilities, h.images, h.rating, h.rating_count, h.synced_at, h.destination_slug, replace(h.slug, '-placeholder', ''), h.booking_url, h.nightly_net_sample, true
from hotels h join ebc_map m on m.old_id = h.ebc_id
on conflict (ebc_id) do nothing;

update storefront_hotels t set ebc_id = m.new_id from ebc_map m where t.ebc_id = m.old_id;
update price_checks t set ebc_id = m.new_id from ebc_map m where t.ebc_id = m.old_id;
update quotes t set ebc_id = m.new_id from ebc_map m where t.ebc_id = m.old_id;
update bookings t set ebc_id = m.new_id from ebc_map m where t.ebc_id = m.old_id;
update collections c set ebc_ids = (select array_agg(coalesce(m.new_id, x) order by o) from unnest(c.ebc_ids) with ordinality u(x, o) left join ebc_map m on m.old_id = u.x);
delete from hotels h using ebc_map m where h.ebc_id = m.old_id;
drop table ebc_map;
