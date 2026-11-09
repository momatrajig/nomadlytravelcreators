"""Generates the world hotel fixture and the matching Supabase seed from one spec.

Photos: Wikimedia Commons files picked by hand (see photos.src.txt). Every path is checked
against the md5 of its file name, the way Commons stores files, so a typo fails here and not
on the live site. Supplier prices are simulator values (EBC_MODE=mock) and say so on the site.
"""
import hashlib, json, unicodedata, urllib.parse, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent

def commons_url(h, name):
    return "https://upload.wikimedia.org/wikipedia/commons/" + h + "/" + urllib.parse.quote(name, safe="(),'!*")

SMALL = {"Lounge_in_red_(30057855996).jpg", "Lounge_in_blue_(29797458990).jpg", "Lobby_Restaurant.jpg", "L'Oiseau_Blanc_Vue.jpg",
         "Le_Meurice_005.jpg", "Le_Meurice_004.jpg", "Le_Meurice_006.jpg", "Façade_gommage®_at_The_Ritz_Hotel,_Piccadilly,_London.jpg",
         "Inside_Singapore_Raffles_Long_Bar-1_(11861954616).jpg", "Entrance_to_Singapore_Raffles_Hotel-1_(11861605264).jpg",
         "Istanbul-çırağan_palace-bosphour_-_panoramio_-_HALUK_COMERTEL_(12).jpg", "Istanbul-çırağan_palace-bosphour_-_panoramio_-_HALUK_COMERTEL_(2).jpg",
         "Istanbul-çırağan_palace-bosphour_-_panoramio_-_HALUK_COMERTEL.jpg", "Istanbul-çırağan_palace-bosphour_-_panoramio_-_HALUK_COMERTEL_(13).jpg",
         "Istanbul-çırağan_palace-bosphour_-_panoramio_-_HALUK_COMERTEL_(3).jpg"}

photos = {}
for line in (ROOT / "scripts/photos.src.txt").read_text().splitlines():
    if not line.strip() or line.startswith("#"):
        continue
    key, h, name, by, lic = line.split("|")
    name = unicodedata.normalize("NFC", name)
    m = hashlib.md5(name.encode()).hexdigest()
    assert h == f"{m[0]}/{m[:2]}", (key, name)
    photos.setdefault(key, []).append({
        "url": commons_url(h, name), "w": 1280 if name in SMALL else 1920,
        "credit": by, "license": lic, "source": "https://commons.wikimedia.org/wiki/File:" + urllib.parse.quote(name, safe="(),'!*"),
    })

