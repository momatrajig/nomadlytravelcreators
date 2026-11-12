/**
 * Transactional email through Resend's REST API (no SDK, one fetch). Without RESEND_API_KEY the
 * function returns false and the caller records "email_skipped"; nothing else changes.
 *
 * The confirmation carries what the booking page shows, from the same builder (lib/booking/itinerary):
 * the trip in order, the price line by line, the cancellation stages with their penalties, and how to change.
 */
import { env } from "@/lib/env";
import type { Booking } from "@/lib/db/types";
import { db } from "@/lib/db";
import { fmtDay, money, type Lang } from "@/lib/i18n";
import { cancelStages, changesFor, priceLines, requestsLine, tripSteps, tripWords } from "@/lib/booking/itinerary";

export async function sendEmail(to: string, subject: string, html: string, text: string): Promise<boolean> {
  const key = env().RESEND_API_KEY;
  if (!key) return false;
  const res = await fetch("https://api.resend.com/emails", { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify({ from: env().EMAIL_FROM, to: [to], subject, html, text }) });
  if (!res.ok) throw new Error(`resend ${res.status}: ${await res.text()}`);
  return true;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const E = {
  en: { confirmed: (h: string, r: string) => `${h} is confirmed, ${r}`, received: (h: string, r: string) => `${h}: booking received, ${r}`, demo: "Demo checkout complete. Live prices and a Stripe test card: nothing was charged and the hotel holds no room.", sample: "Sample total", onReq: "We have your booking and the hotel is confirming it now, usually within a few hours. You get a second email the moment it does.", ok: "Your room is booked. Show this email or the reference at check in if the hotel asks.", ref: "Reference", hotelRef: "Hotel confirmation", trip: "Your trip", price: "Price breakdown", total: "Paid to Nomadly", tax: "Taxes and charges included. City tax, if any, is paid at the hotel.", cancel: "Cancellation", change: "Changes", penalty: "Cancellation fee", refund: "Estimated refund", manage: "Manage or cancel your booking", requests: "Requests sent to the hotel", footer: (b: string) => `${b} runs on Nomadly, a Veny Inc. company, New York. Support every day, 08:00 to 22:00 UTC.` },
  cs: { confirmed: (h: string, r: string) => `${h}: rezervace potvrzena, ${r}`, received: (h: string, r: string) => `${h}: rezervace přijata, ${r}`, demo: "Ukázková rezervace dokončena. Skutečné ceny a testovací karta Stripe: nic se nestrhlo a hotel žádný pokoj nedrží.", sample: "Ukázková cena", onReq: "Rezervaci máme a hotel ji právě potvrzuje, obvykle do několika hodin. Hned potom vám přijde druhý e-mail.", ok: "Pokoj je rezervovaný. Pokud se hotel zeptá, ukažte tento e-mail nebo číslo rezervace.", ref: "Číslo rezervace", hotelRef: "Potvrzení hotelu", trip: "Vaše cesta", price: "Rozpis ceny", total: "Zaplaceno Nomadly", tax: "Včetně daní a poplatků. Případnou městskou taxu platíte v hotelu.", cancel: "Storno", change: "Změny", penalty: "Storno poplatek", refund: "Odhad vrácené částky", manage: "Spravovat nebo zrušit rezervaci", requests: "Požadavky pro hotel", footer: (b: string) => `${b} běží na Nomadly, společnosti Veny Inc., New York. Podpora denně 08:00 až 22:00 UTC.` },
};

export async function sendBookingEmail(b: Booking, base: string): Promise<boolean> {
  const sf = (await db().storefrontsForCreator(b.creatorId).catch(() => [])).find((s) => s.id === b.storefrontId) ?? null;
  const lang: Lang = sf?.locale === "cs" ? "cs" : "en";
  const e = E[lang];
  const hotel = await db().hotel(b.ebcId);
  const brand = sf?.brandName ?? "Nomadly";
  const m = (v: number) => money(v, { lang, currency: b.currency || "USD" });
  const d = (iso: string) => fmtDay(iso, lang);
  const link = `${base}/booking/${encodeURIComponent(b.reference)}/open?email=${encodeURIComponent(b.leadEmail)}`;
  const onReq = b.status === "on_request";
  const name = hotel?.name ?? "Your stay";
  const subject = `${b.demo ? "[Demo] " : ""}${onReq ? e.received(name, b.reference) : e.confirmed(name, b.reference)}`;
  const { lines, total } = priceLines(b, lang, m);
  const steps = tripSteps(b, lang);
  const stages = cancelStages(b, lang);
  const w = tripWords(lang);
  const req = requestsLine(b);
  const color = /^#[0-9a-f]{6}$/i.test(sf?.brandColor ?? "") ? sf!.brandColor : "#17243a";
  const tone = { ok: ["#e7f5ed", "#155c3e"], warn: ["#fff2d7", "#774205"], bad: ["#fceef0", "#a12832"] } as const;
  const btn = `background:${color};color:#fff;text-decoration:none;padding:13px 22px;border-radius:999px;font-weight:700;display:inline-block`;

  const html = `<!doctype html><html><body style="margin:0;background:#f6f8fc"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(`${b.reference}: ${name}, ${d(b.checkIn)} ${lang === "cs" ? "až" : "to"} ${d(b.checkOut)}`)}</div><div style="font-family:Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px 16px;color:#17243a">
<p style="font-size:13px;color:#526079;margin:0 0 12px">${esc(brand)} with Nomadly</p>
<div style="background:#fff;border-radius:16px;padding:24px;border:1px solid #dbe2ed">
${b.demo ? `<p style="background:#fdf0dc;padding:10px 12px;border-radius:10px;font-size:14px">${esc(e.demo)}</p>` : ""}
<h1 style="font-family:Georgia,serif;font-weight:500;font-size:28px;margin:0 0 6px">${esc(name)}</h1>
<p style="margin:0 0 14px;color:#526079">${esc([hotel?.address, hotel?.cityName].filter(Boolean).join(", "))}</p>
<p style="margin:0 0 16px">${esc(onReq ? e.onReq : b.demo ? "" : e.ok)}</p>
<table role="presentation" width="100%" style="border-collapse:collapse;margin-bottom:18px"><tr>
<td style="padding:12px;border:1px solid #dbe2ed;border-radius:10px"><div style="font-size:12px;color:#526079">${e.ref}</div><div style="font-size:20px;font-weight:700">${esc(b.reference)}</div>${b.hotelConfirmation ? `<div style="font-size:12px;color:#526079;margin-top:6px">${e.hotelRef}: <b>${esc(b.hotelConfirmation)}</b></div>` : ""}</td>
<td style="padding:12px;border:1px solid #dbe2ed"><div style="font-size:12px;color:#526079">${w.checkin}</div><div style="font-weight:700">${esc(d(b.checkIn))}</div><div style="font-size:12px;color:#526079">${w.checkout}</div><div style="font-weight:700">${esc(d(b.checkOut))}</div></td></tr></table>
<p style="margin:0 0 22px"><a href="${esc(link)}" style="${btn}">${e.manage}</a></p>
<h2 style="font-size:17px;margin:0 0 8px">${e.trip}</h2>
<table role="presentation" width="100%" style="border-collapse:collapse;margin-bottom:18px">${steps.map((s) => `<tr><td style="padding:6px 10px 6px 0;white-space:nowrap;color:#526079;font-size:14px;vertical-align:top">${esc(d(s.date))}</td><td style="padding:6px 0;font-size:14px"><b>${esc(s.title)}</b>${s.time ? `, ${esc(s.time)}` : ""}${s.detail ? `<br><span style="color:#526079">${esc(s.detail)}</span>` : ""}</td></tr>`).join("")}</table>
${req ? `<p style="background:#f6f8fc;border-radius:10px;padding:10px 12px;font-size:14px"><b>${e.requests}:</b> ${esc(req)}</p>` : ""}
<h2 style="font-size:17px;margin:18px 0 8px">${e.price}</h2>
<table role="presentation" width="100%" style="border-collapse:collapse">${lines.map((l) => `<tr><td style="padding:6px 0;font-size:14px">${esc(l.label)}${l.detail ? `<br><span style="color:#526079;font-size:12px">${esc(l.detail)}</span>` : ""}</td><td style="padding:6px 0;text-align:right;font-size:14px;white-space:nowrap">${esc(m(l.amount))}</td></tr>`).join("")}
<tr><td style="padding:10px 0 0;border-top:1px solid #dbe2ed;font-weight:700">${b.demo ? e.sample : e.total}</td><td style="padding:10px 0 0;border-top:1px solid #dbe2ed;text-align:right;font-weight:700;font-size:20px">${esc(m(total))}</td></tr></table>
<p style="font-size:12px;color:#526079">${e.tax}</p>
<h2 style="font-size:17px;margin:18px 0 8px">${e.cancel}</h2>
<table role="presentation" width="100%" style="border-collapse:separate;border-spacing:0 6px">${stages.map((s) => `<tr><td style="background:${tone[s.tone][0]};padding:10px 12px;border-radius:10px;font-size:14px"><b>${esc(s.title)}</b>${s.to || s.from ? `<br><span style="color:#526079">${s.from ? esc(d(s.from)) + " " : ""}${s.to ? (s.from ? (lang === "cs" ? "až " : "to ") : (lang === "cs" ? "do " : "until ")) + esc(d(s.to)) : ""}</span>` : ""}</td><td style="background:${tone[s.tone][0]};padding:10px 12px;border-radius:10px;text-align:right;font-size:14px;white-space:nowrap"><b style="color:${tone[s.tone][1]}">${e.penalty} ${esc(m(s.charge))}</b><br><span style="color:#526079">${e.refund} ${esc(m(s.refund))}</span></td></tr>`).join("")}</table>
<h2 style="font-size:17px;margin:18px 0 8px">${e.change}</h2>
<ul style="padding-left:18px;margin:0 0 18px;font-size:14px;color:#3a4859">${changesFor(b, lang).map((c) => `<li style="margin-bottom:6px">${esc(c)}</li>`).join("")}</ul>
<p style="text-align:center;margin:22px 0 4px"><a href="${esc(link)}" style="${btn}">${e.manage}</a></p>
</div><p style="color:#6b778c;font-size:12px;text-align:center">${esc(e.footer(brand))}</p></div></body></html>`;

  const text = [
    ...(b.demo ? [e.demo] : [onReq ? e.onReq : e.ok]),
    `${e.ref}: ${b.reference}${b.hotelConfirmation ? `, ${e.hotelRef}: ${b.hotelConfirmation}` : ""}`,
    `${name}. ${w.checkin} ${d(b.checkIn)}, ${w.checkout} ${d(b.checkOut)}.`,
    `${e.trip}:\n${steps.map((s) => `  ${d(s.date)}  ${s.title}${s.detail ? `: ${s.detail}` : ""}`).join("\n")}`,
    ...(req ? [`${e.requests}: ${req}`] : []),
    `${e.price}:\n${lines.map((l) => `  ${l.label}: ${m(l.amount)}`).join("\n")}\n  ${b.demo ? e.sample : e.total}: ${m(total)}`,
    `${e.cancel}:\n${stages.map((s) => `  ${s.title}${s.to ? ` (${lang === "cs" ? "do" : "until"} ${d(s.to)})` : ""}: ${e.penalty} ${m(s.charge)}, ${e.refund} ${m(s.refund)}`).join("\n")}`,
    `${e.change}:\n${changesFor(b, lang).map((c) => `  ${c}`).join("\n")}`,
    `${e.manage}: ${link}`, e.footer(brand),
  ].join("\n\n");
  return sendEmail(b.leadEmail, subject, html, text);
}
