import { Check, Search, Trash2 } from "lucide-react";
import { Ico } from "@/components/Icon";
import { revalidatePath } from "next/cache";
import { dashContext, editableContext } from "@/lib/dashboard/context";
import { db } from "@/lib/db";
import { importHotel, searchHotels } from "@/lib/links/directory";
import { photoThumb } from "@/lib/media/photo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function Hotels({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const c = (await dashContext())!;
  const sp = await searchParams;
  const pins = await db().pinnedHotels(c.sf.id);
  const place = sp.place?.trim() ?? "", q = sp.q?.trim() ?? "";
  let found: Awaited<ReturnType<typeof searchHotels>> = [];
  let searchErr: string | null = null;
  if (place && q.length >= 2) { try { found = await searchHotels(place, q); } catch { searchErr = "The hotel list did not answer. Try again in a moment."; } }

  async function saveTip(fd: FormData) {
    "use server";
    const { sf } = await editableContext();
    const ebcId = Number(fd.get("ebcId")); const tip = String(fd.get("tip") ?? "").trim().slice(0, 240); const stayedWhen = String(fd.get("stayedWhen") ?? "").trim().slice(0, 40);
    // the cover must be one of this hotel's own photos; anything else is ignored
    const cover = String(fd.get("cover") ?? "");
    const hotel = cover ? await db().hotel(ebcId) : null;
    const coverUrl = hotel?.images.some((x) => x.url === cover) ? cover : undefined;
    await db().updatePin(sf.id, ebcId, { tip: tip || null, stayedWhen: stayedWhen || null, ...(coverUrl ? { coverUrl } : {}) });
    revalidatePath("/dashboard/hotels");
  }
  async function add(fd: FormData) {
    "use server";
    const { sf } = await editableContext();
    const id = Number(fd.get("ebcId"));
    if (!Number.isInteger(id) || id <= 0) return;
    await importHotel(id, String(fd.get("name") ?? "") || null);
    await db().pinHotel(sf.id, id);
    revalidatePath("/dashboard/hotels"); revalidatePath("/");
  }
  async function remove(fd: FormData) {
    "use server";
    const { sf } = await editableContext();
    await db().unpinHotel(sf.id, Number(fd.get("ebcId")));
    revalidatePath("/dashboard/hotels"); revalidatePath("/");
  }

  return (
    <>
      <div className="dash-head"><div><h1>Hotels</h1><p>{pins.length} on your storefront. Links to a hotel by name add it here by themselves; you can also add one by hand.</p></div></div>

      <section className="dcard">
        <h2>Add a hotel</h2>
        <form className="dform" method="get">
          <div className="grid2">
            <div className="field"><label htmlFor="hp">City</label><input id="hp" name="place" defaultValue={place} placeholder="Paris, or Paříž" required /></div>
            <div className="field"><label htmlFor="hq">Hotel name, or part of it</label><input id="hq" name="q" defaultValue={q} placeholder="Grands Hommes" required minLength={2} /></div>
          </div>
          <button className="btn" type="submit" style={{ justifySelf: "start" }}><Ico of={Search} size={16} />Search the supplier&apos;s list</button>
        </form>
        {searchErr && <div className="notice warn" style={{ marginTop: 10 }}>{searchErr}</div>}
        {place && q && !searchErr && (
          <table className="dtable" style={{ marginTop: 12 }}><tbody>
            {found.map((h) => (
              <tr key={h.ebcId}><td><b>{h.name}</b><div className="small mute">{[h.stars ? `${h.stars} star` : null, h.address, h.cityName].filter(Boolean).join(", ")}</div></td>
                <td className="n">{pins.some((p) => p.ebcId === h.ebcId) ? <span className="chip chip-ok">On your storefront</span> : <form action={add}><input type="hidden" name="ebcId" value={h.ebcId} /><button className="btn" type="submit" disabled={!c.canEdit}>Add</button></form>}</td></tr>
            ))}
            {!found.length && <tr><td className="mute">No hotel with that name in {place}. Try fewer words.</td></tr>}
          </tbody></table>
        )}
      </section>

      <div style={{ display: "grid", gap: 12 }}>
        {pins.map((h) => (
          <div key={h.ebcId} className="dcard" style={{ display: "grid", gridTemplateColumns: "120px minmax(0,1fr)", gap: 14 }}>
            <div style={{ borderRadius: 10, overflow: "hidden", aspectRatio: "4/3", background: "var(--mist)" }}>{h.images[0] && <img src={photoThumb(h.images[0].url)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}</div>
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}><b>{h.name}<span className="small mute" style={{ fontWeight: 400 }}>{h.cityName ? `, ${h.cityName}` : ""}, {h.images.length} photos</span></b>
                <form action={remove}><input type="hidden" name="ebcId" value={h.ebcId} /><button className="btn btn-quiet small" type="submit" disabled={!c.canEdit}><Ico of={Trash2} size={15} />Remove</button></form></div>
              <form action={saveTip} className="dform">
                <input type="hidden" name="ebcId" value={h.ebcId} />
                <div className="field"><label htmlFor={`t${h.ebcId}`}>Your tip, shown under the hotel name (240 characters)</label><textarea id={`t${h.ebcId}`} name="tip" maxLength={240} defaultValue={h.tip ?? ""} rows={2} style={{ minHeight: 64, font: "inherit" }} /></div>
                {h.images.length > 1 && (
                  <fieldset className="covers"><legend className="small">Cover photo, the one readers see first</legend>
                    <div>{h.images.slice(0, 12).map((im, i) => (
                      <label key={im.url} className="cover-opt"><input type="radio" name="cover" value={im.url} defaultChecked={i === 0} disabled={!c.canEdit} /><img src={photoThumb(im.url)} alt={`Photo ${i + 1}`} loading="lazy" /></label>
                    ))}</div>
                  </fieldset>
                )}
                <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
                  <div className="field"><label htmlFor={`w${h.ebcId}`}>When you stayed, optional</label><input id={`w${h.ebcId}`} name="stayedWhen" defaultValue={h.stayedWhen ?? ""} placeholder="March 2026" /></div>
                  <button className="btn" type="submit" disabled={!c.canEdit}><Ico of={Check} size={16} />Save</button>
                </div>
              </form>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
