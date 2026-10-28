# Reroute integration pass (2026-10-28)

Branch `feature/accounts` only; nothing merged or pushed. Written by Claude Sonnet 5.5 via Claude Code at T.P's request. **Human review required.**

## What changed

1. **Privacy and Terms.** Privacy Policy v2.0 (plain-language summary, ride-board poster codes and the device-id header, reports/blocks/bans and the 90-day log, consent-gated analytics and crash reports, push tokens, location, retention list, rights under the Australian Privacy Principles and GDPR-style rights, children, transfers, cookies, changes, contact) in `privacy.body.jsx` and, identically, `app.js` (`web/scripts/sync_legacy_legal.py`, guarded by `test_legal_sync.py`). The outdated "logs include query strings" statement is corrected. Terms and Community Guidelines made consistent. New `docs/engineering/privacy-data-map.md`; both store listing drafts and `PrivacyInfo.xcprivacy` brought in line (device id, ride-board content, opt-in analytics; age rating decision: not 4+). Found and repaired a pre-existing break in the legacy `app.js` where the Account fallback function had been inserted in the middle of the Terms template.
2. **Account screen on native.** Google/Apple buttons call the lazy `native/auth.js` (nonce, ID token) and POST to `/auth/native/google|apple`; the bearer token is kept in `localStorage` and sent on every call; the web redirect flow is unchanged; Apple is not offered on Android. `/api/auth/providers` returns the public `native_config`. `accounts.py` `origin_ok` honours `PLANB_CORS_ORIGINS`; `api.js` rewrites `/auth/...` too. Tests: 2 Python, 5 vitest.
3. **Loose ends.** (a) offline day control wraps at large text; (b) trip-summary strip focusable with a group role; (c) home tile headings `aria-level=2`; (d) `safety.css` in rem; (e) removed `local-notifications`, `preferences`, `device` (nothing imported them; no native permissions existed for them), `cap sync` run; (f) auto-hide logs a WARNING and optionally POSTs to `PLANB_ALERT_WEBHOOK` (post id, count, reason codes only); (g) axe: **0 violations in dark and light** at 100% (was 6 nodes in 3 rules in dark); (h) `offline_area_downloaded` fires on completion or failure with bucket labels; (i) `GIT_SHA` documented, update-script change proposed (not applied).
4. **Well-known files.** Association files are served only if they are valid JSON, as `application/json`, with no redirect, with accounts on or off (tests). The Dockerfile passes `GIT_SHA` to the web stage too; native projects are excluded from the image.

## LXC build verification (home-lab container 101, throwaway image `reroute-test2`, port 8098, named volume)

- `docker build` of `HEAD` df27bd6 succeeded (BuildKit, `--build-arg GIT_SHA=df27bd6`).
- `/` 200, `/api/status` 200, `/healthz` 200 `{"status":"ok","version":"df27bd6",...}`, `/account/delete` 200, `/community` 200, `/privacy` 200, `/account` 200, `/api/auth/providers` 200, `/.well-known/assetlinks.json` and `apple-app-site-association` 200 `application/json` with no redirect, the domain-association file 404 while its variable is unset. CSP header present.
- Container user `planb` (uid 10001) wrote `accounts.db`, `rides.sqlite3`, `vapid.json` and `gtfs/` into the named volume; the data survived a container restart.
- Cleaned up: test container, image, volume and `/tmp/rtest2` removed; the running `reroute` container, the other containers and `/opt/reroute` were not touched.

## Final checks

`python -m unittest -q`: 435 tests OK. `npm run build` and `npm test` (44 tests) OK. Browser smoke at 390x844 with the CSP enforced and service workers/caches cleared: journey, dashboard, rides, weather, offline-area, terms, privacy, about, community, licences, support, account, panic: zero console errors, zero CSP violations. (Results, next steps and the option sheet were covered by the axe harness with its fixture plan.) Direct navigation to `next` or `journey` without a plan throws in the legacy code; the UI never reaches them that way.

## Still needs a human

- Replace the placeholder contacts, fill every `[TODO]` in the Privacy page (legal entity, host and region, PostHog and Sentry regions and retention, log retention), and have the text reviewed by someone qualified.
- Real Google/Apple credentials; native sign-in is untested on a device. Move the native bearer token to Keychain/Keystore before release.
- Apply the `--build-arg GIT_SHA` change to `/opt/reroute/update.sh`; set `PLANB_ALERT_WEBHOOK` and `PLANB_CORS_ORIGINS` on the host.
- Enter the store forms from the data map; confirm the age rating the forms return.
