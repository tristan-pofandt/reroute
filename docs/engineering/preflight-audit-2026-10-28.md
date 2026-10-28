# Reroute pre-submission audit (report only)

Date: 2026-10-28. Branch `feature/accounts`. Audited commit: **08e48b1** (HEAD when the files were read; other agents had uncommitted edits to `accounts.py`, `test_accounts.py`, `web/src/accounts/store.js`, `web/src/native/api.js`, `web/src/native/auth.js` at the time, so those were not treated as final).
Prepared by Claude Sonnet 5.5 via Claude Code at T.P's request. **Human review required.** This is an AI-written audit, not legal advice. No app code was changed. Nothing was run on a device, in Xcode, in Android Studio, or against a store.

Method in one line: installed skills `play-policy-insights`, `app-store-review`, `capacitor-app-store`, `accessibility`, applied to `apps/plan-b-mvp/web/{android,ios}`, the server, the store-listing drafts and `store-readiness-audit-2026-10-28.md` (the "earlier audit"). Commands run: `python -m unittest` (429 tests OK on the second run; the first run, while others were editing, showed 1 error that did not repeat), `npm test` (32 vitest tests pass), `npm audit --omit=dev`, `node scripts/a11y-audit.mjs --axe` (dark 390x844; light 360x800 at 200% text), `curl -I` on a local server for headers, Google's static scanner `orchestrator.py init` on a scratch copy of `android/`.

## 1. Summary table

| # | Area | Status | Severity | One line |
|---|---|---|---|---|
| 1 | Android project, target API, permissions | PASS | blocker (met) | `targetSdk 36`, `minSdk 24`, foreground location only, no background location, HTTPS-only network config, `allowBackup=false`. |
| 2 | Play Data safety declaration vs code | PARTIAL | blocker | Draft table matches `privacy-data-map.md`; not entered in Console; scanner confirms no extra sensitive permissions. |
| 3 | Play account deletion (in-app + web URL) | PASS (code) | blocker | In-app "Delete my account"; public `/account/delete` page; `POST /api/account/delete`. Needs a live domain to be submitted. |
| 4 | Play UGC policy | PASS (code) | blocker | Report, block, filter, moderation queue exist (`server.py:579-591`, `rides.py`). Contact mailboxes are placeholders. |
| 5 | Android FCM push | FAIL | should | `android/app/google-services.json` absent, so the Google services plugin is skipped and native push cannot work. Needs a Firebase project. |
| 6 | Android App Links / TWA | PARTIAL | should | Manifest filter uses placeholder host `reroute.example`; `/.well-known/<name>` route exists, content comes from env. |
| 7 | iOS privacy manifest | PASS (static) | blocker | `PrivacyInfo.xcprivacy` present, matches the data map (precise location, email, name, user id, device id, other user content, crash data, product interaction), no tracking. Not validated by Xcode. |
| 8 | iOS Info.plist, entitlements, export | PARTIAL | should | Location purpose string, `ITSAppUsesNonExemptEncryption=false`, UIScene lifecycle, Sign in with Apple, push and associated-domains entitlements present. `aps-environment=development`, `applinks:reroute.example` placeholder, `UIRequiredDeviceCapabilities=armv7`. |
| 9 | Apple 1.2 UGC | PASS (code) | blocker | As row 4. |
| 10 | Apple 4.8 Sign in with Apple | PASS | blocker | Google and Apple both offered; accounts optional; app fully usable signed out. |
| 11 | Apple 5.1.1(v) deletion, 5.1.1(i) policy link | PARTIAL | blocker | Deletion and Apple token revocation implemented; public privacy URL needs a real domain. |
| 12 | Apple 4.2 minimum functionality | UNVERIFIED | blocker | Native features are wired in code (push, geolocation, haptics, share, offline area, native sign-in) but nothing was run in WKWebView. Review outcome cannot be predicted. |
| 13 | Apple 2.1 completeness / 5.1.2 | PARTIAL | blocker | Demo mode needs no login (good for review). Support and privacy contacts are `.invalid` placeholders; backend must be live during review. |
| 14 | Versioning and signing | PARTIAL | should | Android `versionCode 1`/`1.0`, iOS build 1/`1.0`, `package.json` is `0.1.0` (the release process says keep them equal). No signing material (correctly not in repo). |
| 15 | Icons and screenshots | PARTIAL | should | iOS 1024 icon, Android mipmaps, web icons present; screenshots drafted at 360/390/430/820 widths; Play feature graphic missing; sizes not checked against current store specs. |
| 16 | Listing metadata, age rating, export compliance | PARTIAL | should | Drafts exist for both stores; support, website and privacy URLs are TODO. |
| 17 | Placeholder domains and mailboxes | FAIL | blocker | 16 references to `reroute.example` / `reroute.invalid` in source (support, abuse, privacy, App Links, API host). |
| 18 | Accessibility (WCAG 2.2 AA) automated | PARTIAL | should | axe: 3 rules, 6 nodes (dark), 8 nodes (light 200%). 0 console errors, no horizontal overflow at 200% text. |
| 19 | Accessibility manual (VoiceOver, TalkBack, switch) | UNVERIFIED | should | Never done. |
| 20 | Security headers, dependencies | PARTIAL | should | CSP, nosniff, Referrer-Policy, Permissions-Policy, X-Frame-Options verified live; HSTS only behind `PLANB_TRUST_PROXY`. `npm audit`: 2 moderate (react-router, fix needs a major bump to 7). `pip-audit` not run. |
| 21 | Data licences | PARTIAL | blocker for commercial | Translink licence mismatch and Open-Meteo/RainViewer free-tier terms still open (see `data-licences.md`). |
| 22 | Business set-up (accounts, entity, trademark) | FAIL | blocker | Nothing exists in the repo; human only. |
| 23 | CI and release process | PASS | should | `.github/workflows`, `scripts/check.sh`, `Makefile check`, `release-process.md` exist. Workflows were not run here. |

