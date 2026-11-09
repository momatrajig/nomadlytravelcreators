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
    <div className="panel" style={{ marginTop: 18, maxWidth: 480 }}>
      <h1 style={{ fontSize: 24 }}>Creator sign in</h1>
      {user ? (
        <>
          <p className="mute">Signed in as <b>{user.email}</b>.</p>
          <div style={{ display: "flex", gap: 10 }}><Link className="btn btn-brand" href="/dashboard">Open my dashboard</Link><form action={out}><button className="btn" type="submit">Sign out</button></form></div>
        </>
      ) : sp.sent ? (
        <p>We sent a sign in link to <b>{sp.sent}</b>. Open it on this device; it works once and for one hour.</p>
      ) : (
        <form action={send} style={{ display: "grid", gap: 12, marginTop: 10 }}>
          <p className="mute" style={{ margin: 0 }}>No password. We email you a link that signs you in.</p>
          <div className="field"><label htmlFor="em">Email</label><input id="em" name="email" type="email" autoComplete="email" required /></div>
          {sp.error && <p role="alert" style={{ color: "var(--bad)", margin: 0 }}>{msg[sp.error] ?? "Something went wrong."}</p>}
          <button className="btn btn-brand" type="submit">Email me a sign in link</button>
        </form>
      )}
    </div>
  );
}