# slug, eBooking hotel ID (mapped in the eBooking portal), name, area, destination slug, city, country iso, stars, lat, lng,
# two night net for one adult, Booking.com and Expedia public prices for the same two nights, rating, votes, tip
H = [
 ("peninsula-paris", 483658, "The Peninsula Paris", "Avenue Kléber", "paris", "Paris", "FR", 5, 48.8705, 2.2933, 2380, 2795, 2820, 9.4, 1210, "Ask for a sixth floor room on the Kléber side. The rooftop bar has the Eiffel Tower straight ahead and is open to hotel guests first."),
 ("meurice", 284785, "Le Meurice", "Rue de Rivoli", "paris", "Paris", "FR", 5, 48.8651, 2.3281, 2150, 2520, 2560, 9.3, 980, "Rooms facing the Tuileries are worth the difference. Have the pastries at Le Dalí once, even if you skip breakfast."),
 ("crillon", 284440, "Hôtel de Crillon", "Place de la Concorde", "paris", "Paris", "FR", 5, 48.8676, 2.3214, 2290, 2690, 2715, 9.4, 760, "The Concorde facing rooms are the reason to stay here. The pool in the basement is quiet before ten."),
 ("athenee", 285550, "Hôtel Plaza Athénée", "Avenue Montaigne", "paris", "Paris", "FR", 5, 48.8661, 2.3043, 2240, 2625, 2650, 9.3, 1040, "Courtyard rooms are quieter than the avenue side. The bar turns into the best people watching in Paris after nine."),
 ("ritz-london", 303974, "The Ritz London", "Piccadilly", "london", "London", "GB", 5, 51.5070, -0.1416, 1640, 1925, 1950, 9.3, 1890, "Book afternoon tea when you book the room; it fills weeks ahead. Green Park side rooms get the morning light."),
 ("langham", 287987, "The Langham, London", "Marylebone", "london", "London", "GB", 5, 51.5179, -0.1440, 980, 1150, 1168, 9.1, 2420, "Ten minutes on foot to Oxford Circus and still quiet at night. Tea in the Palm Court is the one to book."),
 ("savoy", 1919916, "The Savoy", "Strand", "london", "London", "GB", 5, 51.5104, -0.1203, 1380, 1620, 1645, 9.2, 2210, "River view rooms are worth it at Christmas. The American Bar opens at noon and you will not need a reservation then."),
 ("burj", 288903, "Burj Al Arab", "Jumeirah", "dubai", "Dubai", "AE", 5, 25.1412, 55.1853, 3100, 3640, 3690, 9.4, 1580, "Every room is a duplex suite. Book the beach cabana early in December; the terrace pool is calmer than the main one."),
 ("atlantis", 210858, "Atlantis The Palm", "Palm Jumeirah", "dubai", "Dubai", "AE", 5, 25.1304, 55.1171, 1180, 1385, 1402, 8.9, 6120, "Water park entry is included with the room; go in the first hour. Ask for the Palm side for the skyline at night."),
 ("plaza-ny", 805571, "The Plaza", "Fifth Avenue", "new-york", "New York", "US", 5, 40.7646, -73.9744, 1720, 2020, 2045, 9.0, 1730, "Park view rooms on a high floor, or do not bother upgrading. The food hall downstairs is open until late."),
 ("mbs", 421077, "Marina Bay Sands", "Marina Bay", "singapore", "Singapore", "SG", 5, 1.2834, 103.8607, 1260, 1480, 1497, 8.9, 9840, "The infinity pool is for hotel guests only; go at seven in the morning. City view rooms beat the harbor side at night."),
 ("raffles", 421119, "Raffles Singapore", "Beach Road", "singapore", "Singapore", "SG", 5, 1.2949, 103.8545, 1940, 2280, 2305, 9.5, 870, "Every room is a suite with a butler. Skip the queue at the Long Bar by going before five."),
 ("ciragan", 4865, "Çırağan Palace Kempinski", "Beşiktaş", "istanbul", "Istanbul", "TR", 5, 41.0435, 29.0153, 1290, 1515, 1532, 9.2, 2650, "Pay for the Bosphorus view; the garden side looks at a wall. The heated infinity pool is open all winter."),
 ("pera", 283296, "Pera Palace Hotel", "Beyoğlu", "istanbul", "Istanbul", "TR", 5, 41.0315, 28.9746, 520, 610, 619, 9.0, 3320, "Room 411 is the Agatha Christie room if you ask early. Five minutes on foot to İstiklal, and the bar is from 1892."),
 ("mamounia", 308854, "La Mamounia", "Medina", "marrakech", "Marrakech", "MA", 5, 31.6215, -7.9988, 1480, 1740, 1762, 9.5, 1410, "Garden view rooms face the Atlas on a clear morning. The gardens are the reason to stay; breakfast out there in winter sun."),
 ("amstel", 324773, "InterContinental Amstel Amsterdam", "Amstel river", "amsterdam", "Amsterdam", "NL", 5, 52.3592, 4.9046, 1120, 1315, 1331, 9.2, 1980, "River view rooms only. The hotel boat goes to the Rijksmuseum, which is the best way into the city in winter."),
 ("majestic", 309521, "Majestic Hotel and Spa Barcelona", "Passeig de Gràcia", "barcelona", "Barcelona", "ES", 5, 41.3946, 2.1624, 760, 892, 905, 9.2, 4100, "The rooftop pool looks at Sagrada Família. Casa Batlló is a three minute walk; book the first slot of the day."),
 ("arts", 309165, "Hotel Arts Barcelona", "Port Olímpic", "barcelona", "Barcelona", "ES", 5, 41.3864, 2.1967, 940, 1105, 1121, 9.0, 3550, "Sea view above the 20th floor. The beach is across the road, the old town a ten minute taxi."),
 ("wbcn", 72202, "W Barcelona", "Barceloneta", "barcelona", "Barcelona", "ES", 5, 41.3684, 2.1901, 820, 965, 978, 8.8, 5280, "The sail is on the beach, so every room sees the sea. Eclipse bar on the 26th floor for sunset."),
 ("excelsior-rome", 356072, "The Westin Excelsior, Rome", "Via Veneto", "rome", "Rome", "IT", 5, 41.9087, 12.4893, 780, 915, 929, 8.9, 2240, "Via Veneto is quiet at night and Villa Borghese is at the end of the street. Corner rooms under the dome have the view."),
 ("cip", 393287, "Copacabana Palace, A Belmond Hotel", "Copacabana", "rio", "Rio de Janeiro", "BR", 5, -22.9670, -43.1786, 1260, 1480, 1500, 9.2, 2890, "The New Year fireworks are right in front of the hotel. Book the beach side; the pool deck is the best seat in Rio."),
]