## 2. play-policy-insights (Android)

Invocation. The skill says `python3 orchestrator.py init <app_dir>`. Run with `python -I` it fails (`ModuleNotFoundError: scanner`, because `-I` removes the script directory from the path), so it was run as plain `python` from a scratch directory, against a **copy** of `android/` (build outputs excluded) placed under the session scratchpad, never inside the repo. The scanner is Google's; the skill's LLM worker and critic stages (6 goals: `data_safety_part_1..4`, `permissions_and_apis`, `user_account`) were **not** run, to save tokens; the judgement below was done by hand from the scanner's facts. Treat the scanner keyword hits (`record` as AUDIO, `race` as RACE_ETHNICITY, `track` as MUSIC) as false positives from minified JS.

Scanner facts: package `au.reroute.app`, target SDK 36, permissions `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION`, `ACCESS_NETWORK_STATE`, `INTERNET`, `POST_NOTIFICATIONS`, `VIBRATE`; no foreground services; only location counted as a requested sensitive permission; only found URLs are Google privacy/terms/Maps terms (the privacy URL for the app itself is therefore not embedded in the Android assets).

Findings:
- **Permissions (PASS).** Nothing restricted: no background location, SMS, call log, `QUERY_ALL_PACKAGES`, or MANAGE_EXTERNAL_STORAGE. `POST_NOTIFICATIONS` is runtime on Android 13+; confirm the app asks only when the person turns alerts on (the earlier audit said `Notification.requestPermission` was called immediately; not re-tested in the native flow). `uses-feature gps required=false` is correct. Location permission needs an in-app prominent disclosure only for background use, which is not requested.
- **Target API (PASS).** `variables.gradle`: `compileSdk=36`, `targetSdk=36`. Matches Google's requirement for new apps and updates from 31 Aug 2026 (see section 7). API 37 is the next step; plan for next August.
- **Data safety (PARTIAL).** `docs/product/store-listing/google-play-console.md` table (approx/precise location, name, email, user ids, other UGC, app interactions opt-in, crash logs opt-in, device id push token) is consistent with `docs/engineering/privacy-data-map.md` and the scanner. Two points to confirm: (1) location is sent to the server and onward to Google and Open-Meteo, so "shared" must be answered consistently (service-provider exemption wording); (2) IP address and the pseudonymous poster id are collected (rate limits, bans) but are not rows in the Play draft; add "Device or other IDs" detail for the HMAC'd device id. Entering the form is human work.
- **Account deletion (PASS in code).** In-app flow in `web/src/screens/account.screen.jsx` (two-step, "Yes, delete everything"), `POST /api/account/delete` (`accounts.py:803`), data export `GET /api/account/export`, and a public script-free page `GET /account/delete` (`accounts.py:597`) for the Play Console "delete account URL" field. Evidence of tests: `test_accounts.py`. Needs the production domain to give Play a URL.
- **User account / demo credentials.** App access: everything works signed out, demo mode needs no credentials (draft says so). If the reviewer is asked to test sign-in, Play will need a working Google test login; only the human can provide one.
- **Manifest hygiene (PASS).** `usesCleartextTraffic=false`, network security config trusts system CAs only, `allowBackup=false`, FileProvider not exported, only the launcher activity exported. `minifyEnabled false` in release (nice-to-have: shrink; low risk).
- **16 KB page size.** Capacitor 8 / AGP versions were not inspected for native libs; no `.so` files were listed in the scanned copy. UNVERIFIED; run the Play pre-launch report.
- **FCM (FAIL, should).** No `google-services.json`; `app/build.gradle` logs "Push Notifications won't work". Needs a Firebase project (human), then the file stays out of git or is supplied by CI.

