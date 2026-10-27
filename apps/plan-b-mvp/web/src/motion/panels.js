// Menus, settings and sheets (legacy `.menu-backdrop`, `.settings-backdrop`, `.sheet-backdrop`), busy-button loaders and the skeleton
// cross-fade. app.js still toggles the `open` class and slides the panel in CSS; this layer adds the liquid part on top:
//   * the panel is revealed through a rounded clip-path that opens from its leading edge (one paint-only clip per frame, 340 ms), so the
//     panel unfurls like a drop instead of sliding as a rigid slab; closing re-folds it in 200 ms;
//   * its rows rise in with a short stagger (opacity + translate only, capped at 8 rows);
//   * a soft haptic marks the morph (menus / settings) or a snap (sheets).
// The veil is deliberately not used here: it is the route-change transition (800 ms, full screen) and a drawer must not cover the screen.
import { animate, stagger } from "framer-motion";
import { snap, soft } from "../haptics.js";
import { track, touch, untrack } from "./fm.js";

const E = [0.22, 1, 0.36, 1];
const C = 15; // clip bleed (%): the clip ends slightly outside the panel so its drop shadow is never cut off
// [backdrop, panel, rows, row offset px [x, y], clipped side (inset index t,r,b,l), start % of that side hidden, corner radii at the start (px), haptic]
const PANELS = [
  [".menu-backdrop", ".menu-panel", ".menu-scroll > *", [-14, 0], 1, 82, [0, 56, 56, 0], soft],
  [".settings-backdrop", ".settings-panel", ".settings-scroll > *", [14, 0], 3, 82, [56, 0, 0, 56], soft],
  [".sheet-backdrop", ".sheet", ".sheet-scroll > *", [0, 10], 0, 34, [40, 40, 0, 0], snap],
];

const lerp = (a, b, t) => a + (b - a) * t;
function clip(panel, side, hide, radii, p) {
  const ins = [-C, -C, -C, -C];
  ins[side] = lerp(hide, -C, p);
  panel.style.clipPath = `inset(${ins.map((v) => `${v.toFixed(2)}%`).join(" ")} round ${radii.map((r) => `${lerp(r, 0, p).toFixed(1)}px`).join(" ")})`;
}

function morph(panel, side, hide, radii, from, to, duration) {
  touch(panel, "clip-path");
  clip(panel, side, hide, radii, from);
  const c = track(animate(from, to, {
    duration, ease: E,
    onUpdate: (p) => clip(panel, side, hide, radii, p),
    onComplete: () => { untrack(c); if (to === 1) panel.style.removeProperty("clip-path"); },
  }));
}

function panelChange(backdrop, opened) {
  const cfg = PANELS.find(([sel]) => backdrop.matches(sel));
  const panel = cfg && backdrop.querySelector(cfg[1]);
  if (!panel) return;
  const [, , rowSel, offset, side, hide, radii, haptic] = cfg;
  if (!opened) { if (backdrop.isConnected) morph(panel, side, hide, radii, 1, 0, 0.2); return; }
  morph(panel, side, hide, radii, 0, 1, 0.34);
  haptic();
  const rows = [...backdrop.querySelectorAll(rowSel)].slice(0, 8);
  if (!rows.length) return;
  rows.forEach((r) => { r.style.opacity = "0"; touch(r, "opacity", "translate"); });
  const c = track(animate(rows, { opacity: [0, 1], translate: [`${offset[0]}px ${offset[1]}px`, "0 0"] }, {
    duration: 0.2, ease: E, delay: stagger(0.025, { startDelay: 0.06 }),
    onComplete: () => { untrack(c); rows.forEach((r) => { r.style.removeProperty("opacity"); r.style.removeProperty("translate"); }); },
  }));
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

// When a skeleton is replaced by real content in the same container, the content cross-fades and rises in over 240 ms.
function crossFade(m, done) {
  const wasSkeleton = [...m.removedNodes].some((n) => n.nodeType === 1 && (n.matches(".skeleton, [role=status]") || n.querySelector?.(".skeleton")));
  if (!wasSkeleton) return;
  const added = [...m.addedNodes].filter((n) => n.nodeType === 1 && n.isConnected && !n.matches(".skeleton, .morph-loader") && !n.querySelector(".skeleton")).slice(0, 8);
  if (!added.length) return;
  added.forEach((n) => { n.style.opacity = "0"; touch(n, "opacity", "translate"); });
  const c = track(animate(added, { opacity: [0, 1], translate: ["0 6px", "0 0"] }, {
    duration: 0.24, ease: E, delay: stagger(0.03),
    onComplete: () => { untrack(c); added.forEach((n) => { n.style.removeProperty("opacity"); n.style.removeProperty("translate"); }); done(); },
  }));
}

// Called by MotionLayer with each MutationObserver batch on #viewport.
export function handleMutations(list, done) {
  for (const m of list) {
    if (m.type === "attributes") {
      const t = m.target, was = (m.oldValue || "").split(" ").includes("open"), now = t.classList.contains("open");
      if (was !== now && t.matches(".menu-backdrop, .settings-backdrop, .sheet-backdrop")) panelChange(t, now);
      if (t.matches("button.is-loading")) addLoader(t);
    } else {
      if (m.removedNodes.length) crossFade(m, done);
      m.addedNodes.forEach((n) => { if (n.nodeType === 1) (n.matches("button.is-loading") ? [n] : n.querySelectorAll("button.is-loading")).forEach(addLoader); });
    }
  }
}
