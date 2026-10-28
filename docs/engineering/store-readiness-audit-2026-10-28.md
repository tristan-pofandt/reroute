# Reroute store-readiness audit (Apple App Store and Google Play)

Date: 2026-10-28. Branch `feature/accounts`, app `apps/plan-b-mvp`.
Prepared by Claude Sonnet 5.5 via Claude Code at T.P's request.

**Human review required.** This is an AI-written engineering audit, not legal advice. Store policies, licence terms and API versions change; every item marked "check the current text" was not re-verified against the live policy on 2026-10-28 (no web lookups were made; the policy facts below are from the model's knowledge, cut off mid-2026). A team member must confirm each blocker against the current Apple and Google text before spending money. Nothing was tested on a physical phone, with a screen reader, or with a store submission tool.

Scope notes: the accounts system (Google/Apple sign-in, deletion, export) is being built concurrently on this branch and is counted as **in progress**, not audited. "Reroute" here is a transit/trip-planning/maps app; it uses Google Maps Platform but is not Google Maps.

Status key: HAVE / PARTIAL / MISSING. Priority: **blocker** (will be rejected or is unlawful/unusable), **should**, nice.

## 1. Headline summary

Verdict: the web product is unusually complete for a student project (offline area, push, legal pages, rate limits, 346 tests). It is **not store-ready**. A pure PWA cannot go on the Apple App Store at all; Google Play can take it via a Trusted Web Activity. The largest gaps are not code polish but: no native wrapper, no UGC safety tooling on the ride board, no real domain/hosting/legal entity, no security headers, and no crash reporting.

| # | Area | Status | Priority | One-line finding |
|---|------|--------|----------|------------------|
| 1 | Native binary for Apple (no PWA listing exists) | MISSING | blocker | `@capacitor/core` + haptics are in `web/package.json` and `haptics.js` branches on Capacitor, but there is no `ios/` or `android/` project and no `capacitor.config`. |
| 2 | Guideline 4.2 minimum functionality / repackaged website | PARTIAL | blocker | Real native features exist only as plans; offline area, push and haptics are the best 4.2 arguments but need native implementations. |
| 3 | Guideline 1.2 UGC on the shared ride board (report, block, moderation, contact) | MISSING | blocker | `rides.py` has length checks only (note up to 140 chars, no report/block/filter/admin). Zero hits for report/block/moderat. |
| 4 | Production hosting, domain, HTTPS, support and privacy URLs | PARTIAL | blocker | `infra/plan-b-mvp/render.yaml` + Dockerfile exist; privacy/terms are in-app routes (`/privacy`, `/terms`) with "student prototype... add a monitored contact" caveats. No real domain, support email or contact. |
| 5 | Push via APNs/FCM instead of Web Push | MISSING | blocker (native) / should (PWA) | `push.py` uses `pywebpush` only; `app.js:3853` calls `Notification.requestPermission`. |
| 6 | Privacy manifest, nutrition labels, Data safety form | MISSING | blocker | No `PrivacyInfo.xcprivacy`, no data inventory doc. Data is describable (see section 5). |
| 7 | Account deletion (5.1.1(v), Play web link) | IN PROGRESS | blocker | Being built by the accounts agent; Play also needs a public web deletion URL. |
| 8 | Google Maps Platform key restrictions per platform and billing | PARTIAL | blocker | Server key kept server-side and a separate browser key is supported (`server.py:67-86`), but key is an HTTP-referrer web key; native Android/iOS builds need per-platform keys or a keep-web-view design. Daily caps exist. |
| 9 | Security headers (CSP, HSTS, X-Frame-Options) | MISSING | should | `server.py` sets only `Cache-Control`/`Vary`/`Content-Encoding`/`Retry-After`; no CSP anywhere. |
| 10 | Dependency audit | PARTIAL | should | `npm audit --omit=dev`: 3 high (react-router-dom 6.x via `@remix-run/router`, open-redirect/XSS advisories GHSA-2w69-qvjg-hvjx, GHSA-2j2x-hqr9-3h42); fix to 6.30.6+ is in-range-adjacent (`npm audit fix`). Python: no `pip-audit` installed; `pip list --outdated` showed only trivial wheels. |
| 11 | Crash reporting / observability | MISSING | should | No Sentry/Crashlytics/`onerror` handlers found. |
| 12 | Accessibility (WCAG 2.2 AA, VoiceOver/TalkBack) | PARTIAL | should (blocker if Play pre-launch report or review flags) | 129 `aria-` uses in `app.js`, `lang="en-AU"`, 44-48 px targets, viewport does not block zoom. But 205 `px` font sizes vs 0 `rem` in `app.css` (Dynamic Type/font scaling will not follow system size in a native webview), only 1 `prefers-reduced-motion` rule in `app.css` (JS motion has `reduced.js`), no screen-reader test. |
| 13 | Data licences and attribution | PARTIAL | should | Good: `sources.body.jsx` credits Google, Translink (CC BY 4.0), QLDTraffic (CC BY 4.0), Open-Meteo, RainViewer, OSM (ODbL). Risks: RainViewer free tier is "personal and educational use" (not commercial); Open-Meteo free API is non-commercial; check. |
| 14 | Coverage outside SEQ | PARTIAL | should | Transit data is SEQ only; no obvious "outside coverage" screen found by grep; needs a manual test of the failure state. |
| 15 | Business set-up (entity, ABN, accounts, tax, trademark, age rating, export compliance) | MISSING | blocker | Nothing in repo. Costs and lead times in section 8. |

## 2. Top 10 gaps, ranked

1. No native app binary or store project (Apple will not list a PWA). Add Capacitor project.
2. UGC safety on the ride board missing: Apple 1.2 and Play UGC policy require report, block, content filtering, timely moderation and published contact.
3. No real hosting, domain, support URL or monitored contact; privacy and terms say "student prototype".
4. Business prerequisites: legal entity decision, D-U-N-S/ABN, developer accounts, tax and banking.
5. Native push (APNs/FCM) and the Apple 4.2 native-feature case.
6. Privacy compliance package: privacy manifest, nutrition label, Data safety form, deletion URL, APPs/GDPR review (deletion is in progress on this branch).
7. Google Maps Platform: key strategy per platform, billing alerts, terms for a store app, and the offline-data rule (already respected: offline uses OSM, not Google).
8. Security hardening: CSP and security headers, `npm audit fix` for react-router, rate limits behind a proxy, rides store is a JSON file.
9. Crash reporting, CI (none: no `.github`), release/versioning process.
10. Accessibility verification on real devices and font-scaling (px to rem).

## 3. Apple App Store Review Guidelines

Guideline numbers are from the model's knowledge; check the current text before relying on them.

| Guideline | Status | Pri | Evidence and gap |
|---|---|---|---|
| 1.1 Objectionable content | HAVE | should | Content is transit data; only UGC is the ride note. |
| **1.2 User-generated content** (filter, report with timely response, block abusive users, published contact) | MISSING | blocker | `rides.py` `_clean()` only trims whitespace and length (note 0-140, `rides.py:140`). Ride board is public (`/api/rides`, cap of 500 rides at `rides.py:145`). Need: report button per ride and rider, block user, profanity/PII filter, admin takedown tool, EULA terms with zero tolerance clause, support contact. Persisted as a flat JSON file (`rides.py:56,67`), no accounts until the branch lands, so blocking needs identity. |
| 1.5 Developer information | MISSING | blocker | Working support URL and email required. |
| 1.6 Data security | PARTIAL | should | Rate limits and sanitising exist; no CSP; HTTPS depends on host. |
| 2.1 App completeness (no crashes, demo account, working backend) | PARTIAL | blocker | Needs live backend during review, demo credentials for sign-in (in progress), reviewer notes explaining SEQ-only coverage and a way to see it working from outside Brisbane (`demo_mode.py` exists: good, simulated data is labelled). |
| 2.3 Accurate metadata | MISSING | should | Screenshots and description must show real in-app behaviour; do not claim official Translink status (the About page already disclaims). |
| 2.5.4 Location background | n/a | | Only foreground `watchPosition` (`app.js:1551`). Keep it foreground; do not request Always. |
| **4.2 Minimum functionality / repackaged website** | PARTIAL | blocker | Risk is high for a bare wrapper of a Flask-served React shell. Mitigations that are real: offline area packs in IndexedDB and local routing (`offline.js`, 2,000 lines), push, haptics, share, location. Strengthen with native push, native sign-in, Siri/app shortcuts, widgets or Live Activities for the next departure, native secure storage. |
| 4.8 Login services | IN PROGRESS | blocker | If Google sign-in is offered, Sign in with Apple (or an equivalent privacy-preserving login) must be offered too; accounts agent has both. |
| 4.0 Design (HIG: safe areas, dark mode, back navigation) | PARTIAL | should | `viewport-fit=cover`, dark/light themes, 390 px and 320 px checks logged. Not verified in a WKWebView. |
| 3.1 Payments | n/a | nice | App is free with no purchases; if a paid tier or donations are added, use IAP for digital goods. |
| 3.2 Other business model issues | HAVE | nice | Lime/Neuron buttons link out to their apps (no purchase inside Reroute). |
| 5.1.1 Data collection and storage | PARTIAL | blocker | Privacy page exists and is detailed (`privacy.body.jsx`). Must be consistent with labels and with account data. |
| 5.1.1(i) Privacy policy link in metadata and in-app | PARTIAL | blocker | In-app route exists; needs a stable public URL (no domain yet). |
| 5.1.1(ii) Consent for location | PARTIAL | should | Permission requested when a feature needs it. Add native purpose strings (`NSLocationWhenInUseUsageDescription`). |
| **5.1.1(v) Account deletion in-app** | IN PROGRESS | blocker | Accounts branch. |
| 5.1.2 Data use and sharing / App Tracking Transparency | HAVE (no ATT) | should | No analytics, no cookies, no ad SDKs per privacy text. If analytics or ads are ever added, ATT and updated labels are required. Google Maps SDK and web calls to Google are disclosed as third-party processing; check whether Apple counts that as "tracking" (it normally is not if not linked to other companies' data). |
| 5.1.5 Location services | PARTIAL | should | Location is used for features only; policy says position is not stored. Keep. |
| 5.2 Intellectual property | PARTIAL | blocker | Trademark and name search for "Reroute" not done (Reroute is a common word; many apps share it). Translink/Google names are used descriptively; avoid transit-agency logos. |
| Privacy manifest (`PrivacyInfo.xcprivacy`) and required-reason APIs | MISSING | blocker | Capacitor 8 plugins ship manifests; you must add the app one declaring UserDefaults/file timestamp/system boot time/disk space reasons used by the shell and any plugin, and a Data Collection declaration. Check the current required-reason list and SDK signature requirements. |
| Export compliance (encryption) | MISSING | should | HTTPS only: normally answer "uses standard encryption, exempt" via `ITSAppUsesNonExemptEncryption=false`; confirm. |
| Age rating | MISSING | should | Likely 4+ without UGC; with a public ride board the new questionnaire pushes higher (user-generated content). Answer honestly. |

## 4. Google Play

| Policy | Status | Pri | Evidence and gap |
|---|---|---|---|
| User Data policy and privacy policy URL | PARTIAL | blocker | Policy text exists in app, needs public URL in the Play Console. |
| Data safety form | MISSING | blocker | Inventory: approximate and precise location (processed, sent to server and Google), push subscription token, saved places (local), ride board entries (name/note, approx location rounded to ~100 m in `rides.py:_point`), account data (in progress). Encrypted in transit: yes. Deletion: yes (accounts). |
| Permissions: location only while using the app | HAVE | should | Foreground only. Do not declare `ACCESS_BACKGROUND_LOCATION`; it triggers a separate declaration and review. |
| Notifications permission (Android 13+ runtime `POST_NOTIFICATIONS`) | MISSING | should | Web code calls `Notification.requestPermission` immediately on the push action (`app.js:3853`); no priming UI found. A TWA handles this via the browser, a Capacitor shell needs the native plugin. |
| Target API level | MISSING | blocker | Play requires new apps and updates to target a recent API level (rule moves each August; likely Android 16 / API 36 for 2026). Bubblewrap/Capacitor 8 templates are current, but check the current requirement. |
| User Generated Content policy | MISSING | blocker | Same as Apple 1.2: in-app reporting and blocking, moderation. |
| Account deletion with web link | IN PROGRESS | blocker | Play requires in-app deletion and a web URL for deletion requests. Need a public page. |
| Families / ads | n/a | | Not designed for children, no ads. State target audience 13+ (or 18+); children's data not collected knowingly. |
| Deceptive behaviour / impersonation | PARTIAL | should | "Not an official Translink or Queensland Government service" in About: HAVE; also put it in the store description. |
| Play App Signing | MISSING | blocker | Use Play App Signing (default for new apps); keep the upload key off the repo. |
| TWA digital asset links | MISSING | should | Needs `/.well-known/assetlinks.json` served from the production domain; `server.py` has no such route. Manifest already has icons (192, 512, maskable), name, `start_url`, `display: standalone`. |
| New personal account testing rule | MISSING | blocker | New personal developer accounts (created after Nov 2023) must run a closed test with at least 12 testers opted in for 14 continuous days before applying for production (the number was 20 before Dec 2024; check the current figure). Organisation accounts are exempt. Start this early. |
| Play Console one-off fee | n/a | | US$25 one-off. |

## 5. Third-party platform and data terms

| Source | Status | Pri | Finding |
|---|---|---|---|
| Google Maps Platform | PARTIAL | blocker | Attribution kept (About page and Google map used for Google routes). Offline respects the no-store rule (`osm.py` docstring: Google content cannot be stored offline; OSM used). Check the current Service Specific Terms on caching limits (Place IDs may be stored; lat/lng only for up to 30 days) against saved places stored in `localStorage` with Google place IDs and coordinates. Billing: daily caps (`PLANB_DAILY_GOOGLE_CAP` default 50, autocomplete 500) are conservative; set budget alerts in Cloud Console. Browser key is delivered to every visitor via `/api/config`; must be HTTP-referrer restricted; native app builds need Android package+SHA-1 and iOS bundle-ID restrictions, and a Capacitor webview served from `capacitor://` or `https://localhost` origins will break referrer restrictions unless the webview loads the production origin. Do not use Google data off a Google map (Routes content is shown on a Google map per About). |
| OSM / Overpass | PARTIAL | should | ODbL attribution present. Overpass public instance is a shared volunteer service and the code limits itself to 60 fetches a day (`osm.py:31`). A production app should use its own Overpass, a Geofabrik extract pipeline or a paid provider. Public OSM tile servers forbid heavy app use; the app draws its own base map from vector data, not the tile servers: good. |
| Translink GTFS and GTFS-Realtime | PARTIAL | should | Credited as CC BY 4.0 on About. The request said "Queensland Open Data licence"; the app text says CC BY 4.0 and links Translink open data. Confirm which licence applies to which Translink feed and copy the exact attribution line; GTFS-RT may have an API access term or fair-use limit. |
| QLDTraffic | PARTIAL | should | CC BY 4.0 credit present; API key via `QLDTRAFFIC_API_KEY` (`server.py:148`). Confirm key terms permit a public app. |
| Open-Meteo | PARTIAL | blocker for commercial | Free API is for non-commercial use; a monetised store app needs a paid plan or a different source. Attribution CC BY 4.0 present. |
| RainViewer | PARTIAL | should | Free API is for personal and educational use only (the About page says so itself) and limited to zoom 7. For public launch either buy a plan, drop radar, or switch to the Bureau of Meteorology (licence terms apply; check). |
| Lime / Neuron | HAVE | nice | Links out only. |

## 6. Accessibility

| Item | Status | Pri | Evidence |
|---|---|---|---|
| Screen reader labels | PARTIAL | should | 129 `aria-` attributes in `app.js`; the rides/trip screens are legacy HTML injected via `LegacyBody`, not audited with VoiceOver or TalkBack. |
| Text scaling | PARTIAL | should | CSS uses 205 px font sizes and no rem. iOS Dynamic Type in a WKWebView only applies if CSS uses `-apple-system-body` or rem; Android respects system font size in webviews only with rem/em. Convert to rem. |
| Reduced motion | PARTIAL | should | `web/src/reduced.js` gates haptics and motion; one CSS `prefers-reduced-motion` rule in `app.css` and none in `motion.css`: verify the JS path covers framer-motion and Lenis smooth scroll. |
| Contrast | PARTIAL | should | Motion log says ratios were calculated from tokens; no automated or on-device check. |
| Touch targets | HAVE | nice | 44-48 px min-heights found in `app.css`. |
| Zoom | HAVE | nice | No `user-scalable=no`. |
| WCAG 2.2 AA (target size, focus appearance, dragging alternatives) | PARTIAL | should | Map picker drag/pin alternatives and focus indicators not verified. |

## 7. Security (MASVS-oriented), reliability and tests

Security:
- Transport: depends on host; HSTS is not set by the app. PARTIAL, should.
- Secrets in client: the Google browser key is intentionally public and must be referrer-restricted; `server.py:85` warns if it equals the server key. HAVE for design, unverified for deployment.
- Rate limits: per-IP hourly and global daily caps in `limits.py`, tested in `test_push_limits.py`. HAVE. Behind a reverse proxy the client IP must come from a trusted forwarded header; `is_loopback` exists but proxy trust handling was not verified. should.
- CSP and security headers: MISSING, should. The app loads the Google Maps script and RainViewer tiles from other origins, so write an explicit allowlist.
- Dependencies: `npm audit --omit=dev` found 3 high (react-router-dom range 6.0.0-6.30.2, via `@remix-run/router` <=1.23.2). `npm audit fix` to 6.30.6 reported as available; the app uses declarative routing for in-app pages so exposure is probably low, but upgrade. No lockfile audit for Python; `pip-audit` was not installed, so Flask/pywebpush/cryptography CVEs were **not verified**.
- Ride board is a JSON file on disk with an in-process lock: no multi-instance safety, no backup. should.
- Local data: IndexedDB offline packs and saved places are unencrypted in the webview. nice.

Reliability and tests:
- Crash reporting and analytics: MISSING (no SDK, deliberate per privacy page). Add privacy-friendly crash reporting (Crashlytics or Sentry) and update labels. should.
- Offline: HAVE and strong (service worker, network-first API with marked offline fallback `sw.js`, offline routing).
- Service worker caveat: cache name `planb-reroute-21` is bumped by hand.
- Push: Web Push only (`push.py`, VAPID via `pywebpush`). On iOS PWA it works since 16.4 only for home-screen-installed apps; in a Capacitor app it does not work at all (WKWebView has no Web Push), so native APNs is required. MISSING.
- Deep links: manifest shortcut `/?panic=1` exists; no universal links (`apple-app-site-association`) or app links (`assetlinks.json`). MISSING, should.
- Versioning/releases: package versions are `0.1.0`; no CI (`.github` absent), no release process. MISSING, should.
- Tests: 346 `def test_` in 11 Python files for the server and data layers (largest: `test_offline.py` 56, `test_live_routes.py` 60, `test_server.py` 46). **Untested:** all front end JS (`app.js` 4,651 lines, `offline.js` 2,000 lines, React shell), service worker, any end-to-end flow, accessibility, native code. Front end was checked by headless Chrome by hand (per the AI-use log), not automated.
- Performance budgets: none defined; battery/background behaviour: foreground-only geolocation watch, one-minute alert polling while offline (`privacy` text), which should be justified for battery review.
- Error states and empty states: present in places (offline copy, 429 messages); notification priming and first-run onboarding were not found. should.

## 8. Legal, business and localisation

| Item | Status | Pri | Note |
|---|---|---|---|
| Developer accounts | MISSING | blocker | Apple Developer Program US$99/yr (individual or organisation; organisation needs D-U-N-S and takes days to weeks). Google Play one-off US$25 (individual accounts carry the 12-tester/14-day rule). Check the current fees. |
| Legal entity | MISSING | blocker | Publishing under a personal name exposes the seller's real name and address in store listings (Apple trader status in EU; Play shows the address for paid/organisation accounts). Decide between individual publishing, sole trader with ABN, or a company. ABN is free; company registration is not. Tax/banking is needed only if you charge. |
| Support URL, privacy URL, terms | PARTIAL | blocker | Pages exist in-app, no public domain or contact. |
| Content and age rating | MISSING | should | Questionnaires on both stores. |
| Trademark "Reroute" | MISSING | blocker-ish | Not checked: search IP Australia, USPTO, EUIPO, and both stores for name collisions (the repo shows the name changed from Plan B). |
| Export compliance | MISSING | should | See Apple. |
| Data residency | PARTIAL | should | Host is Render per `render.yaml` (check region). Privacy page says hosting retention must be confirmed. Google, Open-Meteo, RainViewer are overseas processors: disclose for APP 8. |
| Australian Privacy Act / APPs | PARTIAL | should | Small-business exemption (turnover under A$3m) may apply, but store policies demand compliance anyway; privacy page is plain-language and detailed. Notifiable Data Breaches process and complaint contact are missing. |
| GDPR (EU users) | PARTIAL | should | Apply if the app is available in the EU: legal basis, DPO/representative questions, data subject rights (export and deletion are in progress), cross-border transfers. Restrict storefronts to Australia initially to avoid this. |
| Children's data | PARTIAL | should | Target 13+ (Australia's Children's Online Privacy Code is being introduced; check status). |
| Regional coverage | PARTIAL | should | SEQ only. Treat out-of-region searches with a clear message; for store review explain coverage and consider restricting store availability to Australia. Observed: no dedicated "outside SEQ" screen found by grep, needs a manual test. |

## 9. Form comparison

Context: Apple will not list a pure PWA. Android can list a PWA through a TWA. The repo already contains a React shell (web/, Vite) plus a legacy `app.js` shell injected via `LegacyBody`, a `@capacitor/core` 8.0.0 and `@capacitor/haptics` dependency, and `haptics.js` that branches on `window.Capacitor`. iOS Safari has no Vibration API (the haptics file notes it).

| Option | Apple listing | What works | Cost / effort | Verdict |
|---|---|---|---|---|
| (a) PWA only | No | Install via Add to Home Screen; Web Push since iOS 16.4 (installed apps only); service worker; no Vibration API; storage can be evicted after ~7 days of non-use for non-installed sites (installed PWAs are more resilient; check); limited background. | Zero. Good for the class demo. | Keep as the web build, not a store plan. |
| (b) Capacitor wrapper | Yes | Reuse the React/legacy UI; native push (APNs/FCM), haptics (already wired), Sign in with Apple/Google plugins, geolocation (background optional), StoreKit if ever needed. Mitigates 4.2 only if real native features are used, not just a webview. | About 15-25 person-days (see below). | **Recommended.** |
| (c) TWA via Bubblewrap | n/a (Android only) | Chrome Custom Tab full-screen, Web Push works, assetlinks needed, real domain needed. | 2-4 days incl. assetlinks and Play listing. | Optional fast Android path; skipped if Capacitor already covers Android. |
| (d) React Native / Expo rewrite | Yes | Fully native UI, best review outcome, can reuse logic. | 60-100+ person-days to port 6,650 lines of app and offline JS plus the map layer. | Not justified for this team and timeline. |
| (e) Flutter | Yes | Single codebase, new language. | 80-120+ person-days. | No. |
| (f) Swift + Kotlin native | Yes | Best quality. | 150+ person-days, two codebases. | No. |

Capacitor effort estimate (rough, one developer, unverified): scaffolding and config 1-2 days; moving server to a production domain with the app loading local assets and calling the API over HTTPS with CORS allowlist, 2 days; native push (APNs/FCM) in `push.py` and client 3-4 days; native sign-in integration with the accounts branch 2-3 days; geolocation/permissions strings, safe areas 2 days; Google Maps key strategy per platform 1-2 days; UGC report/block/moderation (needed regardless of form) 3-5 days; privacy manifest, labels, data safety, store assets 2-3 days; accessibility pass 2-3 days; CI and release signing 1-2 days. Total about 19-27 days; review rounds and the Android 12-tester wait add calendar time.

What changes in this repo: add `capacitor.config.ts`, run `npx cap add ios android` in `apps/plan-b-mvp/web`, add `ios/` and `android/` projects, add push plugin and sign-in plugins, add CORS or same-origin proxy settings and `assetlinks.json` / `apple-app-site-association` routes in `server.py`, add privacy manifest and Info.plist strings, add CI and a store-asset folder. The Flask server stays and gets a real host.

## 10. Recommendation

Use **Capacitor (b)** for both stores, with the existing React shell and legacy bridge, a real production domain, and native push, native sign-in, native geolocation and haptics so Apple 4.2 is answerable. Ship the PWA/TWA path (c) in parallel only if you want an earlier Android closed test. Do not rewrite (d, e, f) before the product is validated. Honest uncertainty: Apple's 4.2 outcome cannot be predicted, the Open-Meteo and RainViewer commercial limits and the Google caching rules need reading in full, and nothing here was tested on a physical device.

## 11. Phased roadmap

Costs in AUD where possible, rough, unverified. Calendar times assume a part-time student team.

| Phase | Work | Rough cost | Calendar |
|---|---|---|---|
| **Now** (this semester, before 2026 submission) | Finish accounts; fix react-router audit; add report/block/moderation design and minimal implementation; add security headers/CSP; register a domain and move hosting off a free tier; decide entity and name check; add support email; fix rem font sizing; CI with the 346 tests. | Domain about A$20-30/yr, hosting about A$10-30/month for a paid always-on plan, plus time | 2-4 weeks |
| **Before closed beta** | Capacitor project (iOS + Android); native push; sign-in; privacy manifest; Data safety form; Play closed test with 12 testers for 14 days; TestFlight (US$99/yr Apple account); App Signing; crash reporting; accessibility pass with VoiceOver and TalkBack; Maps key per platform and billing alerts. | US$99 + US$25 + hosting + maps usage; roughly A$300-600 cash | 6-10 weeks |
| **Before public launch** | Pay or replace Open-Meteo/RainViewer; own Overpass or data pipeline; legal review of privacy/terms/APPs (and GDPR if EU enabled); trademark clearance; storefronts restricted to Australia; store assets, age ratings, reviewer notes with demo account; monitoring and incident process; backup for the rides store (move from JSON to a database). | Possible paid weather plan (about tens of dollars/month; check), legal review A$500-2,000, trademark filing from A$250 per class (check) | 4-8 weeks, plus Apple review (typically 1-3 days, can be longer) |

## 12. What was not verified

- No store policy text was fetched; guideline and policy numbers must be checked against current text.
- Play target API number, tester count and Apple SDK/Xcode requirements change yearly.
- Python dependency vulnerabilities (no `pip-audit`), Docker image CVEs, and the deployed header set were not tested.
- Accessibility, native behaviour, push on iOS, and the out-of-coverage UX were not tested on devices.
- Accounts work (sign-in, deletion, export) was not read.
- `app.js` was grepped, not read in full.
