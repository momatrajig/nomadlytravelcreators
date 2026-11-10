import { notFound } from "next/navigation";
import CheckoutForm from "@/components/CheckoutForm";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { fmtDay, price } from "@/lib/i18n";
import { readerOf } from "@/lib/storefront/reader";
import Price from "@/components/Price";
import { requireStorefront } from "@/lib/tenant";
import { sourceLabel } from "@/lib/booking/service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// kept outside render so the React compiler lint accepts the clock read on a dynamic server page
function isExpired(iso: string) { return Date.parse(iso) < Date.now(); }

export default async function Checkout({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sf = await requireStorefront();
  const { t, f } = await readerOf(sf);
  const fmtDate = (d: string) => fmtDay(d, f.lang);
  const usd = (x: number) => price(f, x, false);
  const { q } = await searchParams;
  if (typeof q !== "string") notFound();
  const quote = await db().quote(q);
  if (!quote || quote.storefrontId !== sf.id) notFound();
  const hotel = await db().hotel(quote.ebcId);
  const expired = isExpired(quote.expiresAt);
  const nights = Math.round((Date.parse(quote.checkOut) - Date.parse(quote.checkIn)) / 86_400_000);
  return (
    <>
      <h1 style={{ fontSize: 28, margin: "18px 0 0" }}>{t.checkout}</h1>
      <div className="checkout">
        <div>
          {expired ? <div className="notice warn" role="alert">{t.heldExpired} <a href={`/hotel/${quote.ebcId}?in=${quote.checkIn}&out=${quote.checkOut}`}>{t.freshPrice}</a>.</div>
            : <CheckoutForm quoteId={quote.id} amount={quote.readerPrice} currency={quote.currency} refundable={quote.refundable} cancelDeadline={quote.cancelDeadline} cancelCharge={quote.cancelCharge} brandName={sf.brandName} stripeKey={env().NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? null} expiresAt={quote.expiresAt} f={f} />}
        </div>
        <aside className="summary panel">
          <h2 style={{ fontSize: 20 }}>{hotel?.name}</h2>
          <p className="small mute" style={{ margin: "4px 0 12px" }}>{t.stayLine(fmtDate(quote.checkIn), fmtDate(quote.checkOut), nights, quote.occupancy[0]?.adults ?? 1)}. {t.board[quote.board ?? "RO"]}.</p>
          <ul>
            <li><span>{t.roomNights(nights)}</span><span>{usd(quote.readerPrice)}</span></li>
            {quote.lowestReference && quote.lowestReference > quote.readerPrice && <li className="small" style={{ color: "var(--ok)" }}><span>{t.showed(sourceLabel(quote.lowestReferenceSource))}</span><span>{usd(quote.lowestReference)}</span></li>}
            <li className="total"><span>{t.payNow}</span><Price f={f} v={quote.readerPrice} whole={false} approxClass="approx small mute" /></li>
            <li className="small mute"><span>{t.cityTax}</span><span>{t.perPersonNight}</span></li>
          </ul>
          <p className="small mute" style={{ margin: "12px 0 0" }}>{quote.refundable ? t.freeUntilShort(quote.cancelDeadline ? fmtDate(quote.cancelDeadline) : t.checkInWord, quote.cancelCharge ? usd(quote.cancelCharge) : null) : t.rateNoRefunds}</p>
        </aside>
      </div>
    </>
  );
}