DEST_EXTRA = [
 ("singapore", "Singapore", "Singapore", "SG", "Asia/Singapore", 1.2903, 103.8520, "Hawker stalls, rooftop pools and the cleanest airport on earth.", 14),
 ("rio", "Rio de Janeiro", "Brazil", "BR", "America/Sao_Paulo", -22.9068, -43.1729, "Copacabana at New Year, two million people in white.", 15),
]
U = lambda i: f"https://images.unsplash.com/{i}"
# photos are copied into our Supabase Storage at fixed sizes (scripts: browser copy, 9 Nov 2026); the url is the base, sizes are suffixes
MEDIA = "https://yssrtmwluzgbviiqnxvu.supabase.co/storage/v1/object/public/media/photos"
PLACE = lambda slug: f"{MEDIA}/p/{slug}"
HERO = {"paris": "photo-1502602898657-3e91760cbb34", "london": "photo-1529655683826-aba9b3e77383", "dubai": "photo-1518684079-3c830dcef090",
        "new-york": "photo-1767342976245-b34c150bddf9", "singapore": "photo-1525625293386-3f8f99389edd", "istanbul": "photo-1636537511494-c3e558e0702b",
        "marrakech": "photo-1770970389629-86cac3ef3e12", "amsterdam": "photo-1459679749680-18eb1eb37418", "barcelona": "photo-1539037116277-4db20889f2d4",
        "lisbon": "photo-1558102400-72da9fdbecae", "madeira": "photo-1628413283166-a7666966d26b", "rome": "photo-1552832230-c0197dd311b5",
        "rio": "photo-1483729558449-99ef09a8c325"}
SEASON_HERO = {"christmas": "photo-1514729797186-944d57303199", "new-year": "photo-1549534077-1b4f31dd59ea"}

def stored(eid, imgs):
    return [{**p, "url": f"{MEDIA}/h/{eid}/{k}", "origin": p["url"]} for k, p in enumerate(imgs)]

world = []
for (slug, eid, name, area, dest, city, iso, stars, lat, lng, net, b, e, rating, votes, tip) in H:
    assert slug in photos, slug
    world.append({"slug": slug, "ebcId": eid, "ebcIdVerified": True, "name": name, "area": area, "city": city, "destination": dest, "countryIso": iso,
                  "stars": stars, "rating": rating, "votes": votes, "supplierNet": float(net), "supplierNetNonRef": round(net * 0.9, 2), "penalty": round(net / 2, 2),
                  "refs": [{"source": "Booking.com", "price": b}, {"source": "Expedia", "price": e}], "booked": 0, "lat": lat, "lng": lng,
                  "deposit": "Pre authorization by card at check in", "onRequest": False, "bookingSoldOut": False, "tip": tip, "images": stored(eid, photos[slug])})
(ROOT / "lib/ebc/fixtures/world.json").write_text(json.dumps(world, ensure_ascii=False, indent=1) + "\n")

