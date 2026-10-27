# Reroute web shell (Vite + React)

The React shell that owns the page frame, routing, page transitions, smooth scrolling and the DOM motion layer. The screens are either native React components (`src/screens/`) or the legacy `app.js` HTML builders, rendered through a bridge. There is no WebGL: no `three`, no canvas, no shader. Everything moves by sliding, fading and settling elements.

Stack: react 18, react-router-dom 6, framer-motion 11, lenis, @capacitor/haptics (native only).

## Develop and build

```bash
cd apps/plan-b-mvp/web
npm install
npm run build                 # -> web/dist (git-ignored)
VITE_SLOWMO=1 npm run build   # same, plus the slow-motion hook (see Choreography); never ship this build
```

- **Served by Flask:** `python server.py` (from `apps/plan-b-mvp`). If `web/dist/index.html` exists, Flask serves it for `/`, `/index.html`, `/terms`, `/privacy`, `/about`, and `/assets/*` (hashed, immutable). If `web/dist` is absent it serves the old `index.html`, so the plain app still works.
- **Hot reload:** run Flask on 8000 (`python server.py`), then `npm run dev` and open `http://127.0.0.1:5173`. If Flask is not on 8000: `FLASK_URL=http://127.0.0.1:8641 npm run dev` (also honoured by `vite preview`). On OneDrive paths the dev server can serve a stale module for several seconds after an edit; for visual checks prefer a build. Vite proxies `/api`, `/app.js`, `/offline.js`, `/app.css`, `/vendor`, icons and the manifest to Flask. `base` is `/`.
- Rebuild after changing anything in `web/src`; the service worker (`sw.js`, cache `planb-reroute-21`) precaches the hashed files it finds in the cached `/` page.

## Architecture

```
index.html -> src/main.jsx -> App.jsx
  <MotionLayer/>              DOM motion layer, mounted once (src/motion, below)
  <div id="app"> ... <main id="viewport">   static chrome the legacy code looks up by id
     <AppRoutes/>             BrowserRouter + LayoutGroup + AnimatePresence(mode="wait"), rendered once legacy scripts have loaded
```

- **Routing (`src/Routes.jsx`)**: only the legal pages have real paths (`/terms`, `/privacy`, `/about`); every other screen stays at `/`. The shown screen travels in `location.state = { screen, direction }`. Browser Back/Forward (POP) derives the screen from the path, as the legacy `popstate` handler did. `AnimatePresence mode="wait"` means a navigation is two beats: the old page's elements leave, then the new page mounts and its elements arrive. `Page.jsx` is the wrapper every screen goes through.
- **Smooth scroll (`src/smoothScroll.js`)**: Lenis on each page's `.scroll` element (not the window), re-bound when legacy `rerender()` replaces the node (`reroute:rerender` event). Measured scroll velocity (`motion/velocity.js`) tilts the scroll reveals.
- **Haptics (`src/haptics.js`)**: `tick, soft, thud, snap, error`. `@capacitor/haptics` when `window.Capacitor?.isNativePlatform()`, otherwise `navigator.vibrate`; silent when motion is reduced or unsupported. A page leaving is a `tick`, its entrance settling is a `snap`, pressing a button is a `tick` (motion layer), a card seating while scrolling is a `thud`, a menu or settings opening is `soft` and a sheet is `snap`.
- **Reduced motion**: `html[data-motion="reduced"]` or `prefers-reduced-motion` (unless `data-motion="full"`), including flipping either mid-session: pages swap instantly (no stagger, no splash, no travel), no haptics, no Lenis, the motion layer uninstalls and restores the DOM.

## Choreography (`src/choreography.js`)

One file holds the timing and travel every element transition uses (pages, side menu, Settings, sheets, launch splash), so they share one feel: opacity eases out (`EASE`), position slides and settles with a short spring (`spring()`: 0.5 s, bounce 0.24), elements arrive 35 ms apart (`STAGGER_IN`) and leave 30 ms apart (`STAGGER_OUT`, 140 ms each), capped (`CAP` 10 entering, `CAP_OUT` 7 leaving: the rest share the last delay and fade with the group, so a leaving page clears in about 300 ms).

