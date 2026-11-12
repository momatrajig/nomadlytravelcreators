"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeftRight, BedDouble, CircleDollarSign, LayoutDashboard, Link2, ReceiptText, Store, Wallet, type LucideIcon } from "lucide-react";
import { Ico } from "@/components/Icon";

const NAV: Array<[string, string, LucideIcon]> = [
  ["/dashboard", "Performance", LayoutDashboard], ["/dashboard/transactions", "Transactions", ReceiptText], ["/dashboard/links", "Links", Link2], ["/dashboard/hotels", "Hotels", BedDouble],
  ["/dashboard/payouts", "Payouts", Wallet], ["/dashboard/earnings", "How you earn", CircleDollarSign], ["/dashboard/settings", "Storefront", Store], ["/dashboard/switch", "Switch from Stay22", ArrowLeftRight],
];

/** The creator's sections, each with its icon; the open one is marked so the creator always knows where they are. */
export default function DashNav() {
  const p = usePathname() ?? "";
  return (
    <nav aria-label="Dashboard">
      {NAV.map(([h, l, I]) => <Link key={h} href={h} aria-current={(h === "/dashboard" ? p === h : p.startsWith(h)) ? "page" : undefined}><Ico of={I} size={18} />{l}</Link>)}
    </nav>
  );
}
