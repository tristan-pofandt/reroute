// Menus, settings and sheets (legacy `.menu-backdrop`, `.settings-backdrop`, `.sheet-backdrop`), busy-button loaders and the skeleton
// cross-fade. app.js still toggles the `open` class and the panel itself slides in CSS (220 ms); this layer adds the choreography on top,
// with the same spring, easing and stagger as the page transitions (choreography.js):
//   * opening: the lines inside the panel slide in one after another from the panel's own side (menu from the left, Settings from the
//     right, sheets from below) and settle with a little spring;
//   * closing: the panel eases out over DUR.panelOut (CSS, app.css --dur-close) while the lines slide back out top first, a 14 ms cascade
//     that is over just before the panel is; reopening mid-close eases the lines back from where they are (no restart);
//   * a soft haptic marks a menu / Settings opening, a snap a sheet.
// A panel that is being dragged shut is left alone: it is already moving under the finger.
import { animate } from "framer-motion";
import { CSS_EASE, DUR, IN_CURVE, LINE_OUT, STAGGER_CLOSE, STAGGER_IN, clamp, fx, slide, slow } from "../choreography.js";
import { snap, soft } from "../haptics.js";
import { track, untrack } from "./fm.js";

const lerp = (a, b, t) => a + (b - a) * t;
// [backdrop, panel, lines (slid one by one), offset the lines travel from, line cap, haptic]
const PANELS = [
  [".menu-backdrop", ".menu-panel", ".menu-head > *, .menu-scroll .section-header, .menu-scroll .row, .menu-scroll .fine", { x: -28, y: 0 }, 9, soft],
  [".settings-backdrop", ".settings-panel", ".settings-panel .navbar .side > *, .settings-scroll > *", { x: 28, y: 0 }, 7, soft],
  [".sheet-backdrop", ".sheet", ".sheet-head, .sheet-scroll > *", { x: 0, y: 24 }, 6, snap],
];
const live = new WeakMap(); // panel -> the running line animation and the pending panel release

function panelChange(backdrop, opened) {
  const cfg = PANELS.find(([sel]) => backdrop.matches(sel));
  const panel = cfg && backdrop.querySelector(cfg[1]);
  if (!panel) return;
  const [, , lineSel, offset, cap, haptic] = cfg;
  const was = live.get(panel);
  if (was) { was.run.stop(); clearTimeout(was.timer); was.release?.(); }
  const lines = [...backdrop.querySelectorAll(lineSel)];
  if (opened && was?.closing) { // interrupted close: the lines are part way out; ease them back from there instead of replaying the entrance
    const done = (el) => { el.style.removeProperty("translate"); el.style.removeProperty("opacity"); };
    live.set(panel, { run: fx(lines, [{ opacity: 1, translate: "0px 0px" }], { duration: DUR.fade * 1000 * slow(), easing: CSS_EASE, done }) });
    return;
  }
  if (opened) {
    haptic();
    live.set(panel, { run: slide(lines, offset, { delay: 0.04, cap }) });
    return;
  }
  if (!backdrop.isConnected || panel.classList.contains("dragging") || panel.style.transform) return;
  // The panel eases away (CSS, DUR.panelOut); the lines leave top-first with a short stagger and are gone just before it.
  live.set(panel, { closing: true, run: slide(lines, offset, { out: true, step: STAGGER_CLOSE, cap, time: LINE_OUT }) });
}

