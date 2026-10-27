// Router + page transitions. Real URLs: only the legal pages have their own path (/terms, /privacy, /about); every other screen stays at "/".
// The screen being shown therefore travels in location.state ({ screen, direction }), written by bridge.navigate, and is what the
// <Routes>-style table below resolves. Browser Back/Forward (POP) derives the screen from the path alone, as the legacy popstate handler did.
import { useEffect, useRef } from "react";
import { BrowserRouter, matchRoutes, useLocation, useNavigate, useNavigationType } from "react-router-dom";
import { AnimatePresence, LayoutGroup } from "framer-motion";
import { attachRouter } from "./bridge.js";
import { Page } from "./Page.jsx";
import { playVeil } from "./fxBus.js";
import { swell } from "./haptics.js";
import { captureShared, SharedGhost } from "./shared.jsx";

const LEGAL = { terms: "/terms", privacy: "/privacy", sources: "/about" };
const PATH_SCREEN = { "/terms": "terms", "/privacy": "privacy", "/about": "sources" };
const NAMES = ["home", "journey", "results", "next", "panic", "nav", "dashboard", "rides", "weather", "offline-area", "terms", "privacy", "sources"];
const ROUTES = NAMES.map((name) => ({ path: `/${name}`, name }));
const pathScreen = (pathname) => PATH_SCREEN[pathname] || "home";

function Screens() {
  const location = useLocation();
  const type = useNavigationType();
  const navigate = useNavigate();
  const first = useRef(true);
  const dir = useRef("back");

  useEffect(() => attachRouter((screen, direction, syncUrl) => {
    dir.current = direction;
    captureShared(); // remember the shared elements (Impact button / lead figure) before the old page goes
    swell();
    playVeil(direction);
    const here = window.location.pathname;
    const path = LEGAL[screen] || "/";
    const state = { screen, direction };
    // A legal page gets its own history entry; leaving one adds an entry for "/" so the browser Back button returns to it.
    const push = syncUrl && (LEGAL[screen] ? here !== path : here !== "/");
    navigate(syncUrl ? path : here, { state, replace: !push });
  }), [navigate]);

  const popped = type === "POP";
  const screen = popped ? pathScreen(location.pathname) : location.state?.screen || pathScreen(location.pathname);
  const direction = popped ? dir.current : location.state?.direction || "forward";
  const route = matchRoutes(ROUTES, `/${screen}`)?.[0].route ?? ROUTES[0];
  return (
    <LayoutGroup>
      <AnimatePresence mode="popLayout" initial={false} custom={direction}>
        <Page key={route.name} name={route.name} custom={direction} first={first} />
      </AnimatePresence>
      <SharedGhost screen={route.name} />
    </LayoutGroup>
  );
}

export default function AppRoutes() {
  return <BrowserRouter><Screens /></BrowserRouter>;
}
