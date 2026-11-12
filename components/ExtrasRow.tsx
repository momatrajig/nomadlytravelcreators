import { ELSEWHERE_CHECKED, EXTRAS } from "@/lib/extras/catalog";
import { dict, price, type ReaderFmt } from "@/lib/i18n";
import { EXTRA_ICON, Ico } from "@/components/Icon";

/** Veny services as a quiet row. They are added at checkout, with the stay, in one payment. */
/** compare: struck through retail prices, shown when checked (or labelled samples in the demo, by the caller) */
export default function ExtrasRow({ f = { lang: "en", currency: "USD", disp: null, rate: null }, compare = ELSEWHERE_CHECKED }: { f?: ReaderFmt; compare?: boolean }) {
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
            <span className="extra-ico"><Ico of={EXTRA_ICON[x.icon]!} size={22} /></span>
            <div><h3>{t.extras?.[x.kind]?.name ?? x.name}</h3><p>{t.extras?.[x.kind]?.short ?? x.short}</p></div>
            <div className="extra-price"><span className="from">{t.fromWord}</span> <b>{price(f, x.price)}</b>{compare && <s>{t.onItsOwn(price(f, x.elsewhere))}</s>}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}
