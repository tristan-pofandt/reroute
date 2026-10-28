# Reroute accounts log

**Status:** Implemented on 2026-10-28 on the branch `feature/accounts` for team review. Not merged, not pushed and not deployed; `main` (the demo build) is unchanged. No real Google or Apple credentials existed, so real sign-in was never run: it was tested against mocked providers and a development-only fake provider. Nothing was tested with participants or on a real phone.

**Who wrote it:** requested and directed by T.P; written by Claude Sonnet 5.5 via Claude Code at T.P's request (see the [AI-use log](../team/ai-use-log.md)). Every commit carries a `Co-Authored-By: Claude Sonnet 5.5` line. **Human review required:** a team member who did not build it must review it before merge, and the Privacy and Terms wording needs review by someone qualified.

Paths are in `apps/plan-b-mvp/`. Design, diagrams and set-up steps are in [accounts.md](../engineering/accounts.md).

## What changed

| Change | What was built | Where |
| --- | --- | --- |
| Accounts backend | Optional sign-in with Google and Apple (Authlib OpenID Connect, PKCE, state, nonce, ES256 Apple client secret, `form_post`), SQLite `accounts.db`, server-side revocable 30-day rolling sessions, per-user synced data with optimistic versions, guest merge that never overwrites silently, JSON export, hard delete with Apple token revocation. A previous run had written a draft; it was completed, and a key-set deadlock that froze every sign-in was fixed. | `accounts.py`, `server.py` |
| Native readiness | `POST /auth/native/google` and `/auth/native/apple` verify SDK ID tokens (JWKS, issuer, audience list from environment, expiry, nonce, single use) and return a cookie or a hashed bearer token. No plugin was installed. | `accounts.py` |
| Public deletion page | `/account/delete`: plain HTML without script, explains how to delete an account and data (Google Play asks for a web address). `/.well-known/` files are served from environment variables. | `accounts.py` |
| Account screen | Signed out: what an account is for, what is stored, Continue with Google and Sign in with Apple (brand-guideline buttons, same size), Terms and Privacy links, Continue without an account. Signed in: name, email, provider, last sign-in, sync status, Download my data, Sign out, Delete my account (two taps, asks for a fresh sign-in if the last one is old). Loading, error and "not set up" states. | `web/src/screens/account.screen.jsx`, `web/src/accounts/account.css` |
| Avatar menu | The two placeholder items became one entry: "Sign in" or the person's name, opening the Account screen. | `app.js` |
| Sync | Settings, saved places and trip history sync through an adapter over the existing `planb.*` localStorage keys (legacy code is unchanged), debounced, with an offline queue that survives reloads and a conflict message with a choice. | `web/src/accounts/store.js`, `adapter.js` |
| Service worker | Never caches `/auth/*`, `/api/me`, `/api/account/*`, `/account/delete` or `/.well-known/*`; `VERSION` is `planb-reroute-22`. | `sw.js` |
| Privacy and Terms | New sections on accounts, retention, deletion and export, Google and Apple as processors, a `privacy@reroute.invalid` placeholder with a visible TODO, and ride-board acceptable use. The wording is identical in the legacy `app.js` and the React bodies. The placeholder-profile sentences were removed. | `app.js`, `web/src/screens/legal/privacy.body.jsx`, `terms.body.jsx` |
| Dependencies and config | `Authlib`, `joserfc` and `requests` in `requirements.txt`; environment variable names in `.env.example`, the infra README and the app README (no values). | `requirements.txt`, `.env.example`, `README.md`, `infra/plan-b-mvp/README.md` |

## What was checked

- `python -m unittest -q`: all tests pass, including 31 new account tests with local RSA and EC keys and no network (PKCE, state and nonce parameters, callback success, failure and replay, Apple `form_post`, native bad audience, issuer, expiry, nonce and signature, CSRF, export and delete, rate limits, expiry, disabled providers, open redirects).
- `npm run build` and `npm test` (32 tests) in `web/` pass.
- Flask on `127.0.0.1` with `PLANB_DEV=1`, fake provider variables and the test-only fake sign-in, driven with a headless Chrome at 390x844: signed out with providers (both brand buttons shown) and without (a "not set up" message, no buttons); simulated sign-in; signed-in card; avatar menu showing the name; sync reaching the server for settings, saved places and trips; Download my data; a second device with different settings producing a conflict panel and the "Keep this device's" choice uploading it; the two-step delete leaving the person signed out; Privacy, Terms and `/account/delete` loading. No console errors from the app (only the harness's blocked service worker).

## Not checked

- Real Google or Apple sign-in, Apple token revocation against Apple, the Apple domain file, and any native SDK flow: no credentials existed.
- Docker: `docker` is not installed on this machine, so the image was not built. `requirements.txt` resolves with pip, and `Dockerfile.dockerignore` only drops `test_*.py`, so `accounts.py` ships. A team member should run `docker build -f infra/plan-b-mvp/Dockerfile .`.
- Real phone, VoiceOver or TalkBack, the installed-PWA return after a provider redirect, and accessibility of the Account screen beyond headless checks.
- `accounts.db` must be on a persistent disk; a host that wipes the disk on redeploy would delete every account.

## Deployment note

Accounts stay off until `ACCOUNTS_SECRET_KEY` is set on the host. The provider steps, the exact redirect URIs and origins, and the Google Testing-mode reason (`ts.net` is a public-suffix domain) are in [accounts.md](../engineering/accounts.md).

## Open decisions

- Replace `privacy@reroute.invalid` with a monitored address.
- The placeholder app ID `au.reroute.app` appears in the native config; the Apple and Google native client IDs depend on the final one.
