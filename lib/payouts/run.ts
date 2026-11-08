/**
 * Weekly payout run (Vercel cron, Wednesdays). A stay becomes payable 7 days after check out.
 * One payout per creator per run, itemized per booking, so the dashboard can show the statement.
 * Money movement itself (Wise transfer) is a separate step that reads payouts with status scheduled.
 */
import { db } from "@/lib/db";
import { r2 } from "@/lib/pricing/engine";

export const HOLD_DAYS = 7;

export async function runPayouts(creatorIds: string[], now = new Date()): Promise<Array<{ creatorId: string; amount: number; bookings: number }>> {
  const before = new Date(now.getTime() - HOLD_DAYS * 86_400_000).toISOString().slice(0, 10);
  const out = [];
  for (const creatorId of creatorIds) {
    const payable = await db().payableBookings(creatorId, before);
    if (!payable.length) continue;
    const items = payable.map((b) => ({ bookingId: b.id, amount: r2(b.creatorShare - b.promoDiscount + b.extras.reduce((a, x) => a + x.creatorShare, 0)) }));
    const amount = r2(items.reduce((a, i) => a + i.amount, 0));
    const periodStart = payable.map((b) => b.checkOut).sort()[0]!;
    await db().createPayout({ creatorId, periodStart, periodEnd: before, amount, currency: payable[0]!.currency, status: "scheduled", scheduledFor: now.toISOString().slice(0, 10), paidAt: null, items });
    for (const b of payable) await db().updateBooking(b.id, { status: "completed" });
    out.push({ creatorId, amount, bookings: payable.length });
  }
  return out;
}
