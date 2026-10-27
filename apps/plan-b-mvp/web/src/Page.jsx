// One routed screen: a `.page` <section> (the element the legacy code calls currentPage) with direction-aware enter/exit variants.
// Legacy screens fill it with HTML from RerouteLegacy.SCREENS[name](); native screens (screens/*.screen.jsx) render React children.
import { forwardRef, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion, useIsPresent } from "framer-motion";
import { bridge } from "./bridge.js";
import { screens } from "./screens/index.js";
import { attachSmoothScroll } from "./smoothScroll.js";
import { useReducedMotion } from "./reduced.js";
import { thud } from "./haptics.js";

const PUSH = [0.72, 0, 0.28, 1];
const OUT = [0.23, 1, 0.32, 1];
// Mirrors the CSS push transitions in app.css (in-forward, out-back, in-up, out-down ...), retimed so the swap lands under the veil.
// z-index: the page that moves over the other one is on top (the incoming one going forward/up, the outgoing one going back/down).
export const variants = {
  initial: (d) => ({
    x: d === "forward" ? "100%" : d === "back" || d === "down" ? "-24%" : "0%",
    y: d === "up" ? "100%" : "0%",
    opacity: d === "back" || d === "down" ? 0.5 : d === "up" ? 0.6 : 1,
    zIndex: d === "forward" ? 2 : d === "up" ? 3 : 1,
  }),
  enter: { x: "0%", y: "0%", opacity: 1, zIndex: 1 },
  exit: (d) => ({
    x: d === "forward" || d === "up" ? "-24%" : d === "back" ? "100%" : "0%",
    y: d === "down" ? "100%" : "0%",
    opacity: d === "forward" || d === "up" ? 0.5 : 1,
    zIndex: d === "back" ? 2 : d === "down" ? 3 : 1,
  }),
};

export const pageClass = (name) => `page${name === "panic" || name === "nav" ? ` ${name}` : ""}`;

export const Page = forwardRef(function Page({ name, custom, first }, ref) {
  const reduced = useReducedMotion();
  const Native = screens[name];
  // Only the very first page of the session mounts without animating (and without a "settled" callback).
  const [isFirst] = useState(() => { const f = first.current; first.current = false; return f; });
  const local = useRef(null);
  const isPresent = useIsPresent();
  const setRef = useCallback((el) => {
    local.current = el;
    if (typeof ref === "function") ref(el); else if (ref) ref.current = el;
  }, [ref]);

  useLayoutEffect(() => {
    const el = local.current;
    if (!isPresent) { el.inert = true; return; }
    bridge.legacy?.pageMounted(el, name);
    return attachSmoothScroll(el);
  }, [isPresent, name]);

  const v = useMemo(() => ({
    initial: variants.initial,
    enter: (d) => ({ ...variants.enter, transition: reduced ? { duration: 0 } : { duration: 0.46, delay: 0.2, ease: d === "up" ? OUT : PUSH } }),
    exit: (d) => ({ ...variants.exit(d), transition: reduced ? { duration: 0 } : { duration: 0.3, ease: PUSH } }),
  }), [reduced]);

  const common = {
    ref: setRef,
    className: pageClass(name),
    "data-screen": name,
    variants: v,
    custom,
    initial: isFirst ? false : "initial",
    animate: "enter",
    exit: "exit",
    onAnimationComplete: (def) => {
      if (def !== "enter" || isFirst) return;
      thud();
      bridge.legacy?.pageSettled();
    },
  };
  return Native
    ? <motion.section {...common}><Native /></motion.section>
    : <LegacyScreen name={name} {...common} />;
});

// A legacy screen: the HTML from RerouteLegacy.SCREENS[name]() inside a .page section. It is built once, from the state at the moment
// the page mounts; legacy rerender() then rewrites the element's innerHTML itself (React never re-applies it while the string is unchanged).
export const LegacyScreen = forwardRef(function LegacyScreen({ name, ...motionProps }, ref) {
  const html = useMemo(() => window.RerouteLegacy.SCREENS[name](), [name]);
  return <motion.section ref={ref} dangerouslySetInnerHTML={{ __html: html }} {...motionProps} />;
});
