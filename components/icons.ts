/** Lucide style line icons as inline SVG strings (used inside engine rendered cards) */
const w = (d: string) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
export const I = {
  star: w('<path d="M12 3l3 6 6 1-4.5 4 1 6-5.5-3-5.5 3 1-6L3 10l6-1z"/>'),
  clock: w('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  users: w('<circle cx="9" cy="8" r="3.5"/><path d="M3 20a6 6 0 0112 0M16 4a3.5 3.5 0 010 7M21 20a6 6 0 00-5-5.9"/>'),
  arrow: w('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  check: w('<path d="M5 12l4 4L19 6"/>'),
  info: w('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'),
  x: w('<path d="M18 6L6 18M6 6l12 12"/>'),
};
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
