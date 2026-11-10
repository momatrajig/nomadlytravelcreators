import { redirect } from "next/navigation";
import { requireStorefront } from "@/lib/tenant";
import { dict, langOf } from "@/lib/i18n";

export default async function Lookup({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  async function find(fd: FormData) {
    "use server";
    const ref = String(fd.get("reference") ?? "").trim(), email = String(fd.get("email") ?? "").trim().toLowerCase();
    redirect(`/booking/${encodeURIComponent(ref)}?email=${encodeURIComponent(email)}`);
  }
  void searchParams;
  const t = dict(langOf((await requireStorefront()).locale));
  return (
    <div className="panel" style={{ marginTop: 18, maxWidth: 520 }}>
      <h1 style={{ fontSize: 26 }}>{t.lookupTitle}</h1>
      <p className="mute" style={{ margin: "6px 0 14px" }}>{t.lookupSub}</p>
      <form action={find} style={{ display: "grid", gap: 12 }}>
        <div className="field"><label htmlFor="r">{t.reference}</label><input id="r" name="reference" placeholder="NMD 231821" required /></div>
        <div className="field"><label htmlFor="e">{t.email}</label><input id="e" name="email" type="email" required /></div>
        <button className="btn btn-brand" type="submit">{t.findMy}</button>
      </form>
    </div>
  );
}
