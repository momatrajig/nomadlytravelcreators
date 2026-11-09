import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import "./flow.css";
import { currentStorefront } from "@/lib/tenant";
import { BottomNav } from "@/components/BottomNav";
import { headers } from "next/headers";
import { env } from "@/lib/env";
import { signedInUser } from "@/lib/auth";

export async function generateMetadata(): Promise<Metadata> {
  const sf = await currentStorefront();
  return { title: sf ? `${sf.brandName}: stays below the big sites` : "Nomadly", description: sf ? `${sf.brandName} books the hotels she actually stayed in, priced below Booking.com, Expedia and Agoda.` : "Nomadly Ambassadors" };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const sf = await currentStorefront();
  // the dashboard switch shows on platform and preview hosts (and to a signed in creator); readers on a creator's domain do not see it
  const host = ((await headers()).get("x-forwarded-host") ?? (await headers()).get("host") ?? "").toLowerCase();
  const showCreator = host.endsWith(".vercel.app") || host.startsWith("localhost") || host.endsWith(env().PLATFORM_HOST) || !!(await signedInUser());
  const brand = sf?.brandColor ?? "#2458d6";
  return (
    <html lang="en" style={{ ["--brand" as string]: brand }}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&family=Hanken+Grotesk:wght@400;500;600;700&display=swap" />
      </head>
      <body>
        {sf ? (
          <>
            {env().EBC_MODE === "mock" && <div className="demo" role="note">Preview. Hotel prices and big site prices are simulated until the live hotel connection is on, and cards are charged in Stripe test mode, so nothing here is a real booking.</div>}
            <header className="hdr"><div className="wrap">
              <Link href="/" className="logo"><span className="mark">{sf.brandName.slice(0, 1).toUpperCase()}</span><span>{sf.brandName}</span></Link>
              <div className="hdr-right"><nav className="nav" aria-label="Main"><Link href="/stays">Hotels</Link><Link href="/booking">Your booking</Link></nav>{showCreator && <Link href="/dashboard" className="btn btn-quiet"><span className="hide-sm">Creator </span>dashboard</Link>}</div>
            </div></header>
            <main className="wrap">{children}</main>
            <footer className="wrap site-foot">
              <p>{sf.brandName} runs on Nomadly, a Veny Inc. company. Nomadly takes the payment and pays the hotel. Support every day, 08:00 to 22:00 UTC.</p>
              <p><Link href="/credits">Photo credits</Link><Link href="/booking">Find your booking</Link><Link href="/dashboard">Creator dashboard</Link></p>
            </footer>
            <BottomNav />
          </>
        ) : (
          <main className="wrap" style={{ padding: "80px 0" }}><h1>Nomadly</h1><p className="mute">No storefront is configured on this address.</p></main>
        )}
      </body>
    </html>
  );
}
