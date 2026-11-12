/**
 * What a booking says to the guest, in one place, for the booking page and the confirmation email alike:
 * the price line by line, the trip in order (booked, free cancellation ends, ride, check in, check out),
 * the cancellation stages with the one that applies now marked, and how to change anything.
 * Pure: the caller formats money and dates, so the same data renders as HTML on the page and in mail.
 */
import type { Booking } from "@/lib/db/types";
import { chargedTotal, penaltyNow, requestComments } from "@/lib/booking/service";
import type { Lang } from "@/lib/i18n";

export interface PriceLine { label: string; detail?: string; amount: number; kind: "room" | "extra" | "discount" }
export interface TripStep { date: string; time?: string; title: string; detail?: string; kind: "booked" | "deadline" | "ride" | "checkin" | "checkout" }
export interface CancelStage { title: string; from: string | null; to: string | null; charge: number; refund: number; now: boolean; tone: "ok" | "warn" | "bad" }

const T = {
  en: {
    room: (n: number, room: string) => `${room}, ${n} ${n === 1 ? "night" : "nights"}`, roomDetail: (avg: string) => `${avg} a night on average, taxes included`,
    promo: (c: string) => `Code ${c}`, booked: "Booked and paid", bookedDemo: "Demo checkout complete", deadline: "Last day to cancel free", ride: "Airport ride", checkin: "Check in", checkout: "Check out",
    checkinTime: "From the hotel's check in time, usually 15:00", checkoutTime: "Usually by 12:00",
    nights: (n: number) => `${n} ${n === 1 ? "night" : "nights"}`, free: "Free cancellation", after: "After the free period", noShow: "No show or after check in", nonRef: "Non refundable", feeFromBooking: "Cancellation fee",
    changes: [
      "Different dates or another room: rates cannot be moved, so cancel (free in the green period) and book again at today's price.",
      "A name change, an extra request, or anything else: write to us with your reference and we arrange it with the hotel.",
      "Running late: the hotel keeps the room for the whole first night; tell us if you arrive after midnight.",
    ],
    changesFee: "Different dates or another room: rates cannot be moved, so cancel (the fee below applies) and book again at today's price.",
    changesNonRef: [
      "This rate cannot be changed or refunded. A name change or a request: write to us with your reference and we ask the hotel.",
      "Running late: the hotel keeps the room for the whole first night; tell us if you arrive after midnight.",
    ],
  },
  cs: {
    room: (n: number, room: string) => `${room}, ${n} ${n === 1 ? "noc" : n < 5 ? "noci" : "nocí"}`, roomDetail: (avg: string) => `v průměru ${avg} za noc, vč. daní`,
    promo: (c: string) => `Kód ${c}`, booked: "Rezervováno a zaplaceno", bookedDemo: "Ukázková rezervace dokončena", deadline: "Poslední den bezplatného storna", ride: "Odvoz z letiště", checkin: "Příjezd", checkout: "Odjezd",
    checkinTime: "Od času příjezdu hotelu, obvykle 15:00", checkoutTime: "Obvykle do 12:00",
    nights: (n: number) => `${n} ${n === 1 ? "noc" : n < 5 ? "noci" : "nocí"}`, free: "Storno zdarma", after: "Po bezplatné lhůtě", noShow: "Nedostavení nebo po příjezdu", nonRef: "Bez možnosti storna", feeFromBooking: "Storno poplatek",
    changes: [
      "Jiné termíny nebo jiný pokoj: cenu nelze přesunout, takže zrušte (v zelené lhůtě zdarma) a zarezervujte znovu za dnešní cenu.",
      "Změna jména, další požadavek nebo cokoli jiného: napište nám s číslem rezervace a domluvíme to s hotelem.",
      "Zpoždění: hotel drží pokoj celou první noc; dejte vědět, pokud přijedete po půlnoci.",
    ],
    changesFee: "Jiné termíny nebo jiný pokoj: cenu nelze přesunout, takže zrušte (platí poplatek níže) a zarezervujte znovu za dnešní cenu.",
    changesNonRef: [
      "Tuto cenu nelze změnit ani vrátit. Změna jména nebo požadavek: napište nám s číslem rezervace a zeptáme se hotelu.",
      "Zpoždění: hotel drží pokoj celou první noc; dejte vědět, pokud přijedete po půlnoci.",
    ],
  },
};
export const tripWords = (lang: Lang) => T[lang] ?? T.en;

