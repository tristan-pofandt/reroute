# Reroute rides switch log

**Status:** Implemented on 2026-10-30 on the branch `feature/rides-switch` for team review. Not merged, not pushed and not deployed; `main` (the demo build) is unchanged. Not tried on a real phone or with participants.

**Who wrote it:** requested by T.P; the code, tests and this log were written by Claude Sonnet via Claude Code. Human review is required before this is treated as final, especially the decision to leave the Terms and Community Guidelines text unchanged while rides are off.

Paths are in `apps/plan-b-mvp/`.

## Why

Nobody is moderating the ride board during the pilot, so the feature needs an off switch that does not need a code change or a new build.

## What changed

| Change | What was built | Where |
| --- | --- | --- |
| Switch | `PLANB_RIDES` is on unless it is `0`, `false` or `off` (any case). Unset means on, so local development and the existing tests are unchanged. | `server.py` `create_app` |
| Rides API | When off, every `/api/rides*` route answers 404 with `{"error": "Shared rides are switched off."}`. | `server.py` `rides_switch` |
| Plan answers | When off, the plan service has no board, so `rides` in a plan answer is an empty list. | `server.py` |
| Status | `/api/status` includes `"rides": true` or `false`. | `server.py` `status` |
| Moderation kept | The `Board` object and `/admin/moderation` are untouched, so an operator can still clear existing posts. | `moderation.py` |
| App | When status says `rides: false`: the side-menu item, the home tile and every "Share this trip" tile on the results screens are hidden, `loadMyRides` does nothing, and opening the rides screen sends the person home. Until status has loaded the feature shows. The React shell renders these screens from the legacy builders, so it needed no change. | `app.js` `ridesOn`, `ridesTile`, `navigate`, `loadMyRides` |
| Cache | Service worker cache bumped to `planb-reroute-24`. | `sw.js` |
| Tests | `test_rides_switch.py` covers off (404s, status, no matches) and the default on. | `test_rides_switch.py` |
| Docs | `PLANB_RIDES` added to both environment tables. | `README.md`, `infra/plan-b-mvp/README.md` |

## Limits

- The Terms of Use, Privacy Policy, Community Guidelines and Support text still describe the ride board; they were not edited because the React legal bodies are synced to the legacy text and the board still exists on the server. Decide whether to reword them while rides are off.
- A device that already holds ride tokens keeps them in local storage; they are ignored while off.
- The switch is read when the server starts, so changing it needs a restart.

## Checks run

- `python -m unittest -q`: 450 tests pass, 1 skipped (2 new in `test_rides_switch.py`).
- `node --check app.js motion.js offline.js sw.js`: pass.
- `web`: `npm test` (75 tests) and `npm run build` pass. No React logic changed, so no new vitest.
- Not run: the app in a browser with `PLANB_RIDES=0`, a real device, the homelab deployment.
