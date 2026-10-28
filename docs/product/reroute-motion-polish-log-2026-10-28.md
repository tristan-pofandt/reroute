# Reroute motion and polish log

**Status:** Implemented on 2026-10-27 and 2026-10-28 on the branch `feature/webgl-overhaul` for team review. Not merged, not pushed and not deployed; `main` (the demo build) is unchanged. Nothing was tested with participants or on a real phone.

**Who wrote it:** requested and directed by T.P; written by Claude Sonnet 5.5 through Claude Code, with subagents for the React shell, screen ports and fixes (see the [AI-use log](../team/ai-use-log.md)). Every commit carries a `Co-Authored-By: Claude Sonnet 5.5` line. A team member who did not build it must review it before merge.

Paths are in `apps/plan-b-mvp/` (the React shell is in `web/`, see `web/README.md`).

## What changed

| Change | What was built | Where |
| --- | --- | --- |
| React shell | A Vite and React 18 shell (React Router, framer-motion, Lenis, a haptics module) hosts the existing screens. `home`, `dashboard`, `rides`, `journey`, `results`, `next`, `weather`, `terms`, `privacy` and `sources` render as React components; `panic`, `nav` and `offline-area` still use the legacy markup through a bridge. | `web/`, `app.js` (bridge), `server.py`, `sw.js` |
| Element-level page transitions | The WebGL liquid veil and 3D accents were tried, then removed. Screens now change with `AnimatePresence mode="wait"`: the old screen's elements stagger out in the direction of travel, then the new screen's elements stagger in. Shared elements (Back, Home, title, Impact button to dashboard figure) morph with `layoutId`. | `web/src/choreography.js`, `web/src/` |
| Menus | The side menu items slide in line by line from the left and leave quickly on close. Settings come from the right and sheets from below. The profile menu grows out of the avatar, diagonally down and left. | `web/src/motion/panels.js`, `motion.css` |
| Exit flicker fix | Buttons and cards had a 200 ms CSS opacity and transform transition that lagged behind framer-motion. That caused the logo, Show routes, I'm taking this trip and Done buttons to flicker on exit and enter late. Only colour and shadow transitions remain inside pages and panels. | `web/src/motion/motion.css` |
| Scroll momentum lean | Blocks lean slightly with scroll speed (3 degrees at most) using the CSS `rotate` property, so it cannot fight other transforms, and it clears at rest. | `web/src/motion/scroll3d.js` |
| Sideways drift | `touch-action: pan-y pinch-zoom`, clipped horizontal overflow and `overscroll-behavior` stop the page moving sideways in the browser. Pinch-zoom still works. | `app.css` |
| Route options list view | A Cards or List toggle compacts the options to the key factors. The choice is remembered in `localStorage`. | `web/src/screens/results.screen.jsx`, `listview.css` |
| Ambient animation | The greenest option pulses gently, leaf icons sway, the route symbol in Plan a trip animates, and the weather icon animates by condition. All are paused when Reduce motion is on. | `web/src/screens/ambient.css`, `weather.screen.jsx`, `app.js` |
| Translink refresh | The separate live-data refresh block is replaced by a small refresh button beside the Translink right now heading, with the last update time (screen readers hear "Live data updated ..."). | `app.js` (`syncCardInner`), `ambient.css` |
| Haptics | Tick on press, soft pulse on menus, snap on success, thud when a card lands, through `navigator.vibrate` (Android) or Capacitor on a native build. iPhone Safari has no Vibration API. | `web/src/haptics.js` |
| Privacy text | The Privacy page wording is unchanged from `main` ("three decimal places"). | `app.js`, `privacy.body.jsx` |

## What was checked

`python -m unittest -q` passes (346 tests) and `npm run build` succeeds. Headless Chrome at 390 px found no console errors, no horizontal overflow and no leftover canvas. The Translink time no longer overlaps its heading.

## Not checked

Real phone touch and haptics; the route options scroll lean and list view by eye with real routes; Show routes, I'm taking this trip and Done clicked through after the flicker fix; the left-menu close by eye; the weather radar map (no browser maps key locally); the `next` screen with a chosen trip.