export function priceLines(b: Booking, lang: Lang, fmt: (v: number) => string): { lines: PriceLine[]; total: number } {
  const w = tripWords(lang);
  const roomTotal = Math.round((b.readerPrice + (b.promoDiscount || 0)) * 100) / 100;
  const lines: PriceLine[] = [{ kind: "room", label: w.room(b.nights, b.roomName ?? "Room"), detail: w.roomDetail(fmt(roomTotal / Math.max(b.nights, 1))), amount: roomTotal }];
  if (b.promoDiscount) lines.push({ kind: "discount", label: w.promo(b.promoCode ?? ""), amount: -b.promoDiscount });
  for (const x of b.extras) lines.push({ kind: "extra", label: x.name, detail: x.detail ?? undefined, amount: x.price });
  return { lines, total: chargedTotal(b) };
}

export function tripSteps(b: Booking, lang: Lang): TripStep[] {
  const w = tripWords(lang);
  const ride = b.extras.find((x) => x.kind === "transfer");
  const both = ride?.detail?.includes(" and back");
  const toHotel = ride && (both || /to the hotel/.test(ride.detail ?? ""));
  const toAirport = ride && (both || /^Hotel to/.test(ride.detail ?? ""));
  const steps: TripStep[] = [{ kind: "booked", date: (b.paidAt ?? b.createdAt).slice(0, 10), title: b.demo ? w.bookedDemo : w.booked }];
  const bookedAt = Date.parse(b.paidAt ?? b.createdAt);
  if (b.refundable && b.cancelDeadline && Date.parse(b.cancelDeadline) > bookedAt) steps.push({ kind: "deadline", date: b.cancelDeadline.slice(0, 10), title: w.deadline, time: b.cancelDeadline.length > 10 ? b.cancelDeadline.slice(11, 16) : undefined });
  if (toHotel) steps.push({ kind: "ride", date: b.checkIn, title: w.ride, detail: ride!.detail ?? undefined });
  steps.push({ kind: "checkin", date: b.checkIn, title: w.checkin, detail: `${w.checkinTime}. ${w.nights(b.nights)}.` });
  steps.push({ kind: "checkout", date: b.checkOut, title: w.checkout, detail: w.checkoutTime });
  if (toAirport) steps.push({ kind: "ride", date: b.checkOut, title: w.ride, detail: ride!.detail ?? undefined });
  return steps;
}

/** The stages of the cancellation policy, in money, with the one that applies right now marked. */
export function cancelStages(b: Booking, lang: Lang, now = Date.now()): CancelStage[] {
  const w = tripWords(lang);
  const total = chargedTotal(b);
  const extrasBack = total - b.readerPrice; // add-ons are always refunded in full with the stay
  const current = penaltyNow(b, now);
  if (!b.refundable) return [{ title: w.nonRef, from: null, to: b.checkIn, charge: b.readerPrice, refund: extrasBack, now: true, tone: "bad" }];
  const late = b.cancelCharge ?? b.readerPrice;
  const pastDeadline = !!b.cancelDeadline && Date.parse(b.cancelDeadline) < now;
  const inStay = Date.parse(`${b.checkIn}T00:00:00Z`) <= now;
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const hadFree = !b.cancelDeadline || Date.parse(b.cancelDeadline) > Date.parse(b.paidAt ?? b.createdAt);
  return [
    ...(hadFree ? [{ title: w.free, from: null, to: b.cancelDeadline?.slice(0, 10) ?? b.checkIn, charge: 0, refund: total, now: current === 0 && !inStay, tone: "ok" as const }] : []),
    { title: hadFree ? w.after : w.feeFromBooking, from: hadFree ? b.cancelDeadline?.slice(0, 10) ?? null : null, to: b.checkIn, charge: late, refund: r2(total - late), now: pastDeadline && !inStay, tone: "warn" },
    { title: w.noShow, from: b.checkIn, to: null, charge: b.readerPrice, refund: r2(extrasBack), now: inStay, tone: "bad" },
  ];
}

export const requestsLine = (b: Booking) => requestComments(b.requests);

/** How to change the booking, matched to its policy: free period ahead, fee already due, or no refunds. */
export function changesFor(b: Booking, lang: Lang): string[] {
  const w = tripWords(lang);
  if (!b.refundable) return w.changesNonRef;
  const hadFree = !b.cancelDeadline || Date.parse(b.cancelDeadline) > Date.parse(b.paidAt ?? b.createdAt);
  return hadFree ? w.changes : [w.changesFee, ...w.changes.slice(1)];
}
