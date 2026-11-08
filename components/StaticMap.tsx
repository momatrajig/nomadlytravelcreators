import { LISBON_PLACES } from "@/lib/transit/places";

/** Dependency free map: the hotel and the landmarks on a projected plane, so the page works without a maps key. Swap for a tiles map behind the same props. */
export default function StaticMap({ lat, lng, name }: { lat: number; lng: number; name: string }) {
  const pts = [{ key: "hotel", name, lat, lng }, ...LISBON_PLACES.map((p) => ({ key: p.key, name: p.name, lat: p.lat, lng: p.lng }))];
  const lats = pts.map((p) => p.lat), lngs = pts.map((p) => p.lng);
  const minLat = Math.min(...lats) - 0.01, maxLat = Math.max(...lats) + 0.01, minLng = Math.min(...lngs) - 0.012, maxLng = Math.max(...lngs) + 0.012;
  const W = 400, H = 300;
  const x = (lo: number) => ((lo - minLng) / (maxLng - minLng)) * W, y = (la: number) => H - ((la - minLat) / (maxLat - minLat)) * H;
  return (
    <svg className="map" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Map of ${name} and nearby landmarks`} style={{ width: "100%", height: "auto", display: "block", background: "var(--surface-2)" }}>
      <defs><pattern id="g" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="var(--line)" strokeWidth="1" /></pattern></defs>
      <rect width={W} height={H} fill="url(#g)" />
      <path d={`M0 ${H * 0.86} Q ${W * 0.3} ${H * 0.8} ${W * 0.55} ${H * 0.9} T ${W} ${H * 0.84} V ${H} H 0 Z`} fill="color-mix(in srgb, var(--brand) 25%, var(--surface-3))" opacity=".7" />
      {pts.slice(1).map((p) => (
        <g key={p.key}>
          <line x1={x(lng)} y1={y(lat)} x2={x(p.lng)} y2={y(p.lat)} stroke="var(--line-2)" strokeDasharray="3 4" />
          <circle cx={x(p.lng)} cy={y(p.lat)} r="5" fill="var(--surface)" stroke="var(--fg-2)" strokeWidth="1.5" />
          <text x={x(p.lng) + 8} y={y(p.lat) + 4} fontSize="10" fill="var(--fg-2)" fontFamily="var(--font-body)">{p.name.split(" and ")[0]}</text>
        </g>
      ))}
      <circle cx={x(lng)} cy={y(lat)} r="9" fill="var(--brand)" stroke="#fff" strokeWidth="2" />
      <text x={x(lng) + 12} y={y(lat) - 8} fontSize="11" fontWeight="600" fill="var(--fg)" fontFamily="var(--font-body)">{name}</text>
    </svg>
  );
}
