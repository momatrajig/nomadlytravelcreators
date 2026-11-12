import { Clock } from "lucide-react";
import { Ico } from "@/components/Icon";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import CheckoutForm from "@/components/CheckoutForm";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { readerOf } from "@/lib/storefront/reader";
import { requireStorefront } from "@/lib/tenant";
import { searchStays } from "@/lib/booking/service";
import { ELSEWHERE_CHECKED } from "@/lib/extras/catalog";
import { bookingClosedReason } from "@/lib/booking/guard";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// kept outside render so the React compiler lint accepts the clock read on a dynamic server page
function isExpired(iso: string) { return Date.parse(iso) < Date.now(); }

export default async function Checkout({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sf = await requireStorefront();
  const { t, f } = await readerOf(sf);
  const { q } = await searchParams;
  if (typeof q !== "string") notFound();
  const quote = await db().quote(q);
  if (!quote || quote.storefrontId !== sf.id) notFound();
  const hotel = await db().hotel(quote.ebcId);
  const expired = isExpired(quote.expiresAt);
  const nights = Math.round((Date.parse(quote.checkOut) - Date.parse(quote.checkIn)) / 86_400_000);
  const adults = quote.occupancy.reduce((a, r) => a + r.adults, 0) || 1;
  const h = await headers();
  const country = (h.get("x-vercel-ip-country") ?? "").toUpperCase() || (sf.locale === "cs" ? "CZ" : null);
  // the room's name from the search the reader just saw (cached); the quote itself only holds the package code
  const roomName = await searchStays(sf, quote.checkIn, quote.checkOut, adults, [], [quote.ebcId], country ?? undefined)
    .then((r) => r.offers.flatMap((o) => o.rates).find((x) => x.packageCode === quote.packageCode)?.roomName ?? null).catch(() => null);
  return (
    <>
      <nav className="crumbs" aria-label="Breadcrumb"><Link href={`/hotel/${quote.ebcId}?in=${quote.checkIn}&out=${quote.checkOut}&adults=${adults}`}>{hotel?.name ?? t.allHotels}</Link><span aria-hidden="true">/</span><span aria-current="page">{t.checkout}</span></nav>
      {expired
        ? (
          <section className="expired" role="alert">
            <Ico of={Clock} size={20} />
            <h1>{hotel?.name}</h1>
            <p>{t.heldExpired}</p>
            <a className="btn btn-brand btn-lg" href={`/hotel/${quote.ebcId}?in=${quote.checkIn}&out=${quote.checkOut}&adults=${adults}#rooms`}>{t.freshPrice}</a>
          </section>
        )
        : <CheckoutForm
            quoteId={quote.id} amount={quote.readerPrice} currency={quote.currency} refundable={quote.refundable} cancelDeadline={quote.cancelDeadline} cancelCharge={quote.cancelCharge}
            brandName={sf.brandName} brandColor={sf.brandColor} stripeKey={env().NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? null} expiresAt={quote.expiresAt} f={f}
            hotel={{ name: hotel?.name ?? "", stars: hotel?.stars ?? null, address: [hotel?.address, hotel?.cityName].filter(Boolean).join(", ") || null, photo: hotel?.images[0] ? { url: hotel.images[0].url, w: hotel.images[0].w } : null, roomName, board: quote.board }}
            checkIn={quote.checkIn} checkOut={quote.checkOut} nights={nights} adults={adults} destination={hotel?.destination ?? null} country={country}
            lowestReference={quote.lowestReference} lowestSource={quote.lowestReferenceSource} compare={ELSEWHERE_CHECKED || !!bookingClosedReason()} demo={!!bookingClosedReason()}
          />}
    </>
  );
}
