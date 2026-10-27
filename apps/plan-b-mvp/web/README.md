# Reroute web shell (Vite + React)

The React shell that owns the page frame, routing, page transitions, smooth scrolling and the WebGL layer. The screens themselves are still the legacy `app.js` HTML builders, rendered through a bridge, until each is ported to a native React component.

Stack: react 18, react-router-dom 6, three, @react-three/fiber 8, @react-three/drei 9, framer-motion 11, framer-motion-3d 11, lenis, @capacitor/haptics (native only).

## Develop and build

```bash
cd apps/plan-b-mvp/web
npm install
npm run build            # -> web/dist (git-ignored)
```

- **Served by Flask:** `python server.py` (from `apps/plan-b-mvp`). If `web/dist/index.html` exists, Flask serves it for `/`, `/index.html`, `/terms`, `/privacy`, `/about`, and `/assets/*` (hashed, immutable). If `web/dist` is absent it serves the old `index.html`, so the plain app still works.
- **Hot reload:** run Flask on 8000 (`python server.py`), then `npm run dev` and open `http://127.0.0.1:5173`. Vite proxies `/api`, `/app.js`, `/offline.js`, `/app.css`, `/vendor`, icons and the manifest to Flask. `base` is `/`.
- Rebuild after changing anything in `web/src`; the service worker (`sw.js`, cache `planb-reroute-20`) precaches the hashed files it finds in the cached `/` page.

## Architecture

```
index.html -> src/main.jsx -> App.jsx
  <FxCanvas/>                 one persistent R3F canvas (fixed, pointer-events none, frameloop="demand", dpr <= 1.5), lazy-loaded
  <div id="app"> ... <main id="viewport">   static chrome the legacy code looks up by id
     <AppRoutes/>             BrowserRouter + AnimatePresence(popLayout) + LayoutGroup, rendered once legacy scripts have loaded
```

- **Canvas (`src/fx/`)**: `Veil` is a full-screen quad with a GLSL liquid veil (`veil.glsl.js`; direction aware via `uAxis`, noise-warped edges, scroll-velocity distortion). `Accents` are three low-poly `framer-motion-3d` meshes that fly in on Z and spin as a page enters and tilt with scroll velocity. The canvas is never remounted by navigation.
- **`src/fxBus.js`**: framework-free state shared with the canvas (`veil.progress` motion value, `scrollVelocity`, `enter`) and `wake(ms)`. Because the canvas renders on demand and `framer-motion-3d` does not call `invalidate()`, anything that moves calls `wake()`; a small driver then invalidates every frame until the wake window ends, plus one final frame so the last veil frame is cleared. `window.RerouteFx` exposes it for debugging (`RerouteFx.veil.progress.set(0.5); RerouteFx.wake(5000)`).
- **Routing (`src/Routes.jsx`)**: only the legal pages have real paths (`/terms`, `/privacy`, `/about`); every other screen stays at `/`. The shown screen travels in `location.state = { screen, direction }`. Browser Back/Forward (POP) derives the screen from the path, as the legacy `popstate` handler did. Page enter/exit variants (`Page.jsx`) mirror the CSS forward/back/up/down push transitions; the veil runs 800 ms and the page swap lands while it fully covers the screen.
- **Smooth scroll (`src/smoothScroll.js`)**: Lenis on each page's `.scroll` element (not the window), re-bound when legacy `rerender()` replaces the node (`reroute:rerender` event). Measured scroll velocity feeds the canvas.
- **Shared elements (`src/shared.jsx`)**: legacy HTML cannot carry a `layoutId`, so a fixed `motion.div layoutId="impact"` ghost flies between the home Impact button and the dashboard lead figure. Native screens can use `layoutId` directly (the router is wrapped in `LayoutGroup`).
- **Haptics (`src/haptics.js`)**: `tick, soft, swell, thud, snap, error`. `@capacitor/haptics` when `window.Capacitor?.isNativePlatform()`, otherwise `navigator.vibrate`; silent when motion is reduced or unsupported. The veil start is a `swell`, a page landing is a `thud`, pressing a button is a `tick`.
- **Reduced motion / no WebGL**: `html[data-motion="reduced"]` or `prefers-reduced-motion` (unless `data-motion="full"`) means no canvas, no veil, no 3D, no haptics, zero-duration page changes and no Lenis. If WebGL is unavailable or the canvas throws, the canvas is skipped and pages still slide.

## The legacy bridge

`app.js` and `offline.js` are loaded as classic scripts by `legacyLoader.js` after the shell exists. `app.js` checks `window.RerouteBridge` (created in `src/bridge.js`, before it loads):

| Direction | API |
| --- | --- |
| legacy -> React | `RerouteBridge.navigate(screen, direction, syncUrl)`, `RerouteBridge.isNative(screen)`, `RerouteBridge.register({ rerender, pageMounted, pageSettled })` |
| React -> legacy | `RerouteBridge.legacy.pageMounted(el, screen)`, `pageSettled()`; globals `window.RerouteLegacy = { SCREENS, state, navigate, goBack, rerender, enhanceClear, pageClass, isTransitioning }` |

Legacy `navigate()` still does all state work (stack, sheets, menus, nav/panic/weather setup), then hands the DOM swap and URL change to React; React mounts a `.page` section whose HTML is `SCREENS[name]()`, calls `pageMounted` (which sets `currentPage`, inert handling, focus, maps, charts) and, when the push animation ends, `pageSettled` (clears `transitioning`, resizes and cleans maps). `rerender()` keeps rewriting `currentPage.innerHTML` in place and fires `reroute:rerender`. Without `window.RerouteBridge` (plain `index.html`) `app.js` swaps pages itself as before. `motion.js`, `fx.js` and the GSAP/three vendor files are not loaded by the shell; press scaling and menu staggers from `motion.js` are not ported (CSS `:active` styles apply).

## Porting a screen to native React

1. Create `src/screens/<name>.screen.jsx` whose default export is the component, e.g. `dashboard.screen.jsx`. The part before `.screen.` is the route name: `home, journey, results, next, panic, nav, dashboard, rides, weather, offline-area, terms, privacy, sources`. (Or set `Component.screenName`.)
2. That is all. `src/screens/index.js` collects every `*.screen.{js,jsx}` with `import.meta.glob`, so the registry `screens` (`{ [name]: Component }`) needs no edit and parallel screens never conflict. The router prefers a registered screen over `LegacyScreen`.
3. The component renders the page body only; the shell supplies the `.page` section, enter/exit motion, Lenis on `.scroll` and `pageMounted`. Use the same markup classes (`.scroll`, `.eyebrow`, ...) so `app.css` applies. Legacy `rerender()` does not rewrite native pages; it fires `reroute:rerender` with `detail.native = true`, so a native screen can re-read `RerouteLegacy.state` on that event.
4. Native pages still use legacy actions: keep `data-action="..."` attributes and the global click delegation keeps working.
