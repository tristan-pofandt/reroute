// The one source of timing and travel for every element transition: page routes, the side menu, Settings, sheets and the launch splash
// all read the constants and helpers here, so they share one feel (an ease-out quint on opacity, a short springy settle on position,
// a 30-40 ms stagger capped at CAP elements). Nothing in here touches WebGL: elements slide, fade and settle.
//
//   * variants (ITEM, LATE, PAGE) and `staggerProps(i)` are for React elements inside a native screen (framer-motion variants, propagated
//     from the page root with `staggerChildren`);
//   * `slide(elements, offset, opts)` is the same motion done imperatively, for legacy HTML (panic, nav, offline-area, menu rows ...);
//   * `useDirection()` / `getDirection()` say which way the current navigation travels: forward, back, up or down.
import { animate } from "framer-motion";
import { useSyncExternalStore } from "react";
import { reducedMotion } from "./reduced.js";
import { touch, track, untrack } from "./motion/fm.js";

// Dev/slow-motion builds only (vite dev, or VITE_SLOWMO=1 at build time): `window.__slowmo = 6` slows every transition six times so a
// frame can be captured mid-flight. Production builds replace the flag with `false` and drop the branch.
const SLOWMO = import.meta.env.DEV || import.meta.env.VITE_SLOWMO === "1";
export const slow = () => (SLOWMO ? Number(window.__slowmo) || 1 : 1);

export const EASE = [0.22, 1, 0.36, 1]; // ease-out quint: opacity and anything that must not overshoot
export const EASE_IN = [0.4, 0, 1, 1]; // leaving: accelerate away
export const STAGGER_IN = 0.035;
export const STAGGER_OUT = 0.03;
export const CAP = 10; // elements beyond this share the last element's delay and "fade with the group"
export const CAP_OUT = 7; // leaving is capped sooner so a long page still clears in about 300 ms
export const OUT_TIME = 0.14; // one element leaving
export const spring = (s = slow()) => ({ type: "spring", duration: 0.5 * s, bounce: 0.24 }); // slide-and-settle: a little overshoot, no wobble
export const watchdog = () => 600 * slow(); // an exit that has not reported in by now is force-completed

// The same spring as a pure function of scroll progress, for the scrubbed scroll reveals (motion/scroll3d.js): damping ratio 1 - bounce,
// settled by k = 1, with a hair of overshoot. settle(0) = 0, settle(1) = 1 exactly.
const Z = 0.76, W = 7.24, WD = W * Math.sqrt(1 - Z * Z);
const step = (t) => 1 - Math.exp(-Z * W * t) * (Math.cos(WD * t) + ((Z * W) / WD) * Math.sin(WD * t));
const STEP_END = step(1);
export const settle = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : step(k) + (1 - STEP_END) * k);

// ── Direction of travel ──────────────────────────────────────────────────────
let dir = "forward";
const subs = new Set();
export const getDirection = () => dir;
export const setDirection = (d) => { if (d && d !== dir) { dir = d; subs.forEach((f) => f()); } };
export const useDirection = () => useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), getDirection);

// Where an element is displaced to: forward content leaves left and arrives from the right, back is the reverse, up (sheet-like) leaves
// down and arrives from below, down leaves down and arrives from just above.
export function travel(d, phase) {
  const w = Math.round(Math.min(innerWidth, 520) * 0.6), h = 56;
  if (d === "forward") return { x: phase === "out" ? -w : w, y: 0 };
  if (d === "back") return { x: phase === "out" ? w : -w, y: 0 };
  if (d === "up") return { x: 0, y: h };
  return { x: 0, y: phase === "out" ? h : -h / 2 };
}
const rest = { opacity: 1, x: 0, y: 0 };
const off = (phase) => (reducedMotion() ? rest : { ...travel(dir, phase), opacity: 0 });