## 3. app-store-review (iOS)

Files read: `ios/App/App/Info.plist`, `App.entitlements`, `PrivacyInfo.xcprivacy`, `project.pbxproj` (deployment target 15.0, bundle id `au.reroute.app`, `MARKETING_VERSION 1.0`, `CURRENT_PROJECT_VERSION 1`, automatic signing), `AppDelegate.swift`/`SceneDelegate.swift`, assets.

| Guideline | Status | Evidence / gap |
|---|---|---|
| 1.2 UGC | PASS (code) | Report/block endpoints (`server.py:579-591`), community guidelines page, content filter, rate limits, operator queue, 24 h response promise (`web/src/screens/legal/contact.js`). Gap: `abuse@reroute.invalid` and `support@reroute.invalid` do not exist; a reviewer will test that contact. |
| 2.1 Completeness | PARTIAL | Needs a live HTTPS backend at the API host during review (currently placeholder `reroute.example`). Demo mode covers out-of-Brisbane reviewers; keep the review note about SEQ-only coverage. |
| 2.3 Metadata | PARTIAL | Drafts include the "not an official Translink/Queensland Government service" line. Screenshots must show the real UI, no unsupported claims. |
| 4.2 Min functionality | UNVERIFIED | Native push (APNs, `push_native.py` is new and uncommitted at audit time), geolocation, haptics, share, offline area, Sign in with Apple. Real risk remains, but the story is now defensible. |
| 4.8 Sign in with Apple | PASS | Entitlement `com.apple.developer.applesignin`; server-side Apple flow with refresh-token revocation on delete; Google offered alongside. Accounts are optional. |
| 5.1.1(i) privacy policy | PARTIAL | In-app page exists and was being edited during the audit; needs public URL in App Store Connect and in the app. |
| 5.1.1(ii)/(iii) location consent | PASS | `NSLocationWhenInUseUsageDescription` present and specific; no Always permission. |
| 5.1.1(v) deletion | PASS (code) | In-app and web; includes revoking the Apple token. |
| 5.1.2 data use / ATT | PASS | `NSPrivacyTracking=false`, no tracking domains, no IDFA, no ATT string; analytics (PostHog) and Sentry are opt-in and off by default. Labels must say "Data Not Used to Track You". |
| Privacy manifest | PASS (static), UNVERIFIED (tool) | App manifest declares UserDefaults `CA92.1`, FileTimestamp `C617.1`, SystemBootTime `35F9.1`, DiskSpace `E174.1`. Not validated by an actual Xcode archive "Privacy Report"; plugin manifests combine at archive time. Collected types match `privacy-data-map.md`, including OtherUserContent, CrashData, ProductInteraction. |
| Export compliance | PASS | `ITSAppUsesNonExemptEncryption=false` (HTTPS only). Confirm no custom crypto: the server-side Fernet/JWT is server code, not in the binary. |
| Entitlements | PARTIAL | `aps-environment=development` is rewritten by the distribution profile; `applinks:reroute.example` must become the real domain and `apple-app-site-association` served (route exists via env). Associated-domains and push need a paid team. |
| Info.plist | PARTIAL | `UIRequiredDeviceCapabilities` = `armv7` is a stale Capacitor template value; use `arm64` (nice). Orientation includes landscape; the layout was only checked in portrait (should). |
| Deployment target / SDK | PARTIAL | Target iOS 15.0. Since 28 Apr 2026 uploads must be built with Xcode 26 / iOS 26 SDK; the Xcode version used was not checked (cannot be, no Mac here). UIScene lifecycle is already adopted. |
| 5.2 IP / name | OPEN | "Reroute" trademark and name collision search not done (human). |

