"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BedDouble, House, Ticket, type LucideIcon } from "lucide-react";
import { Ico } from "@/components/Icon";

const TABS: Array<[string, LucideIcon]> = [["/", House], ["/stays", BedDouble], ["/booking", Ticket]];

/** The reader's tab bar on phones: icon over label, the current tab in ink with a filled pill behind its icon. */
export function BottomNav({ labels = ["Home", "Hotels", "Your booking"] }: { labels?: [string, string, string] | string[] }) {
  const p = usePathname();
  // creators in their dashboard have their own navigation
  if (p?.startsWith("/dashboard")) return null;
  const cur = (h: string) => (p === h || (h !== "/" && p.startsWith(h)) ? "page" : undefined);
  return (
    <nav className="bottomnav" aria-label="Sections">
      {TABS.map(([href, I], i) => (
        <Link key={href} href={href} aria-current={cur(href)}><span className="bn-ic"><Ico of={I} size={21} /></span>{labels[i]}</Link>
      ))}
    </nav>
  );
}
