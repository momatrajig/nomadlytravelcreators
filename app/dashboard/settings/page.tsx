import ColorField from "@/components/dash/ColorField";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { dashContext, editableContext } from "@/lib/dashboard/context";
import { db } from "@/lib/db";
import { linkBase } from "@/lib/links/base";

export const dynamic = "force-dynamic";

export default async function Settings() {
  const c = (await dashContext())!;
  const sf = c.sf;
  const base = linkBase(sf, await headers());
  async function save(fd: FormData) {
    "use server";
    const { sf: mine } = await editableContext();
    const color = String(fd.get("brandColor") ?? ""); const tpl = String(fd.get("template"));
    const lang = String(fd.get("locale")); const disp = String(fd.get("displayCurrency") ?? "");
    const site = String(fd.get("siteUrl") ?? "").trim();
    const domain = String(fd.get("customDomain") ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    await db().updateStorefront(mine.id, {
      brandName: String(fd.get("brandName") ?? "").trim().slice(0, 40) || mine.brandName,
      brandColor: /^#[0-9a-fA-F]{6}$/.test(color) ? color : mine.brandColor,
      headline: String(fd.get("headline") ?? "").trim().slice(0, 90) || mine.headline,
      template: tpl === "editorial" || tpl === "grid" ? tpl : "postcard",
      locale: lang === "cs" ? "cs" : "en",
      displayCurrency: ["CZK", "EUR", "GBP"].includes(disp) ? disp : null,
      siteUrl: /^https:\/\/[^\s]+$/.test(site) ? site.slice(0, 120) : null,
      // a new domain is pending until Nomadly verifies it
      customDomain: /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain) ? domain : null,
    });
    revalidatePath("/dashboard/settings"); revalidatePath("/");
  }
  const verified = !!sf.customDomain && !!sf.domainVerifiedAt;
  return (
    <>
      <div className="dash-head"><div><h1>Storefront</h1><p>Live at <b>{verified ? sf.customDomain : `${base.replace(/\/go\/.*$/, "")}/s/${sf.slug}`}</b>. Changes show on the storefront at once.</p></div></div>
      <form action={save} className="dcard dform" style={{ maxWidth: 640 }}>
        <div className="field"><label htmlFor="bn">Name on the door</label><input id="bn" name="brandName" defaultValue={sf.brandName} maxLength={40} /></div>
        <div className="field"><label htmlFor="hl">Headline</label><input id="hl" name="headline" defaultValue={sf.headline} maxLength={90} /></div>
        <div className="grid2">
          <div className="field"><label htmlFor="lo">Language for readers</label><select id="lo" name="locale" defaultValue={sf.locale ?? "en"}><option value="en">English</option><option value="cs">Čeština</option></select></div>
          <div className="field"><label htmlFor="dc">Also show prices in</label><select id="dc" name="displayCurrency" defaultValue={sf.displayCurrency ?? ""}><option value="">USD only</option><option value="CZK">CZK, approximate</option><option value="EUR">EUR, approximate</option><option value="GBP">GBP, approximate</option></select></div>
        </div>
        <div className="grid2">
          <ColorField name="brandColor" defaultValue={sf.brandColor} />
          <div className="field"><label htmlFor="tp">Template</label><select id="tp" name="template" defaultValue={sf.template}><option value="postcard">Postcard</option><option value="editorial">Editorial</option><option value="grid">Grid</option></select></div>
        </div>
        <div className="field"><label htmlFor="su">Your site, linked in the footer</label><input id="su" name="siteUrl" defaultValue={sf.siteUrl ?? ""} placeholder="https://yourblog.com" /></div>
        <div className="field"><label htmlFor="cd">Your domain for the storefront</label><input id="cd" name="customDomain" defaultValue={sf.customDomain ?? ""} placeholder="hotels.yourblog.com" /></div>
        <button className="btn btn-brand" type="submit" style={{ justifySelf: "start" }} disabled={!c.canEdit}>Save</button>
      </form>
      <section className="dcard" style={{ maxWidth: 640 }}>
        <h2>Connect your domain</h2>
        {verified ? <p className="small"><span className="chip chip-ok">Live</span> {sf.customDomain} serves your storefront, with its own certificate. Your links use it.</p> : <>
          <p className="small" style={{ marginTop: -4 }}>Add this record where your domain&apos;s DNS is managed (your registrar or Cloudflare). If you use Cloudflare, set it to DNS only (grey cloud).</p>
          <code className="code">CNAME&nbsp;&nbsp;{(sf.customDomain ?? "hotely.yourblog.com").split(".")[0]}&nbsp;&nbsp;cname.vercel-dns.com</code>
          <p className="note">Then tell your partner manager. We add the domain on our side, the certificate is issued automatically, and the status here turns to Live, usually within the hour. Until then everything works on the Nomadly address, and links made now keep working afterwards.</p>
        </>}
      </section>
    </>
  );
}
