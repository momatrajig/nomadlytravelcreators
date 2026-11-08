import { revalidatePath } from "next/cache";
import { currentCreator } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Settings() {
  const c = (await currentCreator())!;
  const sf = (await db().storefrontsForCreator(c.id))[0]!;
  async function save(fd: FormData) {
    "use server";
    const me = (await currentCreator())!; const mine = (await db().storefrontsForCreator(me.id))[0]!;
    const color = String(fd.get("brandColor") ?? ""); const tpl = String(fd.get("template"));
    await db().updateStorefront(mine.id, {
      brandName: String(fd.get("brandName") ?? "").trim().slice(0, 40) || mine.brandName,
      brandColor: /^#[0-9a-fA-F]{6}$/.test(color) ? color : mine.brandColor,
      headline: String(fd.get("headline") ?? "").trim().slice(0, 90) || mine.headline,
      template: tpl === "editorial" || tpl === "grid" ? tpl : "postcard",
    });
    revalidatePath("/dashboard/settings"); revalidatePath("/");
  }
  return (
    <>
      <h1 style={{ fontSize: 26 }}>Storefront</h1>
      <p className="mute" style={{ margin: "6px 0 16px" }}>Live at <b>{sf.customDomain ?? `${sf.slug}.nomadly.app`}</b>. Changes show on the storefront immediately.</p>
      <form action={save} className="panel" style={{ display: "grid", gap: 12, maxWidth: 560 }}>
        <div className="field"><label htmlFor="bn">Name on the door</label><input id="bn" name="brandName" defaultValue={sf.brandName} maxLength={40} /></div>
        <div className="field"><label htmlFor="hl">Headline</label><input id="hl" name="headline" defaultValue={sf.headline} maxLength={90} /></div>
        <div className="grid2">
          <div className="field"><label htmlFor="bc">Brand color</label><input id="bc" name="brandColor" type="color" defaultValue={sf.brandColor} style={{ height: 44, padding: 4 }} /></div>
          <div className="field"><label htmlFor="tp">Template</label><select id="tp" name="template" defaultValue={sf.template}><option value="postcard">Postcard</option><option value="editorial">Editorial</option><option value="grid">Grid</option></select></div>
        </div>
        <button className="btn btn-brand" type="submit" style={{ justifySelf: "start" }}>Save</button>
      </form>
      <div className="panel" style={{ marginTop: 14, maxWidth: 560 }}>
        <h2 style={{ fontSize: 18 }}>Your domain</h2>
        <p className="small" style={{ color: "var(--fg-2)" }}>Point a subdomain at Nomadly and the storefront answers there under your name. Add this record at your DNS provider, then tell us and we switch it on within one working day:</p>
        <code style={{ display: "block", padding: 10, background: "var(--surface-2)", borderRadius: 10, fontSize: 13 }}>CNAME &nbsp; stays &nbsp; cname.nomadly.app</code>
      </div>
    </>
  );
}
