import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { dashContext } from "@/lib/dashboard/context";
import { convertLinks } from "@/lib/links/convert";
import { linkBase } from "@/lib/links/base";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const B = z.object({ text: z.string().max(20000), place: z.string().max(80).optional(), source: z.string().max(80).optional() });

export async function POST(req: Request) {
  const c = await dashContext();
  if (!c || !c.canEdit) return NextResponse.json({ message: "Sign in to convert links for your storefront." }, { status: 401 });
  const b = B.safeParse(await req.json().catch(() => null));
  if (!b.success) return NextResponse.json({ message: "Paste links or an article address." }, { status: 400 });
  const base = linkBase(c.sf, await headers());
  try {
    const rows = await convertLinks(c.sf, b.data.text.split(/\s+/), base, { place: b.data.place || null, source: b.data.source?.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-") || null });
    return NextResponse.json({ rows });
  } catch (e) {
    return NextResponse.json({ message: e instanceof Error ? e.message : "Could not convert these links." }, { status: 502 });
  }
}
