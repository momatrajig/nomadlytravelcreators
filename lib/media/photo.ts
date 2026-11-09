/**
 * Responsive photo URLs. Only high resolution sources are stored; this picks the right size for
 * the slot so a phone does not download a 4K file and a retina hero is never upscaled.
 *
 *  Wikimedia Commons: served from its CDN at the standard thumbnail widths (960, 1280, 1920);
 *                     other widths are refused by Commons, and a width at or above the original is an error.
 *  Unsplash:          imgix parameters (w, q, auto=format).
 *  Anything else:     returned as is.
 */
export interface Photo { url: string; w?: number; h?: number; credit?: string; license?: string; source?: string }

const COMMONS = /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/([0-9a-f]\/[0-9a-f]{2})\/([^/?#]+)$/;
const STEPS = [960, 1280, 1920] as const;

export function photoSrc(url: string, width: number, max = 1920): string {
  const m = COMMONS.exec(url);
  if (m) {
    const w = STEPS.find((s) => s >= width && s <= max) ?? STEPS.filter((s) => s <= max).at(-1)!;
    return `https://upload.wikimedia.org/wikipedia/commons/thumb/${m[1]}/${m[2]}/${w}px-${m[2]}`;
  }
  if (url.startsWith("https://images.unsplash.com/")) return `${url}?w=${Math.min(width, 2400)}&q=78&auto=format&fit=crop`;
  return url;
}

export function photoSet(url: string, max = 1920): string | undefined {
  if (COMMONS.test(url)) return STEPS.filter((s) => s <= max).map((s) => `${photoSrc(url, s, max)} ${s}w`).join(", ");
  if (url.startsWith("https://images.unsplash.com/")) return [800, 1200, 1600, 2400].map((w) => `${photoSrc(url, w)} ${w}w`).join(", ");
  return undefined;
}

/** Small preview (thumbnail strips, contact rows). Commons serves 330 and 500 as standard sizes too. */
export function photoThumb(url: string, w: 330 | 500 = 330): string {
  const m = COMMONS.exec(url);
  if (m) return `https://upload.wikimedia.org/wikipedia/commons/thumb/${m[1]}/${m[2]}/${w}px-${m[2]}`;
  if (url.startsWith("https://images.unsplash.com/")) return `${url}?w=${w + 100}&q=70&auto=format&fit=crop`;
  return url;
}

export const isLicensed = (p: Photo) => !!p.license;