- **Direction** (`useDirection()`, `getDirection()`, `setDirection()`; set by the router before it renders): `forward` leaves left and arrives from the right, `back` is the reverse, `up` (sheet-like) leaves down and arrives from below, `down` leaves down and arrives from just above. `travel(direction, "in" | "out")` gives the displacement.
- **Native React elements**: `PAGE` variants sit on the page root (`hidden` / `show` / `exit`, `staggerChildren`); every `motion.*` element with `{...staggerProps(i)}` (or `<Item tag index>` from `shared.jsx`) inherits the label and slides in or out. Variants are functions, so direction, reduced motion and slow motion are read when an animation starts.
- **Plain DOM** (legacy HTML screens, menu lines, splash): `slide(elements, { x, y }, { out, delay, step, cap })` does the same with the CSS `translate` property and opacity (never `transform`, which the scroll reveals and framer own). Legacy pages animate the direct children of their header, `.scroll`, footer and the map screens' loose blocks from `Page.jsx`.
- **Page lifecycle (`Page.jsx`)**: `usePresence` keeps the old page mounted until its exit has finished, with a watchdog (`watchdog()`, 600 ms) that force-completes a stuck exit; an interrupted exit (browser Back/Forward mid-transition) re-enters instead of deadlocking. A tick fires as the exit starts and a snap when the entrance settles, which is also when `pageSettled()` lets the legacy side accept the next navigation (a backstop timer does it too, and immediately under reduced motion).
- **Slow motion for inspection**: in dev, or in a build made with `VITE_SLOWMO=1`, `window.__slowmo = 6` multiplies every duration, delay and spring by 6 so a frame can be captured mid-flight. Production builds contain no such code.
- **Scroll reveals** (`motion/scroll3d.js`) use `settle(k)`, the same spring as a pure function of scroll progress, so a block slides in from alternating sides and settles with the same overshoot as the page elements, still scrubbed by scroll.

### Shared layout (`src/shared.jsx`)

Elements that persist across screens carry a framer-motion `layoutId` (the router is a `LayoutGroup`), so they physically morph instead of leaving and re-entering: `impact` (home Impact button <-> dashboard lead figure), `nav-back`, `nav-home` and `title` (the large page title, position only).

Rules: (1) a shared element is a `<Shared id>`, never an `<Item>`: it takes no part in its screen's stagger, the elements around it stagger. (2) A container that holds a shared element is not itself animated (it would carry the element away); its children are staggered individually instead. `legacyNode()` applies both rules when legacy HTML becomes React (`screens/home/tree.jsx`, `screens/trip/LegacyTree.jsx`); the hand-written screens (`Navbar`, weather, legal) apply them by hand. Legacy innerHTML screens (panic, nav, offline-area) cannot carry a `layoutId`, so their Back/Home simply slide with the rest. With `mode="wait"` the old page is gone before the new one mounts; framer keeps the old shared node's last box and the new node morphs from it, so the Impact button stays in place while everything else leaves and then grows into the lead figure.

## Motion layer (`src/motion/`)

One `MotionLayer` (mounted in `App.jsx`) owns every DOM-level effect. It uses delegated pointer/focus listeners on `document` plus one `MutationObserver` on `#viewport`, so it treats legacy HTML-string screens and native React screens identically. It uses the imperative `animate()` from framer-motion on DOM nodes and never touches React state.

| File | What it does |
| --- | --- |
| `MotionLayer.jsx` | Installs/uninstalls everything. Reduced motion (system preference or `data-motion`, including flipping mid-session) stops every animation, removes every inline style the layer wrote (`fm.js` keeps the registry), and removes the `html.fm` class and `data-fm` markers; turning it off installs the layer again. |
| `micro.js` | Press sinks to 0.97 (140 ms) and releases with a `backOut` overshoot (220 ms); hover lift only for a fine mouse; elastic settle on a field tapped into (not keyboard focus). Drives the CSS individual `scale` / `translate` properties, never `transform`. `motion.css` neutralises the CSS `:active` transform while `html.fm` is set so the two do not stack. |
| `panels.js` | Menu / settings / sheet backdrops (class `open` toggled by `app.js`): the panel slides in CSS as before and the lines inside it slide in one after another from the panel's own side (menu from the left, line by line; Settings from the right; sheets from below) with the choreography spring and stagger. Closing slides the lines out first (bottom first) while the panel is held, then lets the panel go; a panel being dragged shut is left alone. Soft haptic (menu, settings) or snap (sheet). Busy buttons (`button.is-loading`) get the route-bend loader. A skeleton replaced by content cross-fades over 240 ms. |
| `scroll3d.js` | Every direct child block of `.scroll` / `.sheet-scroll` (and `.chart-card`) below the fold slides in from alternating sides and settles (`settle`), scrubbed by scroll progress (reverses on scroll back; ranges are clamped to the scrollable distance so the last block always seats). Blocks tilt (rotateX, max 7 deg) with scroll velocity and ease flat. A card seating gives `thud`. Chart bars grow (`scaleY`), `.hero-art` / `.kpi.lead` drift up and dim, `.kpi b` figures count up once when 30% visible. Opt out with `data-fm-off`; opt a custom native block in via `data-fm-reveal`. Blocks already on screen are staggered by the page choreography, not here. |
| `launch.js` | Splash sequence: the first page is mounted but hidden under the splash; once the app is ready and the mark has drawn, the mark slides away with the page-leave motion, the backdrop fades and the first screen's elements stagger in (the `launched` promise gates `Page.jsx`). Reduced motion: no splash. |
| `velocity.js` | The scroll velocity motion value (fed by Lenis and native touch scroll). |
| `motion.css` | `html.fm`-scoped overrides (CSS entrances/transitions that would fight per-frame writes, the CSS `:active` transform) and the switch-off of app.css's timed splash exit. |

