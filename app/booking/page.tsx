import { CircleAlert, Ticket } from "lucide-react";
import { Ico } from "@/components/Icon";
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
    <div className="auth">
      <form action={find} className="auth-card auth-form">
        <span className="auth-ic"><Ico of={Ticket} size={24} /></span>
        <h1>{t.lookupTitle}</h1>
        <p className="mute">{t.lookupSub}</p>
        {sp.missing && <p className="auth-err" role="alert"><Ico of={CircleAlert} size={16} />{MISSING[lang] ?? MISSING.en}</p>}
        <div className="field"><label htmlFor="r">{t.reference}</label><input id="r" name="reference" placeholder="NMD 231821" defaultValue={sp.ref ?? ""} autoCapitalize="characters" autoComplete="off" spellCheck={false} required /></div>
        <div className="field"><label htmlFor="e">{t.email}</label><input id="e" name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required /></div>
        <button className="btn btn-brand" type="submit">{t.findMy}</button>
      </form>
    </div>
  );
}
