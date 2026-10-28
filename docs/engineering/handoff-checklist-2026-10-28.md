# Reroute hand-off checklist (the one document to follow)

Date: 2026-10-28 (final fix pass 2026-10-29). Branch `feature/accounts`. Prepared by Claude Sonnet 5.5 via Claude Code at T.P's request. **Human review required.** Nothing here was run against a store, a Mac, a phone, a mailbox provider or a real Google or Apple account. Store rules and fees come from model knowledge and the audit's secondary sources: check each against the live pages. The detail behind each step is in `accounts.md`, `native-wrapper.md`, `release-process.md`, `privacy-data-map.md`, `ride-board-moderation.md`, `analytics-implementation.md` and `docs/product/store-listing/`; this file only orders the work and gives the exact values.

Key to the last column of each table: **Human only** = needs your identity, money, a device or a legal decision. **Claude can do if you give me X** = ask Claude Code to do it once you supply X.

Conventions used below: `DOMAIN` is the public host name you choose in section B (example `reroute.app.example.org`, bare host, no `https://`). Replace it everywhere. Never paste a secret into the repository, a commit, an issue or a chat; secrets go only in `/opt/reroute/reroute.env` on the host, Play Console, App Store Connect, GitHub repository Variables (non-secret values only) or a password manager.

---

## A. Deploy what exists now

Goal: the branch running on the LXC so you can see it. The server needs no domain for this.

- [ ] **A1. Push from the VS Code terminal** (Claude never pushes). Human only.
  ```
  git status
  git push origin feature/accounts
  ```
  If the host deploys from `main` only, open a pull request and merge it in GitHub yourself after reviewing; do not push to `main` directly.
- [ ] **A2. Confirm the LXC deployed.** Human only (needs SSH to the Proxmox host).
  ```
  ssh root@192.168.1.106 "pct exec 101 -- journalctl -u reroute-update -n 20"
  curl -s https://DOMAIN/healthz
  ```
  `/healthz` should show `"status":"ok"` and `app_version` equal to `web/package.json` `version`. `version` is the git short sha once step A3 is done (it says `dev` before).
- [ ] **A3. Make `/healthz` show the commit.** In `/opt/reroute/update.sh` change the build line to pass the sha (see `infra/plan-b-mvp/README.md`, "Build argument GIT_SHA"):
  ```
  docker build -q --build-arg GIT_SHA=$(git rev-parse --short HEAD) -f infra/plan-b-mvp/Dockerfile -t reroute:latest .
  ```
  Run `git rev-parse` in the checkout, not inside a `git archive` context. Human only. (Claude can edit it if you paste the current `update.sh` with no secrets in it.)
- [ ] **A4. Add the pages' domain and contacts to the same build line** once section B is done, so the React pages show the real mailboxes (they are baked at build time):
  ```
  docker build -q --build-arg GIT_SHA=$(git rev-parse --short HEAD) \
    --build-arg VITE_SITE_DOMAIN=DOMAIN \
    --build-arg VITE_SUPPORT_EMAIL=support@DOMAIN \
    --build-arg VITE_ABUSE_EMAIL=abuse@DOMAIN \
    --build-arg VITE_PRIVACY_EMAIL=privacy@DOMAIN \
    -f infra/plan-b-mvp/Dockerfile -t reroute:latest .
  ```
  Human only (host script). Note `VITE_API_BASE=https://DOMAIN` is only needed for the native app builds, not for this web image.
