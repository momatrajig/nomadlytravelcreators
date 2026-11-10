/**
 * Monthly payout run (Vercel cron, the 15th). Pays every completed stay that checked out before the 1st of
 * the current month and is not in a payout yet: hotel commission less any promotion code, plus add ons.
 * One payout per creator per run, itemized per booking, so the dashboard shows the statement.
 * Money movement itself (bank or Wise transfer) is a separate step that reads payouts with status scheduled.
 */
import { db } from "@/lib/db";
import { r2 } from "@/lib/pricing/engine";

/** stays checked out before this date are payable on this run */
export const cutoffFor = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);

export async function runPayouts(creatorIds: string[], now = new Date()): Promise<Array<{ creatorId: string; amount: number; bookings: number }>> {
  const cutoff = cutoffFor(now);
  // payableBookings is inclusive of the date given; the day before the 1st
  const before = new Date(Date.parse(`${cutoff}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
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
