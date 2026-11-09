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
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;1,9..144,400&family=Inter:wght@400;500;600;700&display=swap" />
      </head>
      <body>
        {sf ? (
          <>
            <header className="hdr"><div className="wrap">
              <Link href="/" className="logo"><span className="mark">{sf.brandName.slice(0, 1).toUpperCase()}</span><span>{sf.brandName}</span></Link>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><nav className="nav" aria-label="Main"><Link href="/">Home</Link><Link href="/stays">Stays</Link><Link href="/booking">Your booking</Link></nav>{showCreator && <Link href="/dashboard" className="btn" style={{ minHeight: 36, padding: "7px 12px", fontSize: 13 }}>Creator dashboard</Link>}</div>
            </div></header>
            <main className="wrap">{children}</main>
            <footer className="wrap">
              <p>{sf.brandName} is powered by Nomadly, a Veny Inc. company, New York. Bookings are made and charged by Nomadly; the hotel is paid by Nomadly. Prices on the big sites are checked every hour. Support 7 days a week, 08:00 to 22:00 Lisbon time.</p>
              <p style={{ marginTop: 8 }}><Link href="/dashboard" style={{ color: "var(--mute)" }}>Creator dashboard</Link></p>
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