// ── Variants for React elements ──────────────────────────────────────────────
// Functions, so direction, reduced motion and slow motion are read when an animation starts, not when the module loads.
const enter = (delay = 0) => () => reducedMotion() ? { ...rest, transition: { duration: 0 } }
  : { ...rest, transition: { default: { ...spring(), delay }, opacity: { duration: 0.2 * slow(), ease: EASE, delay } } };
const leave = (delay = 0) => () => reducedMotion() ? { ...rest, transition: { duration: 0 } }
  : { ...off("out"), transition: { duration: OUT_TIME * slow(), ease: EASE_IN, delay } };
const hidden = () => ({ ...off("in"), transition: { duration: 0 } });

export const ITEM = { hidden, show: enter(), exit: leave() };
// Past a cap an element stops staggering: its delay is fixed at the last staggered element's, so a long page does not take longer.
// Entering caps at CAP elements, leaving at CAP_OUT, hence 3 sets: ITEM (both staggered), MID (leaves with the group) and LATE.
export const MID = { hidden, show: ITEM.show, exit: () => leave((CAP_OUT - 1) * STAGGER_OUT * slow())() };
export const LATE = { hidden, show: () => enter((CAP - 1) * STAGGER_IN * slow())(), exit: MID.exit };
// The page root carries no visuals of its own, only the stagger its children inherit.
export const PAGE = {
  hidden: {},
  show: () => ({ transition: { staggerChildren: STAGGER_IN * slow() } }),
  exit: () => ({ transition: { staggerChildren: STAGGER_OUT * slow() } }),
};
// `{...staggerProps(i)}` on any motion.* element inside a native screen makes it take part (i = its position, for the cap).
export const staggerProps = (i = 0) => ({ variants: i >= CAP ? LATE : i >= CAP_OUT ? MID : ITEM });

// ── The same motion for plain DOM elements (legacy HTML, menu rows, splash) ──────
// Position is the CSS individual `translate` property and fades use opacity, so it composes with the press / hover micro-interactions
// (which use `scale`) and never touches `transform` (scroll reveals and framer own that). Every write is registered with the motion
// layer, so turning Reduce motion on mid-flight stops it and restores the DOM.
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);

// slide(els, { x, y }, { out, delay, step, cap }) -> { stop(), finished: Promise }
//   in:  elements start displaced by the offset, invisible, and spring to rest (the first frame is written synchronously: no flash);
//   out: elements accelerate to the offset while fading.
export function slide(els, offset, { out = false, delay = 0, step = out ? STAGGER_OUT : STAGGER_IN, cap = CAP } = {}) {
  const list = [...els].filter(Boolean);
  if (!list.length || reducedMotion()) return { stop() {}, finished: Promise.resolve() };
  const s = slow();
  const put = (el, k, v) => {
    el.style.translate = k === 0 ? "" : `${(offset.x * k).toFixed(2)}px ${(offset.y * k).toFixed(2)}px`;
    el.style.opacity = out ? String(1 - clamp(v * 1.15)) : String(clamp(v * 1.6));
  };
  list.forEach((el) => { touch(el, "translate", "opacity"); if (!out) put(el, 1, 0); });
  const stopAt = [];
  const runs = list.map((el, i) => new Promise((resolve) => {
    const c = track(animate(0, 1, {
      ...(out ? { duration: OUT_TIME * s, ease: EASE_IN } : spring(s)),
      delay: delay * s + Math.min(i, cap - 1) * step * s,
      onUpdate: (v) => put(el, out ? v : 1 - v, v),
      onComplete: () => { untrack(c); if (!out) { el.style.removeProperty("translate"); el.style.removeProperty("opacity"); } resolve(); },
    }));
    stopAt.push(c);
  }));
  const gone = new Promise((r) => setTimeout(r, 1500 * s)); // an animation stopped from outside never resolves; do not wait for it
  return {
    stop() { stopAt.forEach((c) => { c.stop(); untrack(c); }); },
    finished: Promise.race([Promise.all(runs), gone]),
  };
}
