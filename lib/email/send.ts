/**
 * Transactional email through Resend's REST API (no SDK, one fetch). Without RESEND_API_KEY the
 * function returns false and the caller records "email_skipped"; nothing else changes.
 */
import { env } from "@/lib/env";
import type { Booking } from "@/lib/db/types";
import { db } from "@/lib/db";
import { BOARD, fmtDate, usd } from "@/lib/format";

export async function sendEmail(to: string, subject: string, html: string, text: string): Promise<boolean> {
  const key = env().RESEND_API_KEY;
  if (!key) return false;
  const res = await fetch("https://api.resend.com/emails", { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify({ from: env().EMAIL_FROM, to: [to], subject, html, text }) });
  if (!res.ok) throw new Error(`resend ${res.status}: ${await res.text()}`);
  return true;
}

export async function sendBookingEmail(b: Booking, base: string): Promise<boolean> {
  const sf = await db().storefrontBySlug("lina"); // TODO: storefront by id once Db exposes it
  const hotel = await db().hotel(b.ebcId);
  const brand = sf?.brandName ?? "Nomadly";
  const link = `${base}/booking/${encodeURIComponent(b.reference)}?email=${encodeURIComponent(b.leadEmail)}`;
  const onReq = b.status === "on_request";
  const subject = `${b.demo ? "[Demo] " : ""}${onReq ? `${hotel?.name ?? "Your stay"}: booking received, ${b.reference}` : `${hotel?.name ?? "Your stay"} is confirmed, ${b.reference}`}`;
  const lines = [
    ...(b.demo ? ["This is a demo booking. It was paid with a Stripe test card; no room is reserved at the hotel and no money was taken."] : []),
    onReq ? "We have your booking and the hotel is confirming it now, usually within a few hours. You will get a second email the moment it does." : "Your room is booked. Show this reference at check in if the hotel asks.",
    `Reference: ${b.reference}${b.hotelConfirmation ? `   Hotel confirmation: ${b.hotelConfirmation}` : ""}`,
    `${hotel?.name ?? ""}, ${fmtDate(b.checkIn)} to ${fmtDate(b.checkOut)}, ${b.nights} ${b.nights === 1 ? "night" : "nights"}. ${b.roomName ?? "Room"}, ${(BOARD[b.board ?? "RO"] ?? "").toLowerCase()}.`,
    `Paid: ${usd(b.readerPrice + b.extras.reduce((a, x) => a + x.price, 0))}. Your card statement shows NOMADLY*${brand.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 12)}. The city tax is paid at the hotel.`,
    b.refundable ? `Free cancellation until ${b.cancelDeadline ? fmtDate(b.cancelDeadline) : "check in"}${b.cancelCharge ? `, then ${usd(b.cancelCharge)}` : ""}.` : "This rate has no refunds.",
    ...b.extras.map((x) => `Also booked: ${x.name}, ${usd(x.price)}.`),
    `Manage or cancel: ${link}`,
    "If the hotel cannot find your booking, show them this email. Nomadly support answers every day, 08:00 to 22:00 UTC.",
  ];
  const html = `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:auto;color:#0f172a"><h2 style="font-family:Georgia,serif;font-weight:500">${subject}</h2>${lines.map((l) => `<p style="line-height:1.5">${l.replace(link, `<a href="${link}">${link}</a>`)}</p>`).join("")}<p style="color:#64748b;font-size:13px">${brand} is powered by Nomadly, a Veny Inc. company, New York.</p></div>`;
  return sendEmail(b.leadEmail, subject, html, lines.join("\n\n"));
}
