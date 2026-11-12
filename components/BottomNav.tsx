"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BedDouble, House, Ticket, type LucideIcon } from "lucide-react";
import { Ico } from "@/components/Icon";

// each tab owns the pages under it: a hotel page and checkout belong to "Hotels"
const TABS: Array<[string, LucideIcon, string[]]> = [["/", House, []], ["/stays", BedDouble, ["/stays", "/hotel", "/checkout", "/picks"]], ["/booking", Ticket, ["/booking"]]];

/** The reader's tab bar on phones: icon over label, the current tab in ink with a filled pill behind its icon. */
export function BottomNav({ labels = ["Home", "Hotels", "Your booking"] }: { labels?: [string, string, string] | string[] }) {
  const p = usePathname();
  // creators in their dashboard have their own navigation
  // checkout is a focused task: no tabs that lead away from a held price
  if (p?.startsWith("/dashboard") || p?.startsWith("/checkout")) return null;
  const cur = (h: string, own: string[]) => (p === h || own.some((o) => p.startsWith(o)) ? "page" : undefined);
  return (
    <nav className="bottomnav" aria-label="Sections">
      {TABS.map(([href, I, own], i) => (
        <Link key={href} href={href} aria-current={cur(href, own)}><span className="bn-ic"><Ico of={I} size={21} /></span>{labels[i]}</Link>
      ))}
    </nav>
  );
}
