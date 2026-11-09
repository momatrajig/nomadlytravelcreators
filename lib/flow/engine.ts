/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * NomadlyFlow engine: a 2.5D cover flow. Framework free, GPU transforms only, spring physics,
 * pointer and touch drag, wheel, keyboard, lazy images, neighbor preload, idle life (breathing,
 * Ken Burns, auto advance), pointer tilt, reduced motion fallback. Ported from the prototype
 * with its behavior verified; typed loosely on purpose where the DOM is dynamic.
 * Use through components/CoverFlow.tsx.
 */
export interface FlowOptions<T = any> {
  items: T[];
  renderCard: (item: T, i: number) => string;
  onOpen?: (item: T, i: number, card: HTMLElement) => void;
  onChange?: (i: number, item: T) => void;
  label?: string;
  start?: number;
  flat?: boolean;
  autoEvery?: number;
  sideShift?: number; depth?: number; angle?: number; scaleStep?: number; stiffness?: number; damping?: number;
}
export interface FlowHandle { go(i: number, v0?: number): void; readonly index: number; destroy(): void }
export interface SheetOptions { title?: string; images: string[]; alts?: string[]; body?: string; onClose?: () => void }

const isBrowser = typeof window !== "undefined";
const REDUCED = isBrowser && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const LOW_END = isBrowser && ((navigator.hardwareConcurrency || 8) <= 2 || ((navigator as any).deviceMemory && (navigator as any).deviceMemory <= 2));

function spring(from: number, to: number, v0: number, opts: { stiffness?: number; damping?: number }) {
  // critically damped spring; returns {step(dt) -> value, done}
  const k = opts.stiffness || 170, c = opts.damping || 26, m = 1;
  let x = from, v = v0 || 0;
  return {
    step(dt: number) {
      const f = -k * (x - to) - c * v;
      v += (f / m) * dt; x += v * dt;
      if (Math.abs(x - to) < 0.0005 && Math.abs(v) < 0.001) { x = to; v = 0; return { x, done: true }; }
      return { x, done: false };
    }
  };
}

