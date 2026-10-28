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
