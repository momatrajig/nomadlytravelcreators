import { revalidatePath } from "next/cache";
import { currentCreator } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Hotels() {
  const c = (await currentCreator())!;
  const sf = (await db().storefrontsForCreator(c.id))[0]!;
  const pins = await db().pinnedHotels(sf.id);
  async function saveTip(fd: FormData) {
    "use server";
    const me = (await currentCreator())!; const mine = (await db().storefrontsForCreator(me.id))[0]!;
    const ebcId = Number(fd.get("ebcId")); const tip = String(fd.get("tip") ?? "").trim().slice(0, 240); const stayedWhen = String(fd.get("stayedWhen") ?? "").trim().slice(0, 40);
    await db().updatePin(mine.id, ebcId, { tip: tip || null, stayedWhen: stayedWhen || null });
    revalidatePath("/dashboard/hotels");
  }
  return (
    <>
      <h1 style={{ fontSize: 26 }}>Hotels and tips</h1>
      <p className="mute" style={{ margin: "6px 0 16px" }}>The hotels pinned on your storefront, in order. Your tip is the one paragraph a reader sees under the hotel name; 240 characters, in your voice.</p>
      <div style={{ display: "grid", gap: 12 }}>
        {pins.map((h) => (
          <form key={h.ebcId} action={saveTip} className="panel" style={{ display: "grid", gridTemplateColumns: "120px minmax(0,1fr)", gap: 14 }}>
            <input type="hidden" name="ebcId" value={h.ebcId} />
            <div style={{ borderRadius: 10, overflow: "hidden", aspectRatio: "4/3", background: "var(--surface-2)" }}>{h.images[0] && <img src={h.images[0].url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}</div>
            <div style={{ display: "grid", gap: 8 }}>
              <b>{h.name}</b>
              <div className="field"><label htmlFor={`t${h.ebcId}`}>Your tip</label><textarea id={`t${h.ebcId}`} name="tip" maxLength={240} defaultValue={h.tip ?? ""} rows={2} style={{ padding: 10, borderRadius: 10, border: "1px solid var(--line-2)", background: "var(--surface)", color: "var(--fg)", font: "inherit" }} /></div>
              <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
                <div className="field"><label htmlFor={`w${h.ebcId}`}>When you stayed</label><input id={`w${h.ebcId}`} name="stayedWhen" defaultValue={h.stayedWhen ?? ""} placeholder="March 2026" /></div>
                <button className="btn" type="submit">Save</button>
              </div>
            </div>
          </form>
        ))}
      </div>
    </>
  );
}