export function mount<T = any>(root: HTMLElement, opts: FlowOptions<T>): FlowHandle {
  const items = opts.items || [];
  const n = items.length;
  const flat = opts.flat !== undefined ? opts.flat : REDUCED;
  const lite = LOW_END;
  root.classList.add('nf');
  root.setAttribute('role', 'region');
  root.setAttribute('aria-roledescription', 'carousel');
  root.setAttribute('aria-label', opts.label || 'Offers');
  root.innerHTML = '';
  const stage = document.createElement('div'); stage.className = 'nf-stage';
  root.appendChild(stage);
  const cards: HTMLElement[] = items.map((it, i) => {
    const el = document.createElement('article');
    el.className = 'nf-card'; el.tabIndex = -1; el.dataset.i = String(i);
    el.setAttribute('aria-label', String((it as any).name || (it as any).title || ''));
    el.innerHTML = opts.renderCard(it, i) + '<span class="nf-gloss" aria-hidden="true"></span>';
    stage.appendChild(el);
    return el;
  });
  const nav = document.createElement('div'); nav.className = 'nf-nav';
  nav.innerHTML = `<button type="button" class="nf-btn nf-prev" aria-label="Previous"><svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></button>
    <div class="nf-dots" role="tablist"></div>
    <button type="button" class="nf-btn nf-next" aria-label="Next"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button>`;
  root.appendChild(nav);
  const dots = nav.querySelector('.nf-dots') as HTMLElement;
  items.forEach((_, i) => { const d = document.createElement('button'); d.type = 'button'; d.setAttribute('role', 'tab'); d.setAttribute('aria-label', 'Go to ' + (i + 1)); d.addEventListener('click', () => go(i)); dots.appendChild(d); });

  if (flat) {
    root.classList.add('nf-flat');
    // flat fallback: native horizontal scroll with snap, no 3D
    stage.addEventListener('scroll', () => { const w = (cards[0]?.offsetWidth ?? 300) + 16; const i = Math.round(stage.scrollLeft / w); setActive(i, false); }, { passive: true });
    (nav.querySelector('.nf-prev') as HTMLElement).addEventListener('click', () => go(cur - 1));
    (nav.querySelector('.nf-next') as HTMLElement).addEventListener('click', () => go(cur + 1));
  }

  let cur = Math.min(opts.start || 0, n - 1), pos = cur, vel = 0, last = 0;
  // living motion state: time, entrance, pointer tilt, idle auto advance, visibility
  const born = performance.now();
  let tiltX = 0, tiltY = 0, tiltTX = 0, tiltTY = 0, hovering = false, idleAt = performance.now(), inView = true, sp: ReturnType<typeof spring> | null = null, loop: number | null = null, lastAuto = performance.now();
  const AUTO_EVERY = opts.autoEvery === undefined ? 5200 : opts.autoEvery, IDLE_AFTER = 6500;
  const touch = () => { idleAt = performance.now(); };
  let dragging = false, startX = 0, startPos = 0, lastX = 0, lastT = 0, moved = 0;
  const ease = (t: number) => t < 0 ? 0 : t > 1 ? 1 : 1 - Math.pow(1 - t, 3);
  const cw = () => cards[0] ? cards[0].offsetWidth : 300;
  const metrics = () => {
    const w = cw();
    const narrow = root.clientWidth < 640;
    const side = opts.sideShift || (narrow ? 0.42 : 0.62);   // fraction of card width between neighbors
    const depth = opts.depth || (narrow ? 200 : 140);        // px pushed back per step
    const angle = opts.angle || (narrow ? 46 : 38);          // degrees
    const scale = opts.scaleStep || (narrow ? 0.16 : 0.12);
    return { w, side, depth, angle, scale };
  };

  function layout(p: number, now?: number) {
    if (flat) return;
    now = now || performance.now();
    const m = metrics();
    const T = (now - born) / 1000;   // seconds alive, drives the slow idle motion
    const narrow = root.clientWidth < 640;
    cards.forEach((el, i) => {
      const d = i - p;                 // signed distance from center
      const ad = Math.abs(d);
      if (ad > 4.2) { el.style.visibility = 'hidden'; return; }
      el.style.visibility = '';
      const sign = d < 0 ? -1 : 1;
      const t = Math.min(ad, 1);       // 0..1 blend near center
      const e = lite ? 1 : ease((now - born - Math.abs(i - cur) * 70) / 760);   // fan in on first view
      const x = sign * (t * m.w * (narrow ? 0.6 : 0.78) + Math.max(0, ad - 1) * m.w * m.side) + sign * (1 - e) * 90;
      const bob = lite ? 0 : Math.sin(T * 0.8 + i * 1.7) * (ad < 0.5 ? 2.5 : 4);   // each card breathes on its own phase
      const z = -(t * m.depth + Math.max(0, ad - 1) * m.depth * 0.9) - (1 - e) * 320;
      const active = ad < 0.5;
      const ry = -sign * t * m.angle + (active ? tiltX * 6 : 0) + (lite ? 0 : Math.sin(T * 0.5 + i) * 1.2 * t);
      const rx = active ? -tiltY * 4 : 0;
      const s = (1 - t * m.scale - Math.max(0, ad - 1) * m.scale * 0.5) * (0.92 + 0.08 * e);
      el.style.transform = `translate3d(calc(-50% + ${x.toFixed(2)}px), calc(-50% + ${bob.toFixed(2)}px), ${z.toFixed(2)}px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) scale(${s.toFixed(4)})`;
      el.style.zIndex = String(100 - Math.round(ad * 10));
      el.style.opacity = String((ad > 3 ? Math.max(0, 1 - (ad - 3)) : 1) * e);
      el.classList.toggle('is-active', Math.round(p) === i && active);
      // light sweep follows the card's angle
      const g = el.lastElementChild as HTMLElement | null; if (g && g.classList.contains('nf-gloss')) g.style.transform = `translate3d(${(ry * 1.6 - tiltX * 30).toFixed(1)}%, 0, 0)`;
      // parallax plus a slow Ken Burns drift inside the picture
      const img = lite ? null : (el.querySelector('.nf-img') as HTMLElement | null);
      if (img) {
        const kb = active ? 1.14 + 0.07 * (0.5 + 0.5 * Math.sin(T * 0.21 + i)) : 1.14;
        const px = -d * 6 + (active ? Math.sin(T * 0.16 + i * 0.7) * 1.8 : 0), py = active ? Math.cos(T * 0.12 + i * 0.4) * 1.4 : 0;
        img.style.transform = `translate3d(${px.toFixed(2)}%, ${py.toFixed(2)}%, 0) scale(${kb.toFixed(4)})`;
      }
    });
  }

  function setActive(i: number, focus: boolean) {
    cur = Math.max(0, Math.min(n - 1, i));
    cards.forEach((el, k) => { el.setAttribute('aria-hidden', k === cur ? 'false' : 'true'); el.tabIndex = k === cur ? 0 : -1; });
    dots.querySelectorAll('button').forEach((d, k) => d.setAttribute('aria-selected', k === cur ? 'true' : 'false'));
    preload(cur);
    if (focus) cards[cur]?.focus({ preventScroll: true });
    if (opts.onChange) opts.onChange(cur, items[cur] as T);
  }

  function preload(i: number) {
    for (let k = i - 2; k <= i + 2; k++) {
      const el = cards[k]; if (!el) continue;
      el.querySelectorAll('img[data-src]').forEach((im) => { const el2 = im as HTMLImageElement; el2.src = el2.dataset.src!; el2.removeAttribute('data-src'); });
    }
  }

  function animateTo(target: number, v0?: number) {
    if (flat) { stage.scrollTo({ left: target * (cw() + 16), behavior: 'smooth' }); return; }
    sp = spring(pos, target, v0 || 0, { stiffness: opts.stiffness || 135, damping: opts.damping || 21 });
    last = performance.now(); wake();
  }
  function frame(now: number) {
    loop = null;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (sp) { const r = sp.step(dt); pos = r.x; if (r.done) sp = null; }
    // pointer tilt eases toward its target
    tiltX += (tiltTX - tiltX) * Math.min(1, dt * 7); tiltY += (tiltTY - tiltY) * Math.min(1, dt * 7);
    layout(pos, now);
    // auto advance when the visitor has been idle, the flow is on screen and nothing is open
    if (AUTO_EVERY && n > 1 && !dragging && !hovering && !sp && inView && !document.hidden && now - idleAt > IDLE_AFTER && now - lastAuto > AUTO_EVERY && !document.querySelector('.nf-sheet') && !root.contains(document.activeElement)) {
      lastAuto = now; go(cur + 1 >= n ? 0 : cur + 1);
    }
    const settling = sp || (now - born) < 1400 || Math.abs(tiltTX - tiltX) > 0.002;
    if ((inView && !document.hidden) || settling) loop = requestAnimationFrame(frame);
  }
  function wake() { if (!loop && !flat) { last = performance.now(); loop = requestAnimationFrame(frame); } }

  function go(i: number, v0?: number) { const t = Math.max(0, Math.min(n - 1, i)); setActive(t, false); animateTo(t, v0); }

  // Drag (pointer events cover mouse, touch and pen)
  const onDown = (e: PointerEvent) => {
    if (flat) return;
    if (e.button && e.button !== 0) return;
    dragging = true; moved = 0; startX = lastX = e.clientX; startPos = pos; lastT = performance.now(); vel = 0; touch();
    sp = null; wake();
    root.classList.add('is-dragging');
  };
  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - startX; moved = Math.max(moved, Math.abs(dx));
    const now = performance.now(); const dt = Math.max(1, now - lastT);
    vel = ((e.clientX - lastX) / dt) * -1000 / cw(); lastX = e.clientX; lastT = now;
    pos = startPos - dx / cw(); touch();
  };
  const onUp = () => {
    if (!dragging) return; dragging = false; root.classList.remove('is-dragging'); touch();
    const target = Math.round(pos + vel * 0.12);
    go(target, vel);
  };
  stage.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  // swallow click after a drag
  stage.addEventListener('click', (e) => { if (moved > 6) { e.stopPropagation(); e.preventDefault(); moved = 0; return; }
    const target = e.target as HTMLElement; const card = target.closest('.nf-card') as HTMLElement | null; if (!card) return;
    const i = +card.dataset.i!;
    // the Photos button opens the gallery from any card, active or not
    if (target.closest('[data-nf-open]')) { e.preventDefault(); if (i !== cur) go(i); if (opts.onOpen) opts.onOpen(items[i] as T, i, card); return; }
    if (i !== cur) { go(i); return; }
    if (!target.closest('a,button')) { if (opts.onOpen) opts.onOpen(items[i] as T, i, card); }
  }, true);
  // wheel: horizontal intent only
  let wheelAcc = 0, wheelT: ReturnType<typeof setTimeout> | undefined;
  stage.addEventListener('wheel', (e) => {
    if (flat) return;
    if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) return;
    e.preventDefault(); wheelAcc += e.deltaX;
    clearTimeout(wheelT); wheelT = setTimeout(() => { const steps = Math.round(wheelAcc / 120); wheelAcc = 0; if (steps) go(cur + steps); }, 60);
  }, { passive: false });
  // keyboard
  root.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(cur + 1); setActive(cur, true); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(cur - 1); setActive(cur, true); }
    else if (e.key === 'Enter' && (e.target as HTMLElement).classList.contains('nf-card')) { if (opts.onOpen) opts.onOpen(items[cur] as T, cur, cards[cur]!); }
  });
  (nav.querySelector('.nf-prev') as HTMLElement).addEventListener('click', () => go(cur - 1));
  (nav.querySelector('.nf-next') as HTMLElement).addEventListener('click', () => go(cur + 1));
  // hover lift
  stage.addEventListener('pointerover', (e) => { const c = (e.target as HTMLElement).closest('.nf-card') as HTMLElement | null; if (c && +c.dataset.i! !== cur) c.classList.add('is-hover'); hovering = true; touch(); wake(); });
  stage.addEventListener('pointerout', (e) => { const c = (e.target as HTMLElement).closest('.nf-card'); if (c) c.classList.remove('is-hover'); if (!stage.contains(e.relatedTarget as Node)) { hovering = false; tiltTX = 0; tiltTY = 0; } });
  // the active card leans toward the pointer
  stage.addEventListener('pointermove', (e: PointerEvent) => {
    if (dragging || e.pointerType === 'touch') return;
    const a = cards[cur]; if (!a) return;
    // no lean while the pointer is over the text and buttons: a tilting button moves away from the click
    if ((e.target as HTMLElement).closest('.nf-body, .nf-top')) { tiltTX = 0; tiltTY = 0; touch(); return; }
    const r = a.getBoundingClientRect();
    const nx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2), ny = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    if (Math.abs(nx) <= 1.3 && Math.abs(ny) <= 1.3) { tiltTX = Math.max(-1, Math.min(1, nx)); tiltTY = Math.max(-1, Math.min(1, ny)); } else { tiltTX = 0; tiltTY = 0; }
    touch(); wake();
  }, { passive: true });
  root.addEventListener('focusin', touch); root.addEventListener('keydown', touch);
  nav.addEventListener('click', touch, true);
  let io: IntersectionObserver | undefined;
  if (window.IntersectionObserver) { io = new IntersectionObserver((es) => { inView = es[0]!.isIntersecting; if (inView) { lastAuto = performance.now(); wake(); } }, { threshold: 0.35 }); io.observe(root); }
  document.addEventListener('visibilitychange', wake);

  let ro: ResizeObserver | undefined;
  if (window.ResizeObserver) { ro = new ResizeObserver(() => layout(pos)); ro.observe(root); }
  setActive(cur, false); layout(pos); wake();
  return { go, get index() { return cur; }, destroy() { if (ro) ro.disconnect(); if (io) io.disconnect(); if (loop) cancelAnimationFrame(loop); loop = null; document.removeEventListener('visibilitychange', wake); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp); root.innerHTML = ''; root.classList.remove('nf', 'nf-flat'); } };
}

