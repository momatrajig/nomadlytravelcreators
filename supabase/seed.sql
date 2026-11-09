-- Development seed: Lina's storefront with the eight Lisbon hotels. Prices come from the live
-- eBooking search (mock in dev); only content and pins are seeded here.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000001', 'lina@example.com') on conflict do nothing;
insert into creators (id, user_id, display_name, email, country) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Lina', 'lina@example.com', 'PT');
insert into storefronts (id, creator_id, slug, custom_domain, brand_name, brand_color, template, city_id, city_name, creator_rate, live) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'lina', 'stays.wanderwithlina.com', 'Wander with Lina', '#2458d6', 'postcard', 1, 'Lisbon', 0.08, true);
insert into hotels (ebc_id, name, stars, address, city_id, city_name, country_iso, lat, lng, rating, rating_count) values
  (515886, 'InterContinental Lisbon', 5, 'Marquês de Pombal', 1, 'Lisbon', 'PT', 38.7266, -9.1529, 8.8, 2340),
  (322829, 'Sofitel Lisbon Liberdade', 5, 'Avenida da Liberdade', 1, 'Lisbon', 'PT', 38.7196, -9.1455, 9.0, 1810),
  (322826, 'Tivoli Oriente', 4, 'Parque das Nações', 1, 'Lisbon', 'PT', 38.7676, -9.0987, 8.5, 3120),
  (1003703, 'Iberostar Selection Lisboa', 5, 'Saldanha', 1, 'Lisbon', 'PT', 38.7352, -9.1444, 8.9, 2650),
  (1129920, 'Áurea Museum by Eurostars', 5, 'Baixa and Chiado', 1, 'Lisbon', 'PT', 38.7090, -9.1368, 9.1, 980),
  (323689, 'Eurostars Das Letras', 5, 'Avenida da Liberdade', 1, 'Lisbon', 'PT', 38.7228, -9.1488, 8.6, 1420),
  (2218071, 'Eurostars Universal Lisboa', 4, 'Saldanha', 1, 'Lisbon', 'PT', 38.7366, -9.1433, 8.4, 1760),
  (322364, 'Corinthia Lisbon', 5, 'Lapa', 1, 'Lisbon', 'PT', 38.7322, -9.1680, 9.2, 4010);
insert into storefront_hotels (storefront_id, ebc_id, position, tip, stayed_when) values
  ('20000000-0000-0000-0000-000000000001', 515886, 0, 'Ask for a room above the 12th floor on the park side. The breakfast is good but Rua Castilho has two bakeries that are better and cheaper.', 'March 2026'),
  ('20000000-0000-0000-0000-000000000001', 322829, 1, 'Breakfast is included on this rate, which is rare on the Avenida. The bar does a quiet late lunch if you land at midday.', 'May 2025'),
  ('20000000-0000-0000-0000-000000000001', 322826, 2, 'Right on top of Oriente station, so this is the one if you have an early train to Porto. Ask for a river view, there is no extra charge if they have one.', 'October 2025'),
  ('20000000-0000-0000-0000-000000000001', 1003703, 3, 'The rooftop pool is heated and open in December. Adults only, so skip it for a family trip.', 'December 2025'),
  ('20000000-0000-0000-0000-000000000001', 1129920, 4, 'Built around Roman ruins you can see from the lobby. Rooms over Rua do Comércio hear the trams, ask for the courtyard side.', 'February 2026'),
  ('20000000-0000-0000-0000-000000000001', 323689, 5, 'Quiet for the location. The gym is small but real. Good value if you only need a base.', 'June 2025'),
  ('20000000-0000-0000-0000-000000000001', 2218071, 6, 'On request only for these dates, so book early and expect a confirmation within a few hours. Metro at the door.', 'September 2025'),
  ('20000000-0000-0000-0000-000000000001', 322364, 7, 'The spa is the best in the city and residents get a discount. Lapa is quiet; take the 28 tram in.', 'April 2026');
