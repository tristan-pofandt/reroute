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
| home -> panic | 5 (opacity flash) -> 0 | 0, 16 -> 0, 12 | 1, 24 -> 2, 24 |
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
