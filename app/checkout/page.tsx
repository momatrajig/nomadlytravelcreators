import { notFound } from "next/navigation";
import CheckoutForm from "@/components/CheckoutForm";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { BOARD, fmtDate, usd } from "@/lib/format";
import { requireStorefront } from "@/lib/tenant";
import { sourceLabel } from "@/lib/booking/service";

export const dynamic = "force-dynamic";

// kept outside render so the React compiler lint accepts the clock read on a dynamic server page
function isExpired(iso: string) { return Date.parse(iso) < Date.now(); }

export default async function Checkout({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sf = await requireStorefront();
  const { q } = await searchParams;
  if (typeof q !== "string") notFound();
  const quote = await db().quote(q);
  if (!quote || quote.storefrontId !== sf.id) notFound();
  const hotel = await db().hotel(quote.ebcId);
  const expired = isExpired(quote.expiresAt);
  const nights = Math.round((Date.parse(quote.checkOut) - Date.parse(quote.checkIn)) / 86_400_000);
  return (
    <>
      <h1 style={{ fontSize: 28, margin: "18px 0 0" }}>Checkout</h1>
      <div className="checkout">
        <div>
          {expired ? <div className="notice warn" role="alert">This price was held for 20 minutes and has expired. <a href={`/hotel/${quote.ebcId}?in=${quote.checkIn}&out=${quote.checkOut}`}>Get a fresh price</a>.</div>
            : <CheckoutForm quoteId={quote.id} amount={quote.readerPrice} currency={quote.currency} refundable={quote.refundable} cancelDeadline={quote.cancelDeadline} cancelCharge={quote.cancelCharge} brandName={sf.brandName} stripeKey={env().NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? null} expiresAt={quote.expiresAt} />}
        </div>
        <aside className="summary panel">
          <h2 style={{ fontSize: 20 }}>{hotel?.name}</h2>
          <p className="small mute" style={{ margin: "4px 0 12px" }}>{fmtDate(quote.checkIn)} to {fmtDate(quote.checkOut)}, {nights} {nights === 1 ? "night" : "nights"}, {quote.occupancy[0]?.adults} {quote.occupancy[0]?.adults === 1 ? "adult" : "adults"}. {BOARD[quote.board ?? "RO"]}.</p>
          <ul>
            <li><span>Room, {nights} nights, tax included</span><span>{usd(quote.readerPrice)}</span></li>
            {quote.lowestReference && quote.lowestReference > quote.readerPrice && <li className="small" style={{ color: "var(--ok)" }}><span>{sourceLabel(quote.lowestReferenceSource)} showed</span><span>{usd(quote.lowestReference)}</span></li>}
            <li className="total"><span>You pay now</span><span>{usd(quote.readerPrice)}</span></li>
            <li className="small mute"><span>At the hotel, city tax</span><span>per person per night</span></li>
          </ul>
          <p className="small mute" style={{ margin: "12px 0 0" }}>{quote.refundable ? `Free cancellation until ${quote.cancelDeadline ? fmtDate(quote.cancelDeadline) : "check in"}${quote.cancelCharge ? `, then ${usd(quote.cancelCharge)}` : ""}.` : "This rate has no refunds."}</p>
        </aside>
      </div>
    </>
  );
}