/* Detail sheet: opens a card into a full view with a swipeable gallery. */
export function openSheet(opts: SheetOptions): { close: () => void } {
  const old = document.querySelector('.nf-sheet'); if (old) old.remove();
  const sheet = document.createElement('div'); sheet.className = 'nf-sheet'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true'); sheet.setAttribute('aria-label', opts.title || 'Details');
  const imgs = opts.images || [];
  sheet.innerHTML = `<div class="nf-sheet-bg"></div><div class="nf-sheet-card">
    <button type="button" class="nf-sheet-close" aria-label="Close"><svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
    <div class="nf-gal"><div class="nf-gal-track">${imgs.map((s, i) => `<img src="${s}" alt="${(opts.alts && opts.alts[i]) || ''}" ${i > 1 ? 'loading="lazy"' : ''}>`).join('')}</div>
      <div class="nf-gal-nav"><button type="button" class="nf-btn" data-g="-1" aria-label="Previous photo"><svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></button><span class="nf-gal-count">1 / ${imgs.length}</span><button type="button" class="nf-btn" data-g="1" aria-label="Next photo"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button></div>
      <div class="nf-thumbs">${imgs.map((s, i) => `<button type="button" data-t="${i}" aria-label="Photo ${i + 1}"><img src="${s}" alt=""></button>`).join('')}</div>
    </div>
    <div class="nf-sheet-body">${opts.body || ''}</div></div>`;
  document.body.appendChild(sheet);
  const track = sheet.querySelector('.nf-gal-track') as HTMLElement, count = sheet.querySelector('.nf-gal-count') as HTMLElement;
  let gi = 0;
  const setG = (i: number) => { gi = (i + imgs.length) % imgs.length; track.style.transform = `translate3d(${-gi * 100}%,0,0)`; count.textContent = `${gi + 1} / ${imgs.length}`; sheet.querySelectorAll('.nf-thumbs button').forEach((b, k) => b.classList.toggle('on', k === gi)); };
  sheet.querySelectorAll('[data-g]').forEach((b) => b.addEventListener('click', () => setG(gi + (+(b as HTMLElement).dataset.g!))));
  sheet.querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', () => setG(+(b as HTMLElement).dataset.t!)));
  let sx: number | null = null; track.addEventListener('pointerdown', (e) => { sx = e.clientX; }); track.addEventListener('pointerup', (e) => { if (sx === null) return; const dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 40) setG(gi + (dx < 0 ? 1 : -1)); });
  const close = () => { sheet.classList.remove('on'); setTimeout(() => sheet.remove(), REDUCED ? 0 : 260); document.removeEventListener('keydown', onKey); if (opts.onClose) opts.onClose(); };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); if (e.key === 'ArrowRight') setG(gi + 1); if (e.key === 'ArrowLeft') setG(gi - 1); };
  (sheet.querySelector('.nf-sheet-close') as HTMLElement).addEventListener('click', close);
  (sheet.querySelector('.nf-sheet-bg') as HTMLElement).addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  setG(0);
  requestAnimationFrame(() => { sheet.classList.add('on'); (sheet.querySelector('.nf-sheet-close') as HTMLElement).focus(); });
  return { close };
}


export const reducedMotion = REDUCED;
