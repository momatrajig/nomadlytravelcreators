import { headers } from "next/headers";
import { dashContext } from "@/lib/dashboard/context";
import { db } from "@/lib/db";
import { linkBase } from "@/lib/links/base";
import { storefrontDestinations } from "@/lib/storefront/data";
import { Converter, LinkBuilder } from "@/components/dash/LinkTools";

export const dynamic = "force-dynamic";
function daysAgo(d: number) { return new Date(Date.now() - d * 86_400_000).toISOString(); }

export default async function Links() {
  const c = (await dashContext())!;
  const h = await headers();
  const base = linkBase(c.sf, h);
  const pins = await db().pinnedHotels(c.sf.id);
  const since = daysAgo(30);
  const clicks = (await db().clicksForStorefront(c.sf.id, since)).filter((x) => !x.bot);
  const byHotel = new Map<number, number>();
  for (const x of clicks) if (x.ebcId) byHotel.set(x.ebcId, (byHotel.get(x.ebcId) ?? 0) + 1);
  const unresolved = clicks.filter((x) => x.target !== "hotel" && x.query?.hotelname).slice(0, 10);
  const verified = !!(c.sf as { domainVerifiedAt?: string | null }).domainVerifiedAt && !!c.sf.customDomain;
  return (
    <>
      <div className="dash-head"><div><h1>Links</h1><p>One link per hotel, destination or page. Each click is counted under the source you name.</p></div></div>

      <section className="dcard">
        <h2>Your link</h2>
        <div className="linkrow"><code className="code">{base}</code></div>
        <p className="note">{verified ? `Your own domain, ${c.sf.customDomain}, is live.` : c.sf.customDomain ? `Once ${c.sf.customDomain} points at Nomadly, links switch to it; links made now keep working and forward there.` : "Links work on this address now; connect your own domain under Storefront and they move there."}</p>
      </section>

      <section className="dcard">
        <h2>Swap the links in an article</h2>
        <p className="small mute" style={{ marginTop: -4 }}>Paste the article&apos;s address and we read every hotel link in it, find the same hotel in our supplier&apos;s list, add it to your storefront and give you the replacement link. Or paste the links themselves.</p>
        <Converter disabled={!c.canEdit} />
      </section>

      <section className="dcard">
        <h2>Build a link</h2>
        <LinkBuilder base={base} hotels={pins.map((p) => ({ value: String(p.ebcId), label: `${p.name}${p.cityName ? `, ${p.cityName}` : ""}` }))} places={storefrontDestinations(pins).map((d) => ({ value: d.slug, label: d.name }))} />
      </section>

      <section className="dcard">
        <h2>Most clicked hotels, 30 days</h2>
        <table className="dtable"><thead><tr><th>Hotel</th><th className="n">Clicks</th></tr></thead>
          <tbody>
            {[...byHotel.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id, n]) => <tr key={id}><td>{pins.find((p) => p.ebcId === id)?.name ?? `Hotel ${id}`}</td><td className="n">{n}</td></tr>)}
            {!byHotel.size && <tr><td colSpan={2} className="mute">No hotel clicks yet.</td></tr>}
          </tbody>
        </table>
        {unresolved.length > 0 && <p className="note">Links that named a hotel we could not match yet: {[...new Set(unresolved.map((u) => u.query!.hotelname))].join(", ")}. Readers landed on the destination; add the hotel under Hotels.</p>}
      </section>

      <section className="dcard">
        <h2>Link format</h2>
        <div className="small" style={{ display: "grid", gap: 6 }}>
          <span><code>hotel=</code> a hotel on your storefront, by number (the builder writes it)</span>
          <span><code>hotelname=</code> and <code>address=</code> a hotel by name and place, as many article links already name them; any hotel our supplier sells, added to your storefront on the first click</span>
          <span><code>city=</code> a destination&apos;s hotels; <code>src=</code> the source name; <code>in=</code> and <code>out=</code> dates, YYYY-MM-DD</span>
        </div>
      </section>
    </>
  );
}
