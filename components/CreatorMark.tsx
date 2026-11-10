import type { Storefront } from "@/lib/db/types";

/** The creator's mark: their logo, else the first letter in their colour. */
export default function CreatorMark({ sf, size = 22 }: { sf: Pick<Storefront, "logoPath" | "brandName">; size?: number }) {
  return sf.logoPath
    ? <img className="cmark" src={sf.logoPath} alt="" width={size} height={size} style={{ width: size, height: size }} />
    : <span className="cmark" aria-hidden="true" style={{ width: size, height: size, fontSize: size * 0.55 }}>{sf.brandName.slice(0, 1).toUpperCase()}</span>;
}