insert into promo_codes (storefront_id, code, amount_off, max_uses) values ('20000000-0000-0000-0000-000000000001', 'LISBON10', 10, 200);
insert into price_checks (ebc_id, source, check_in, check_out, adults, price, currency) values
  (515886, 'booking', '2026-12-03', '2026-12-05', 1, 404, 'USD'), (515886, 'expedia', '2026-12-03', '2026-12-05', 1, 409, 'USD'), (515886, 'agoda', '2026-12-03', '2026-12-05', 1, 412, 'USD'),
  (322829, 'booking', '2026-12-03', '2026-12-05', 1, 421, 'USD'), (322829, 'expedia', '2026-12-03', '2026-12-05', 1, 428, 'USD'),
  (322826, 'booking', '2026-12-03', '2026-12-05', 1, 316.90, 'USD'), (322826, 'agoda', '2026-12-03', '2026-12-05', 1, 319, 'USD'),
  (1003703, 'booking', '2026-12-03', '2026-12-05', 1, 325, 'USD'),
  (1129920, 'booking', '2026-12-03', '2026-12-05', 1, 366, 'USD'),
  (323689, 'booking', '2026-12-03', '2026-12-05', 1, 308, 'USD'),
  (2218071, 'booking', '2026-12-03', '2026-12-05', 1, 290, 'USD'),
  (322364, 'expedia', '2026-12-03', '2026-12-05', 1, 455, 'USD'), (322364, 'agoda', '2026-12-03', '2026-12-05', 1, 461, 'USD');

-- destinations and services
insert into destinations (slug, name, country, country_iso, tz, lat, lng, blurb, position) values
  ('lisbon', 'Lisbon', 'Portugal', 'PT', 'Europe/Lisbon', 38.7223, -9.1393, 'Seven hills, tiled facades and the best light in Europe.', 0),
  ('porto', 'Porto', 'Portugal', 'PT', 'Europe/Lisbon', 41.1579, -8.6291, 'Port wine lodges, the Douro and a city that stays itself.', 1),
  ('paris', 'Paris', 'France', 'FR', 'Europe/Paris', 48.8566, 2.3522, 'The palaces, the bistros, the walk home along the Seine.', 2),
  ('rome', 'Rome', 'Italy', 'IT', 'Europe/Rome', 41.9028, 12.4964, 'Two thousand years in one afternoon walk.', 3),
  ('barcelona', 'Barcelona', 'Spain', 'ES', 'Europe/Madrid', 41.3874, 2.1686, 'Gaudí, the sea and dinner at eleven.', 4),
  ('dubai', 'Dubai', 'United Arab Emirates', 'AE', 'Asia/Dubai', 25.2048, 55.2708, 'Beach, desert and the tallest skyline on earth, six hours from Europe.', 5),
  ('istanbul', 'Istanbul', 'Türkiye', 'TR', 'Europe/Istanbul', 41.0082, 28.9784, 'Two continents, one breakfast table.', 6),
  ('london', 'London', 'United Kingdom', 'GB', 'Europe/London', 51.5074, -0.1278, 'The grand hotels, done properly.', 7),
  ('amsterdam', 'Amsterdam', 'Netherlands', 'NL', 'Europe/Amsterdam', 52.3676, 4.9041, 'Canal houses turned into the quietest luxury in Europe.', 8),
  ('bali', 'Bali', 'Indonesia', 'ID', 'Asia/Makassar', -8.4095, 115.1889, 'Rice terraces, cliff edges and villas with their own pools.', 9),
  ('marrakech', 'Marrakech', 'Morocco', 'MA', 'Africa/Casablanca', 31.6295, -7.9811, 'Riads, palm groves and the Atlas behind them.', 10),
  ('madeira', 'Madeira', 'Portugal', 'PT', 'Atlantic/Madeira', 32.6669, -16.9241, 'Cliff hotels above the Atlantic, spring all year.', 11),
  ('new-york', 'New York', 'United States', 'US', 'America/New_York', 40.7128, -74.006, 'The city that needs no blurb.', 12),
  ('algarve', 'Algarve and Comporta', 'Portugal', 'PT', 'Europe/Lisbon', 37.0179, -7.9304, 'Cliffs, coves and the quietest beaches in Europe.', 13);
update hotels h set destination_slug = d.slug from destinations d where h.destination_slug is null and lower(h.city_name) = lower(d.name);
update hotels set destination_slug = 'algarve' where destination_slug is null and city_name in ('Algarve', 'Comporta');
update hotels set destination_slug = 'lisbon' where destination_slug is null;
update collections set destination_slug = slug where kind = 'destination' and slug in (select slug from destinations);
insert into services (key, name, blurb, price, elsewhere, commission, unit) values
  ('ride', 'Airport ride', 'A driver waiting at arrivals with your name, fixed price, flight tracked.', 29, 47, 9, 'per ride'),
  ('esim', 'Travel eSIM, 10 GB', 'Data the moment you land. Installed from a QR code before you fly.', 12, 18, 4, 'per trip'),
  ('bag', 'Bag protection', 'USD 1,500 cover for a lost or delayed bag, paid within 48 hours of the claim.', 9, 31, 3.5, 'per trip'),
  ('delay', 'Delay cover', 'USD 200 paid automatically if your flight lands more than 3 hours late.', 11, 36, 4, 'per trip');
