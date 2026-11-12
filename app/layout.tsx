import { X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import "./flow.css";
import { currentStorefront } from "@/lib/tenant";
import { BottomNav } from "@/components/BottomNav";
import CreatorTabs from "@/components/CreatorTabs";
import { headers } from "next/headers";
import { env } from "@/lib/env";
import { signedInUser } from "@/lib/auth";
import { bookingClosedReason } from "@/lib/booking/guard";
import { dict, langOf } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const sf = await currentStorefront();
  const t = dict(langOf(sf?.locale));
  return { title: sf ? t.metaTitle(sf.brandName) : "Nomadly", description: sf ? `${sf.brandName}: ${sf.headline}` : "Nomadly Ambassadors", robots: sf ? undefined : { index: false } };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const sf = await currentStorefront();
  // the dashboard switch shows on platform and preview hosts (and to a signed in creator); readers on a creator's domain do not see it
  const host = ((await headers()).get("x-forwarded-host") ?? (await headers()).get("host") ?? "").toLowerCase();
  // readers land here from creator links, so creator controls show only to a signed in creator (and in local development)
  const showCreator = host.startsWith("localhost") || !!(await signedInUser());
  const brand = sf?.brandColor ?? "#2458d6";
  const t = dict(langOf(sf?.locale));
  return (
    <html lang={t.lang} style={{ ["--brand" as string]: brand }}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&family=Hanken+Grotesk:wght@400;500;600;700&display=swap" />
      </head>
      <body>
        {sf ? (
          <>
            {env().EBC_MODE === "mock" ? <div className="demo" role="note">{t.bannerMock}</div>
              : bookingClosedReason() ? <div className="demo" role="note"><span className="hide-sm">{t.bannerDemo}</span><span className="show-sm">{t.bannerDemoShort}</span></div> : null}
            <CreatorTabs signedIn={showCreator} labels={{ view: "Creator view", dashboard: "Dashboard", storefront: "My storefront", platform: "Booking platform" }} />
            <header className="hdr"><div className="wrap">
              <Link href="/" className="logo cobrand" aria-label={`Nomadly with ${sf.brandName}, home`}>
                <img className="nm" src="/brand/nomadly.png" alt="Nomadly" width={118} height={36} />
                <X className="x" size={16} aria-hidden="true" />
                {sf.logoPath ? <img className="cl" src={sf.logoPath} alt={sf.brandName} /> : <><span className="mark">{sf.brandName.slice(0, 1).toUpperCase()}</span><span className="bn">{sf.brandName}</span></>}
              </Link>
              <div className="hdr-right"><nav className="nav" aria-label="Main"><Link href="/picks">{t.theirPicks(sf.brandName)}</Link><Link href="/stays">{t.hotels}</Link><Link href="/booking">{t.yourBooking}</Link></nav>{!showCreator && <Link href="/dashboard" className="btn btn-quiet hdr-creators">{t.forCreators}</Link>}</div>
            </div></header>
            <main className="wrap">{children}</main>
            <footer className="wrap site-foot">
              <p>{t.footRuns(sf.brandName)}</p>
              <p>{sf.siteUrl && <a href={sf.siteUrl}>{sf.siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}</a>}<Link href="/credits">{t.photoCredits}</Link><Link href="/booking">{t.findBooking}</Link><Link href="/dashboard">{t.creatorDashboard}</Link></p>
            </footer>
            <BottomNav labels={[t.home, t.hotels, t.yourBooking]} />
          </>
        ) : (
          <main className="wrap" style={{ padding: "80px 0" }}><h1>Nomadly</h1><p className="mute">No storefront is configured on this address.</p></main>
        )}
      </body>
    </html>
  );
}