# Portugal hotels that have licensed high resolution photos keep them; the rest leave the storefront.
pt = json.loads((ROOT / "lib/ebc/fixtures/portugal.json").read_text())
# mapped in the eBooking portal on 9 Nov 2026 (hotel autocomplete, exact name and city)
PT_REAL = {"reids": 1700418, "pestana": 322834}
for h in pt:
    if h["slug"] in PT_REAL:
        h["ebcId"], h["ebcIdVerified"] = PT_REAL[h["slug"]], True
for h in pt:
    if h["slug"] in photos:
        h["images"] = stored(h["ebcId"], photos[h["slug"]])
(ROOT / "lib/ebc/fixtures/portugal.json").write_text(json.dumps(pt, ensure_ascii=False, indent=2) + "\n")
PT_KEEP = [h for h in pt if h["slug"] in photos]

media = {"destinations": {k: PLACE(k) for k in HERO}, "seasons": {k: PLACE(k) for k in SEASON_HERO}}
(ROOT / "lib/content/media.json").parent.mkdir(exist_ok=True)
(ROOT / "lib/content/media.json").write_text(json.dumps(media, indent=1) + "\n")

q = lambda s: "null" if s is None else "'" + str(s).replace("'", "''") + "'"
sql = ["-- World inventory: 21 hotels in 12 destinations, licensed high resolution photos, seasonal collections.",
       "-- eBooking IDs mapped in the portal (hotel autocomplete); prices come from the simulator until the live connection is on.", ""]
for (slug, name, country, iso, tz, lat, lng, blurb, pos) in DEST_EXTRA:
    sql.append(f"insert into destinations (slug, name, country, country_iso, tz, lat, lng, blurb, position) values ({q(slug)}, {q(name)}, {q(country)}, {q(iso)}, {q(tz)}, {lat}, {lng}, {q(blurb)}, {pos}) on conflict (slug) do nothing;")
for k, v in HERO.items():
    sql.append(f"update destinations set hero_image = {q(PLACE(k))} where slug = {q(k)};")
sql.append("")
photo_rows = []
for h in world + PT_KEEP:
    for k, p in enumerate(h["images"]):
        tail = p["origin"].split("/commons/")[1]
        photo_rows.append(f"({h['ebcId']},{k},{q(tail)},{p['w']},{q(p['credit'])},{q(p['license'])})")
PT_DEST = {"Madeira": "madeira", "Lisbon": "lisbon"}
hotel_rows = [f"({h['ebcId']},{q(h['name'])},{h['stars']},{q(h['area'])},{q(h['city'])},{q(h.get('countryIso', 'PT'))},{h['lat']},{h['lng']},{h['rating']},{h['votes']},{q(h.get('destination') or PT_DEST[h['city']])},{q(h['slug'])},{round(h['supplierNet']/2, 2)})" for h in world + PT_KEEP]
sql.append("insert into hotels (ebc_id, name, stars, address, city_name, country_iso, lat, lng, rating, rating_count, destination_slug, slug, nightly_net_sample, ebc_id_verified) select v.*, true from (values " + ",".join(hotel_rows) + ") as v "
           "on conflict (ebc_id) do update set name = excluded.name, address = excluded.address, city_name = excluded.city_name, destination_slug = excluded.destination_slug, lat = excluded.lat, lng = excluded.lng, rating = excluded.rating, rating_count = excluded.rating_count;")
sql.append("with p(e, k, f, w, c, l) as (values " + ",".join(photo_rows) + ") "
           f"update hotels h set images = x.j from (select e, jsonb_agg(jsonb_build_object('url', '{MEDIA}/h/' || e || '/' || k, 'origin', 'https://upload.wikimedia.org/wikipedia/commons/' || f, 'w', w,"
           " 'credit', c, 'license', l, 'source', 'https://commons.wikimedia.org/wiki/File:' || split_part(f, '/', 3)) order by k) j from p group by e) x where h.ebc_id = x.e;")
