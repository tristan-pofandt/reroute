// Scroll-bound motion for every scroll area (`.scroll`, `.sheet-scroll`), legacy or native.
//   * blocks below the fold slide in from alternating sides and settle with the same springy curve as the page / menu choreography
//     (choreography.js `settle`), scrubbed by scroll progress, so they reverse when you scroll back; the last block always seats because
//     the scrub range is clamped to the scrollable distance;
//   * a card seating gives a `thud` haptic;
//   * visible blocks tilt (rotateX) with the Lenis / native scroll velocity and ease flat when scrolling stops;
//   * chart bars grow from their baseline, the hero / lead figure drifts up and dims (parallax), KPI figures count up once.
// (Blocks already on screen when a page is born are not touched here: the page choreography staggers them in.)
// Cost model: layout is read only when something is registered or the viewport resizes (batched, one reflow); a scroll event reads one
// scrollTop; every frame after that only writes inline `transform` / `opacity` / `translate`. A frame is only scheduled while scrolling or
// while the tilt is easing back, so nothing runs at rest.
import { animate } from "framer-motion";
import { scrollVelocity } from "./velocity.js";
import { settle } from "../choreography.js";
import { thud } from "../haptics.js";
import { NOT_BLOCK, REVEAL } from "./selectors.js";
import { prune, touch, track, untrack } from "./fm.js";

const ALL = `${REVEAL}, .scroll .kpi.lead, .scroll .hero-art, .scroll .kpi b`;
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);

let scrollers = new Map(), known = new WeakSet(), io = null, side = 1, lastThud = 0, queued = false;

const state = (sc) => {
  let S = scrollers.get(sc);
  if (!S) scrollers.set(sc, (S = { el: sc, list: [], s: sc.scrollTop, H: 1, max: 0, tilt: 0 }));
  return S;
};

function request() {
  if (queued || document.hidden) return;
  queued = true;
  requestAnimationFrame(flush);
}

// ── Registration ────────────────────────────────────────────────────────────
export function sweep(root) {
  prune();
  const fresh = [];
  for (const el of root.querySelectorAll(ALL)) {
    if (known.has(el) || el.closest("[data-fm-off]")) continue;
    known.add(el);
    fresh.push(el);
  }
  for (const [sc, S] of scrollers) { if (!sc.isConnected) scrollers.delete(sc); else S.list = S.list.filter((it) => it.el.isConnected); }
  if (fresh.length) measure(fresh);
}

function measure(fresh) {
  // Read phase (a single reflow): rects, then classification. New elements carry no transform yet, so their rects are true layout.
  const rects = new Map();
  const rect = (sc) => { if (!rects.has(sc)) rects.set(sc, sc.getBoundingClientRect()); return rects.get(sc); };
  const touched = new Set(), writes = []; // writes wait until every rect is read, so the loop never thrashes layout
  for (const el of fresh) {
    if (el.matches(".kpi b")) { io.observe(el); continue; }
    const sc = el.closest(".scroll, .sheet-scroll");
    if (!sc) continue;
    const S = state(sc), r = el.getBoundingClientRect();
    S.H = sc.clientHeight; S.max = Math.max(0, sc.scrollHeight - S.H); S.s = sc.scrollTop;
    const top = r.top - rect(sc).top + S.s, h = r.height, below = top - S.s >= S.H;
    touched.add(S);
    if (el.matches(".kpi.lead, .hero-art")) { S.list.push({ kind: "depth", el, top, h, s0: top - 80, s1: top + h, sig: "" }); continue; }
    if (el.matches(".chart-card")) {
      const bars = [...el.querySelectorAll(".bar")];
      if (bars.length && top - S.s >= S.H * 0.9) S.list.push({ kind: "bars", el, bars, top, h, s0: top - S.H * 0.9, s1: Math.min(top + h / 2 - S.H * 0.6, S.max), sig: "" });
    }
    if (!el.matches(REVEAL) || el.matches(NOT_BLOCK) || h < 40) continue;
    writes.push(() => { el.dataset.fm = "1"; }); // lets motion.css switch off CSS entrances / transitions that would fight the per-frame writes
    touch(el, "data-fm");
    side = -side;
    const it = { kind: "block", el, top, h, scrub: below, sig: "", clean: true, seated: !below, card: el.matches(".card, .ride-card, .tile-card, .sync-card, .wx, .chart-card, .empty-card"), sgn: side };
    if (below) {
      it.s1 = Math.min(top - S.H * 0.7, S.max);
      it.s0 = Math.min(top - S.H * 0.98, it.s1 - 40);
      touch(el, "transform", "opacity");
    }
    S.list.push(it);
  }
  writes.forEach((w) => w());
  touched.forEach((S) => S.list.sort((a, b) => a.top - b.top));
  queued = false;
  flush(); // synchronously, so blocks that start hidden are never painted in their resting state for a frame
}

