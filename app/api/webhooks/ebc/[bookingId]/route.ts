import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ebc } from "@/lib/ebc/client";

export const dynamic = "force-dynamic";

/** eBooking Center reservation webhook. We never trust the payload: we re-read the reservation and update from it. Must answer {"received": true}. */
export async function POST(req: Request, ctx: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await ctx.params;
  const payload = await req.json().catch(() => null);
  const b = await db().booking(bookingId);
  if (b?.ebcReservationId) {
    await db().addEvent(b.id, `webhook:${payload?.event ?? "unknown"}`, payload);
    try {
      const r = await ebc().reservation(b.ebcReservationId);
      const status = r.service.status === "XX" ? "canceled" : r.service.status === "RQ" ? "on_request" : b.status === "completed" ? "completed" : "confirmed";
      await db().updateBooking(b.id, { status, hotelConfirmation: r.hotelConfirmationNumber ?? b.hotelConfirmation });
      if (payload?.event === "voucher.generated") {
        const docs = await ebc().documents(b.ebcReservationId);
        const token = docs.documents.find((d) => d.code === "voucher")?.documents[0]?.token;
        if (token) await db().updateBooking(b.id, { voucherToken: token });
      }
    } catch (e) { console.error("ebc webhook", bookingId, e); }
  }
  return NextResponse.json({ received: true });
}
