// Shared-element morph for legacy-HTML screens. A real element cannot carry a layoutId when it lives inside dangerouslySetInnerHTML, so a
// fixed "ghost" <motion.div layoutId> stands in: it is born over the old element, then re-born over the new one and framer-motion's
// layout projection flies it across. Native screens do not need this: give their own motion elements the same layoutId inside the router's LayoutGroup.
import { useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { reducedMotion } from "./reduced.js";

const SHARED = { impact: [".impact-btn", ".kpi.lead"] }; // home Impact button <-> dashboard lead figure
let snapshot = null;

const box = (r) => ({ left: r.left, top: r.top, width: r.width, height: r.height });
const find = (page, id) => SHARED[id].map((sel) => page.querySelector(sel)).find(Boolean);

// Called just before the old page is swapped out.
export function captureShared() {
  snapshot = null;
  if (reducedMotion()) return;
  const page = document.querySelector("#viewport > .page:not([inert])");
  if (!page) return;
  for (const id of Object.keys(SHARED)) {
    const el = find(page, id);
    if (el) { snapshot = { id, rect: box(el.getBoundingClientRect()), cls: el.className, html: el.innerHTML }; return; }
  }
}

const Ghost = ({ id, rect, cls, html }) => (
  <motion.div layoutId={id} className={cls} style={{ position: "fixed", margin: 0, zIndex: 59, pointerEvents: "none", ...rect }}
    transition={{ duration: 0.55, ease: [0.72, 0, 0.28, 1] }} dangerouslySetInnerHTML={{ __html: html }} aria-hidden="true" />
);

export function SharedGhost({ screen }) {
  const [ghost, setGhost] = useState(null);
  const prev = useRef(screen);

  useLayoutEffect(() => {
    if (prev.current === screen) return;
    prev.current = screen;
    const snap = snapshot; snapshot = null;
    const page = snap && document.querySelector(`#viewport > .page[data-screen="${screen}"]`);
    const target = page && find(page, snap.id);
    if (!target) return;
    // The incoming page is still sliding in, so take the target's position relative to its page and add the viewport's origin.
    const p = page.getBoundingClientRect(), t = target.getBoundingClientRect(), v = page.parentElement.getBoundingClientRect();
    const to = { left: v.left + (t.left - p.left), top: v.top + (t.top - p.top), width: t.width, height: t.height };
    target.style.opacity = "0";
    setGhost({ stage: 0, ...snap });
    let raf2;
    const raf1 = requestAnimationFrame(() => { raf2 = requestAnimationFrame(() => setGhost({ stage: 1, id: snap.id, rect: to, cls: target.className, html: target.innerHTML })); });
    const done = setTimeout(() => { target.style.opacity = ""; setGhost(null); }, 900);
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); clearTimeout(done); target.style.opacity = ""; };
  }, [screen]);

  return ghost ? <Ghost key={ghost.stage} {...ghost} /> : null;
}
