"use client";
import { useState } from "react";

/**
 * Brand colour as a round swatch plus its hex code, with a live preview of a button in that colour, and a
 * contrast hint: white text must stay readable on it (WCAG AA, 4.5:1), or the storefront's buttons fail.
 */
export default function ColorField({ name, defaultValue, disabled }: { name: string; defaultValue: string; disabled?: boolean }) {
  const [v, setV] = useState(defaultValue);
  const ok = contrastWithWhite(v) >= 4.5;
  return (
    <div className="field">
      <label htmlFor="bc">Brand color</label>
      <div className="color-field">
        <input id="bc" name={name} type="color" value={v} disabled={disabled} onChange={(e) => setV(e.target.value)} aria-describedby="bc-h" />
        <code>{v.toUpperCase()}</code>
        <span className="color-demo" style={{ background: v }}>Book</span>
      </div>
      <small id="bc-h" className={ok ? "mute" : "warn-text"}>{ok ? "White text reads well on it." : "Too light for white text. Pick a deeper shade so buttons stay readable."}</small>
    </div>
  );
}

function contrastWithWhite(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return 1.05 / (L + 0.05);
}
