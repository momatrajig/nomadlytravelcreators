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
