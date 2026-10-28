# Analytics, crash reporting and health endpoints: implementation

Prepared by Claude Sonnet 5.5 via Claude Code at T.P's request. **Human review required** (especially the consent wording, which is not legal advice). Implements `docs/product/analytics-and-metrics-2026-10-28.md` sections 3, 4 and 10.

## Default is off

Nothing is sent, no consent UI is shown and no cookies are set unless the build has `VITE_POSTHOG_KEY` **and** `VITE_POSTHOG_HOST` (usage events) or `VITE_SENTRY_DSN` (crash reports) **and** the person has chosen "Allow". Set them as environment variables at build time (never in the repo):

```
VITE_POSTHOG_KEY=phc_... VITE_POSTHOG_HOST=https://eu.i.posthog.com VITE_SENTRY_DSN=https://...@o0.ingest.sentry.io/0 GIT_SHA=$(git rev-parse --short HEAD) npm run build
```

## Front end (`web/src/analytics`, `web/src/errors`)

- `schema.js`: the event allow-list from section 4. Unknown events, unknown properties and values that fail a check (booleans, numbers, short enum strings, bucket labels) are dropped. A test fails if a property name looks like PII.
- `consent.js`: `planb.analyticsConsent` (`granted` / `denied`) and `planb.analyticsId` (random UUID per install, created only after consent, deleted on withdrawal). Not asked counts as no.
- `index.js`: `track(event, props)`. Returns at once without consent or build keys. Batches for 5 s, posts to `${host}/batch/` with `sendBeacon` (fallback `fetch` with `credentials: "omit"`), so no cookies. Events carry `schema_version`, `app_version` (release), `platform`, `display_mode`, `session_id` (per page load, not stored), and `$process_person_profile: false`. Never throws.
- `hooks.js`: instruments the legacy app without editing its logic: one capture-phase click listener on `[data-action]`, a watcher on `#app[data-screen]`, `appinstalled`, a wrapper on `Notification.requestPermission`, and two document events for other modules: `reroute:track` (`{event, props}`) and `reroute:account` (`{type: "created"|"signed_in", provider}`; the accounts code should dispatch it). It also supplies the Settings row (`window.RerouteAnalytics.settingsGroup()`, one line in `app.js`).
- `ConsentSheet.jsx`: first-run bottom sheet using the app's `.sheet-backdrop`/`.sheet` classes (2.5 s after launch, `role="dialog"`, `aria-modal`, focus trap, Escape and outside tap = "No thanks"). Settings has "Share anonymous usage data" (default off). Declining changes nothing else.
- `errors/report.js`: Sentry (`@sentry/browser`) is imported lazily only with `VITE_SENTRY_DSN` and consent; no default integrations, no breadcrumbs, no user/request data, URLs reduced to origin+path, release = `GIT_SHA`. `installGlobalHandlers()` reports `window.error` and `unhandledrejection`. `ErrorBoundary.jsx` shows "Something went wrong / Reload" in the app's style and reports.

Known approximations: `offline_area_downloaded` fires when the download is requested, not when it finishes (no `success`/size props); `trip_planned` fires when the results screen is shown with no latency or Google-call count; `option_selected`/`panic_option_chosen` send `mode` only if the button has `data-mode` (it is dropped otherwise); `push_enabled` reports `platform: "desktop"`. Improve by dispatching `reroute:track` from `app.js` at the true points. `user_hash` (HMAC of the account id) is not sent from the client: it must be computed server-side and is not implemented. Enable "discard client IP data" in the PostHog project, since the request IP is still visible to the host.

## Server (`ops.py`, `usage.py`)

- `GET /healthz`: `{status, version (env GIT_SHA), app_version, uptime_s}`. `GET /readyz`: adds checks (data directory writable; GTFS index loaded is reported but not fatal), 503 if not ready. Both are no-store and need no auth: point Uptime Kuma at `/healthz` (keyword `"ok"`), alert on `/readyz`.
- `GET /admin/usage` with `Authorization: Bearer $PLANB_ADMIN_TOKEN`: per-day (Brisbane) Google request counts by API and SKU with a cost estimate from `google_api.PRICES`. Counted in `google_api.record_request` (every real, uncached call). Disabled (404, same as a wrong token) when the env var is unset. In memory only: a restart resets it.
- Sentry for Flask: set `SENTRY_DSN` (and `pip install "sentry-sdk[flask]"`; not in `requirements.txt` on purpose). `send_default_pii=False`, request bodies, cookies, headers and query strings stripped, no tracing.
- Docker: `ARG GIT_SHA` sets the env var. In `update.sh`/deploy: `docker build --build-arg GIT_SHA=$(git rev-parse --short HEAD) ...` and pass the same value to the web build stage if you want the front-end release tag to match.

## Text for the Privacy page (paste, then have a human review)

> **Usage data and crash reports (optional).** If you choose "Allow anonymous usage data", Reroute counts which features you use (for example, that a trip was planned or an option chosen) and sends crash reports when something breaks. These are tied to a random code created on your device, not to your name, email or account. They never include the places you search, your location, ride-board text or contact details. The data is processed by PostHog (usage) and Sentry (crashes), which may store it outside Australia, and is deleted after 90 days (usage) or 30 days (crashes) [confirm in the vendor settings]. It is off until you choose, you can change your mind at any time under Settings > Share anonymous usage data (turning it off stops sending and deletes the random code), and Reroute works the same either way. Separately, the server keeps daily totals of how many Google Maps requests were made, with no information about who made them, to control costs.
