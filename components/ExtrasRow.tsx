import { EXTRAS } from "@/lib/extras/catalog";
import { dict, price, type ReaderFmt } from "@/lib/i18n";

const ICON: Record<string, string> = {
  car: "M3 13l2-5a2 2 0 012-1h10a2 2 0 012 1l2 5v5h-2a2 2 0 11-4 0H9a2 2 0 11-4 0H3zM6 13h12",
  sim: "M7 3h7l4 4v14H7zM10 11h6v6h-6z",
  luggage: "M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2M5 7h14v12H5zM9 11v4M15 11v4",
  umbrella: "M12 3a9 9 0 019 9H3a9 9 0 019-9zM12 12v6a2 2 0 004 0",
};

/** Veny services as a quiet row. They are added at checkout, with the stay, in one payment. */
export default function ExtrasRow({ f = { lang: "en", currency: "USD", disp: null, rate: null } }: { f?: ReaderFmt }) {
  const t = dict(f.lang);
  return (
    <section className="block extras" aria-labelledby="extras">
      <div className="block-head">
        <h2 id="extras">{t.extrasTitle}</h2>
        <p>{t.extrasSub}</p>
      </div>
      <ul role="list">
        {EXTRAS.map((x) => (
          <li key={x.kind}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICON[x.icon]} /></svg>
            <div><h3>{t.extras?.[x.kind]?.name ?? x.name}</h3><p>{t.extras?.[x.kind]?.short ?? x.short}</p></div>
            <div className="extra-price"><b>{price(f, x.price)}</b><s>{t.onItsOwn(price(f, x.elsewhere))}</s></div>
          </li>
        ))}
      </ul>
    </section>
  );
}
