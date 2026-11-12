import type { LucideIcon } from "lucide-react";

/**
 * The site's one icon family: Lucide line icons on a 24 grid. Stroke weight and colour are set once in CSS
 * (.lucide), so every icon on every page reads as the same hand. Decorative by default; pass `label` when the
 * icon carries meaning on its own.
 */
export function Ico({ of: C, size = 18, label, className }: { of: LucideIcon; size?: number; label?: string; className?: string }) {
  return <C size={size} className={className} aria-hidden={label ? undefined : true} aria-label={label} role={label ? "img" : undefined} focusable="false" />;
}

import { CarTaxiFront, Luggage, Smartphone, Timer, type LucideIcon as L } from "lucide-react";
/** the add-on services, the same glyph on the home page shelf and at checkout */
export const EXTRA_ICON: Record<string, L> = { car: CarTaxiFront, sim: Smartphone, luggage: Luggage, umbrella: Timer };

import { ArrowRight, Star } from "lucide-react";
/** hotel class as filled stars, drawn, never a text glyph that changes with the font */
export function Stars({ n, label, size = 14 }: { n: number; label: string; size?: number }) {
  return <span className="stars" role="img" aria-label={label}>{Array.from({ length: n }, (_, i) => <Star key={i} size={size} aria-hidden="true" />)}</span>;
}
/** "from → to" ranges: a drawn arrow between two dates */
export const To = () => <ArrowRight className="to" size={14} aria-hidden="true" />;
