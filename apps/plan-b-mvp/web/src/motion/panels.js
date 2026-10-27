// Menus, settings and sheets (legacy `.menu-backdrop`, `.settings-backdrop`, `.sheet-backdrop`), busy-button loaders and the skeleton
// cross-fade. app.js still toggles the `open` class and the panel itself slides in CSS (220 ms); this layer adds the choreography on top,
// with the same spring, easing and stagger as the page transitions (choreography.js):
//   * opening: the lines inside the panel slide in one after another from the panel's own side (menu from the left, Settings from the
//     right, sheets from below) and settle with a little spring;
//   * closing: the lines slide back out first, in reverse order, and only then does the panel go (the panel is held in place for that
//     moment, so the lines are seen leaving);
//   * a soft haptic marks a menu / Settings opening, a snap a sheet.
// A panel that is being dragged shut is left alone: it is already moving under the finger.
import { animate, stagger } from "framer-motion";
import { slide, slow } from "../choreography.js";
import { snap, soft } from "../haptics.js";
import { track, touch, untrack } from "./fm.js";

const E = [0.22, 1, 0.36, 1];
const lerp = (a, b, t) => a + (b - a) * t;
// [backdrop, panel, lines (slid one by one), offset the lines travel from, line cap, haptic]
const PANELS = [
  [".menu-backdrop", ".menu-panel", ".menu-head > *, .menu-scroll .section-header, .menu-scroll .row, .menu-scroll .fine", { x: -28, y: 0 }, 14, soft],
  [".settings-backdrop", ".settings-panel", ".settings-panel .navbar .side > *, .settings-scroll > *", { x: 28, y: 0 }, 10, soft],
  [".sheet-backdrop", ".sheet", ".sheet-head, .sheet-scroll > *", { x: 0, y: 24 }, 8, snap],
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
  if (opened) {
    haptic();
    live.set(panel, { run: slide(lines, offset, { delay: 0.05, cap }) });
    return;
  }
  if (!backdrop.isConnected || panel.classList.contains("dragging") || panel.style.transform) return;
  // Hold the panel where it is (the class change has not been styled yet), slide the lines out bottom-first, then let the panel go.
  touch(panel, "transition", "transform");
  panel.style.transition = "none";
  panel.style.transform = "none";
  const release = () => { panel.style.removeProperty("transition"); panel.style.removeProperty("transform"); };
  const run = slide(lines.reverse(), offset, { out: true, step: 0.008, cap });
  const timer = setTimeout(() => { release(); live.set(panel, { run }); }, 170 * slow());
  live.set(panel, { run, timer, release });
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