// Re-measure after a resize: clear what we wrote, read once, write again on the next flush.
function remeasure() {
  const lists = [...scrollers.values()];
  for (const S of lists) for (const it of S.list) if (it.kind === "block") { it.el.style.removeProperty("transform"); it.el.style.removeProperty("opacity"); }
  for (const S of lists) {
    if (!S.el.isConnected) continue;
    const sr = S.el.getBoundingClientRect();
    S.H = S.el.clientHeight; S.max = Math.max(0, S.el.scrollHeight - S.H); S.s = S.el.scrollTop;
    for (const it of S.list) {
      if (!it.el.isConnected) continue;
      const r = it.el.getBoundingClientRect();
      it.top = r.top - sr.top + S.s; it.h = r.height; it.sig = ""; it.clean = false;
      if (it.kind === "block" && it.scrub) { it.s1 = Math.min(it.top - S.H * 0.7, S.max); it.s0 = Math.min(it.top - S.H * 0.98, it.s1 - 40); }
      if (it.kind === "depth") { it.s0 = it.top - 80; it.s1 = it.top + it.h; }
      if (it.kind === "bars") { it.s0 = it.top - S.H * 0.9; it.s1 = Math.min(it.top + it.h / 2 - S.H * 0.6, S.max); }
    }
  }
  request();
}

// ── Per-frame write phase ───────────────────────────────────────────────────
function flush() {
  queued = false;
  if (document.hidden) return;
  const target = clamp(-scrollVelocity.get() * 0.24, -7, 7); // px/frame -> degrees; flicking up leans the blocks back
  let busy = false;
  for (const S of scrollers.values()) {
    if (!S.el.isConnected) continue;
    S.tilt += (target - S.tilt) * 0.3;
    if (Math.abs(S.tilt) < 0.03 && Math.abs(target) < 0.03) S.tilt = 0;
    else busy = true;
    const s = S.s;
    for (const it of S.list) {
      const el = it.el;
      if (!el.isConnected) continue;
      if (it.kind === "block") {
        const k = it.scrub ? clamp((s - it.s0) / (it.s1 - it.s0)) : 1;
        const q = settle(k), top = it.top - s, vis = top < S.H + 40 && top + it.h > -40;
        const rx = vis ? S.tilt : 0;
        if (it.scrub) {
          if (!it.seated && k >= 1) { it.seated = true; if (it.card && performance.now() - lastThud > 140) { lastThud = performance.now(); thud(); } }
          else if (k < 0.9) it.seated = false;
        }
        const sig = `${q.toFixed(3)}|${rx.toFixed(2)}`, seatedNow = Math.abs(q - 1) < 0.002;
        if (sig === it.sig && seatedNow) continue; // off the rest position it is rewritten every flush: framer or CSS may have overwritten the inline style
        it.sig = sig;
        if (seatedNow && Math.abs(rx) < 0.05) {
          if (!it.clean) { el.style.removeProperty("transform"); el.style.removeProperty("opacity"); it.clean = true; }
          continue;
        }
        it.clean = false;
        touch(el, "transform", "opacity");
        const f = 1 - q;
        el.style.transform = `perspective(900px) translate3d(${(64 * it.sgn * f).toFixed(2)}px,${(24 * f).toFixed(2)}px,0) rotateX(${rx.toFixed(2)}deg)`;
        el.style.opacity = seatedNow ? "" : clamp(q * 1.5).toFixed(3);
      } else if (it.kind === "bars") {
        const p = clamp((s - it.s0) / (it.s1 - it.s0)), n = it.bars.length, sig = p.toFixed(3);
        if (sig === it.sig) continue;
        it.sig = sig;
        it.bars.forEach((b, i) => {
          const bp = clamp((p - (i * 0.4) / n) / 0.6);
          touch(b, "transform");
          if (bp >= 0.999) b.style.removeProperty("transform"); else b.style.transform = `scaleY(${bp.toFixed(3)})`;
        });
      } else {
        const p = clamp((s - it.s0) / (it.s1 - it.s0)), sig = p.toFixed(3);
        if (sig === it.sig) continue;
        it.sig = sig;
        touch(el, "translate", "opacity");
        if (p < 0.001) { el.style.removeProperty("translate"); el.style.removeProperty("opacity"); }
        else { el.style.translate = `0 ${(-24 * p).toFixed(2)}px`; el.style.opacity = (1 - 0.4 * p).toFixed(3); }
      }
    }
  }
  if (busy) request();
}