Cost model: transform / opacity / `translate` / `scale` for feedback; layout is read only when something new is registered or the viewport resizes (batched, writes after reads, one reflow); the press / hover / focus handlers and the scroll handler perform no layout reads. Nothing runs at rest: the scroll flush is scheduled only while scrolling or while the tilt eases out, Lenis (no `autoRaf`) loops only while it glides after a wheel event. Everything pauses on `visibilitychange: hidden`.

## Manual smoke test (no browser driver is installed in this repo, so there is no `scripts/smoke.mjs`)

1. `VITE_SLOWMO=1 npm run build`, start Flask (`HOST=127.0.0.1 PORT=8641 python server.py`) and open it at 390x844 with service workers unregistered and caches cleared. Expect: splash, mark slides away, first screen's elements stagger in, no console errors, no `canvas` in the DOM.
2. Set `window.__slowmo = 40`, tap the Impact button: the page's elements slide left one after another, the Impact button stays, then the dashboard mounts and its elements arrive from the right while the lead figure grows out of the button (it needs at least one logged trip in `localStorage` `planb.trips`). Repeat with Back, the menu items, browser Back/Forward and rapid taps (nothing may stay inert or half-hidden).
3. Open the menu on home: the lines slide in from the left one by one. Close it: they slide back, then the panel goes. Settings slides from the right, sheets rise.
4. Scroll the home screen: blocks slide in from alternating sides and settle, tilt with speed, one `thud` (`navigator.vibrate(16)`) as cards seat.
5. `document.documentElement.dataset.motion = "reduced"`: pages swap instantly, `html.fm` removed, no press scale, no haptics. Set `"full"` again: everything is back.

## The legacy bridge

`app.js` and `offline.js` are loaded as classic scripts by `legacyLoader.js` after the shell exists. `app.js` checks `window.RerouteBridge` (created in `src/bridge.js`, before it loads):

| Direction | API |
| --- | --- |
| legacy -> React | `RerouteBridge.navigate(screen, direction, syncUrl)`, `RerouteBridge.isNative(screen)`, `RerouteBridge.register({ rerender, pageMounted, pageSettled })` |
| React -> legacy | `RerouteBridge.legacy.pageMounted(el, screen)`, `pageSettled()`; globals `window.RerouteLegacy = { SCREENS, state, navigate, goBack, rerender, enhanceClear, pageClass, isTransitioning }` |

Legacy `navigate()` still does all state work (stack, sheets, menus, nav/panic/weather setup), then hands the DOM swap and URL change to React; React mounts a `.page` section whose HTML is `SCREENS[name]()` once the previous page has finished leaving, calls `pageMounted` (which sets `currentPage`, inert handling, focus, maps, charts) and, when the entrance stagger ends, `pageSettled` (clears `transitioning`, resizes and cleans maps). While the old page is still leaving, legacy `rerender()` does nothing (`currentPage.dataset.screen !== state.screen`), and a browser Back/Forward that arrives mid-transition waits for it to settle before the legacy state catches up with the address. `rerender()` keeps rewriting `currentPage.innerHTML` in place and fires `reroute:rerender`. Without `window.RerouteBridge` (plain `index.html`) `app.js` swaps pages itself as before. `motion.js` and the GSAP vendor files belong to the plain `index.html` only; the shell does not load them (everything they did lives in `src/motion` and `src/choreography.js`).

## Porting a screen to native React

1. Create `src/screens/<name>.screen.jsx` whose default export is the component, e.g. `dashboard.screen.jsx`. The part before `.screen.` is the route name: `home, journey, results, next, panic, nav, dashboard, rides, weather, offline-area, terms, privacy, sources`. (Or set `Component.screenName`.)
2. That is all. `src/screens/index.js` collects every `*.screen.{js,jsx}` with `import.meta.glob`, so the registry `screens` (`{ [name]: Component }`) needs no edit and parallel screens never conflict. The router prefers a registered screen over `LegacyScreen`.
3. The component renders the page body only; the shell supplies the `.page` section, the enter/exit stagger root, Lenis on `.scroll` and `pageMounted`. To take part in the page transition, render the direct children of the navbar and of `.scroll` as `<Item tag index={i}>` (any `motion.*` tag, see Choreography) and anything that persists across screens as `<Shared id=...>`; for legacy markup let `legacyNode` (`shared.jsx`) do it. Use the same markup classes (`.scroll`, `.eyebrow`, ...) so `app.css` applies. Legacy `rerender()` does not rewrite native pages; it fires `reroute:rerender` with `detail.native = true`, so a native screen can re-read `RerouteLegacy.state` on that event.
4. Native pages still use legacy actions: keep `data-action="..."` attributes and the global click delegation keeps working.
