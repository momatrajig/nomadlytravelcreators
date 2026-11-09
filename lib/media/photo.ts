/**
 * Responsive photo URLs. Only high resolution sources are stored; this picks the right size for
 * the slot so a phone does not download a 4K file and a retina hero is never upscaled.
 *
 *  Wikimedia Commons: served from its CDN at the standard thumbnail widths (960, 1280, 1920);
 *                     other widths are refused by Commons, and a width at or above the original is an error.
 *  Unsplash:          imgix parameters (w, q, auto=format).
 *  Our storage:       photos copied into Supabase Storage at fixed sizes (hotels 330, 960, 1920;
 *                     places 800, 1600, 2400). The stored url is the base; the size is a suffix.
 *  Anything else:     returned as is.
 */
export interface Photo { url: string; w?: number; h?: number; credit?: string; license?: string; source?: string; origin?: string }

const COMMONS = /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/([0-9a-f]\/[0-9a-f]{2})\/([^/?#]+)$/;
const STEPS = [960, 1280, 1920] as const;
const MEDIA = /\/storage\/v1\/object\/public\/media\/photos\/(h|p)\/[^?#]+$/;
const SIZES = { h: [330, 960, 1920], p: [800, 1600, 2400] } as const;
const mediaKind = (url: string) => (MEDIA.exec(url)?.[1] as "h" | "p" | undefined);

export function photoSrc(url: string, width: number, max = 1920): string {
  const k = mediaKind(url);
  if (k) { const sizes = SIZES[k]; return `${url}-${sizes.find((s) => s >= width) ?? sizes.at(-1)}.jpg`; }
  const m = COMMONS.exec(url);
  if (m) {
    const w = STEPS.find((s) => s >= width && s <= max) ?? STEPS.filter((s) => s <= max).at(-1)!;
    return `https://upload.wikimedia.org/wikipedia/commons/thumb/${m[1]}/${m[2]}/${w}px-${m[2]}`;
  }
  if (url.startsWith("https://images.unsplash.com/")) return `${url}?w=${Math.min(width, 2400)}&q=78&auto=format&fit=crop`;
  return url;
}

export function photoSet(url: string, max = 1920): string | undefined {
  const k = mediaKind(url);
  // the largest hotel file is 1920 wide, or 1280 where the original was smaller (max carries the real width)
  if (k === "h") return `${url}-960.jpg 960w, ${url}-1920.jpg ${max}w`;
  if (k === "p") return `${url}-800.jpg 800w, ${url}-1600.jpg 1600w, ${url}-2400.jpg 2400w`;
  if (COMMONS.test(url)) return STEPS.filter((s) => s <= max).map((s) => `${photoSrc(url, s, max)} ${s}w`).join(", ");
  if (url.startsWith("https://images.unsplash.com/")) return [800, 1200, 1600, 2400].map((w) => `${photoSrc(url, w)} ${w}w`).join(", ");
  return undefined;
}

/** Small preview (thumbnail strips, contact rows). Commons serves 330 and 500 as standard sizes too. */
export function photoThumb(url: string, w: 330 | 500 = 330): string {
  const k = mediaKind(url);
  if (k) return `${url}-${k === "h" ? 330 : 800}.jpg`;
  const m = COMMONS.exec(url);
  if (m) return `https://upload.wikimedia.org/wikipedia/commons/thumb/${m[1]}/${m[2]}/${w}px-${m[2]}`;
  if (url.startsWith("https://images.unsplash.com/")) return `${url}?w=${w + 100}&q=70&auto=format&fit=crop`;
  return url;
}

export const isLicensed = (p: Photo) => !!p.license;