function countUp(el) {
  const node = el.firstChild, text = node?.nodeValue;
  const m = el.childNodes.length === 1 && node.nodeType === 3 ? text.match(/\d[\d,]*(\.\d+)?/) : null;
  const end = m ? parseFloat(m[0].replace(/,/g, "")) : 0;
  if (!(end > 0)) return;
  const dp = m[1] ? m[1].length - 1 : 0, commas = m[0].includes(",");
  const fmt = (v) => (commas ? v.toLocaleString("en-AU", { minimumFractionDigits: dp, maximumFractionDigits: dp }) : v.toFixed(dp));
  // characterData writes on a text node: the layer's own MutationObserver (childList / class) is not woken per frame.
  const c = track(animate(0, end, {
    duration: 0.8, ease: "easeOut",
    onUpdate: (v) => { if (node.isConnected) node.nodeValue = text.replace(m[0], fmt(v)); },
    onComplete: () => { untrack(c); if (node.isConnected) node.nodeValue = text; },
  }));
  const stop = c.stop.bind(c);
  c.stop = () => { stop(); if (node.isConnected) node.nodeValue = text; };
}

// ── Lifecycle ───────────────────────────────────────────────────────────────
export function installScroll3d(viewport) {
  scrollers = new Map(); known = new WeakSet(); side = 1; lastThud = 0; queued = false;
  io = new IntersectionObserver((list) => list.forEach((en) => { if (en.isIntersecting) { io.unobserve(en.target); countUp(en.target); } }), { threshold: 0.3 });
  const onScroll = (e) => { const S = scrollers.get(e.target); if (S) { S.s = e.target.scrollTop; request(); } };
  document.addEventListener("scroll", onScroll, { capture: true, passive: true });
  const off = scrollVelocity.on("change", request);
  let first = true, timer = 0;
  const ro = new ResizeObserver(() => { if (first) { first = false; return; } clearTimeout(timer); timer = setTimeout(remeasure, 120); });
  ro.observe(viewport);
  const onVisible = () => { if (!document.hidden) request(); };
  document.addEventListener("visibilitychange", onVisible);
  sweep(viewport);
  return () => {
    document.removeEventListener("scroll", onScroll, { capture: true });
    document.removeEventListener("visibilitychange", onVisible);
    off(); ro.disconnect(); clearTimeout(timer); io.disconnect();
    scrollers.clear();
  };
}

// Content shifted without a DOM add (a skeleton cross-fade finished): rewrite every block's state on the next frame.
export const invalidate = () => { scrollers.forEach((S) => S.list.forEach((it) => { it.sig = ""; })); request(); };
