# Reroute web shell (Vite + React)

The React shell that owns the page frame, routing, page transitions, smooth scrolling and the WebGL layer. The screens themselves are still the legacy `app.js` HTML builders, rendered through a bridge, until each is ported to a native React component.

Stack: react 18, react-router-dom 6, three, @react-three/fiber 8, framer-motion 11, framer-motion-3d 11, lenis, @capacitor/haptics (native only). `three` is aliased to a trimmed export list (`src/fx/three-lite.js`); `@react-three/drei` is installed but not imported by the shell.

## Develop and build

```bash
cd apps/plan-b-mvp/web
npm install
npm run build            # -> web/dist (git-ignored)
```

- **Served by Flask:** `python server.py` (from `apps/plan-b-mvp`). If `web/dist/index.html` exists, Flask serves it for `/`, `/index.html`, `/terms`, `/privacy`, `/about`, and `/assets/*` (hashed, immutable). If `web/dist` is absent it serves the old `index.html`, so the plain app still works.
- **Hot reload:** run Flask on 8000 (`python server.py`), then `npm run dev` and open `http://127.0.0.1:5173`. If Flask is not on 8000: `FLASK_URL=http://127.0.0.1:8641 npm run dev` (also honoured by `vite preview`). On OneDrive paths the dev server can serve a stale module for several seconds after an edit; for visual checks prefer a build plus `vite preview` (see the smoke test). Vite proxies `/api`, `/app.js`, `/offline.js`, `/app.css`, `/vendor`, icons and the manifest to Flask. `base` is `/`.
- Rebuild after changing anything in `web/src`; the service worker (`sw.js`, cache `planb-reroute-20`) precaches the hashed files it finds in the cached `/` page.

## Architecture

```
index.html -> src/main.jsx -> App.jsx
  <MotionLayer/>              DOM motion layer, mounted once (src/motion, below)
  <FxCanvas/>                 one persistent R3F canvas (fixed, pointer-events none, frameloop="demand", dpr <= 1.5); its chunk is requested only after the legacy scripts load and the browser is idle
  <div id="app"> ... <main id="viewport">   static chrome the legacy code looks up by id
     <AppRoutes/>             BrowserRouter + AnimatePresence(popLayout) + LayoutGroup, rendered once legacy scripts have loaded
```

- **Canvas (`src/fx/`)**: `Veil` is a full-screen quad with a GLSL liquid veil (`veil.glsl.js`; direction aware via `uAxis`, noise-warped edges, scroll-velocity distortion). `Accents` are three low-poly `framer-motion-3d` meshes that fly in on Z and spin as a page enters and tilt with scroll velocity. The canvas is never remounted by navigation.
- **`src/fxBus.js`**: framework-free state shared with the canvas (`veil.progress` motion value, `scrollVelocity`, `enter`) and `wake(ms)`. Because the canvas renders on demand and `framer-motion-3d` does not call `invalidate()`, anything that moves calls `wake()`; a small driver then invalidates every frame until the wake window ends, plus one final frame so the last veil frame is cleared. `window.RerouteFx` exposes it for debugging (`RerouteFx.veil.progress.set(0.5); RerouteFx.wake(5000)`).
- **Routing (`src/Routes.jsx`)**: only the legal pages have real paths (`/terms`, `/privacy`, `/about`); every other screen stays at `/`. The shown screen travels in `location.state = { screen, direction }`. Browser Back/Forward (POP) derives the screen from the path, as the legacy `popstate` handler did. Page enter/exit variants (`Page.jsx`) mirror the CSS forward/back/up/down push transitions; the veil runs 800 ms and the page swap lands while it fully covers the screen.
- **Smooth scroll (`src/smoothScroll.js`)**: Lenis on each page's `.scroll` element (not the window), re-bound when legacy `rerender()` replaces the node (`reroute:rerender` event). Measured scroll velocity feeds the canvas.
- **Shared elements (`src/shared.jsx`)**: legacy HTML cannot carry a `layoutId`, so a fixed `motion.div layoutId="impact"` ghost flies between the home Impact button and the dashboard lead figure. Native screens can use `layoutId` directly (the router is wrapped in `LayoutGroup`).
- **Haptics (`src/haptics.js`)**: `tick, soft, swell, thud, snap, error`. `@capacitor/haptics` when `window.Capacitor?.isNativePlatform()`, otherwise `navigator.vibrate`; silent when motion is reduced or unsupported. The veil start is a `swell`, a page landing is a `thud`, pressing a button is a `tick` (fired by the motion layer), a card seating while scrolling is a `thud`, a menu or settings morph is `soft` and a sheet is `snap`.
- **Reduced motion / no WebGL**: `html[data-motion="reduced"]` or `prefers-reduced-motion` (unless `data-motion="full"`) means no canvas, no veil, no 3D, no haptics, zero-duration page changes and no Lenis. If WebGL is unavailable or the canvas throws, the canvas is skipped and pages still slide.

