"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BedDouble, LayoutDashboard, Store, type LucideIcon } from "lucide-react";
import { Ico } from "@/components/Icon";

const IC: Record<string, LucideIcon> = { dash: LayoutDashboard, store: Store, platform: BedDouble };

/**
 * The creator's switch between the three parts of Nomadly, shown only to a signed in creator (and on the
 * dashboard itself). Readers never see it: for them there is one site, the co-branded booking platform.
 */
export default function CreatorTabs({ signedIn, slug, labels }: { signedIn: boolean; slug?: string; labels: { view: string; dashboard: string; storefront: string; platform: string } }) {
  const path = usePathname() ?? "/";
  const inDash = path.startsWith("/dashboard");
  // the dashboard renders its own strip (it knows which creator is shown); the site wide one steps aside there
  if (inDash !== !!slug) return null;
  if (!signedIn && !inDash) return null;
  const tab = inDash ? "dash" : path.startsWith("/picks") ? "store" : "platform";
  const items: Array<[string, string, string]> = [["dash", "/dashboard", labels.dashboard], ["store", slug ? `/s/${slug}` : "/picks", labels.storefront], ["platform", slug ? `/s/${slug}?to=home` : "/", labels.platform]];
  return (
    <div className="ctabs" role="navigation" aria-label={labels.view}>
      <div className="wrap">
        <span className="ctabs-l">{labels.view}</span>
        {items.map(([k, href, l]) => <Link key={k} href={href} aria-current={tab === k ? "page" : undefined}><Ico of={IC[k]!} size={16} />{l}</Link>)}
      </div>
    </div>
  );
}
