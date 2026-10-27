// Lenis smooth wheel scrolling for a page's own scroll area (the app scrolls inside `.scroll`, never the window), plus the scroll
// velocity the WebGL canvas and the 3D scroll motion react to. Touch keeps the browser's native momentum; velocity is measured from
// scroll events so it works for both. Legacy rerender() replaces the `.scroll` node, so the page re-binds on "reroute:rerender".
//
// Lenis is NOT given `autoRaf` (a rAF loop that never stops): a frame loop is started by a wheel event and runs only while Lenis is
// gliding, so there is no per-frame work at rest. Turning Reduce motion on destroys Lenis at once; turning it off brings it back.
import Lenis from "lenis";
import { pushVelocity } from "./fxBus.js";
import { onReducedChange, reducedMotion } from "./reduced.js";

export function attachSmoothScroll(page) {
  let scroller = null, lenis = null, last = 0, lastT = 0, offScroll = () => {}, offLenis = () => {};

  const stopLenis = () => { offLenis(); offLenis = () => {}; lenis?.destroy(); lenis = null; };
  const startLenis = () => {
    if (lenis || !scroller || reducedMotion()) return;
    const el = scroller;
    // allowNestedScroll: horizontal chip rows and map sheets inside the page keep their own scrolling.
    const l = (lenis = new Lenis({ wrapper: el, content: el, lerp: 0.1, smoothWheel: true, autoRaf: false, allowNestedScroll: true }));
    let raf = 0, kicked = 0;
    const loop = (t) => {
      raf = 0;
      if (document.hidden || lenis !== l) return;
      l.raf(t);
      if (l.isScrolling === "smooth" || performance.now() - kicked < 160) raf = requestAnimationFrame(loop);
    };
    const kick = () => { kicked = performance.now(); if (!raf && !document.hidden) raf = requestAnimationFrame(loop); };
    el.addEventListener("wheel", kick, { passive: true });
    document.addEventListener("visibilitychange", kick);
    offLenis = () => { cancelAnimationFrame(raf); el.removeEventListener("wheel", kick); document.removeEventListener("visibilitychange", kick); };
  };

  const unbind = () => { offScroll(); stopLenis(); scroller = null; };
  const bind = () => {
    const el = page.querySelector(".scroll");
    if (el === scroller) return;
    unbind();
    if (!el) return;
    scroller = el;
    last = el.scrollTop; lastT = performance.now();
    const onScroll = () => {
      const now = performance.now(), top = el.scrollTop;
      const dt = Math.max(1, now - lastT);
      pushVelocity(((top - last) / dt) * 16.7);
      last = top; lastT = now;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    offScroll = () => el.removeEventListener("scroll", onScroll);
    startLenis();
  };

  bind();
  const onRerender = (e) => { if (e.detail?.page === page) bind(); };
  document.addEventListener("reroute:rerender", onRerender);
  const offReduced = onReducedChange(() => (reducedMotion() ? stopLenis() : startLenis()));
  return () => { offReduced(); document.removeEventListener("reroute:rerender", onRerender); unbind(); };
}
