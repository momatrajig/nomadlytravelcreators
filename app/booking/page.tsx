import { redirect } from "next/navigation";
import { requireStorefront } from "@/lib/tenant";
import { dict, langOf } from "@/lib/i18n";

const MISSING = { en: "We could not find a booking with that reference and email. Check both and try again.", cs: "Rezervaci s tímto číslem a e-mailem jsme nenašli. Zkontrolujte obojí a zkuste to znovu." };

export default async function Lookup({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  async function find(fd: FormData) {
    "use server";
    const ref = String(fd.get("reference") ?? "").trim(), email = String(fd.get("email") ?? "").trim().toLowerCase();
    redirect(`/booking/${encodeURIComponent(ref)}/open?email=${encodeURIComponent(email)}`);
  }
  const sp = await searchParams;
  const lang = langOf((await requireStorefront()).locale);
  const t = dict(lang);
  return (
    <div className="panel" style={{ marginTop: 18, maxWidth: 520 }}>
      <h1 style={{ fontSize: 26 }}>{t.lookupTitle}</h1>
      <p className="mute" style={{ margin: "6px 0 14px" }}>{t.lookupSub}</p>
      {sp.missing && <p className="notice warn" role="alert">{MISSING[lang] ?? MISSING.en}</p>}
      <form action={find} style={{ display: "grid", gap: 12 }}>
        <div className="field"><label htmlFor="r">{t.reference}</label><input id="r" name="reference" placeholder="NMD 231821" defaultValue={sp.ref ?? ""} required /></div>
        <div className="field"><label htmlFor="e">{t.email}</label><input id="e" name="email" type="email" autoComplete="email" required /></div>
        <button className="btn btn-brand" type="submit">{t.findMy}</button>
      </form>
    </div>
  );
}
