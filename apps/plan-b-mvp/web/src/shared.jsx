// Shared-element morph for legacy-HTML screens. A real element cannot carry a layoutId when it lives inside dangerouslySetInnerHTML, so the
// shell flies a ghost between the two screens: a clone of the outgoing element and a clone of the incoming one, each in its own look,
// are FLIPped with transform + opacity only (no layout per frame) and cross-fade, so differences in size, radius, colour and type between
// the two elements read as one object morphing instead of one being stretched. Native screens do not need this: give their own motion
// elements the same layoutId inside the router's LayoutGroup, and add `data-no-ghost` to the element so the shell skips it.
//
// Robustness: a new navigation finishes any morph still in flight (the real element is un-hidden at once); a snapshot is only used by the
// screen change it was taken for (stale ones expire after 1.5 s, and a double tap on the same screen leaves the running morph alone); the
// morph is abandoned if the target or the ghost host disappears, and a watchdog removes the ghosts after 1.2 s whatever happens.
import { useLayoutEffect, useRef } from "react";
import { animate } from "framer-motion";
import { reducedMotion } from "./reduced.js";

const SHARED = { impact: [".impact-btn", ".kpi.lead"] }; // home Impact button <-> dashboard lead figure
const LOOK = ["backgroundColor", "backgroundImage", "color", "borderRadius", "boxShadow", "borderTopWidth", "borderTopStyle", "borderTopColor", "padding", "fontSize", "fontWeight", "letterSpacing", "lineHeight", "textAlign", "display", "justifyContent", "alignItems", "flexDirection", "gap", "overflow"];
let snapshot = null; // { id, from, rect, node, look, at }
let active = null; // the morph in flight: { screen, id, stop(), now() -> { rect, node, look } }

const find = (page, id) => SHARED[id].map((sel) => page.querySelector(sel)).find((el) => el && !el.closest("[data-no-ghost]"));
const box = (r) => ({ left: r.left, top: r.top, width: r.width, height: r.height });
const look = (el) => { const cs = getComputedStyle(el), o = {}; for (const k of LOOK) o[k] = cs[k]; return o; };
const onscreen = (r) => r.width > 2 && r.height > 2 && r.top + r.height > 0 && r.top < innerHeight && r.left + r.width > 0 && r.left < innerWidth;
const clean = (el) => { const n = el.cloneNode(true); [n, ...n.querySelectorAll("*")].forEach((e) => { e.removeAttribute("id"); e.removeAttribute("data-action"); e.removeAttribute("name"); e.setAttribute("tabindex", "-1"); e.style.removeProperty("visibility"); }); n.removeAttribute("disabled"); return n; };

// Called just before the old page is swapped out.
export function captureShared() {
  snapshot = null;
  if (reducedMotion()) return;
  if (active) { snapshot = { ...active.now(), id: active.id, from: active.screen, at: performance.now() }; return; } // double tap mid-flight
  const page = document.querySelector("#viewport > .page:not([inert])");
  if (!page) return;
  for (const id of Object.keys(SHARED)) {
    const el = find(page, id);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (onscreen(r)) snapshot = { id, from: page.dataset.screen, rect: box(r), node: clean(el), look: look(el), at: performance.now() };
    return;
  }
}

function ghost(node, rect, lk) {
  const g = node.cloneNode(true);
  Object.assign(g.style, lk, { position: "fixed", margin: "0", boxSizing: "border-box", left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`, transformOrigin: "0 0", pointerEvents: "none", willChange: "transform, opacity", animation: "none", transition: "none", transform: "none", opacity: "1", translate: "none", scale: "none" });
  return g;
}

const smooth = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };

function stopActive() { active?.stop(); }

function run(host, screen) {
  const snap = snapshot;
  snapshot = null;
  stopActive();
  if (!snap || snap.from === screen || performance.now() - snap.at > 1500 || reducedMotion()) return;
  const page = document.querySelector(`#viewport > .page[data-screen="${screen}"]:not([inert])`);
  let target = page && find(page, snap.id);
  if (!target || !host?.isConnected) return;
  // The incoming page is still sliding in, so take the target's position relative to its page and add the viewport's origin.
  const p = page.getBoundingClientRect(), t = target.getBoundingClientRect(), v = page.parentElement.getBoundingClientRect();
  const to = { left: v.left + (t.left - p.left), top: v.top + (t.top - p.top), width: t.width, height: t.height };
  if (!onscreen(to)) return;
  const lookB = look(target), A = ghost(snap.node, snap.rect, snap.look), B = ghost(clean(target), to, lookB);
  const from = snap.rect;
  const sx = to.width / from.width, sy = to.height / from.height, dx = to.left - from.left, dy = to.top - from.top;
  host.append(A, B);
  target.style.visibility = "hidden";
  let done = false, c = null, watchdog = 0, cur = { rect: from, node: A, look: snap.look };
  const finish = () => {
    if (done) return;
    done = true;
    c?.stop(); clearTimeout(watchdog);
    A.remove(); B.remove();
    target.style.removeProperty("visibility");
    if (active === me) active = null;
  };
  const me = { screen, id: snap.id, stop: finish, now: () => cur };
  active = me;
  const frame = (k) => {
    if (!host.isConnected || !page.isConnected) return finish();
    // A screen that re-renders (legacy rerender) swaps its elements: follow the new one, or give up if it is gone.
    if (!target.isConnected) {
      const next = find(page, snap.id);
      if (!next) return finish();
      target = next;
      target.style.visibility = "hidden";
    }
    // A travels from its own box to the target box; B starts as the target box shrunk onto A's box and settles at identity.
    A.style.transform = `translate(${dx * k}px, ${dy * k}px) scale(${1 + (sx - 1) * k}, ${1 + (sy - 1) * k})`;
    const r = 1 - k;
    B.style.transform = `translate(${-dx * r}px, ${-dy * r}px) scale(${1 + (1 / sx - 1) * r}, ${1 + (1 / sy - 1) * r})`;
    A.style.opacity = String(1 - smooth((k - 0.15) / 0.5));
    B.style.opacity = String(smooth((k - 0.3) / 0.5));
    cur = { rect: { left: from.left + dx * k, top: from.top + dy * k, width: from.width + (to.width - from.width) * k, height: from.height + (to.height - from.height) * k }, node: k > 0.5 ? B : A, look: k > 0.5 ? lookB : snap.look };
  };
  frame(0);
  watchdog = setTimeout(finish, 1200);
  c = animate(0, 1, { duration: 0.55, ease: [0.72, 0, 0.28, 1], onUpdate: frame, onComplete: finish });
}

export function SharedGhost({ screen }) {
  const host = useRef(null);
  const prev = useRef(screen);
  useLayoutEffect(() => {
    if (prev.current === screen) return;
    prev.current = screen;
    run(host.current, screen);
  }, [screen]);
  useLayoutEffect(() => stopActive, []);
  return <div ref={host} aria-hidden="true" style={{ position: "fixed", inset: 0, zIndex: 59, pointerEvents: "none", overflow: "hidden" }} />;
}
