import { CircleAlert, LayoutDashboard, LogOut, Mail, MailCheck, ShieldCheck, UserRound } from "lucide-react";
import { Ico } from "@/components/Icon";
import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { signedInUser } from "@/lib/auth";
import { supabaseForRequest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const user = await signedInUser();
  async function send(fd: FormData) {
    "use server";
    const email = String(fd.get("email") ?? "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) redirect("/login?error=email");
    const sb = await supabaseForRequest();
    if (!sb) redirect("/login?error=config");
    const h = await headers();
    const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: `${origin}/auth/callback?next=/dashboard`, shouldCreateUser: true } });
    redirect(error ? `/login?error=send` : `/login?sent=${encodeURIComponent(email)}`);
  }
  async function out() {
    "use server";
    const sb = await supabaseForRequest();
    await sb?.auth.signOut();
    redirect("/login");
  }
  const msg: Record<string, string> = { email: "Enter a valid email address.", config: "Sign in is not configured on this deployment yet.", send: "We could not send the link. Wait a minute and try again.", link: "That link expired or was already used. Ask for a new one.", notcreator: "This email is not on a creator account yet. Reply to your invitation email and we add you." };
  return (
    <div className="auth">
      <div className="auth-card">
        {user ? (
          <>
            <span className="auth-ic"><Ico of={UserRound} size={24} /></span>
            <h1>Signed in</h1>
            <p className="mute">As <b>{user.email}</b>.</p>
            <div className="auth-row"><Link className="btn btn-brand" href="/dashboard"><Ico of={LayoutDashboard} size={17} />Open my dashboard</Link><form action={out}><button className="btn" type="submit"><Ico of={LogOut} size={17} />Sign out</button></form></div>
          </>
        ) : sp.sent ? (
          <>
            <span className="auth-ic ok"><Ico of={MailCheck} size={24} /></span>
            <h1>Check your inbox</h1>
            <p>We sent a sign in link to <b>{sp.sent}</b>. Open it on this device; it works once, for 1 hour.</p>
            <p className="small mute">Nothing after 2 minutes? Look in spam, or <Link href="/login">send it again</Link>.</p>
          </>
        ) : (
          <form action={send} className="auth-form">
            <span className="auth-ic"><Ico of={Mail} size={24} /></span>
            <h1>Creator sign in</h1>
            <p className="mute">No password. We email you a link that signs you in.</p>
            <div className="field"><label htmlFor="em">Email</label><input id="em" name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="you@yourblog.com" required aria-invalid={sp.error === "email" || undefined} aria-describedby={sp.error ? "em-err" : undefined} /></div>
            {sp.error && <p id="em-err" role="alert" className="auth-err"><Ico of={CircleAlert} size={16} />{msg[sp.error] ?? "Something went wrong."}</p>}
            <button className="btn btn-brand" type="submit">Email me a sign in link</button>
            <p className="small mute auth-foot"><Ico of={ShieldCheck} size={15} />Readers never need an account. This is for creators only.</p>
          </form>
        )}
      </div>
    </div>
  );
}
