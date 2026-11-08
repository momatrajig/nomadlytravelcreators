import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { BookingError } from "@/lib/booking/service";
import { EbcError } from "@/lib/ebc/client";

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let json: unknown;
  try { json = await req.json(); } catch { throw new BookingError("INVALID", "Body must be JSON"); }
  return schema.parse(json);
}

/** Uniform error envelope. Supplier details never leak to the reader. */
export function errorResponse(e: unknown): NextResponse {
  if (e instanceof Response) return new NextResponse(e.body, { status: e.status });
  if (e instanceof ZodError) return NextResponse.json({ error: "INVALID", message: "Check the highlighted fields.", issues: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })) }, { status: 400 });
  if (e instanceof BookingError) {
    const status = e.code === "NOT_FOUND" ? 404 : e.code === "SUPPLIER" ? 502 : e.code === "QUOTE_EXPIRED" || e.code === "PRICE_CHANGED" || e.code === "NO_AVAILABILITY" ? 409 : 400;
    return NextResponse.json({ error: e.code, message: e.message }, { status });
  }
  if (e instanceof EbcError) return NextResponse.json({ error: "SUPPLIER", message: "The hotel system did not answer. Try again in a moment." }, { status: 502 });
  console.error(e);
  return NextResponse.json({ error: "INTERNAL", message: "Something went wrong on our side." }, { status: 500 });
}

export const isoDate = /^\d{4}-\d{2}-\d{2}$/;
