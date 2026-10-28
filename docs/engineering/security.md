# Security hardening

Written by Claude Sonnet 5.5 via Claude Code at T.P's request, 2026-10-28. **Human review required:** this is a baseline hardening pass, not a penetration test or a security audit. Store-readiness audit gap 8.

## Threat model summary

| Asset | Threat | Main control |
|---|---|---|
| Google Maps server key | Leaks to the browser or the repo | Server-side only; the browser gets a separate restricted key; no secrets in the repo (env vars) |
| Google quota and bill | Anyone on the internet runs searches | Per-address hourly limits, daily caps (`limits.py`, `server.py`) |
| Users' privacy | Coordinates and searches ending up in logs; third-party data flows | Query strings stripped from access logs; no analytics without consent; privacy page |
| Ride board | Abuse, scams, harassment, spam, data scraping | See `ride-board-moderation.md`; no contact details accepted; coordinates rounded to 100 m; posts expire |
| Accounts | Session theft, CSRF, open redirect | Handled in `accounts.py` (see `accounts.md`) |
| Browser | XSS via user text, clickjacking, mixed content, drive-by third-party script | Output escaping (`esc()`), CSP, `X-Frame-Options`, HSTS |
| Operator tools | Guessable or leaked admin access | `PLANB_ADMIN_TOKEN`, constant-time compare, throttle, Strict cookie, own CSP |
| Server | Oversized bodies, stack traces in responses, vulnerable dependencies | 256 KiB body cap, JSON-only errors, `npm audit` and `pip-audit` |

Out of scope: the hosting platform, DNS and TLS certificates, denial of service by large botnets, the native shells (separate review), the Google, Apple, Translink and Open-Meteo services themselves.

## Response headers (`security.py`)

| Header | Value | Why |
|---|---|---|
| `Content-Security-Policy` | `default-src 'self'`; scripts from self, `maps.googleapis.com`, `*.gstatic.com` and a SHA-256 hash of the one inline theme script (no `unsafe-inline`); styles self, `unsafe-inline` (React and Google Maps set style attributes), `fonts.googleapis.com`; images self, `data:`, `blob:`, Google map hosts, RainViewer; fonts `fonts.gstatic.com`; connect self, Google, RainViewer; workers self and `blob:`; `object-src 'none'`; `base-uri`, `form-action`, `frame-ancestors` self; `report-uri /api/csp-report` | Stops injected script and data exfiltration to unknown hosts |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Only when the request is HTTPS (directly, or via `PLANB_TRUST_PROXY` and `X-Forwarded-Proto`), so local HTTP development is unaffected |
| `X-Content-Type-Options` | `nosniff` | No MIME sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Do not leak paths and queries to third parties |
| `Permissions-Policy` | `geolocation=(self)`, camera, microphone, payment, usb, bluetooth, serial, interest-cohort all off | The app only needs location |
| `X-Frame-Options` | `SAMEORIGIN` (plus CSP `frame-ancestors 'self'`) | Clickjacking |
| `Cross-Origin-Opener-Policy` | `same-origin-allow-popups` | Isolation that still lets Google sign-in popups work |
| `Access-Control-*` | None by default | See CORS below |

The CSP was measured with the policy enforced on `/`, `/terms`, `/privacy`, `/about`, `/community`, `/licences`, `/support`, and the home, journey, results, rides (post, report, block), weather, dashboard, offline-area and panic screens at 390 by 844 (Playwright, service workers and caches cleared, demo mode): zero `securitypolicyviolation` events and zero CSP console errors. **Not verified:** the Google Maps JavaScript API and Google Fonts files, because this machine has no Maps key and no network path to those hosts in the test. The allowed hosts follow Google's published CSP guidance; if a map or the font fails to load on a real deployment, set `PLANB_CSP_ENFORCE=0`, reload, read the `CSP violation` warnings in the server log, and add the host in `POLICY` in `security.py`. It is enforced by default; `PLANB_CSP_ENFORCE=0` makes it report-only.

