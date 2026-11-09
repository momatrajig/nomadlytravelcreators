import { EXTRAS } from "@/lib/extras/catalog";
import { usd } from "@/lib/format";

const ICON: Record<string, string> = {
  car: "M3 13l2-5a2 2 0 012-1h10a2 2 0 012 1l2 5v5h-2a2 2 0 11-4 0H9a2 2 0 11-4 0H3zM6 13h12",
  sim: "M7 3h7l4 4v14H7zM10 11h6v6h-6z",
  luggage: "M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2M5 7h14v12H5zM9 11v4M15 11v4",
  umbrella: "M12 3a9 9 0 019 9H3a9 9 0 019-9zM12 12v6a2 2 0 004 0",
};

/** Veny services as a quiet row. They are added at checkout, with the stay, in one payment. */
export default function ExtrasRow() {
  return (
    <section aria-labelledby="extras" style={{ marginTop: 26 }}>
      <h2 id="extras" style={{ fontSize: 24 }}>Getting there, and the small things</h2>
      <p className="mute" style={{ margin: "4px 0 14px" }}>Add any of these at checkout, in the same payment as the room. Each costs less than on its own site, and you cancel them with the stay.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        {EXTRAS.map((x) => (
          <div key={x.kind} className="panel" style={{ display: "grid", gap: 10 }}>
            <span style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, var(--navy), var(--brand))", display: "grid", placeItems: "center" }}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d={ICON[x.icon]} /></svg>
            </span>
            <div><b>{x.name}</b><p className="small" style={{ margin: "4px 0 0", color: "var(--fg-2)" }}>{x.short}</p></div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}><span className="price" style={{ fontSize: 22 }}>{usd(x.price, true)}</span><span className="small mute" style={{ textDecoration: "line-through" }}>{usd(x.elsewhere, true)} elsewhere</span></div>
          </div>
        ))}
      </div>
    </section>
  );
}
