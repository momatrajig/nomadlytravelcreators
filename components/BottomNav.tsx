"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export function BottomNav({ labels = ["Home", "Hotels", "Your booking"] }: { labels?: [string, string, string] | string[] }) {
  const p = usePathname();
  // the reader's bar; creators in their dashboard have their own navigation
  if (p?.startsWith("/dashboard")) return null;
  const cur = (h: string) => (p === h || (h !== "/" && p.startsWith(h)) ? "page" : undefined);
  return (
    <nav className="bottomnav" aria-label="Sections">
      <Link href="/" aria-current={cur("/")}>{labels[0]}</Link>
      <Link href="/stays" aria-current={cur("/stays")}>{labels[1]}</Link>
      <Link href="/booking" aria-current={cur("/booking")}>{labels[2]}</Link>
    </nav>
  );
}