## Deployment note

`main` deploys with no build step. This branch needs `npm run build` in `web/` and a Docker build change before it can go live.

## Motion audit against Emil Kowalski's rules

Credit: Claude Sonnet 5.5 via Claude Code at T.P's request. Every animation was checked for purpose, frequency, easing, duration, interruptibility and reduced motion. The feel that was kept (staggered page exits and entries, line-by-line menu, scroll reveals, `layoutId` morphs, press and hover, ambient loops, haptics) is unchanged in character; the scroll reveal ranges and logic were not touched. The full table is in `apps/plan-b-mvp/web/README.md` ("Motion principles and timings").

| Item | Before | After | Why |
| --- | --- | --- | --- |
| Page exit | 140 ms each, 30 ms stagger, cap 7, ease-in (about 320 ms) | 120 ms each, 20 ms stagger, cap 5, ease-out (about 200 ms) | Ease-in feels sluggish; faster exit |
| Page entry | spring 500 ms bounce 0.24, 35 ms stagger, cap 10 | spring 400 ms bounce 0.12, 30 ms stagger, cap 7 | Cascade about 350 ms, no wobble |
| Impact morph | spring 550 ms bounce 0.14 | spring 450 ms bounce 0.08 | Calmer and shorter |
| Press release | 220 ms `backOut` | 160 ms ease-out | The overshoot was 0.3 %, invisible; retargets cleanly |
| Hover lift | `backOut` 180 ms | ease-out 150 ms | One easing vocabulary |
| Field focus pop | 0.985 to 1 elastic | removed | Frequent, carries no information |
| Autocomplete rows | rise 200 ms with 28 ms stagger, replayed on every keystroke | none (the list still fades in once) | Fails the frequency test |
| Profile menu | scale from 0.7, spring 420 ms, close to 0.85 in 140 ms ease-in | scale from 0.9, spring 360 ms, close to 0.95 in 120 ms ease-out | Closer to a 0.95 start |
| Menu lines | cap 14, 35 ms stagger (up to 490 ms) | cap 9, 30 ms stagger | Whole menu in about 300 ms |
| Dialog | 200 ms both ways, scale 0.94 with an overshoot curve | open 200-220 ms, close 140 ms, scale 0.95 | Asymmetric |
| Icon and chevron springs (`--spring`) | cubic-bezier with 32 % overshoot | the calm 2 % `--ease-spring` | No wobble |
| Chart bar stagger | 30 ms per bar, unbounded (700 ms for 24 bars) | capped at 8 steps | Short cascade |
| Ambient loops | sway -5 to 6 deg, breathe 1.04, glow 0.75, refresh spin 0.8 s | sway 4 deg, 1.03, 0.6, spin 0.7 s; paused when scrolled out of view | Calmer, no hidden cost |
| Splash | the page cascade starts after 760 ms | 680 ms | The mark is drawn by then |

Checked in headless Chrome at 390 px (sampled frames, no paid APIs): home to the trip screen exit finished in about 250 ms including a tick haptic, menu rows all visible within about 300 ms, press reached 0.97 and release cleared the inline styles, Impact to dashboard settled with no leftover transforms, zero console errors. Not checked: a real phone, haptics, frame rate under load, reduced motion mid-flight after this change, the profile menu by eye, the Cards/List toggle by eye.

## Transition jitter and the side-menu close (measured)

Credit: Claude Sonnet 5.5 via Claude Code at T.P's request. Reported: a split-second jitter going back to the home screen and into "your options", some element-focused transitions feeling jolty, and the home side panel closing too quickly. This section is measured, not guessed: `apps/plan-b-mvp/web/scripts/motion-bench.js` (see web/README.md, "Measuring motion") records every `requestAnimationFrame` delta, `longtask`, `layout-shift` and, after every painted frame, the computed opacity / translate / transform of the moving elements, and flags any direction reversal (a snap-back or a flash). Headless Chrome at 390x844, demo mode, `/api/plan` answered from a fixture (no Google call), the display runs at about 144 Hz so a normal frame is 7 ms. "4x" is `Emulation.setCPUThrottlingRate` 4.

