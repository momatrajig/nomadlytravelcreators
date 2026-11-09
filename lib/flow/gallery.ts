/* Full screen photo viewer. Vanilla so the cover flow (also vanilla) and React pages share it. */
import { photoSet, photoSrc, photoThumb, type Photo } from "@/lib/media/photo";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function openGallery(opts: { title: string; photos: Photo[]; start?: number; onClose?: () => void }): { close: () => void } {
  document.querySelector(".gx")?.remove();
  const ps = opts.photos.filter((p) => p.url);
  const n = ps.length;
  const prevFocus = document.activeElement as HTMLElement | null;
  const root = document.createElement("div");
  root.className = "gx";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", `${opts.title} photos`);
  root.innerHTML = `
    <div class="gx-top"><div class="gx-title">${esc(opts.title)}</div><div class="gx-count" aria-live="polite"></div>
      <button type="button" class="gx-x" aria-label="Close photos"><svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg></button></div>
    <div class="gx-stage">
      <button type="button" class="gx-nav gx-prev" aria-label="Previous photo"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
      <div class="gx-frame"><img class="gx-img" alt="" decoding="async"></div>
      <button type="button" class="gx-nav gx-next" aria-label="Next photo"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button>
    </div>
    <div class="gx-credit"></div>
    <div class="gx-strip" role="tablist" aria-label="All photos">${ps.map((p, i) => `<button type="button" role="tab" data-i="${i}" aria-label="Photo ${i + 1} of ${n}"><img src="${photoThumb(p.url)}" alt="" loading="lazy"></button>`).join("")}</div>`;
  document.body.appendChild(root);
  const prevOverflow = document.documentElement.style.overflow;
  document.documentElement.style.overflow = "hidden";
  const img = root.querySelector(".gx-img") as HTMLImageElement;
  const count = root.querySelector(".gx-count") as HTMLElement;
  const credit = root.querySelector(".gx-credit") as HTMLElement;
  const thumbs = [...root.querySelectorAll<HTMLButtonElement>(".gx-strip button")];
  let i = Math.max(0, Math.min(n - 1, opts.start ?? 0));

  const preload = (k: number) => { const p = ps[(k + n) % n]; if (!p) return; const im = new Image(); im.sizes = "100vw"; const set = photoSet(p.url, p.w); if (set) im.srcset = set; im.src = photoSrc(p.url, 1920, p.w); };
  const show = (k: number) => {
    i = (k + n) % n;
    const p = ps[i]!;
    img.classList.remove("in");
    img.onload = () => img.classList.add("in");
    img.sizes = "(min-width: 1100px) 1100px, 100vw";
    const set = photoSet(p.url, p.w);
    if (set) img.srcset = set; else img.removeAttribute("srcset");
    img.src = photoSrc(p.url, 1920, p.w);
    img.alt = `${opts.title}, photo ${i + 1} of ${n}`;
    if (img.complete) img.classList.add("in");
    count.textContent = `${i + 1} of ${n}`;
    credit.innerHTML = p.credit ? `Photo: ${esc(p.credit)}${p.license ? `, ${esc(p.license)}` : ""}${p.source ? `, <a href="${esc(p.source)}" target="_blank" rel="noreferrer">source</a>` : ""}` : "";
    thumbs.forEach((t, j) => { t.setAttribute("aria-selected", String(j === i)); if (j === i) t.scrollIntoView({ block: "nearest", inline: "center" }); });
    preload(i + 1); preload(i - 1);
  };
  const close = () => {
    root.classList.remove("on");
    document.removeEventListener("keydown", onKey);
    document.documentElement.style.overflow = prevOverflow;
    setTimeout(() => root.remove(), 220);
    prevFocus?.focus?.();
    opts.onClose?.();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") close();
    else if (e.key === "ArrowRight") show(i + 1);
    else if (e.key === "ArrowLeft") show(i - 1);
    else if (e.key === "Tab") { // keep focus inside the viewer
      const f = [...root.querySelectorAll<HTMLElement>("button, a")]; const first = f[0]!, last = f.at(-1)!;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  root.querySelector(".gx-x")!.addEventListener("click", close);
  root.querySelector(".gx-prev")!.addEventListener("click", () => show(i - 1));
  root.querySelector(".gx-next")!.addEventListener("click", () => show(i + 1));
  thumbs.forEach((t) => t.addEventListener("click", () => show(Number(t.dataset.i))));
  // swipe
  let sx: number | null = null, sy = 0;
  const stage = root.querySelector(".gx-stage") as HTMLElement;
  stage.addEventListener("pointerdown", (e) => { sx = e.clientX; sy = e.clientY; });
  stage.addEventListener("pointerup", (e) => { if (sx === null) return; const dx = e.clientX - sx, dy = e.clientY - sy; sx = null; if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) show(i + (dx < 0 ? 1 : -1)); });
  // a click on the dark area beside the photo closes, a click on the photo does not
  stage.addEventListener("click", (e) => { if (e.target === stage) close(); });
  document.addEventListener("keydown", onKey);
  if (n < 2) root.classList.add("single");
  show(i);
  requestAnimationFrame(() => { root.classList.add("on"); (root.querySelector(".gx-x") as HTMLElement).focus(); });
  // a background tab never fires animation frames; make sure the viewer is visible anyway
  setTimeout(() => root.classList.add("on"), 50);
  return { close };
}