## Motion layer (`src/motion/`)

One `MotionLayer` (mounted in `App.jsx`) owns every DOM-level effect. It uses delegated pointer/focus listeners on `document` plus one `MutationObserver` on `#viewport`, so it treats legacy HTML-string screens and native React screens identically (a native screen only has to use the same classes). It uses the imperative `animate()` from framer-motion on DOM nodes and never touches React state.

| File | What it does |
| --- | --- |
| `MotionLayer.jsx` | Installs/uninstalls everything. Reduced motion (system preference or `data-motion`, including flipping mid-session) stops every animation, removes every inline style the layer wrote (`fm.js` keeps the registry), and removes the `html.fm` class and `data-fm` markers; turning it off installs the layer again. |
| `micro.js` | Press sinks to 0.97 (140 ms) and releases with a `backOut` overshoot (220 ms); hover lift only for a fine mouse; elastic settle on a field tapped into (not keyboard focus). Same selectors as the old `motion.js` (`selectors.js`). Drives the CSS individual `scale` / `translate` properties, never `transform`, so it composes with the 3D scroll transform and with framer's own transforms. `motion.css` neutralises the CSS `:active` transform while `html.fm` is set so the two do not stack. |
| `panels.js` | Menu / settings / sheet backdrops (class `open` toggled by `app.js`): the panel is revealed through a rounded clip-path that opens from its leading edge (340 ms, refolds in 200 ms), rows stagger in (opacity + translate, max 8), soft haptic (menu, settings) or snap (sheet). Busy buttons (`button.is-loading`) get the route-bend loader (an SVG path morphing between the direct and detour curve). A skeleton replaced by content cross-fades over 240 ms. The veil is deliberately not used for drawers: it is the 800 ms full-screen route transition. |
| `scroll3d.js` | Every direct child block of `.scroll` / `.sheet-scroll` (and `.chart-card`) below the fold flies in on Z and swings on Y (alternating sides, `perspective(900px)`), scrubbed by scroll progress (reverses on scroll back; ranges are clamped to the scrollable distance so the last block always seats). Blocks tilt (rotateX, max 7 deg) with `scrollVelocity` from `fxBus` (fed by Lenis and native touch scroll) and ease flat. A card seating gives `thud`. Chart bars grow (`scaleY`), `.hero-art` / `.kpi.lead` drift up and dim, `.kpi b` figures count up once when 30% visible. Blocks already on screen on a new page fly in on a short stagger (skipped for elements framer already owns, e.g. `Rise`). Opt out with `data-fm-off` on the block or an ancestor; opt a custom native block in via `data-fm-reveal`. |
| `launch.js` | Splash sequence: the splash sits under the canvas; once the mark has drawn and the canvas is up, the veil floods over it, the splash is removed while the veil covers the screen, the veil lifts and the first page flies in (the `launched` promise gates the entrance). No canvas: the splash fades. Reduced motion: no splash. |
| `motion.css` | `html.fm`-scoped overrides (splash z-index under the canvas, CSS entrances/transitions that would fight per-frame writes, the CSS `:active` transform). |

Cost model: transform / opacity / `translate` / `scale` for feedback; the clip-path morph only while a panel opens or closes, bar and hero scrubs only while scrolling. Layout is read only when something new is registered or the viewport resizes (batched, writes after reads, one reflow); the press / hover / focus handlers and the scroll handler perform no layout reads (measured: 0 `getBoundingClientRect` calls). Nothing runs at rest: the scroll flush is scheduled only while scrolling or while the tilt eases out, Lenis (no `autoRaf`) loops only while it glides after a wheel event, and the canvas (`frameloop="demand"`) renders only inside `wake()` windows. Check in the console: `RerouteFx.stats.frames` (canvas frames rendered) must not change over a few idle seconds, and wrapping `requestAnimationFrame` shows 0 calls at rest. Everything pauses on `visibilitychange: hidden`.

