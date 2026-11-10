import type { NextRequest } from "next/server";
import { handleGo } from "@/lib/links/go";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const GET = (req: NextRequest) => handleGo(req, null);
