/**
 * "Free cancellation" only while it is true. A supplier can call a rate refundable whose free period already
 * ended (a deadline days before today): that rate costs a fee from the first minute and must never be sold
 * as free. Every label goes through here.
 */
export const freeNow = (r: { refundable: boolean; cancelDeadline: string | null }, now = Date.now()) =>
  r.refundable && (!r.cancelDeadline || Date.parse(r.cancelDeadline) > now);
/** Refundable on paper, but the free period is over: canceling costs the charge. */
export const feeNow = (r: { refundable: boolean; cancelDeadline: string | null }, now = Date.now()) => r.refundable && !freeNow(r, now);