## 4. capacitor-app-store (release mechanics)

- **Versions.** Android `versionCode 1`, `versionName 1.0`; iOS `CURRENT_PROJECT_VERSION 1`, `MARKETING_VERSION 1.0`; `web/package.json` `0.1.0`. Release doc says keep marketing versions equal and the build number rising across both: currently inconsistent (PARTIAL, should; fix in code by choosing 1.0.0 or 0.1.0 everywhere).
- **Signing.** Nothing in repo (correct). Android: Play App Signing + upload keystore (human). iOS: distribution certificate and profile via Xcode automatic signing (needs paid team).
- **Capacitor.** All `@capacitor/*` at 8.x (core 8.5.3). `capacitor.config.ts` appId `au.reroute.app`, flagged `TODO(confirm)`: the bundle id is permanent once listed. `server.allowNavigation` includes `*.googleapis.com`, `*.gstatic.com`: broad but acceptable; prefer exact hosts (nice).
- **Icons and splash.** `AppIcon-512@2x.png` (1024) in iOS asset catalogue, Android mipmaps and splash drawables present, web icons 192/512/maskable. Android adaptive icon was not visually inspected (UNVERIFIED).
- **Screenshots.** `docs/product/store-listing/screenshots/{360x800,390x844,430x932,820x1180}`. App Store needs the current required device sizes (6.9"/6.5" iPhone, 13" iPad if iPad supported) and Play needs 2 to 8 phone shots plus a 1024x500 feature graphic (missing). Pixel sizes were not verified against the current spec pages.
- **Listing metadata, App Privacy, Data safety.** Drafts in `app-store-connect.md` (111 lines) and `google-play-console.md` (61 lines); support, marketing and privacy URLs, contact email still TODO.
- **Age rating.** Drafted: UGC = yes (ride board). Answer the current Apple questionnaire and IARC honestly; expect a rating above 4+. Target audience 13+ or 18+ is a human decision.
- **Deadlines (as of 2026-10-28).** Apple: iOS 26 SDK/Xcode 26 required for uploads since 28 Apr 2026. Google: target API 36 for new apps/updates from 31 Aug 2026 (extension was to 1 Nov 2026, so effectively due now); API 37 expected next. Play personal accounts: 12 testers x 14 days closed test.
- **Upload pitfalls to pre-empt.** Duplicate `versionCode` (bump every upload), ITMS-90725 (SDK version), ITMS-91053/91061 (privacy manifest/signature issues for listed SDKs; app manifest present, check archive report).

## 5. accessibility (WCAG 2.2)

Run: `node scripts/a11y-audit.mjs --axe` against `python server.py` serving the existing `web/dist` (built 21:24 by another agent, matching the then-current source; not rebuilt by this audit).

| Run | Result |
|---|---|
| Dark, 390x844, 18 screenshots | 6 violation groups listed as 3 rules, 6 nodes; no overflow; 0 console errors |
| Light, 360x800, text 200% | 3 rules, 8 nodes; no overflow; 0 console errors |

Remaining axe findings (same as `docs/engineering/accessibility.md` said, so not yet fixed):
1. `scrollable-region-focusable` (serious): `.chips` strip on results, results-sheet, next, weather (and offline-area at 200%). WCAG 2.1.1 / 2.1.3. Fix: `tabindex="0"` plus `role="group"` and `aria-label` on the strip in `app.js`. Code-only.
2. `heading-order` (moderate): `h3` in the home alerts tile with no preceding `h2` (WCAG 1.3.1). Code-only.
3. `page-has-heading-one` (moderate): terms page has no `h1` (WCAG 1.3.1 / 2.4.6). Code-only.

Code checks (WCAG 2.2 specifics):
- Text size: `font-size` px in `app.css` is 0; 205 rem declarations; the earlier audit's px-to-rem gap is closed. Large-text layout class exists; remaining 200% issue on the offline-area timetable control is documented but not re-verified visually.
- Reduced motion: `prefers-reduced-motion` present in `app.css`, `styles.css`, `ambient.css`; JS gating in `web/src/reduced.js`. Not tested with an OS setting beyond Playwright `reducedMotion: reduce` (the harness uses it).
- Focus: `:focus-visible` rules present (28 in `app.css`), so 2.4.7 plausible; Focus Appearance (2.4.13, AAA) not assessed. Forced-colours and `prefers-contrast` blocks exist.
- Target size (2.5.8): 44-48 px min-heights in `app.css`; small inline controls (chips, text buttons) not measured.
- Dragging alternatives (2.5.7): pointer-drag code exists in `app.js` (sheets, picker at `app.js:2964`, `3693`); a button/keyboard alternative for each was not confirmed (UNVERIFIED).
- Zoom: viewport allows scaling (good); `lang="en-AU"`.
- Contrast: axe colour-contrast passed in both themes; gradient/image areas and `--text-faint` need manual checks.
- Screen readers: not tested (UNVERIFIED). Legacy `app.js` screens need VoiceOver/TalkBack passes before store review.

## 6. Cross-check of `store-readiness-audit-2026-10-28.md` top 10 gaps

| # | Earlier gap | Now | Evidence |
|---|---|---|---|
| 1 | No native binary / store project | **CLOSED** (code) | `web/android/` and `web/ios/` exist; `capacitor.config.ts`; `web/package.json` Capacitor 8.5.3 + plugins. Not built on a device here. |
| 2 | UGC safety on ride board | **CLOSED** (code), contacts OPEN | `server.py:579-591` report/block/unblock/blocks; `rides.py:347,370,396`; `moderation.py`; ride-board-moderation.md; mailboxes still `.invalid`. |
| 3 | Real hosting, domain, support URL, monitored contact | **OPEN** | 16 placeholder refs; `contact.js` says "TODO before launch". |
| 4 | Business prerequisites (entity, accounts, D-U-N-S, tax) | **OPEN** | Human only. |
| 5 | Native push (APNs/FCM) and 4.2 case | **PARTIAL** | `server.py:621-628` native register/unregister, `push_native.py` (uncommitted at audit time), `@capacitor/push-notifications`; no `google-services.json`, no APNs key, `aps-environment=development`. |
| 6 | Privacy compliance package | **PARTIAL** | `PrivacyInfo.xcprivacy` and `docs/engineering/privacy-data-map.md` now exist; store forms not entered; privacy text being edited concurrently; deletion URL exists. |
| 7 | Google Maps key strategy, billing, terms | **UNVERIFIED** | Not re-audited; native build uses the server for Google calls (per data map), so per-platform Maps SDK keys may not be needed. Referrer restrictions and billing alerts need Cloud Console (human). |
| 8 | Security hardening (CSP, npm audit, rides JSON file) | **PARTIAL** | CSP, nosniff, Referrer-Policy, Permissions-Policy, X-Frame-Options confirmed by `curl -I`; HSTS needs `PLANB_TRUST_PROXY`; rides moved to SQLite (`data/rides.sqlite3`); npm audit now 2 moderate, no highs; `pip-audit` still not run. |
| 9 | Crash reporting, CI, release process | **CLOSED** (code) / consent-gated | `web/src/errors/report.js` (Sentry, opt-in), `.github/workflows`, `scripts/check.sh`, `release-process.md`. DSNs and regions TODO. |
| 10 | Accessibility verification and font scaling | **PARTIAL** | px to rem done (0 px / 205 rem); axe findings in section 5; no device testing. |

Earlier-audit statements checked against the repo:
- "346 tests": outdated. Now 429 Python tests and 32 front-end tests, all pass.
- "No CSP": outdated (headers verified live).
- "3 high npm advisories (react-router-dom 6.x)": outdated and different. `react-router-dom` is pinned at 6.30.6; `npm audit` now reports 2 moderate advisories on `react-router` (GHSA-wrjc-x8rr-h8h6, GHSA-337j-9hxr-rhxg) with the fix being a breaking jump to 7.18.5.
- "205 px, 0 rem; one reduced-motion rule": outdated (fixed).
- "no `.github`", "no `ios/`/`android/`", "no privacy manifest": outdated (all now exist).
- "`@capacitor/core` 8.0.0": outdated (8.5.3).
- Roadmap "Now" items largely done in code; the remaining items are accounts, money and devices.

## 7. Policy facts re-checked (WebSearch / WebFetch, 2026-10-28)

| Earlier statement | Verdict | Source and caveat |
|---|---|---|
| Play personal accounts (created after Nov 2023) need a closed test with 12 testers for 14 days; 20 before Dec 2024; organisation accounts exempt | **Confirmed** (secondary sources only) | Third-party guides (choicely.com, extendsclass.com, testerscommunity.com); none was Google's help page. Detail "12 must stay opted in or the clock resets" and "Google checks real usage" are reported but disputed. Confirm in Play Console. |
| Play target API: likely Android 16 / API 36 for 2026 | **Confirmed** | developer.android.com/google/play/requirements/target-sdk (via search): new apps and updates must target API 36 from 31 Aug 2026; extension to 1 Nov 2026 could be requested; Wear OS/Auto 35, TV/XR 34; API 37 expected next. One forum quotes 30 Aug in a Console email: use 31 Aug from the official page. |
| Apple Developer Program US$99 per year | **Confirmed** | developer.apple.com/programs/whats-included: US$99 per membership year; fee waiver exists for nonprofits, accredited educational institutions and government entities (not for individual students). |
| Play Console US$25 one-off | **Not re-verified** | No lookup done. |
| Apple SDK/Xcode requirement "changes yearly" (earlier audit gave no number) | **Added** | Uploads since 28 Apr 2026 need Xcode 26 / iOS 26 SDK (Expo, Capgo, other summaries of Apple's notice). One forum reports an older-SDK upload still accepted with a warning; do not rely on that. |
| Privacy manifest and required-reason API rules | **Partly confirmed** | Apple's third-party SDK page confirms manifests (and signatures) are required for listed SDKs when adding them; it says nothing on required-reason API enforcement or dates. The 4 reason codes in the app manifest were not re-fetched: verify against Apple's required-reason API list. |
| "D-U-N-S required for organisation accounts, takes days to weeks" | Not re-verified | Apple enrolment page not fetched. |

## 8. Prioritised fix list

### A. Can be done in code now
1. (should) Add `tabindex="0"`, `role="group"` and `aria-label` to the `.chips` info strips in `app.js` (axe serious, 4 to 6 nodes). Fix `h3` heading order in the home alerts tile and add an `h1` to the terms page.
2. (blocker for submission, but code-prep only) Route every `reroute.example` / `reroute.invalid` reference through one config value (env at build time for web, `capacitor.config.ts`, Android manifest host placeholder, iOS entitlement) so swapping the real domain and mailboxes is a single change. 16 references today.
3. (should) Make versions consistent: choose one marketing version for `web/package.json`, iOS `MARKETING_VERSION`, Android `versionName`.
4. (should) Add a manifest/Info.plist check to `scripts/check.sh`: forbid `ACCESS_BACKGROUND_LOCATION`, require `PrivacyInfo.xcprivacy`, and flag `.invalid`/`.example` strings when `RELEASE=1`.
5. (nice) `UIRequiredDeviceCapabilities` armv7 to arm64; Android `minifyEnabled true` after testing; exact `allowNavigation` hosts.
6. (should) Add the HMAC'd device id, IP rate-limit and poster id lines to the Play Data safety draft, and record the answer for "shared" vs "service provider".
7. (should) Run `pip-audit -r apps/plan-b-mvp/requirements.txt` (not run here: tool unavailable), then decide on `react-router` 7 upgrade (breaking; low exposure for in-app routing).
8. (should) Add keyboard/button alternatives for drag interactions (WCAG 2.5.7) if any are missing; re-check the 200% offline-area control.
9. (nice) Create the Play 1024x500 feature graphic and verify all screenshot pixel sizes against the current store spec pages.

### B. Needs real accounts or devices
1. Apple Developer Program (US$99/yr) and Google Play Console (US$25 one-off, per earlier audit): enrolment, tax/banking only if charging.
2. Firebase project, `google-services.json`, APNs key; test native push on a real iPhone and Android phone.
3. Production hosting and domain; HTTPS; `PLANB_TRUST_PROXY=1`; serve `/.well-known/assetlinks.json` and `apple-app-site-association` from env; monitored `support@`, `abuse@`, `privacy@` mailboxes; Sentry/PostHog projects and regions; fill the `[TODO]` retention values in `privacy-data-map.md`.
4. Build with Xcode 26 on a Mac; archive; read the Xcode Privacy Report; upload to TestFlight. Build a signed AAB with Play App Signing; run the pre-launch report (crashes, accessibility, 16 KB page size).
5. Google and Apple sign-in credentials (OAuth client, Services ID, team/key) and test on devices, including account deletion with Apple token revocation.
6. VoiceOver and TalkBack passes, Dynamic Type / font scale on device, landscape on iPad if supported, out-of-region message.
7. Play closed test: 12+ testers for 14 days if a personal account.
8. Enter App Privacy labels and Data safety forms from `privacy-data-map.md`; IARC and Apple age-rating questionnaires.

### C. Needs the human to decide
1. Individual vs sole trader vs company/organisation publisher (affects Play tester rule, public address, D-U-N-S).
2. App name "Reroute" and bundle id `au.reroute.app` (permanent once listed); trademark and store-name search.
3. Translink licence (CC BY 4.0 vs Queensland open data) and whether Open-Meteo and RainViewer free tiers are acceptable for a public store app, or to buy/replace.
4. Target audience 13+ or 18+; storefronts (Australia only to avoid GDPR scope).
5. Whether analytics/crash reporting should ship at all in v1 (they change the labels).
6. Legal review of privacy, terms, community guidelines and retention periods (APPs; no breach/complaint process text yet).
7. Who staffs the 24 h moderation promise (`RESPONSE_HOURS = 24`) after launch; if nobody, change the promise before the store sees it.

## 9. Submission-day checklist

### Apple (App Store Connect)
- [ ] Account active; agreements, tax and banking set (even for a free app, accept the paid-apps section only if needed).
- [ ] Built with Xcode 26 / iOS 26 SDK; version/build bumped; archive validated; Privacy Report reviewed.
- [ ] Bundle id `au.reroute.app`; Sign in with Apple, Push, Associated Domains enabled on the App ID; distribution profile.
- [ ] Real domain: no `reroute.example`/`.invalid` left; AASA served; support URL, marketing URL, privacy URL live.
- [ ] App Privacy answers match `privacy-data-map.md` and `PrivacyInfo.xcprivacy`; "Data Not Used to Track You".
- [ ] Age rating questionnaire done (UGC yes); export compliance = exempt (HTTPS).
- [ ] Screenshots at required sizes; description includes the "not an official Translink or Queensland Government service" line.
- [ ] Review notes: demo mode steps, SEQ-only coverage, how to find report/block and account deletion, sign-in test account if needed; backend live and monitored.
- [ ] TestFlight smoke test on a real device (location prompt, push, sign-in, delete account, offline area).
- [ ] Release type: manual after approval; phased release on.

### Google Play (Console)
- [ ] Account verified; developer identity shown correctly; closed test requirement satisfied (12 testers x 14 days) if personal.
- [ ] Signed `.aab`, Play App Signing on, `versionCode` higher than any prior upload, target API 36.
- [ ] Store listing, 512 icon, 1024x500 feature graphic, 2+ phone screenshots; contact email, website, privacy URL.
- [ ] Data safety form matches `privacy-data-map.md`; account-deletion URL set to `https://<domain>/account/delete`; deletion option stated in the form.
- [ ] Content rating (IARC) with UGC = yes; target audience set; ads = no; app access instructions (no login needed).
- [ ] Permissions declaration: location foreground only; no background location declaration.
- [ ] Pre-launch report clean of crashes and serious accessibility flags; `assetlinks.json` served if App Links are kept.
- [ ] Roll out: internal, closed, then staged production (e.g. 10 to 20 percent first).

---
Credit: prepared by Claude Sonnet 5.5 via Claude Code at T.P's request. **Human review required** before acting on any item; store policies change and several facts above come from secondary sources.

Not checked: any device or emulator behaviour, Xcode archive output, the Google-provided LLM worker/critic stages of `play-policy-insights`, `pip-audit`, the CI workflows themselves, screenshot pixel dimensions against the live store specs, and the Play US$25 fee.