`src/shared.jsx` (ghost morph) FLIPs a clone of the outgoing element and a clone of the incoming one with transform + opacity and cross-fades them, so differences in size, radius, colour or type do not stretch one element into the other. A new navigation finishes a morph in flight at once, a double tap on the same screen leaves it alone, a re-rendered target is followed, and a watchdog removes the ghosts after 1.2 s. Native screens that carry their own `layoutId` mark the element `data-no-ghost`.

`src/fx/three-lite.js`: `three` is aliased to it in `vite.config.js`. R3F registers the whole `three` namespace, so an unaliased import ships every class. Add any class a screen needs there. `src/fx/three-shaders.js` (generated by `node scripts/trim-shaders.mjs`) replaces three's ShaderChunk / ShaderLib with the pieces MeshBasicMaterial and ShaderMaterial use, so lit/physical/toon shader sources are not shipped; a screen that draws with another built-in material must extend the generator. The canvas chunk went from 828 kB (223 kB gzip) to 531 kB (157 kB gzip).

## Manual smoke test (no browser driver is installed in this repo, so there is no `scripts/smoke.mjs`)

1. `npx vite build --outDir /tmp/dist-x`, then `FLASK_URL=http://127.0.0.1:8641 npx vite preview --outDir /tmp/dist-x --port 5643` with Flask on 8641 (`HOST=127.0.0.1 PORT=8641 python server.py`).
2. Load it at 390x844 with service workers unregistered and caches cleared. Expect: splash, veil sweep, first screen flies in, no console errors.
3. Idle: `RerouteFx.stats.frames` unchanged over 3 s and 0 rAF calls over 3 s.
4. Scroll the home screen: blocks swing in alternately, tilt with speed, one `thud` (`navigator.vibrate(16)`) as cards seat.
5. Open the menu, then Settings: clip-path morph and row stagger. Add `is-loading` to a `.btn`: the route-bend loader appears and goes with the class.
6. `document.documentElement.dataset.motion = "reduced"`: `html.fm` removed, canvas removed, no press scale, no haptics. Set `"full"` again: everything is back.

## The legacy bridge

`app.js` and `offline.js` are loaded as classic scripts by `legacyLoader.js` after the shell exists. `app.js` checks `window.RerouteBridge` (created in `src/bridge.js`, before it loads):

| Direction | API |
| --- | --- |
| legacy -> React | `RerouteBridge.navigate(screen, direction, syncUrl)`, `RerouteBridge.isNative(screen)`, `RerouteBridge.register({ rerender, pageMounted, pageSettled })` |
| React -> legacy | `RerouteBridge.legacy.pageMounted(el, screen)`, `pageSettled()`; globals `window.RerouteLegacy = { SCREENS, state, navigate, goBack, rerender, enhanceClear, pageClass, isTransitioning }` |

Legacy `navigate()` still does all state work (stack, sheets, menus, nav/panic/weather setup), then hands the DOM swap and URL change to React; React mounts a `.page` section whose HTML is `SCREENS[name]()`, calls `pageMounted` (which sets `currentPage`, inert handling, focus, maps, charts) and, when the push animation ends, `pageSettled` (clears `transitioning`, resizes and cleans maps). `rerender()` keeps rewriting `currentPage.innerHTML` in place and fires `reroute:rerender`. Without `window.RerouteBridge` (plain `index.html`) `app.js` swaps pages itself as before. `motion.js`, `fx.js` and the GSAP/three vendor files are not loaded by the shell; everything they did lives in `src/motion` (below).

## Porting a screen to native React

1. Create `src/screens/<name>.screen.jsx` whose default export is the component, e.g. `dashboard.screen.jsx`. The part before `.screen.` is the route name: `home, journey, results, next, panic, nav, dashboard, rides, weather, offline-area, terms, privacy, sources`. (Or set `Component.screenName`.)
2. That is all. `src/screens/index.js` collects every `*.screen.{js,jsx}` with `import.meta.glob`, so the registry `screens` (`{ [name]: Component }`) needs no edit and parallel screens never conflict. The router prefers a registered screen over `LegacyScreen`.
3. The component renders the page body only; the shell supplies the `.page` section, enter/exit motion, Lenis on `.scroll` and `pageMounted`. Use the same markup classes (`.scroll`, `.eyebrow`, ...) so `app.css` applies. Legacy `rerender()` does not rewrite native pages; it fires `reroute:rerender` with `detail.native = true`, so a native screen can re-read `RerouteLegacy.state` on that event.
4. Native pages still use legacy actions: keep `data-action="..."` attributes and the global click delegation keeps working.
