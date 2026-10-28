// Router + page transitions. Real URLs: only the legal pages have their own path (/terms, /privacy, /about); every other screen stays at "/".
// The screen being shown therefore travels in location.state ({ screen, direction }), written by bridge.navigate, and is what the
// <Routes>-style table below resolves. Browser Back/Forward (POP) derives the screen from the path alone, as the legacy popstate handler did.
// Transitions: AnimatePresence in "wait" mode inside a LayoutGroup. The old page's elements stagger out, then the new page mounts and its
// elements stagger in (Page.jsx, choreography.js); layoutId elements (shared.jsx) morph across the gap.
import { useEffect, useRef } from "react";
import { BrowserRouter, matchRoutes, useLocation, useNavigate, useNavigationType } from "react-router-dom";
import { AnimatePresence, LayoutGroup } from "framer-motion";
import { attachRouter, bridge } from "./bridge.js";
import { Page } from "./Page.jsx";
import { setDirection } from "./choreography.js";
import { setNav, warmShared } from "./shared.jsx";

const LEGAL = { terms: "/terms", privacy: "/privacy", sources: "/about", community: "/community", licences: "/licences", support: "/support", account: "/account" };
const PATH_SCREEN = { "/terms": "terms", "/privacy": "privacy", "/about": "sources", "/community": "community", "/licences": "licences", "/support": "support", "/account": "account" };
const NAMES = ["home", "journey", "results", "next", "panic", "nav", "dashboard", "rides", "weather", "offline-area", "terms", "privacy", "sources", "community", "licences", "support", "account"];
const ROUTES = NAMES.map((name) => ({ path: `/${name}`, name }));
const pathScreen = (pathname) => PATH_SCREEN[pathname] || "home";

function Screens() {
  const location = useLocation();
  const type = useNavigationType();
  const navigate = useNavigate();
  const first = useRef(true);
  const dir = useRef("back");
  const shown = useRef(null); // the screen currently mounted or on its way in

  useEffect(() => { const t = setTimeout(() => (window.requestIdleCallback || setTimeout)(() => warmShared(NAMES)), 1500); return () => clearTimeout(t); }, []);
  useEffect(() => attachRouter((screen, direction, syncUrl) => {
    dir.current = direction;
    setDirection(direction); // before React renders: the leaving page's elements read it when their exit starts
    const here = window.location.pathname;
    const path = LEGAL[screen] || "/";
    const state = { screen, direction };
    // A legal page gets its own history entry; leaving one adds an entry for "/" so the browser Back button returns to it.
    const push = syncUrl && (LEGAL[screen] ? here !== path : here !== "/");
    navigate(syncUrl ? path : here, { state, replace: !push });
    // Already showing that screen (the browser's Back/Forward got there first): no page change will follow, so nothing would ever
    // report the navigation as settled.
    if (shown.current === screen) setTimeout(() => bridge.legacy?.pageSettled(), 0);
  }), [navigate]);

  const popped = type === "POP";
  const screen = popped ? pathScreen(location.pathname) : location.state?.screen || pathScreen(location.pathname);
  const direction = popped ? dir.current : location.state?.direction || "forward";
  const route = matchRoutes(ROUTES, `/${screen}`)?.[0].route ?? ROUTES[0];
  if (route.name !== shown.current) setNav(shown.current, route.name); // before the pages render: shared elements ask where they come from / go to
  shown.current = route.name;
  if (popped) setDirection(direction);
  return (
    <LayoutGroup>
      <AnimatePresence mode="wait" initial={false}>
        <Page key={route.name} name={route.name} first={first} />
      </AnimatePresence>
    </LayoutGroup>
  );
}

export default function AppRoutes() {
  return <BrowserRouter><Screens /></BrowserRouter>;
}