sql.append("")
SF = "(select id from storefronts where slug = 'lina')"
sql.append(f"delete from storefront_hotels where storefront_id = {SF};")
pins = [h for h in world] + PT_KEEP
sql.append(f"insert into storefront_hotels (storefront_id, ebc_id, position, tip) select {SF}, v.e, v.p, v.t from (values " + ",".join(f"({h['ebcId']},{i},{q(h['tip'])})" for i, h in enumerate(pins)) + ") as v(e, p, t);")
sql.append("")
DATES = [("2026-12-03", "2026-12-05", 1, 1.0), ("2026-12-03", "2026-12-05", 2, 1.0), ("2026-12-22", "2026-12-26", 2, 2 * 1.18), ("2026-12-29", "2027-01-02", 2, 2 * 1.22)]
SRC = {"Booking.com": "booking", "Expedia": "expedia"}
rows = []
for h in pins:
    for (ci, co, ad, f) in DATES:
        for r in h["refs"]:
            if r["source"] in SRC:
                rows.append(f"({h['ebcId']},'{SRC[r['source']]}','{ci}','{co}',{ad},{round(r['price'] * f)})")
sql.append("insert into price_checks (ebc_id, source, check_in, check_out, adults, price, currency, signed_out, checked_at) select v.e, v.s::price_source, v.i::date, v.o::date, v.a, v.p, 'USD', true, now() from (values " + ",".join(rows) + ") as v(e, s, i, o, a, p);")
sql.append("")
by_dest = {}
for h in world:
    by_dest.setdefault(h["destination"], []).append(h["ebcId"])
for h in PT_KEEP:
    by_dest.setdefault({"Lisbon": "lisbon", "Madeira": "madeira"}.get(h["city"], h["city"].lower()), []).append(h["ebcId"])
sql.append(f"delete from collections where storefront_id = {SF};")
ids = lambda xs: "array[" + ",".join(str(x) for x in xs) + "]::int[]"
season = [
 ("new-year", "New Year's Eve", "Four nights over New Year, 29 December to 2 January, two adults. Where the fireworks are.", "2026-12-29", "2027-01-02", ["cip", "burj", "plaza-ny", "mbs", "ritz-london", "peninsula-paris", "mamounia"]),
 ("christmas", "Christmas week", "Four nights, 22 to 26 December, two adults. Markets, lights and long lunches.", "2026-12-22", "2026-12-26", ["savoy", "amstel", "meurice", "pera", "majestic", "excelsior-rome", "reids"]),
]
slug2id = {h["slug"]: h["ebcId"] for h in pins}
pos = 0
for (slug, title, sub, ci, co, hs) in season:
    sql.append(f"insert into collections (storefront_id, slug, kind, title, subtitle, check_in, check_out, ebc_ids, position, hero_url) values ({SF}, {q(slug)}, 'season', {q(title)}, {q(sub)}, '{ci}', '{co}', {ids([slug2id[s] for s in hs])}, {pos}, {q(PLACE(slug))});")
    pos += 1
for d, xs in by_dest.items():
    sql.append(f"insert into collections (storefront_id, slug, kind, title, subtitle, ebc_ids, position, hero_url, destination_slug) select {SF}, {q(d)}, 'destination', name, blurb, {ids(xs)}, {pos} + position, hero_image, slug from destinations where slug = {q(d)};")
plan = {"pins": [{"ebcId": h["ebcId"], "tip": h["tip"]} for h in pins],
        "collections": [{"slug": sl, "kind": "season", "title": t, "subtitle": su, "checkIn": ci, "checkOut": co, "ebcIds": [slug2id[x] for x in hs], "heroUrl": PLACE(sl)} for (sl, t, su, ci, co, hs) in season]
        + [{"slug": d, "kind": "destination", "ebcIds": xs} for d, xs in by_dest.items()],
        "priceDates": [{"checkIn": ci, "checkOut": co, "adults": ad, "factor": f} for (ci, co, ad, f) in DATES]}
(ROOT / "lib/content/lina.json").write_text(json.dumps(plan, ensure_ascii=False, indent=1) + "\n")
sql.append("update storefronts set city_name = null, headline = 'Hotels I slept in, from Paris to Rio.' where slug = 'lina';")
(ROOT / "supabase/migrations/0006_world.sql").write_text("\n".join(sql) + "\n")
print(len(world), "world hotels;", sum(len(v) for v in photos.values()), "photos;", len(by_dest), "destinations;", len(PT_KEEP), "Portugal kept")
