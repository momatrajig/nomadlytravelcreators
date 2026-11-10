import type { Storefront } from "@/lib/db/types";
import { dict, langOf, type Dict, type ReaderFmt } from "@/lib/i18n";
import { usdTo } from "@/lib/i18n/fx";

/** The storefront's language, words and price format for this request. */
export async function readerOf(sf: Storefront): Promise<{ t: Dict; f: ReaderFmt }> {
  const lang = langOf(sf.locale);
  const disp = sf.displayCurrency ?? null;
  const rate = disp ? await usdTo(disp) : null;
  return { t: dict(lang), f: { lang, currency: sf.currency || "USD", disp: rate ? disp : null, rate } };
}
