import { approxOf, price, type ReaderFmt } from "@/lib/i18n";

/** A price in the charging currency, with the readers' currency beside it as an approximation where the storefront shows one. */
export default function Price({ f, v, whole = true, className, approxClass = "approx" }: { f: ReaderFmt; v: number; whole?: boolean; className?: string; approxClass?: string }) {
  const a = approxOf(f, v);
  return <span className={className}>{price(f, v, whole)}{a && <span className={approxClass}> ({a})</span>}</span>;
}
