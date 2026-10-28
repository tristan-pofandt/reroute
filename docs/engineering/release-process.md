# Reroute release process (draft)

Prepared by Claude Sonnet 5.5 via Claude Code at T.P's request. **Human review required.** Store rules, review times and fees are from the model's knowledge (cut off mid-2026) and were not re-checked: confirm each against the current Apple and Google pages before relying on it. Native build detail is in `native-wrapper.md`; the store forms are in `docs/product/store-listing/`.

## Versioning

- **One source of truth**: `apps/plan-b-mvp/web/package.json` (`version` = `MAJOR.MINOR.PATCH`, start `0.1.0`, `1.0.0` = first public store release; `buildNumber` = one integer that only goes up, used for every upload to either store).
- **Bump with the script, never by hand**: `node scripts/bump-version.mjs patch|minor|major|1.2.3 [--build N] [--dry-run]` (build number +1 unless `--build`). It rewrites `package.json`, `package-lock.json`, Android `versionName`/`versionCode` (`android/app/build.gradle`) and iOS `MARKETING_VERSION`/`CURRENT_PROJECT_VERSION` (`project.pbxproj`, both configurations). The Support page shows `package.json` `version` and the build; `/healthz` returns it as `app_version` (plus `version` = git sha, `api_version`). `--sync` re-applies the current version to the native files; `--check` (run by `scripts/check.sh` and `test_versions.py`) fails if anything disagrees.
- Stores reject a reused build number, so bump before every upload even when the marketing version is unchanged. Commit, then tag (below).
- **Server/web**: the deployed web build is identified by `GIT_SHA` (`/healthz` shows it). Native apps load the bundled web build, so a web change that must reach store users needs a new binary unless the app loads the live site.
- Tag releases `v0.1.0` on `main`. Changelog = the what's-new text (template in the listing docs).

## Branching

`main` is always releasable (CI green: Python tests, front-end tests, build, audits). Work on `feature/*` branches via pull request (template in `.github/`); one reviewer minimum once CODEOWNERS is filled in. Release candidates: tag `vX.Y.Z-rc.N` on `main`; hotfixes branch from the release tag.

## Build and signing

1. `make check` (or `scripts/check.sh`), then `GIT_SHA=$(git rev-parse --short HEAD) VITE_... npm run build` with the production env vars (analytics keys, maps browser key; none are committed).
2. `npm run build:native` then open in Xcode (`npm run ios:open`) or Android Studio (`npm run android:open`).
3. **iOS**: Apple Developer account (US$99/year), Distribution certificate and App Store provisioning profile (Xcode automatic signing is fine for one app), Archive, Distribute to App Store Connect. Keep `PrivacyInfo.xcprivacy` current.
4. **Android**: use **Play App Signing**; create an upload keystore once, keep it and its passwords in a password manager and CI secrets, never in the repo; build a signed `.aab` (bundle), not an apk. Target the API level Google currently requires.
5. Secrets in CI (when added): keystore (base64), its passwords, App Store Connect API key. Store only as encrypted repository secrets.

## Test distribution

- **iOS TestFlight**: internal testers (up to 100 team members, no review) get a build minutes after processing; external testers need a one-off beta App Review (usually under a day; check).
- **Google Play internal testing**: up to 100 testers by email, available within minutes, no review. Then **closed testing**.
- **Play 12-tester rule**: a *personal* developer account created after Nov 2023 must run a closed test with at least 12 testers opted in for 14 continuous days before it can apply for production (the number was 20 earlier; check the current figure). Organisation accounts are exempt. Start recruiting testers (the pilot users in `user-testing-plan-2026-10-28.md`) at least three weeks before the planned launch.

## Store review

Apple: first submissions are typically reviewed in about 24 to 48 hours but allow a week for a rejection and resubmission (guideline 4.2 and 1.2 are the likely questions; the review notes in `app-store-connect.md` answer them). Google: new apps and updates usually clear in a few days, but a new developer account can take up to about a week; allow longer for first production access.

## Staged rollout

Apple: "Release over 7 days" phased release (1, 2, 5, 10, 20, 50, 100%), pausable. Google: production release at 5 or 10%, watch Android vitals and crash reports for 24 to 48 hours, then 25, 50, 100%. Halt on any crash-free-sessions drop of more than 1 point or a spike in `/readyz` failures or Google cost (`/admin/usage`).

## Rollback

- Server/web: redeploy the previous image (`docker build --build-arg GIT_SHA=<old sha>` or the host's rollback button); data lives in `PLANB_DATA_DIR` and is not touched by an image change. Keep the previous two images.
- Android: halt the rollout; "roll back" means releasing the previous code as a new build with a higher `versionCode`. iOS: pause the phased release and submit a fixed build (expedited review can be requested for critical bugs); you cannot restore an older binary, but you can remove the new version from sale before it ships.
- The service worker cache name (`planb-reroute-N` in `sw.js`) must be bumped when shipping so old clients refresh.

## Post-launch monitoring

Uptime Kuma on `/healthz` (1 min) and `/readyz` (5 min); Sentry crash and error alerts (if consent-gated reporting is enabled); daily glance at `/admin/usage` against the Google billing budget alert (set one in Google Cloud before launch); PostHog weekly review per the analytics plan; Play Console Android vitals and App Store Connect crash reports; respond to reviews and the support inbox within two days, and to UGC reports within 24 hours (store policy).

## Pre-release checklist

See "Release checklist" in `docs/product/store-listing/app-store-connect.md`; it applies to both stores.
