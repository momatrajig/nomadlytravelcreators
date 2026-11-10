import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { AS_COOKIE, dashContext } from "@/lib/dashboard/context";
import { signedInUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { db } from "@/lib/db";
import CreatorTabs from "@/components/CreatorTabs";
import "./dash.css";

const NAV: Array<[string, string]> = [["/dashboard", "Overview"], ["/dashboard/links", "Links"], ["/dashboard/hotels", "Hotels"], ["/dashboard/payouts", "Payouts"], ["/dashboard/earnings", "How you earn"], ["/dashboard/settings", "Storefront"]];

export default async function DashLayout({ children }: { children: React.ReactNode }) {
  const c = await dashContext();
  if (!c) redirect("/login?error=notcreator");
  const slugs = c.admin ? await allSlugs() : [];
  async function viewAs(fd: FormData) {
    "use server";
    const u = await signedInUser();
    if (!isAdminEmail(u?.email)) return;
    (await cookies()).set(AS_COOKIE, String(fd.get("slug") ?? ""), { path: "/dashboard", httpOnly: true, secure: true, sameSite: "lax", maxAge: 7 * 86400 });
    revalidatePath("/dashboard", "layout");
  }
  return (
    <>
    <CreatorTabs signedIn slug={c.sf.slug} labels={{ view: c.demo ? "Creator view (demo)" : "Creator view", dashboard: "Dashboard", storefront: "My storefront", platform: "Booking platform" }} />
    <div className="dash">
      <aside className="dash-side">
        <div className="dash-who"><b>{c.sf.brandName}</b><span>{c.creator.displayName}</span></div>
        <nav aria-label="Dashboard">{NAV.map(([h, l]) => <Link key={h} href={h}>{l}</Link>)}</nav>
        
        {c.demo && <Link className="notice warn small" href="/login" style={{ textDecoration: "none" }}>Demo dashboard, read only. Sign in to see your own.</Link>}
        {c.admin && (
          <form action={viewAs} className="dash-admin">
            <label htmlFor="as" className="small mute">Nomadly team: view as</label>
            <div style={{ display: "flex", gap: 6 }}>
              <select id="as" name="slug" defaultValue={c.sf.slug}>{slugs.map((s) => <option key={s} value={s}>{s}</option>)}</select>
              <button className="btn" type="submit">Open</button>
            </div>
          </form>
        )}
      </aside>
      <section className="dash-main">{children}</section>
    </div>
    </>
  );
}

async function allSlugs(): Promise<string[]> {
  const list = await db().storefrontSlugs().catch(() => []);
  return list.length ? list : ["lina"];
}