### Root causes

| # | Cause | Evidence | Fix |
| --- | --- | --- | --- |
| 1 | `scroll3d.js` `remeasure()` (a ResizeObserver on the blocks, 120 ms debounce, commit ef4a91e) cleared the inline transform / opacity of EVERY block, and the following flush cleared it again, while framer was animating the same blocks | the entering "your options" chips went 55 px -> 0 px -> 38 px -> 0 px, 120 ms into the entrance, and the view toggle (opacity 0 then) jumped 234 px -> 0 -> 234; the same on every page | Registration, re-measure and re-assert wait for `reroute:settled` (new event from `Page.jsx`); only blocks that start hidden are ever cleared; non-reveal blocks are never touched |
| 2 | app.css `animation: rise / fbIn` CSS entrances on the page blocks (`.wx`, `.card`, `.hero`, `.confirm` ...) ran on top of the choreography and override inline transform / opacity; they had only been silenced by `data-fm`, which fix 1 now sets later | after fix 1 alone the home weather card sat at x = 0 for 80 ms while its opacity rose, then jumped to -89 px | `motion.css` switches those animations off for the direct children of a page's `.scroll`, header and footer |
| 3 | `navigate()` set `app.dataset.screen` at the start of the exit, so the leaving page shifted (the demo pill's 44 px padding is dropped for `nav`) | `layout-shift` 0.052 on the old page, 8 ms after the tap, home -> nav and back | The shell sets it in `pageMounted` only |
| 4 | `reroute:rerender` re-rendered the home / trip trees in the middle of an entrance | rerender marks at 1 ms and 7 ms into journey -> results | `settled.js` `coalesce()`: many events during one transition become one re-render on `reroute:settled` |
| 5 | The close of the menu, Settings and sheets was 160 ms with a very fast start, the scrim 200 ms, and the lines (120 ms + 12 ms stagger) were still leaving when the panel was gone | panel at 66 % of its travel after 20 % of the time | Panel and scrim 300 ms with `--ease-close` (cubic-bezier .4 .55 .2 1: 36 % at 20 % of the time); lines 160 ms, 14 ms apart, top first, the last gone at 272 ms; closing panels let taps through; the menu and profile menu retarget when reopened mid-close |

Not a cause (measured): `will-change` on the page blocks (no consistent gain, worse for weather), long tasks at 1x (none), layout shifts from fonts or scrollbars (none), framer layout (`measureScroll`) at about 6 ms per transition at 4x. Settings open and the weather mount each have one frame of 24-25 ms at 1x (about 100 ms at 4x for weather): the first layout of 400+ nodes; `content-visibility` on Settings gave no reliable gain, so it was left alone.

### Before and after

Before = commit 94d9445, after = HEAD. "Paths" counts elements whose painted path reverses (a visible snap or flash); "frames" are frames over 20 ms / worst frame, per transition window (about 1.3 s, 160-215 frames).

| Transition | Paths before -> after | 1x frames >20 ms, max (before -> after) | 4x frames >20 ms, max (before -> after) |
| --- | --- | --- | --- |
| home -> results | 4 -> 0 | 0, 16 -> 0, 12 | 2, 30 -> 1, 30 |
| results -> home | 4 -> 0 | 0, 9 -> 0, 13 | 1, 30 -> 2, 24 |
| home -> dashboard | 2 -> 0 | 0, 8 -> 0, 12 | 0, 18 -> 0, 18 |
| dashboard -> home | 4 -> 0 | 0, 9 -> 0, 12 | 1, 24 -> 0, 16 |
| home -> weather | 3 -> 0 | 1, 32 -> 1, 25 | 3, 98 -> 4, 53 |
| weather -> home | 4 -> 0 | 0, 15 -> 0, 12 | 2, 30 -> 1, 24 |
| home -> journey | 1 -> 0 | 0, 9 -> 0, 13 | 1, 24 -> 2, 28 |
| journey -> home | 4 -> 0 | 0, 8 -> 1, 31 (once) | 1, 24 -> 1, 24 |
| journey -> results | 4 -> 0 | 0, 9 -> 0, 7 | 1, 24 -> 2, 31 |
| results -> next | 8 -> 0 (see note) | 0, 11 -> 0, 18 | 2, 31 -> 2, 53 |
| next -> results | 4 -> 0 | 0, 8 -> 0, 20 | 1, 24 -> 1, 25 |
| home -> panic | 5 (opacity flash) -> 0 | 0, 16 -> 0, 12 | 1, 24 -> 2, 58 |
| panic -> home | 4 -> 0 | 0, 9 -> 0, 7 | 1, 24 -> 0, 16 |
| home -> nav | 5 -> 0, layout shift 0.052 on the old page -> 0 on it | 0, 15 -> 0, 18 | 0, 19 -> 1, 25 |
| nav -> home | 5 -> 0 | 0, 9 -> 0, 8 | 1, 31 -> 2, 24 |
| menu open | 0 -> 0 | 0 -> 0 | 0 -> 1 (one 25 ms frame) |
| menu close | 0 -> 0 (panel now 300 ms) | 0, 8 -> 0, 8 | 0, 19 -> 1, 24 |
| settings open / close | 0 -> 0 | 0, 16 -> 1, 25 / 0, 9 -> 0, 8 | 2, 49 -> 3, 48 / 0, 18 -> 1, 23 |
| sheet open (share) | 4 (line flash) -> 0 | 0, 10 -> 0, 14 | 0, 19 -> 1, 24 |
| sheet close, profile open / close | 0 -> 0 | 0 -> 0 | 0 -> 0 |

The frame counts at 1x and 4x are dominated by one frame at the instant the next page mounts (React commit, `pageMounted`, Lenis, the first style and layout of the new tree: about 6 ms at 1x, 24 ms at 4x), where nothing is moving yet, so it is not the visible jitter; the snap-backs in the paths column were. Fixing the snaps did not change the frame counts, which were already near the floor; the 4x numbers move by noise (single frames of 24-31 ms either way). The `results -> next` after-note: one below-the-fold card is hidden by the reveal once the page has settled while it still sits under the footer clip (not visible). The raw before / after numbers vary by a frame or two between runs.

Side menu close, measured (1x, frames sampled every second): the panel reaches 12 % of its travel at 27 ms, 65 % at 100 ms, 97 % at 200 ms and is at rest by 300 ms; the scrim is at 0.48 at 82 ms and 0 by 263 ms; the 5th row is gone by 100 ms and the 9th by 173 ms. Reopening 130 ms into a close: the panel turns round from -263 px (no jump to the closed position), one menu element, page inert again.

### Not verified

A real phone (touch, 60 Hz, the browser's compositor on a mobile GPU). The harness runs headless on a fast display, so jitter that comes from the GPU or from a 60 Hz vsync is outside what these numbers show; the 4x CPU throttle is only a proxy for a slower CPU.

## The Impact button, and page transitions on the compositor (measured)

Credit: Claude Sonnet 5.5 via Claude Code at T.P's request. Reported: (1) the green leaf Impact button on the home screen "just appears and disappears" when the menu or screen changes; (2) transitions do not feel smooth on a phone over Tailscale (60 or 120 Hz). Branch `feature/webgl-overhaul` only; nothing pushed or merged. Headless Chrome at 390x844 on a 144 Hz machine flatters every number below (see "Not verified").

### Root cause of (1)

The Impact button is a framer-motion `layoutId` shared element (`impact`), and the rule in `shared.jsx` was "a shared element takes no part in its screen's stagger". That is only right when something on the next screen can take over the `layoutId`. The only partner is the dashboard's `.kpi.lead` figure, and that exists only once a trip is logged. Going from home to Weather, Results, Journey, Panic, Nav or an empty dashboard (demo mode has no trips), nothing morphed and nothing staggered: the button sat still at full opacity while its neighbours left, then the whole page was unmounted and it was simply gone, and on the way back it was simply there when the new page mounted. Measured before the change (home -> weather, per frame): opacity 1.0 and x 180 px until the page was removed, then absent for about 100 samples. The same rule left Back, Home and the title un-animated whenever the other screen was drawn by the legacy HTML (panic, nav, offline-area), which cannot carry a `layoutId`.

Fix: a shared element is exempt only when the screen being navigated to / from has its counterpart (`hasShared`: native screen, and the element is in its markup; the dashboard lead figure is checked against the current data). Otherwise it is a normal item: it slides and fades with the travel direction, in DOM order (so in the header row it goes with the brand and the profile button), with the same easing and stagger. A shared element without a counterpart also gets its own `layoutId` namespace, because framer keeps the last box of a removed node and would otherwise morph an unrelated element out of a stale position. Measured after (home -> weather): opacity 1 -> 0.84 -> 0.31 -> 0.05 -> 0 and x 180 -> 148 -> 41 -> -13 -> -54 over about 100 ms, one direction, no reversal; weather -> home reverses it (arrives from the left, 0 -> 1 over about 250 ms). With a trip logged, home <-> dashboard still morphs (x 180 -> 49 px, opacity 1 throughout, no reversal), and with the dashboard empty it slides and fades like the rest. Checked for home <-> results, weather, journey, dashboard (with and without a trip) and panic: no opacity or position reversal on any path.

### What was done for (2)

Measured first (baseline, commit f8bf7ff): at 1x the worst frame of a page change was 66 ms (home -> weather: a 57 ms long task, `pageMounted` mounting maps and charts while the entrance ran) and 31 ms (Settings open); at 4x CPU throttle 18 of 24 transitions had one to three frames over 20 ms (worst 61 ms). The cause is structural: every page element and panel line was a framer-motion spring writing inline style on the main thread every frame, so any main-thread work in the first 100 ms of a transition showed up as a dropped frame.

- Pages (exit and entrance), menu / Settings / sheet lines, the profile menu items, the splash, the skeleton cross-fade and press / hover feedback are now Web Animations on `translate`, `opacity` and `scale` (compositor thread). The spring is precomputed once into 21 keyframes from framer's own spring generator (same duration and bounce, so the look and timings are unchanged), the leaving ease-out into 13, cached per offset. Animations start in the layout effect of the commit that mounts or removes the page and fill backwards, so the first painted frame is already the start pose.
- Work that sat in front of the entrance now runs after the first frame: the heavy half of legacy `pageMounted` (focus, maps, charts; `lateMount` in `app.js`, flushed earlier by `pageSettled` or `rerender`), Lenis, the motion layer's block sweep and ambient scan.
- Elements outside the viewport are not animated (the scroll reveals own them); items nested in other items are skipped; the exit cap is 5 again (the default had drifted to 7 for the legacy path).
- The profile menu lost its diagonal clip-path reveal (main-thread paint); it still grows out of the avatar with opacity, scale and translate.
- Shared-element presence is read from each screen's markup once per screen and warmed when the browser is idle.
- Not changed: scroll reveals (`scroll3d.js`), the `motion.css` flicker rule, haptics, the no-jitter fixes from 669470e (reveals wait for `reroute:settled`, coalesced re-renders), timings, easing, stagger, travel. The `layoutId` morphs remain on the main thread (one button, one figure).

### Before and after

Frames over 20 ms / worst frame, per transition window (about 1.3 s), `scripts/motion-bench.js`, before = f8bf7ff, after = HEAD. 4x = `Emulation.setCPUThrottlingRate` 4.

| Transition | 1x before -> after | 4x before -> after |
| --- | --- | --- |
| home -> results | 0, 12 -> 0, 8 | 1, 23 -> 1, 23 |
| results -> home | 0, 13 -> 0, 9 | 2, 48 -> 1, 23 |
| home -> dashboard | 0, 12 -> 0, 15 | 1, 24 -> 1, 48 |
| dashboard -> home | 0, 12 -> 0, 9 | 1, 24 -> 1, 24 |
| home -> weather | 1, 66 -> 0, 16 | 3, 61 -> 1, 56 |
| weather -> home | 0, 18 -> 0, 9 | 1, 36 -> 2, 23 |
| home -> journey | 0, 19 -> 0, 9 | 2, 24 -> 1, 24 |
| journey -> home | 0, 13 -> 0, 8 | 1, 25 -> 1, 23 |
| journey -> results | 0, 7 -> 0, 10.6 | 0, 18 -> 1, 24 |
| results -> next | 0, 12 -> 0, 9 | 1, 26 -> 1, 23 |
| next -> results | 0, 12 -> 0, 9 | 0, 18 -> 0, 15 |
| home -> panic | 0, 12 -> 0, 9 | 1, 31 -> 1, 24 |
| panic -> home | 0, 13 -> 0, 9 | 0, 18 -> 0, 16 |
| home -> nav / nav -> home | 0, 12 / 0, 13 -> 0, 9 / 0, 8 | 1, 23 / 0, 19 -> 0, 8 / 0, 16 |
| menu open / close (button) / close (backdrop) | 0, 12 / 0, 13 / 0, 7 -> 0, 9 / 0, 9 / 0, 17 | 0, 18 / 0, 13 / 0, 19 -> 0, 16 / 0, 16 / 0, 8 |
| settings open / close | 2, 31 / 0, 13 -> 0, 16 / 0, 9 | 2, 61 / 1, 24 -> 2, 61 / 1, 24 |
| sheet open / close | 0, 7 / 0, 7 -> 0, 16 / 0, 9 | 0, 19 / 0, 18 -> 1, 24 / 0, 16 |
| profile menu open / close | 0, 8 / 0, 13 -> 0, 8 / 0, 9 | 0, 13 / 0, 12 -> 0, 9 / 0, 9 |

At 1x no transition has a frame over 20 ms any more (the 66 ms home -> weather frame and its long task are gone: `pageMounted` no longer sits in the entrance). At 4x the totals are about the same (18 frames over 20 ms before, 17 after): what remains is the one frame in which React mounts the next page, which is main-thread by nature (the leaving animation has ended and the entrance has not started, so the picture holds still for that frame; 23 to 24 ms, 56 ms for Weather, 61 ms for Settings which builds its panel HTML on open). Those frames are no longer inside a running animation, but they are still there.

Off-main-thread check (`scripts/motion-perf.js`, `mode: "busy", busy: "freeze", freezeAt: "mount"`): the main thread is blocked for 300 ms starting 100 ms after the next page is in the DOM, and the screen is recorded from the compositor. "Pictures that still changed during the block": a CSS transform animation (control, compositor by construction) 6 to 8; before this change 1 to 4 (home -> weather 2, weather -> home 4, home -> journey 3, home -> dashboard 4, dashboard -> home 3, home -> panic 1); after 6 to 7 on every page change (7, 7, 6, 6, 6, 6), so the entrance keeps moving through a blocked main thread. With the block 90 ms after the click (during the exit) the exit also keeps running; only the hand-over to the next page waits for the main thread.

Checked (headless): Reduce motion (`data-motion=reduced`) swaps pages in 12 ms with no animations left, and flipping it mid-entrance, mid-exit and mid-menu-open leaves no running animation, no inline opacity / translate, no `will-change`, nothing `inert`; `html.fm` comes back when set to full; browser Back during a page's exit, during its entrance, and a Back / Forward / Back spam all end on the right page, nothing inert, no running animation, no inline translate; press and release retarget from the current scale and end with no inline style; no console errors or warnings over the whole run; `python -m unittest -q` (346 tests) passes.

### Not verified

A real phone. Everything above is headless Chrome on a 144 Hz display (so frames are 7 ms and a 60 Hz vsync is not exercised), with a synthetic CPU throttle and a synthetic main-thread block; mobile GPU memory for the extra compositor layers (a layer per animated element for about 600 ms, at most the visible ones) and Safari's handling of animated `translate` and `scale` (the individual transform properties need Safari 14.1 or later; older browsers get no animation, the page still swaps) were not tested. The `journey -> results` bench row flags a 0.2 opacity reversal on one or two below-the-fold blocks about one run in three (borderline blocks behind the sticky footer, partly under the scroll reveals); it is not visible and was not present before. The screencast measure has a cadence of about 30 pictures per second, so it distinguishes "moving" from "frozen", not 60 from 120 fps.
