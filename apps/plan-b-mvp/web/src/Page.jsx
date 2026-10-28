// One routed screen: a `.page` <section> (the element the legacy code calls currentPage). The router runs AnimatePresence in "wait" mode, so
// a navigation is two beats: this page's elements slide OUT in the direction of travel and, only once that has finished, the next page
// mounts and its elements slide IN and settle (choreography.js `slide`).
//   * The moving elements are Web Animations on translate + opacity (compositor thread). Native screens mark them `data-item` (Item,
//     Shared); legacy screens (HTML from RerouteLegacy.SCREENS[name]()) animate the direct children of their header, `.scroll` and footer.
//   * A shared (layoutId) element is exempt only when the screen being navigated to / from has its counterpart (shared.jsx `hasShared`);
//     otherwise it staggers like everything else.
//   * The entrance starts in a layout effect, in the same task as the DOM commit, and fills backwards: the first painted frame is already
//     the start pose. Work that is not needed for that frame (legacy pageMounted's maps and focus, Lenis) runs after the first frame.
// `usePresence` hands over the exit: the page stays mounted until its elements have left (or the watchdog fires), so a stuck exit can
// never freeze the app. Reduced motion = instant swap (`slide` becomes a no-op).
import { forwardRef, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePresence } from "framer-motion";
import { bridge } from "./bridge.js";
import { getDirection, slide, slow, travel, watchdog } from "./choreography.js";
import { snap, tick } from "./haptics.js";
import { launched } from "./motion/launch.js";
import { screens } from "./screens/index.js";
import { hasShared, nav } from "./shared.jsx";
import { attachSmoothScroll } from "./smoothScroll.js";
import { useReducedMotion } from "./reduced.js";

export const pageClass = (name) => `page${name === "panic" || name === "nav" ? ` ${name}` : ""}`;

// The elements of a legacy page that take part: the direct children of its header and of `.scroll`, plus the loose blocks the map screens
// are made of (maps themselves stay put). Position is the CSS `translate` property, so it composes with those blocks' own transforms.
const TARGETS = ":scope > header > *, :scope > .panic-top, :scope > .nav-top > *, :scope > .scroll > *, :scope > footer > *, :scope > .nav-fabs, :scope > .nav-sheet, :scope > .area-page > .area-hint, :scope > .area-page > .area-sheet";
// What moves with this page: its `data-item` elements (native) or the legacy targets, minus shared elements whose counterpart is on the other
// screen (they morph), minus anything nested in another moving element or outside the viewport (nothing to see; the scroll reveals own those).
function movers(page, other) {
  const all = [...page.querySelectorAll("[data-item]")];
  const list = (all.length ? all : [...page.querySelectorAll(TARGETS)]).filter((el) => !(el.dataset.shared && hasShared(other, el.dataset.shared)) && !el.parentElement?.closest("[data-item]"));
  const view = innerHeight; // one batch of reads, no writes in between
  return list.filter((el) => { const r = el.getBoundingClientRect(); return (r.width || r.height) && r.bottom > 0 && r.top < view; });
}
// Runs `fn` after the frame that follows this call has been produced (so the first frame of the animation never waits for it).
const afterFrame = (fn) => { let t; const r = requestAnimationFrame(() => { t = setTimeout(fn, 0); }); return () => { cancelAnimationFrame(r); clearTimeout(t); }; };

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

  // Cheap bookkeeping stays in the commit (inert, which page is current); the heavy part of legacy pageMounted (maps, charts, focus) is
  // queued by app.js for after the first frame, and Lenis is set up after it too.
  useLayoutEffect(() => {
    const el = local.current;
    if (!isPresent) { el.inert = true; return; }
    el.inert = false;
    bridge.legacy?.pageMounted(el, name);
  }, [isPresent, name]);
  useEffect(() => {
    const el = local.current;
    if (!isPresent || !el) return;
    let off = () => {};
    const cancel = afterFrame(() => { off = attachSmoothScroll(el); });
    return () => { cancel(); off(); };
  }, [isPresent, name]);

  // The page is gone once this is called (idempotent): from the exit animation, or from the watchdog.
  // A late callback from an exit that was interrupted (the page came back) must not count: only a page that is leaving can leave.
  const leave = useCallback(() => { if (!present.current && !left.current) { left.current = true; safeToRemove?.(); } }, [safeToRemove]);
  // The entrance is over: a snap, and the legacy side may accept the next navigation.
  const settle = useCallback(() => {
    if (!seated.current && !isFirst) snap();
    seated.current = true;
    if (!isFirst) bridge.legacy?.pageSettled();
    document.dispatchEvent(new Event("reroute:settled")); // the scroll reveals wait for this before touching the page's blocks
  }, [isFirst]);

  // Exit: started in the layout phase of the commit that marks the page as leaving, so the first frame already moves.
  useLayoutEffect(() => {
    left.current = false;
    if (isPresent) return;
    seated.current = false;
    tick(); // the soft tick as the elements start to leave
    const t = setTimeout(leave, watchdog());
    if (reduced) leave();
    const el = local.current;
    const run = el ? slide(movers(el, nav.to), travel(getDirection(), "out"), { out: true, hold: true }) : null;
    run?.finished.then(leave);
    return () => { clearTimeout(t); run?.stop(); };
  }, [isPresent, reduced, leave]);

  // Backstop for the entrance: with reduced motion nothing animates (no completion), and a stuck animation must never leave the legacy
  // side believing a transition is still running.
  useEffect(() => {
    if (!isPresent || !armed) return;
    const t = setTimeout(settle, reduced ? 0 : 1500 * slow());
    return () => clearTimeout(t);
  }, [isPresent, armed, reduced, settle]);

  // Entrance, in the commit that mounts the page: the animations fill backwards, so the first painted frame is the start pose.
  useLayoutEffect(() => {
    const el = local.current;
    if (!isPresent || !armed || !el) return;
    const run = slide(movers(el, nav.from), travel(getDirection(), "in"));
    run.finished.then(settle);
    return () => run.stop();
  }, [isPresent, armed, settle]);

  const attrs = { ref: setRef, className: pageClass(name), "data-screen": name, style: armed ? undefined : { visibility: "hidden" } }; // the first page waits, unseen, for the splash
  return Native ? <section {...attrs}><Native /></section> : <LegacyScreen name={name} {...attrs} />;
});

// A legacy screen: the HTML from RerouteLegacy.SCREENS[name]() inside a .page section. It is built once, from the state at the moment
// the page mounts; legacy rerender() then rewrites the element's innerHTML itself (React never re-applies it while the string is unchanged).
export const LegacyScreen = forwardRef(function LegacyScreen({ name, ...attrs }, ref) {
  const html = useMemo(() => window.RerouteLegacy.SCREENS[name](), [name]);
  return <section ref={ref} dangerouslySetInnerHTML={{ __html: html }} {...attrs} />;
});