- [ ] **A5. Server settings in `/opt/reroute/reroute.env`** (host only, never in git). The data volume `reroute-data` is already persistent (mounted at `/app/data`); keep it.
  | Name | Value to enter | Notes |
  |---|---|---|
  | `ACCOUNTS_SECRET_KEY` | 40+ random characters | `python -c "import secrets;print(secrets.token_urlsafe(48))"`. Without it accounts are off. Changing it later logs everyone out and makes stored Apple refresh tokens unreadable |
  | `PLANB_ADMIN_TOKEN` | 32+ random characters | `python -c "import secrets;print(secrets.token_urlsafe(32))"`. Enables `/admin/moderation` and `/admin/usage` |
  | `PUBLIC_URL` | `https://DOMAIN` | Makes cookies `Secure` and builds the sign-in redirect URIs |
  | `PLANB_CORS_ORIGINS` | `capacitor://localhost,https://localhost,ionic://localhost,reroute://localhost` | Native app origins. Exact match |
  | `PLANB_ALERT_WEBHOOK` | A Discord or Slack incoming-webhook URL (a secret) | Gets a message when a ride post is auto-hidden after 3 reports |
  | `PLANB_SUPPORT_EMAIL`, `PLANB_ABUSE_EMAIL`, `PLANB_PRIVACY_EMAIL` | `support@DOMAIN`, `abuse@DOMAIN`, `privacy@DOMAIN` | Used by the server-rendered `/account/delete` page |
  | `PLANB_TRUST_PROXY` | `1` | Already set in the image; needed behind your reverse proxy so HSTS and client IPs work |
  | `MAPS_API_KEY`, `MAPS_BROWSER_API_KEY` | Your Google keys | Already set if the site works today. Restrict the browser key to `https://DOMAIN/*` and the server key by API |
  Human only. Claude can do the proposal and wording if you give me the current `reroute.env` with every value blanked.
