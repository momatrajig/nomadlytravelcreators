import { NextResponse } from "next/server";
import { supabaseForRequest } from "@/lib/supabase-server";
import { currentCreator } from "@/lib/auth";

/** Magic link landing: exchange the code for a session cookie, then send the creator to the dashboard. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next")?.startsWith("/") ? url.searchParams.get("next")! : "/dashboard";
  const sb = await supabaseForRequest();
  if (!sb || !code) return NextResponse.redirect(new URL("/login?error=link", url));
  const { error } = await sb.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/login?error=link", url));
  const c = await currentCreator();
  return NextResponse.redirect(new URL(c ? next : "/login?error=notcreator", url));
}
