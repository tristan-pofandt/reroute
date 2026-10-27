// Shared bookkeeping for the motion layer: every running animation and every inline style the layer writes is registered here, so
// turning Reduce motion on mid-session (or unmounting the layer) can stop the lot and leave the DOM exactly as it found it.
import { animate } from "framer-motion";

const running = new Set();
const written = new Map(); // element -> Set of inline properties the layer owns
export const track = (c) => (running.add(c), c);
export const untrack = (c) => running.delete(c);
export const touch = (el, ...props) => { let s = written.get(el); if (!s) written.set(el, (s = new Set())); props.forEach((p) => s.add(p)); };
export const prune = () => written.forEach((_, el) => { if (!el.isConnected) written.delete(el); });
export function resetAll() {
  running.forEach((c) => c.stop());
  running.clear();
  written.forEach((props, el) => props.forEach((p) => (p.startsWith("data-") ? el.removeAttribute(p) : el.style.removeProperty(p))));
  written.clear();
  driven = new WeakMap();
}

// Press, hover and focus drive the CSS individual `scale` / `translate` properties, never `transform`, so they compose with the
// 3D scroll transform and with framer-motion's own transforms on native screens instead of fighting them.
const REST = { scale: 1, translate: 0 };
const FMT = { scale: (v) => String(v), translate: (v) => `0 ${v}px` };
let driven = new WeakMap();
export function drive(el, prop, to, { from, ...opts } = {}) {
  let s = driven.get(el);
  if (!s) driven.set(el, (s = {}));
  const p = (s[prop] ||= { v: REST[prop], c: null });
  if (p.c) { p.c.stop(); untrack(p.c); }
  if (from != null) p.v = from;
  touch(el, prop);
  const c = (p.c = track(animate(p.v, to, {
    ...opts,
    onUpdate: (v) => { p.v = v; el.style[prop] = FMT[prop](v); },
    onComplete: () => { untrack(c); p.c = null; p.v = to; if (to === REST[prop]) el.style.removeProperty(prop); },
  })));
}