## CORS

None by default: same-origin only, and the existing `Origin` check on every JSON POST still refuses other sites. For the native Capacitor app set `PLANB_CORS_ORIGINS=capacitor://localhost,https://localhost,ionic://localhost` (comma list, exact match). Listed origins get `Access-Control-Allow-Origin` for that origin only (never `*`), `Vary: Origin`, and preflights answer 204 with `GET, POST, OPTIONS` and headers `Content-Type, Authorization, X-Reroute-Device, X-CSRF-Token`. No credentials are allowed cross-origin (the native app should use bearer tokens). Account routes keep their own origin check in `accounts.py`, which now honours the same `PLANB_CORS_ORIGINS` list (exact origin match), so the native app can call `/auth/native/*` and `/api/account/*`.

## Input validation review of `/api/*`

Reviewed every route in `server.py`. All JSON POSTs go through `read_json`: JSON content type, same-origin check, body size cap (8 KiB; 16 KiB push subscribe; 32 KiB live), `application/json` only; invalid JSON, wrong types and missing fields end in a generic 400. Query routes validate lengths and types (`autocomplete` 2 to 120 characters and a session pattern, `place` id pattern, `vehicles` at most ten ids matching `ROUTE_ID`, `offline/*` bounding box and day parsing, `traffic` radius clamped). **Fixed:** `/api/fuel` took any float for latitude and longitude (including NaN and places outside Australia) and passed it to Google; it now uses the same Australia-only check as the other routes. A global 256 KiB `MAX_CONTENT_LENGTH` is the backstop. Ride-board input is validated field by field in `rides.py` (types, lengths, control characters, seat and cost ranges, time window, coordinates rounded) and by the content filter.

## Errors and logging

Unknown `/api` paths and wrong methods answer JSON (`Not found.`, `That method is not allowed.`, `The request is too large.`); any unhandled exception answers `{"error": "Something went wrong on the server."}` with status 500 and the traceback only in the server log. Access logs are scrubbed: the Flask development server and gunicorn log the path without the query string (`security.StripQuery`, the Dockerfile `--access-logformat`), because queries carry typed addresses and coordinates. Application logs do not log tokens, emails or coordinates (reviewed `app.logger` and `log` calls; the accounts code logs ids only). CSP reports are logged as the directive and the blocked host, with queries removed. Hosting platforms keep their own request logs; check them.

## Ride store: JSON file to SQLite

