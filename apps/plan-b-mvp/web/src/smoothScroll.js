// Lenis smooth wheel scrolling for a page's own scroll area (the app scrolls inside `.scroll`, never the window), plus the scroll
// velocity the WebGL canvas reacts to. Touch keeps the browser's native momentum; velocity is measured from scroll events so it
// works for both. Legacy rerender() replaces the `.scroll` node, so the page re-binds on the "reroute:rerender" event.
import Lenis from "lenis";
import { pushVelocity } from "./fxBus.js";
import { reducedMotion } from "./reduced.js";

export function attachSmoothScroll(page) {
  let scroller = null, lenis = null, last = 0, lastT = 0, off = () => {};

  const unbind = () => { off(); lenis?.destroy(); lenis = null; scroller = null; };
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
    off = () => el.removeEventListener("scroll", onScroll);
    if (!reducedMotion()) {
      // allowNestedScroll: horizontal chip rows and map sheets inside the page keep their own scrolling.
      lenis = new Lenis({ wrapper: el, content: el, lerp: 0.1, smoothWheel: true, autoRaf: true, allowNestedScroll: true });
    }
  };

  bind();
  const onRerender = (e) => { if (e.detail?.page === page) bind(); };
  document.addEventListener("reroute:rerender", onRerender);
  return () => { document.removeEventListener("reroute:rerender", onRerender); unbind(); };
}
