/** Lucide line icons as SVG strings, for the cards the stays engine renders as HTML */
const w = (d: string, cls = "") => `<svg class="lucide${cls ? ` ${cls}` : ""}" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
// path data copied from Lucide (ISC), so these string icons match the React ones exactly
export const I = {
  star: w('<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>', "i-star"),
  clock: w('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>'),
  users: w('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
  arrow: w('<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>'),
  check: w('<path d="M20 6 9 17l-5-5"/>'),
  info: w('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'),
  x: w('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
};
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
