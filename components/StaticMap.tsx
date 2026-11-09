/** OpenStreetMap embed: real streets, no API key, no tracking cookies. A tiles SDK can replace it behind the same props. */
export default function HotelMap({ lat, lng, name }: { lat: number; lng: number; name: string }) {
  const dx = 0.018, dy = 0.011;
  const bbox = [lng - dx, lat - dy, lng + dx, lat + dy].map((v) => v.toFixed(5)).join(",");
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat.toFixed(5)},${lng.toFixed(5)}`;
  return (
    <figure className="map">
      <iframe title={`Map of ${name}`} src={src} loading="lazy" referrerPolicy="no-referrer" />
      <figcaption><a href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`} target="_blank" rel="noreferrer">Open the full map</a><span>© OpenStreetMap contributors</span></figcaption>
    </figure>
  );
}
