import type { NextRequest } from "next/server";
import { handleGo } from "@/lib/links/go";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const GET = async (req: NextRequest, { params }: { params: Promise<{ slug: string }> }) => handleGo(req, (await params).slug.toLowerCase());
