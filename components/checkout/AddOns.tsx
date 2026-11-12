"use client";
import { ELSEWHERE_CHECKED, EXTRAS, airportsFor, priceExtra, recommendedPlan, type Direction, type ExtraKind, type ExtraPick } from "@/lib/extras/catalog";
import { price, type ReaderFmt } from "@/lib/i18n";
import type { Co } from "@/lib/i18n/checkout";
import { dict } from "@/lib/i18n";
import { Check, Minus, Plus } from "lucide-react";
import { EXTRA_ICON, Ico } from "@/components/Icon";

/**
 * The counter by the till: four services a traveler adds in one tap, each opening in place to its few real
 * choices (airport, direction, car; data plan). Prices shown here come from the same catalogue the server
 * charges from, so what the reader sees is what is charged.
 */
const TINT: Record<ExtraKind, string> = { transfer: "#e9f0ff", esim: "#e8f7ef", bag: "#fff3e3", delay: "#f3ecff" };
const INK: Record<ExtraKind, string> = { transfer: "#2453c7", esim: "#127a4a", bag: "#a35b00", delay: "#6b3fc4" };

export default function AddOns({ co, f, picks, setPicks, destination, adults, nights, compare = false }: {
  co: Co; f: ReaderFmt; picks: ExtraPick[]; setPicks: (p: ExtraPick[]) => void; destination: string | null; adults: number; nights: number;
  /** show struck through "bought on its own" prices (checked prices, or labelled samples in the demo) */
  compare?: boolean;
}) {
  const t = dict(f.lang);
  const P = (v: number) => price(f, v);
  const ctx = { destination, adults, nights };
  const get = (k: ExtraKind) => picks.find((p) => p.kind === k);
  const set = (k: ExtraKind, patch: Partial<ExtraPick> | null) => {
    if (patch === null) return setPicks(picks.filter((p) => p.kind !== k));
    const cur = get(k);
    setPicks(cur ? picks.map((p) => (p.kind === k ? { ...p, ...patch } : p)) : [...picks, { kind: k, ...patch }]);
  };
  const safe = (p: ExtraPick) => { try { return priceExtra(p, ctx); } catch { return null; } };
  const airports = airportsFor(destination);
  const rec = recommendedPlan(nights);

  return (
    <section className="co-card" aria-labelledby="add-h">
      <h2 id="add-h">{co.addH}</h2>
      <p className="co-sub">{co.addSub}</p>
      {compare && !ELSEWHERE_CHECKED && <p className="small mute" style={{ margin: "-6px 0 0" }}>{co.sampleCompare}</p>}
      <ul className="shelf" role="list">
        {EXTRAS.map((x) => {
          const pick = get(x.kind);
          const on = !!pick;
          const priced = pick ? safe(pick) : null;
          const name = t.extras?.[x.kind]?.name ?? x.name;
          const short = t.extras?.[x.kind]?.short ?? x.short;
          const open = on && x.options.length > 1;
          return (
            <li key={x.kind} className={`shelf-item${on ? " on" : ""}${open ? " open" : ""}`} style={{ ["--tint" as string]: TINT[x.kind], ["--tink" as string]: INK[x.kind] }}>
              <div className="shelf-top">
                <span className="shelf-ico" aria-hidden="true"><Ico of={EXTRA_ICON[x.icon]!} size={22} /></span>
                <div className="shelf-txt"><h3>{name}</h3><p>{short}</p></div>
                <div className="shelf-price">
                  {priced ? <b>{P(priced.price)}</b> : <><span className="from">{co.from}</span> <b>{P(x.price)}</b></>}
                  {compare && <s>{P(priced?.elsewhere ?? x.elsewhere)} {co.onItsOwn}</s>}
                  {compare && <span className="save-pct">−{Math.round((1 - (priced?.price ?? x.price) / (priced?.elsewhere ?? x.elsewhere)) * 100)}%</span>}
                </div>
                <button type="button" className={`shelf-btn${on ? " on" : ""}`} aria-pressed={on} onClick={() => set(x.kind, on ? null : {})}>
                  {on ? <><Ico of={Check} size={16} />{co.added}</> : <><Ico of={Plus} size={16} />{co.add}</>}
                </button>
              </div>

              {open && x.kind === "transfer" && pick && (
                <div className="shelf-cfg">
                  {airports.length > 1 && (
                    <fieldset><legend>{co.airport}</legend>
                      <div className="seg">{airports.map((a) => <button key={a.code} type="button" aria-pressed={(pick.airport ?? airports[0]!.code) === a.code} onClick={() => set("transfer", { airport: a.code })}><b>{a.code}</b><span>{a.name}{a.minutes ? `, ${co.minutes(a.minutes)}` : ""}</span></button>)}</div>
                    </fieldset>
                  )}
                  <fieldset><legend>{co.direction}</legend>
                    <div className="seg seg-sm">{([["arrival", co.toHotel], ["departure", co.toAirport], ["both", co.both]] as Array<[Direction, string]>).map(([d, l]) => <button key={d} type="button" aria-pressed={(pick.direction ?? "arrival") === d} onClick={() => set("transfer", { direction: d })}>{l}</button>)}</div>
                  </fieldset>
                  <fieldset><legend>{co.car}</legend>
                    <div className="cars">{x.options.map((o) => {
                      const q = safe({ ...pick, option: o.id });
                      const sel = (priced?.option ?? "") === o.id;
                      return (
                        <button key={o.id} type="button" className="car" aria-pressed={sel} disabled={!q} onClick={() => set("transfer", { option: o.id })}>
                          <CarArt id={o.id} />
                          <b>{o.name}</b><span>{o.sub}</span>
                          <span className="car-meta">{o.seats ? (q ? co.seats(o.seats) : co.tooSmall(o.seats)) : ""}</span>
                          <strong>{q ? P(q.price) : "–"}</strong>
                        </button>
                      );
                    })}</div>
                  </fieldset>
                  <div className="field flight"><label htmlFor="fl">{co.flight}</label><input id="fl" value={pick.flight ?? ""} placeholder={co.flightPh} maxLength={8} autoCapitalize="characters" onChange={(e) => set("transfer", { flight: e.target.value.toUpperCase() })} aria-describedby="fl-h" /><span id="fl-h" className="hint">{co.flightHint}</span></div>
                </div>
              )}

              {open && x.kind === "esim" && pick && (
                <div className="shelf-cfg">
                  <fieldset><legend>{co.plan}</legend>
                    <div className="plans">{x.options.map((o) => {
                      const sel = (priced?.option ?? rec) === o.id;
                      return (
                        <button key={o.id} type="button" className="plan" aria-pressed={sel} onClick={() => set("esim", { option: o.id })}>
                          {o.id === rec && <em>{co.recommended(nights)}</em>}
                          <b>{o.name}</b><span>{o.sub}</span><strong>{P(o.price)}</strong>
                        </button>
                      );
                    })}</div>
                  </fieldset>
                  {adults > 1 && (
                    <div className="qty"><span>{co.howMany} <small>{co.perPhone}</small></span>
                      <div className="stepper">
                        <button type="button" aria-label={co.fewer} disabled={(pick.qty ?? 1) <= 1} onClick={() => set("esim", { qty: Math.max(1, (pick.qty ?? 1) - 1) })}><Ico of={Minus} size={16} /></button>
                        <output aria-live="polite">{pick.qty ?? 1}</output>
                        <button type="button" aria-label={co.more} disabled={(pick.qty ?? 1) >= adults} onClick={() => set("esim", { qty: Math.min(adults, (pick.qty ?? 1) + 1) })}><Ico of={Plus} size={16} /></button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** A small side view per car class: the silhouette grows with the class. */
function CarArt({ id }: { id: string }) {
  const d: Record<string, string> = {
    standard: "M6 30h52M10 30c0-5 3-7 8-8l6-6c2-2 4-3 7-3h10c3 0 5 1 7 3l5 6c5 1 8 3 8 8",
    business: "M4 30h56M8 30c0-5 3-8 9-9l8-7c2-1 4-2 7-2h11c3 0 5 1 7 3l5 6c6 1 9 4 9 9",
    van: "M5 30h54M8 30V16c0-2 1-4 4-4h30c4 0 7 2 9 5l5 6c2 1 3 3 3 7M8 20h44",
    first: "M2 30h60M6 30c0-5 4-8 10-9l9-7c2-1 5-2 8-2h11c3 0 6 1 8 3l5 6c6 1 9 4 9 9",
  };
  return (
    <svg className="car-art" viewBox="0 0 64 38" aria-hidden="true">
      <path d={d[id] ?? d.standard} />
      <circle cx="18" cy="30" r="4.5" /><circle cx="46" cy="30" r="4.5" />
    </svg>
  );
}
