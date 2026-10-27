// One routed screen: a `.page` <section> (the element the legacy code calls currentPage). The router runs AnimatePresence in "wait" mode, so
// a navigation is two beats: this page's elements stagger OUT in the direction of travel and, only once that has finished, the next page
// mounts and its elements stagger IN and settle (choreography.js).
//   * Native screens (screens/*.screen.jsx) render their elements as framer-motion Items; the root below only carries the stagger, the
//     elements inherit its `hidden` / `show` / `exit` labels as variants.
//   * Legacy screens (HTML from RerouteLegacy.SCREENS[name]()) animate their direct children imperatively with the same motion.
// `usePresence` hands over the exit: the page stays mounted until its elements have left (or the watchdog fires), so a stuck exit can
// never freeze the app. Reduced motion = instant swap (the variants and `slide` become no-ops).
import { forwardRef, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion, usePresence } from "framer-motion";
import { bridge } from "./bridge.js";
import { PAGE, getDirection, slide, slow, travel, watchdog } from "./choreography.js";
import { snap, tick } from "./haptics.js";
import { launched } from "./motion/launch.js";
import { screens } from "./screens/index.js";
import { attachSmoothScroll } from "./smoothScroll.js";
import { useReducedMotion } from "./reduced.js";

export const pageClass = (name) => `page${name === "panic" || name === "nav" ? ` ${name}` : ""}`;

// The elements of a legacy page that take part: the direct children of its header and of `.scroll`, plus the loose blocks the map screens
// are made of (maps themselves stay put). Position is the CSS `translate` property, so it composes with those blocks' own transforms.
const TARGETS = ":scope > header > *, :scope > .panic-top, :scope > .nav-top > *, :scope > .scroll > *, :scope > footer > *, :scope > .nav-fabs, :scope > .nav-sheet, :scope > .area-page > .area-hint, :scope > .area-page > .area-sheet";
const targets = (page) => [...page.querySelectorAll(TARGETS)];

export const Page = forwardRef(function Page({ name, first }, ref) {
  const reduced = useReducedMotion();
  const Native = screens[name];
  // Only the very first page of the session waits for the launch splash and has no "settled" callback.
  const [isFirst] = useState(() => { const f = first.current; first.current = false; return f; });
  const [armed, setArmed] = useState(!isFirst);
  const [isPresent, safeToRemove] = usePresence();
  const local = useRef(null);
  const left = useRef(false), seated = useRef(false), present = useRef(true);
  present.current = isPresent;
  const setRef = useCallback((el) => {
    local.current = el;
    if (typeof ref === "function") ref(el); else if (ref) ref.current = el;
  }, [ref]);

  useEffect(() => {
    if (!isFirst) return;
    launched.then(() => setArmed(true));
    const t = setTimeout(() => setArmed(true), 4000); // whatever happens to the splash, the first page appears
    return () => clearTimeout(t);
  }, [isFirst]);

  useLayoutEffect(() => {
    const el = local.current;
    if (!isPresent) { el.inert = true; return; }
    el.inert = false;
    bridge.legacy?.pageMounted(el, name);
    return attachSmoothScroll(el);
  }, [isPresent, name]);

  // The page is gone once this is called (idempotent): from the exit animation, or from the watchdog.
  // A late callback from an exit that was interrupted (the page came back) must not count: only a page that is leaving can leave.
  const leave = useCallback(() => { if (!present.current && !left.current) { left.current = true; safeToRemove?.(); } }, [safeToRemove]);
  // The entrance is over: a snap, and the legacy side may accept the next navigation.
  const settle = useCallback(() => {
    if (!seated.current && !isFirst) snap();
    seated.current = true;
    if (!isFirst) bridge.legacy?.pageSettled();
  }, [isFirst]);

  useEffect(() => {
    left.current = false;
    if (isPresent) return;
    seated.current = false;
    tick(); // the soft tick as the elements start to leave
    const t = setTimeout(leave, watchdog());
    if (reduced) leave();
    const el = local.current;
    const run = !Native && el ? slide(targets(el), travel(getDirection(), "out"), { out: true }) : null;
    run?.finished.then(leave);
    return () => { clearTimeout(t); run?.stop(); };
  }, [isPresent, Native, reduced, leave]);

  // Backstop for the entrance: with reduced motion a native page has nothing to animate (no completion event), and a stuck animation
  // must never leave the legacy side believing a transition is still running.
  useEffect(() => {
    if (!isPresent || !armed) return;
    const t = setTimeout(settle, reduced ? 0 : 1500 * slow());
    return () => clearTimeout(t);
  }, [isPresent, armed, reduced, settle]);

  // Legacy entrance (native screens enter through their variants).
  useLayoutEffect(() => {
    const el = local.current;
    if (Native || !isPresent || !armed || !el) return;
    const run = slide(targets(el), travel(getDirection(), "in"));
    run.finished.then(settle);
    return () => run.stop();
  }, [Native, isPresent, armed, settle]);

  const attrs = { ref: setRef, className: pageClass(name), "data-screen": name };
  const variants = useMemo(() => PAGE, []);
  if (Native) {
    return (
      <motion.section {...attrs} variants={variants} initial={reduced ? false : "hidden"} animate={!isPresent ? "exit" : armed ? "show" : "hidden"}
        onAnimationComplete={(def) => { if (def === "exit") leave(); else if (def === "show") settle(); }}>
        <Native />
      </motion.section>
    );
  }
  return <LegacyScreen name={name} {...attrs} />;
});

// A legacy screen: the HTML from RerouteLegacy.SCREENS[name]() inside a .page section. It is built once, from the state at the moment
// the page mounts; legacy rerender() then rewrites the element's innerHTML itself (React never re-applies it while the string is unchanged).
export const LegacyScreen = forwardRef(function LegacyScreen({ name, ...attrs }, ref) {
  const html = useMemo(() => window.RerouteLegacy.SCREENS[name](), [name]);
  return <section ref={ref} dangerouslySetInnerHTML={{ __html: html }} {...attrs} />;
});
