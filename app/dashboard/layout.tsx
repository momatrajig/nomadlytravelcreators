import Link from "next/link";
import { redirect } from "next/navigation";
import { currentCreator } from "@/lib/auth";
import { db } from "@/lib/db";

const NAV: Array<[string, string]> = [["/dashboard", "Overview"], ["/dashboard/pricing", "Pricing and earnings"], ["/dashboard/hotels", "Hotels and tips"], ["/dashboard/payouts", "Payouts"], ["/dashboard/settings", "Storefront"]];

export default async function DashLayout({ children }: { children: React.ReactNode }) {
  const c = await currentCreator();
  if (!c) redirect("/login");
  const sfs = await db().storefrontsForCreator(c.id);
  const sf = sfs[0];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "220px minmax(0,1fr)", gap: 24, marginTop: 18 }} className="dash">
      <aside style={{ display: "grid", alignContent: "start", gap: 4 }}>
        <div className="small mute" style={{ padding: "6px 12px" }}>{c.displayName}{sf ? `, ${sf.brandName}` : ""}</div>
        {NAV.map(([h, l]) => <Link key={h} href={h} className="btn" style={{ justifyContent: "flex-start", border: 0, background: "transparent" }}>{l}</Link>)}
      </aside>
      <section>{children}</section>
      <style>{`@media (max-width: 800px){ .dash{ grid-template-columns: 1fr } .dash aside{ display:flex; flex-wrap:wrap } }`}</style>
    </div>
  );
}