`data/rides.json` (one `write_text` per change, no lock, a crash mid-write lost the board) is replaced by `data/rides.sqlite3` (WAL mode, `BEGIN IMMEDIATE` transactions, a thread lock and SQLite's own cross-process lock, busy timeout 5 s). On first start an existing `rides.json` is imported once (recorded in the `meta` table) and **left in place as a backup**; a corrupt file imports nothing. Verified by tests: restart persistence, one-time import, two connections writing to the same file, `PRAGMA integrity_check`. Other files: `push.json` is written to a temporary file and renamed (atomic); the one-time `vapid.json` write and the GTFS and offline caches are written once and rebuilt if lost. `accounts.db` is SQLite (accounts owner).

## Dependencies

* `npm audit fix` (no `--force`): `react-router-dom` 6.30.1 to 6.30.6 (pulls `@remix-run/router` 1.23.4 and `react-router` 6.30.6), which clears the three high advisories (open redirect and XSS via redirects) in the production dependencies. The build and the browser smoke pass.
* Remaining `npm audit` items: two **moderate** `react-router` advisories (open redirect via backslash in `<Link>`/`useNavigate`, and `deserializeErrors` in SSR hydration) whose fix is react-router 7, a breaking change. The app only navigates to fixed internal paths and does not server-render, so it is not exploitable as used; schedule the v7 upgrade. The other items (`tar`, `uuid`, `sharp`/libvips, `tinypool`, `esbuild`, vitest mocker) are in development or native-tooling packages (`@capacitor/cli`, `@capacitor/assets`, vitest) and are not shipped in the web bundle; they have no fix available upstream or need major upgrades.
* `pip-audit -r requirements.txt` (installed with `pip install pip-audit` in the user Python, not a scratch environment): **no known vulnerabilities**. Run it in CI.
* No new Python dependency was added (SQLite is in the standard library, `markupsafe` ships with Flask).

### Dependency decision, final fix pass (2026-10-29)

Read with `npm audit --json`: the two production advisories are both on `react-router` (and `react-router-dom`), fixed only in 7.18.0+.

| Advisory | Affects | Evidence for this app | Decision |
|---|---|---|---|
| GHSA-wrjc-x8rr-h8h6, open redirect via a backslash in `<Link>` / `useNavigate` (CVE-2025-68470 bypass) | A path chosen by an attacker reaching `navigate()` or `<Link to>` | `grep` over `web/src`: no `<Link>`, `<NavLink>` or `<Navigate>`; the only `navigate()` call is `Routes.jsx:37` and its argument is a fixed internal path from the `LEGAL` table, `"/"` or the current pathname, never a query value or user text. `deeplinks.js` uses `history.pushState` after mapping to known screens. Server-side `?next=` goes through `safe_next` (`accounts.py`), unrelated to react-router. | **Not applicable as used.** Not upgraded: 7.x is a major bump that changes the router package layout for no gain. Revisit with the next planned dependency round. |
| GHSA-337j-9hxr-rhxg, arbitrary constructor injection via `deserializeErrors()` in SSR hydration | Server rendering with a data router (`createStaticRouter` hydration data) | No SSR, no data router (`createBrowserRouter`, `RouterProvider`, loaders and `__staticRouterHydrationData` are absent); only `<BrowserRouter>` renders in the browser from the static `dist`. | **Not applicable.** |

Other findings in the full `npm audit` (development and native tooling only, none in `dist`, found now because the advisory database moved on since the earlier pass): `vite` 5.4.x and `esbuild` (dev-server request and `server.fs` issues; the project only runs `vite build`, never the dev server on a shared network; bumped 5.4.11 to 5.4.21, the last non-breaking 5.x, the remaining advisories need vite 7), `vitest`, `@vitest/mocker`, `tinypool` (test runner and its UI/mock features, run only locally and in CI on repository code; vitest 5 is a major upgrade, schedule it), `tar`, `@capacitor/cli`, `@capacitor/assets`, `@trapezedev/project`, `xcode`, `uuid` (Capacitor CLI and asset tooling, run by the developer on trusted project files, never on untrusted archives) and `sharp` (used by `make-native-assets.mjs` and `gen-store-assets.mjs` on our own SVG only). None is reachable from the deployed app. CI keeps `npm audit --omit=dev` (production dependencies) as the gate: `ci.yml` at `--audit-level=high`, `release.yml` at `--audit-level=moderate`, so the release job will fail until the react-router item is upgraded or this "not applicable" decision is accepted by the reviewer and the level raised. `pip-audit -r requirements.txt` re-run 2026-10-29: no known vulnerabilities; it runs in `ci.yml` and `release.yml`.

## Residual risks

1. CSP not verified against live Google Maps and Fonts hosts (see above); `style-src 'unsafe-inline'` remains.
2. Rate limits and poster ids are per process; a second gunicorn worker would split them (the image runs one on purpose).
3. Guests can evade bans and blocks by clearing storage.
4. The content filter is English-only and simple.
5. `X-Forwarded-For` trust depends on `PLANB_TRUST_PROXY` matching the real proxy count; a wrong value lets visitors fake their address.
6. The admin token is a single shared secret with no audit trail beyond the moderation log.
7. The image was built and smoke-tested on the home-lab LXC on 2026-10-28 (see the integration log); no image vulnerability scan was run.
8. The gunicorn and Render platform logs may still record query strings outside our control.
9. Native apps and the account flows were not reviewed in this pass.
