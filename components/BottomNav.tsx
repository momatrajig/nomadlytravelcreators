"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export function BottomNav() {
  const p = usePathname();
  const cur = (h: string) => (p === h || (h !== "/" && p.startsWith(h)) ? "page" : undefined);
  return (
    <nav className="bottomnav" aria-label="Sections">
      <Link href="/" aria-current={cur("/")}>Home</Link>
      <Link href="/stays" aria-current={cur("/stays")}>Stays</Link>
      <Link href="/booking" aria-current={cur("/booking")}>Your booking</Link>
    </nav>
  );
}