// Profile menu: grows out of the avatar (top right) diagonally down and left; the items stagger in, closing reverses quickly.
// Opacity + transform only (Web Animations, compositor thread); the CSS .open class is the resting look once the animation is cancelled.
let profile = null;
const lerp1 = (a, b, v) => a + (b - a) * v;
const POSE = (v) => `translate(${lerp1(12, 0, v).toFixed(2)}px,${lerp1(-12, 0, v).toFixed(2)}px) scale(${lerp1(0.9, 1, v).toFixed(4)})`;
const OPEN = IN_CURVE.map((v, i) => ({ offset: i / (IN_CURVE.length - 1), opacity: clamp(v * 1.6), transform: POSE(v) }));
const CLOSE = [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translate(6px,-6px) scale(0.95)" }];
function profileChange(menu, opened) {
  const mid = opened && profile?.closing; // reopened part way through a close: retarget from the current look (stop() keeps it), do not snap to closed first
  profile?.c.stop(); profile?.run.stop();
  const items = [...menu.querySelectorAll("button")];
  if (opened) soft();
  const s = slow() * 1000;
  const done = (el) => { el.style.removeProperty("opacity"); el.style.removeProperty("transform"); };
  const c = fx([menu], mid ? [{ opacity: 1, transform: "none" }] : opened ? OPEN : CLOSE,
    { duration: (mid || !opened ? DUR.menuOut : DUR.menu) * s, easing: opened && !mid ? "linear" : CSS_EASE, props: ["opacity", "transform"], done });
  const run = slide(opened ? items : items.reverse(), { x: 14, y: -10 }, { out: !opened, delay: opened ? 0.04 : 0, step: opened ? STAGGER_IN : STAGGER_CLOSE, cap: 5 });
  profile = { c, run, closing: !opened };
  c.finished?.then(() => { if (profile?.c === c) profile.closing = false; });
}

// Busy buttons get a loader drawn from the logo: the direct route bends into the detour and back, the app's idea in one line.
const STRAIGHT = [4, 28, 10, 22, 18, 14, 28, 4], DETOUR = [4, 28, 4, 16, 11, 6, 25, 6];
const path = (t) => { const n = STRAIGHT.map((v, i) => +lerp(v, DETOUR[i], t).toFixed(2)); return `M${n[0]} ${n[1]} C${n[2]} ${n[3]} ${n[4]} ${n[5]} ${n[6]} ${n[7]}`; };
function addLoader(button) {
  if (button.querySelector(".morph-loader")) return;
  button.insertAdjacentHTML("afterbegin", `<svg class="morph-loader" viewBox="0 0 32 32" aria-hidden="true"><path d="${path(0)}"/><circle cx="4" cy="28" r="3.5"/></svg>`);
  const svg = button.firstElementChild, p = svg.querySelector("path");
  const c = track(animate(0, 1, {
    duration: 0.5, ease: "easeInOut", repeat: Infinity, repeatType: "reverse",
    onUpdate: (t) => {
      if (!p.isConnected || !button.classList.contains("is-loading")) { c.stop(); untrack(c); svg.remove(); return; }
      p.setAttribute("d", path(t));
    },
  }));
}

// When a skeleton is replaced by real content in the same container, the content cross-fades and rises in (DUR.crossfade).
function crossFade(m, done) {
  const wasSkeleton = [...m.removedNodes].some((n) => n.nodeType === 1 && (n.matches(".skeleton, [role=status]") || n.querySelector?.(".skeleton")));
  if (!wasSkeleton) return;
  const added = [...m.addedNodes].filter((n) => n.nodeType === 1 && n.isConnected && !n.matches(".skeleton, .morph-loader") && !n.querySelector(".skeleton")).slice(0, 8);
  if (!added.length) return;
  added.forEach((n) => { n.style.opacity = "0"; });
  const c = fx(added, [{ opacity: 0, translate: "0 6px" }, { opacity: 1, translate: "0 0" }], {
    duration: DUR.crossfade * 1000, easing: CSS_EASE, step: STAGGER_IN * 1000,
    done: (n) => { n.style.removeProperty("opacity"); n.style.removeProperty("translate"); },
  });
  c.finished.then(done);
}

// Called by MotionLayer with each MutationObserver batch on #viewport.
export function handleMutations(list, done) {
  for (const m of list) {
    if (m.type === "attributes") {
      const t = m.target, was = (m.oldValue || "").split(" ").includes("open"), now = t.classList.contains("open");
      if (was !== now && t.matches(".menu-backdrop, .settings-backdrop, .sheet-backdrop")) panelChange(t, now);
      if (was !== now && t.matches(".profile-menu")) profileChange(t, now);
      if (t.matches("button.is-loading")) addLoader(t);
    } else {
      if (m.removedNodes.length) crossFade(m, done);
      m.addedNodes.forEach((n) => { if (n.nodeType === 1) (n.matches("button.is-loading") ? [n] : n.querySelectorAll("button.is-loading")).forEach(addLoader); });
    }
  }
}