- [ ] **A6. Force a rebuild and restart** (Human only; run the host's own update script, which rebuilds the image and recreates the container):
  ```
  ssh root@192.168.1.106 "pct exec 101 -- /opt/reroute/update.sh"
  ssh root@192.168.1.106 "pct exec 101 -- journalctl -u reroute-update -n 20"
  ```
  If your script skips the build when the commit has not changed, use the host's force option or delete the `reroute:latest` image first (do not delete the `reroute-data` volume).
- [ ] **A7. Check after deploy** (Human only; takes two minutes): open `https://DOMAIN/`, `/privacy`, `/community`, `/support`, `/account/delete`; `curl -sI https://DOMAIN/ | grep -i "content-security\|strict-transport"` shows the headers; sign-in buttons appear only once section C or D is done.

## B. Domain and email

- [ ] **B1. Choose and buy the domain.** Human only (money, identity). Pick the name last: the bundle id `au.reroute.app` and the app name "Reroute" are permanent once listed (do the trademark and store-name search first, section H4).
- [ ] **B2. DNS.** `A`/`AAAA` (or a Cloudflare Tunnel) to your reverse proxy with a Let's Encrypt certificate. Human only.
- [ ] **B3. Three real mailboxes that someone reads:** `support@DOMAIN`, `abuse@DOMAIN`, `privacy@DOMAIN` (aliases forwarding to one inbox are fine; the store reviewer will email them). Add SPF, DKIM and DMARC records at the mail provider. Human only.
- [ ] **B4. Rewrite the native files from one argument.** Claude can do if you give me the domain.
  ```
  node scripts/set-domain.mjs --domain DOMAIN --dry-run
  node scripts/set-domain.mjs --domain DOMAIN
  ```
  This changes the Android App Links host, the iOS associated domain and the `capacitor.config.ts` API host default. Commit the result.
- [ ] **B5. Set the build-time values** for the web image (A4) and for native builds: `VITE_API_BASE=https://DOMAIN VITE_SITE_DOMAIN=DOMAIN VITE_SUPPORT_EMAIL=... VITE_ABUSE_EMAIL=... VITE_PRIVACY_EMAIL=...`. For CI, add the same six names as **repository Variables** (Settings, Secrets and variables, Actions, Variables; they are public values, not secrets): `PUBLIC_URL`, `VITE_API_BASE`, `VITE_SITE_DOMAIN`, `VITE_SUPPORT_EMAIL`, `VITE_ABUSE_EMAIL`, `VITE_PRIVACY_EMAIL`. Human only.
- [ ] **B6. Verify nothing placeholder is left.** Claude can do (or you run):
  ```
  cd apps/plan-b-mvp
  python placeholders.py                       # report
  PLANB_PRIVACY_EMAIL=privacy@DOMAIN ... python placeholders.py --strict   # all nine env values set, native files rewritten
  ```
  The CI job `.github/workflows/release.yml` (tag `v*` or run by hand) fails while any placeholder remains (`PLANB_REQUIRE_REAL_CONTACTS=1`).
- [ ] **B7. Serve the association files** (after C and D give you the values): `ANDROID_ASSETLINKS_JSON` (the signing SHA-256 from Play Console, App signing) and `APPLE_APP_SITE_ASSOCIATION_JSON` (`TEAMID.au.reroute.app`) in `reroute.env`; check `https://DOMAIN/.well-known/assetlinks.json` and `.../apple-app-site-association` return JSON. Claude can write the JSON if you give me the SHA-256 fingerprint and the Apple Team ID.

## C. Google OAuth (web and native sign-in)

Do this in Google Cloud console, project owned by you. Human only for the console work; Claude can do the doc/env wording if you give me the values.

- [ ] **C1.** Create a project (name "Reroute"). APIs and services, OAuth consent screen: User type **External**, app name Reroute, support email `support@DOMAIN`, authorised domain `DOMAIN`, homepage `https://DOMAIN/`, privacy `https://DOMAIN/privacy`, terms `https://DOMAIN/terms`. Scopes: only `openid`, `email`, `profile`.
- [ ] **C2. Leave Publishing status = Testing** while you test. Add **Test users**: your Google accounts and every tester who will try sign-in (up to 100). Testing-mode refresh tokens expire after 7 days, which is fine because Reroute only reads the ID token. Move to **In production** only before the public store release (verification may be requested for the app domain and privacy page; with only basic scopes it is normally quick).
- [ ] **C3. Web client:** Credentials, Create credentials, OAuth client ID, Web application. Authorised JavaScript origins: `https://DOMAIN`. Authorised redirect URI exactly: `https://DOMAIN/auth/google/callback`. Copy the ID and secret to `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `reroute.env`.
- [ ] **C4. iOS client:** OAuth client ID, iOS, bundle id `au.reroute.app`. Put its ID in `GOOGLE_IOS_CLIENT_ID`.
- [ ] **C5. Android client:** OAuth client ID, Android, package `au.reroute.app`, SHA-1 of the signing key. You need two: the debug key's SHA-1 (`cd apps/plan-b-mvp/web/android && ./gradlew signingReport`) for testing, and the Play App Signing SHA-1 (Play Console, Setup, App signing) for the store build. Comma-separate both IDs in `GOOGLE_ANDROID_CLIENT_ID`.
- [ ] **C6.** `GOOGLE_IOS_CLIENT_ID` also goes in the `reroute.env` list the native app reads through `/api/auth/providers` (`native_config`); the web client ID is the `webClientId` for the Android token audience. Restart (A6) and confirm the buttons appear.

## D. Apple Developer setup

Needs the paid Apple Developer Program (US$99 per year; organisation enrolment needs a D-U-N-S number). Human only.

- [ ] **D1. App ID** `au.reroute.app` with capabilities Sign in with Apple, Push Notifications, Associated Domains.
- [ ] **D2. Services ID** (the web client): identifier e.g. `au.reroute.web`; enable Sign in with Apple, Configure: primary App ID `au.reroute.app`, domain `DOMAIN`, return URL exactly `https://DOMAIN/auth/apple/callback`. Apple gives a domain-verification file: put its exact text in `APPLE_DOMAIN_ASSOCIATION` (served at `/.well-known/apple-developer-domain-association.txt`), then click Verify.
- [ ] **D3. Sign in with Apple key:** Keys, new key, enable Sign in with Apple, primary App ID `au.reroute.app`; download the `.p8` once. In `reroute.env`: `APPLE_TEAM_ID` (Membership page), `APPLE_KEY_ID` (the key's id), `APPLE_CLIENT_ID` = the Services ID, `APPLE_PRIVATE_KEY_FILE` = path to the `.p8` on the host (or `APPLE_PRIVATE_KEY` with the PEM), `APPLE_BUNDLE_ID=au.reroute.app`. Never commit the `.p8`; keep a copy in a password manager.
- [ ] **D4. Associated domains:** `APPLE_APP_SITE_ASSOCIATION_JSON` with `applinks` for `TEAMID.au.reroute.app` (see B7).
- [ ] **D5. APNs key** is created in section E.
- [ ] **D6.** Test sign-in on a real iPhone, then delete the account in the app and confirm the Apple token is revoked (server log shows no error).

## E. Firebase (FCM) and APNs

Human only for console work. Claude can wire anything in code after you give me the (non-secret) config.

- [ ] **E1.** Firebase console, create project "Reroute". Add an **Android app** `au.reroute.app` and an **iOS app** with the same bundle id.
- [ ] **E2.** Download `google-services.json` into `apps/plan-b-mvp/web/android/app/` and `GoogleService-Info.plist` into `apps/plan-b-mvp/web/ios/App/App/` (add it to the App target in Xcode). Both are git-ignored or must stay out of git; confirm with `git status` before committing.
- [ ] **E3. APNs key:** Apple Developer, Keys, new key, Apple Push Notifications service (APNs); download the `.p8`. Firebase, Project settings, Cloud Messaging, Apple app configuration: upload it with the Key ID and Team ID.
- [ ] **E4. Server credential:** Firebase, Project settings, Service accounts, Generate new private key. Put the JSON file on the host, set `FCM_SERVICE_ACCOUNT_FILE=/path` (or `FCM_SERVICE_ACCOUNT_JSON`) in `reroute.env`. Never commit it. Restart (A6).
- [ ] **E5. Production APNs environment** (TestFlight and App Store builds): the distribution profile makes `aps-environment` production; see `native-wrapper.md`, Hardening notes (optionally a Release-only entitlements file in Xcode).
- [ ] **E6. Test:** install the debug APK, turn on alerts for a trip, then Settings, Demo mode, "Send test disruption push".

## F. Android build, signing, Play internal testing and the 12-tester rule

Needs Android Studio (JDK 17+ and the Android SDK; none on this machine) and a Google Play developer account (US$25 one-off).

- [ ] **F1. Prerequisites:** `cd apps/plan-b-mvp/web && npm ci`, then production env (B5) and `npm run build:native`, then `npm run android:open`. Human only.
- [ ] **F2. Version:** `node scripts/bump-version.mjs patch` (build number +1; the store rejects a reused `versionCode`). Claude can do.
- [ ] **F3. Upload keystore** (once): `keytool -genkeypair -v -keystore reroute-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000`. Store the file and both passwords in a password manager; never in the repo. Enable **Play App Signing** when creating the app. Human only.
- [ ] **F4. Build the signed bundle:** Android Studio, Build, Generate Signed Bundle (`.aab`), release. R8 stays off until you do the "Enable R8 after a signed release test" steps in `native-wrapper.md`.
- [ ] **F5. Create the app in Play Console** (default language English (Australia), app or game: app, free). Complete App content (privacy policy URL `https://DOMAIN/privacy`, ads: none, app access: all functionality available without login, content rating questionnaire with user-generated content = yes, target audience, data safety, account deletion URL `https://DOMAIN/account/delete`). Use `docs/product/store-listing/google-play-console.md`.
- [ ] **F6. Internal testing track:** upload the `.aab`, add yourself and up to 100 testers by email, install through the opt-in link, smoke-test sign-in, push, location, offline area, delete account. Read the **pre-launch report** for crashes, accessibility and 16 KB page-size warnings.
- [ ] **F7. The 12-tester rule (personal accounts created after Nov 2023):** a **closed test** with at least 12 testers opted in for 14 continuous days before you can apply for production. Recruit them three weeks before launch (pilot participants from the user-testing plan; confirm the current number in Play Console). Organisation accounts are exempt. Human only.
- [ ] **F8. Upload graphics:** `docs/product/store-listing/assets/play-icon-512.png` and `play-feature-graphic-1024x500.png`; phone screenshots from `docs/product/store-listing/screenshots/`. Regenerate with `node web/scripts/gen-store-assets.mjs` if the logo changes.
- [ ] **F9. Production:** staged rollout 10 percent first (see `release-process.md`).

## G. iOS build and TestFlight (a Mac, or a cloud Mac)

No Mac is available here. Options: a borrowed Mac; a cloud Mac service (for example MacinCloud or AWS EC2 Mac, billed by the hour, check price and region); or a CI macOS runner such as GitHub Actions `macos-latest` or Codemagic with App Store Connect API key secrets. You need Xcode 26 / iOS 26 SDK (required for uploads since 28 April 2026; check).

- [ ] **G1.** Clone the repo (branch or tag), `cd apps/plan-b-mvp/web && npm ci`, set the B5 env, `npm run build:native`, `npm run ios:open`. Human only.
- [ ] **G2.** In Xcode: select the App target, Signing and Capabilities, your team, confirm Push Notifications, Associated Domains, Sign in with Apple appear (the entitlements file was hand-wired; open it once). Add `GoogleService-Info.plist` to the target.
- [ ] **G3. Version:** `node scripts/bump-version.mjs patch` before archiving (iOS needs a higher build number each upload).
- [ ] **G4.** Product, Archive, Validate, Distribute to App Store Connect. After upload open the archive's **Privacy Report** and compare to `PrivacyInfo.xcprivacy` and `privacy-data-map.md`. Fix ITMS warnings (ITMS-90725 SDK version, ITMS-91053/91061 privacy manifests).
- [ ] **G5. TestFlight:** internal testers get the build in minutes; external testers need a one-off beta review. Smoke-test on a real iPhone: location prompt, push, Google and Apple sign-in, delete account, offline area, VoiceOver pass.
- [ ] **G6. Icon:** the 1024x1024 no-alpha marketing icon is `docs/product/store-listing/assets/ios-marketing-icon-1024.png` if Xcode asks for it.
- [ ] **G7.** Claude can do if you give me the macOS CI choice and an App Store Connect API key stored as encrypted repository secrets (not in chat): write the workflow for build and upload.

## H. Store forms

- [ ] **H1. Apple App Store Connect:** follow `docs/product/store-listing/app-store-connect.md` (description, keywords, screenshots, review notes with the demo-mode steps, age rating with user-generated content = yes, export compliance = exempt/HTTPS, release manually, phased release on).
- [ ] **H2. Apple App Privacy labels:** copy from "Form answers derived from this map" in `privacy-data-map.md`; Data Not Used to Track You.
- [ ] **H3. Google Play Data safety:** copy the table in `google-play-console.md` (includes the device-id and IP rows); every row must match `privacy-data-map.md`, which you change first if the app changes. Human only (the Console form).
- [ ] **H4. Name and trademark:** search IP Australia trademarks and both stores for "Reroute" before committing to the bundle id. Human only.
- [ ] **H5. Review notes:** say the backend must be live (Section A) and that Demo mode works outside South East Queensland; give a sign-in test account only if the reviewer must test sign-in (Play Console field, not the repo).
- [ ] **H6. Publisher type decision** (individual or organisation) affects the Play tester rule, the public address on the listing and D-U-N-S. Human only.

## I. Legal review items and every `[TODO]` in the Privacy page

Get the Privacy Policy, Terms and Community Guidelines reviewed by a person qualified in Australian privacy law (UQ legal support or a community legal centre). Claude's text is a draft, not legal advice. Edit the wording in `web/src/screens/legal/privacy.body.jsx` and run `python web/scripts/sync_legacy_legal.py` (it rewrites the legacy copy so both stay identical; `test_legal_sync.py` fails otherwise). Claude can make the edits if you give me the values.

| `[TODO]` text in the Privacy page | Recommended default | You must supply |
|---|---|---|
| Name the legal entity and its address | "Reroute is operated by [your full name], a student at The University of Queensland, Brisbane, Queensland" until an entity exists. Use a postal address or a business PO box, not your home address | The real operator name and a contactable address (human decision) |
| Hosting provider and country | "Hosted on a server in Brisbane, Australia" if it stays on your own LXC; otherwise the provider and country | Where it really runs |
| Crash reports retention in the vendor settings | 30 days (Sentry project setting: Settings, Security and Privacy, data retention) | Set it in Sentry, then keep the text |
| Usage data retention (text says 90 days) | 90 days in PostHog (project settings, data retention) | Set it in PostHog |
| Server access log retention | 30 days or less (the host's log rotation; set `logrotate`/Docker log `max-file`) | Confirm the real setting |
| Backups made by the host | "Backups are kept for 14 days, then deleted" (match what section M sets up) | Confirm the real schedule |
| PostHog region and Sentry region | PostHog EU (`eu.i.posthog.com`) and Sentry Germany (`de.sentry.io`) when you create the projects, to avoid US transfer text | Choose when creating the projects |
| Any "[TODO: confirm]" in the retention or disclosure lists | Keep the default wording if it matches the code (`privacy-data-map.md` is the source) | Confirm each line |

Other review items: the "TODO before public release" line at the bottom of the Privacy page (delete it after the above); the Terms disclaimer; the 24-hour moderation promise (section L; if nobody can keep it, change `RESPONSE_HOURS` in `web/src/screens/legal/contact.js` and the legacy text before the store sees it); the data licences (`data-licences.md`: the Translink licence mismatch, Open-Meteo and RainViewer free-tier terms for a public store app); Australian Privacy Principles complaint and data breach process text; whether to ship analytics at all in v1 (switching it on changes the store labels).

## J. Ethics and user testing kickoff

- [ ] **J1.** Read `docs/product/user-testing-plan-2026-10-28.md`, especially section 6 (ethics and consent). Decide with your tutor whether UQ ethics review is needed before contacting any participant. Human only; the AI cannot decide this.
- [ ] **J2.** Prepare the consent text and recruiting message from the plan; never record names or contact details in Git (participant codes only; see `AGENTS.md`).
- [ ] **J3.** Start recruiting the 12+ Play closed testers from the same pool (section F7). Claude can do if you give me the final consent wording: update the install page and the screening form text.
- [ ] **J4.** Run the pilot sessions per the plan's schedule. Human only. Claude can summarise anonymised notes you paste, labelled as interpretation.

## K. Analytics and Sentry switch-on

Off by default; nothing is sent without both the build keys and the person's consent (see `analytics-implementation.md`).

- [ ] **K1.** Create a PostHog project in the EU region and a Sentry project (JavaScript browser; EU/Germany). Human only.
- [ ] **K2.** Add the keys as build-time variables (these are public client keys): `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST=https://eu.i.posthog.com`, `VITE_SENTRY_DSN`. Add them to the web build line (A4) as extra `--build-arg` plus matching `ARG`/`ENV` lines in the Dockerfile web stage; Claude can do that if you give me the names (not the values).
- [ ] **K3.** Server-side errors: `SENTRY_DSN` in `reroute.env` and `pip install "sentry-sdk[flask]"` added to `requirements.txt` (on purpose not there today). Claude can do if you confirm you want it.
- [ ] **K4.** In PostHog and Sentry set the retention values you wrote in section I. Turn off IP capture in both. Test: Settings, "Share anonymous usage data" on, do a trip, confirm one event arrives.
- [ ] **K5.** Update the store privacy labels (H2, H3): they already list opt-in analytics and crash data.

## L. Moderation operations

The app promises to review reports within 24 hours. Someone must actually do it. Runbook: `ride-board-moderation.md`, "Operator runbook".

- [ ] **L1. Name the person** who checks `https://DOMAIN/admin/moderation` at least once a day and within 24 hours of any report, and a named backup for weekends and exams. Human only. If nobody can, change the promise (section I).
- [ ] **L2.** Make sure `PLANB_ADMIN_TOKEN` is set (A5) and store it in the password manager. Test: open `/admin/moderation`, sign in with the token.
- [ ] **L3.** Set `PLANB_ALERT_WEBHOOK` (A5) so the phone buzzes when a post auto-hides; test with three reports on a demo post.
- [ ] **L4.** Read and test the appeals process (runbook steps 3 and 4). `abuse@DOMAIN` must reach the same person.
- [ ] **L5.** Threats, child safety or illegal content: remove and ban immediately, keep the log text, contact police (runbook step 5). Human only.

## M. Ongoing

- [ ] **M1. Dependabot:** `.github/dependabot.yml` exists; review and merge its pull requests weekly. Run `npm audit --omit=dev` and `pip-audit -r apps/plan-b-mvp/requirements.txt`; the release workflow runs both. The two moderate `react-router` advisories are documented as not applicable in `security.md`; revisit with the react-router 7 and vitest 5 upgrade round.
- [ ] **M2. Backups of `/app/data`** (rides, accounts, push, GTFS cache). Daily snapshot of the `reroute-data` volume, kept 14 days, one copy off the host. Example on the host (adjust paths; test a restore):
  ```
  docker run --rm -v reroute-data:/d -v /srv/backups:/b alpine tar czf /b/reroute-data-$(date +%F).tar.gz -C /d .
  find /srv/backups -name 'reroute-data-*.tar.gz' -mtime +14 -delete
  ```
  Human only (cron on the host). Claude can write the systemd timer if you tell me the backup path and the off-host target.
- [ ] **M3. Uptime Kuma:** monitor `https://DOMAIN/healthz` (HTTP keyword `ok`, 1 minute) and `https://DOMAIN/readyz` (5 minutes); notify the same channel as `PLANB_ALERT_WEBHOOK`. Human only.
- [ ] **M4. Google cost:** set a billing budget alert in Google Cloud before launch; glance at `/admin/usage` (Bearer `PLANB_ADMIN_TOKEN`) daily in the first weeks.
- [ ] **M5. Releases:** `node scripts/bump-version.mjs patch`; update the service-worker cache name in `sw.js`; commit; tag `vX.Y.Z`; the release workflow runs; upload builds (F, G). See `release-process.md`.
- [ ] **M6. Rollback:** server: rebuild the previous commit (`git checkout <old sha>` then A3 build line) or retag the previous image; the `reroute-data` volume is untouched. Android: halt the rollout and ship the previous code with a higher `versionCode`. iOS: pause the phased release and submit a fixed build.
- [ ] **M7. Platform deadlines:** Play target API 36 now, API 37 expected next August; Apple Xcode/SDK requirement rises every April. Put a reminder in your calendar.

---

## Quick list of what only a human can do (the shortest path to a store submission)

1. Push and merge (A1) and confirm the deploy (A2).
2. Buy the domain, set DNS and HTTPS, create the three mailboxes (B).
3. Run `scripts/set-domain.mjs` and set the env values (B4, B5; Claude can do the run).
4. Create the Google OAuth clients and add test users (C).
5. Join the Apple Developer Program and create the Services ID, key and App ID (D).
6. Create the Firebase project, APNs key and service-account file (E).
7. Install Android Studio, make the upload keystore, build the signed bundle and start internal then closed testing with 12 testers (F).
8. Get a Mac or cloud Mac, archive, upload to TestFlight (G).
9. Fill both store forms and name the legal entity; get the legal review (H, I).
10. Name the moderator, decide on ethics review, and set up backups and monitoring (J, L, M).

Credit: prepared by Claude Sonnet 5.5 via Claude Code at T.P's request. **Human review required.**
