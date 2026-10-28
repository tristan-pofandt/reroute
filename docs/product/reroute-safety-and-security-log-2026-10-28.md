# Reroute safety and security log, 2026-10-28

Written by Claude Sonnet 5.5 via Claude Code at T.P's request, on branch `feature/accounts`. **Human review required** for every item below; none of it was tested on a device or reviewed by a lawyer.

Goal: meet the store and policy safety requirements for user-generated content (Apple 1.2, Google Play UGC) and a security baseline, without changing how the app feels. From the store-readiness audit: gaps 2 (UGC safety), 3 (support contact, partly) and 8 (security).

## What changed

| Area | Change | Where |
|---|---|---|
| Ride board safety | Report and Block on every post by someone else; community rules box with required acknowledgement; "Under review" badge; Blocked list with Unblock; 24 hour response statement and abuse address on the board and in the report sheet | `app.js` (rides section), `web/src/screens/safety.css`, `rides.screen.jsx` |
| Server safety | Reports with reasons, auto-hide at 3 distinct reporters, blocks per account or device, bans, per-poster rate limits, objectionable-content and contact-detail filter with an editable word list, expiry of posts and their reports, 90 day moderation log | `rides.py`, `contentfilter.py`, `moderation/wordlist.txt`, `server.py` |
| Operator tool | `/admin/moderation` HTML and JSON, token-guarded (`PLANB_ADMIN_TOKEN`), approve, remove, ban, unban | `moderation.py` |
| Pages | Community Guidelines `/community`, Licences `/licences`, Support and contact `/support`, in the router, Flask allow-list, side menu, home legal links and About | `web/src/screens/*.screen.jsx`, `legal/*.body.jsx`, `Routes.jsx`, `server.py`, `app.js` |
| Licences | Generator for npm and Python notices, data attributions, mismatch note | `web/scripts/gen-licences.mjs`, `licences.data.json`, `docs/engineering/data-licences.md` |
| Security | CSP (enforced by default, `PLANB_CSP_ENFORCE=0` for report-only), HSTS on HTTPS, nosniff, referrer, permissions and frame policies, explicit CORS allow-list, 256 KiB body cap, JSON-only error responses, query-free access logs, `/api/fuel` input fix | `security.py`, `server.py`, `infra/plan-b-mvp/Dockerfile` |
| Storage | Ride board moved from `rides.json` to SQLite with a one-time import (file kept) | `rides.py` |
| Dependencies | `react-router-dom` 6.30.6 (three highs cleared); `pip-audit` clean | `web/package.json` |
| Tests | 27 moderation tests and 10 security tests; one existing test updated (the ride file is now `rides.sqlite3`) | `test_moderation.py`, `test_security.py`, `test_rides.py` |

Environment variables added (names only): `PLANB_ADMIN_TOKEN`, `PLANB_CSP_ENFORCE`, `PLANB_CORS_ORIGINS`. Endpoints added: `POST /api/rides/report`, `POST /api/rides/block`, `POST /api/rides/unblock`, `GET /api/rides/blocks`, `POST /api/csp-report`, `GET /admin/moderation`, `POST /admin/moderation/login`, `POST /admin/moderation/action`. The ride calls now take an `X-Reroute-Device` header and the create call requires `rules_ack: true`.

## How it was checked

* `python -m unittest -q`: 417 tests pass (`test_moderation`, `test_security` included).
* `npm run build` in `web/`: passes.
* Playwright at 390 by 844 with the CSP enforced, service workers and caches cleared: every legal page, the home, weather, dashboard, offline-area, panic and rides screens; posted a ride (rejected for a missing acknowledgement and for a phone number, accepted when clean), reported a post, blocked a poster (card disappears, server list matches), saw the Blocked list. Zero CSP violations. The only console errors were the browser noting the deliberate 400 answers.
* `pip-audit -r requirements.txt`: no known vulnerabilities. `npm audit --omit=dev`: two moderate react-router advisories that need v7 (see `security.md`).

## Not verified or not done

* The Google Maps and Google Fonts hosts under the enforced CSP (no key or network in the test).
* Docker build (Docker is not installed on this machine); no new Python dependency was added.
* Live behaviour of the admin page on a real host, and a real mailbox: both contact addresses are the placeholders `support@reroute.invalid` and `abuse@reroute.invalid`.
* The privacy text (owned by the accounts work) still describes console logs that "include" query data; with this change query strings are no longer written to Flask or gunicorn logs.

## Needs the human

1. Create and monitor the abuse and support mailboxes; replace the placeholders (`contact.js`, `ABUSE_EMAIL` in `app.js`).
2. Set `PLANB_ADMIN_TOKEN` as a host secret, add a persistent disk, and agree who checks the queue each day.
3. Read and approve the Community Guidelines wording and the 24 hour target; extend the word list.
4. Resolve the Translink licence wording (`data-licences.md`) and decide RainViewer and Open-Meteo for commercial use.
5. Check the CSP on a real deployment with a Maps key; check store policy text for Apple 1.2 and Play UGC.
6. Update the Privacy page for the new data (poster ids, reports, blocks, device id, 90 day moderation log) and for the logging change.
