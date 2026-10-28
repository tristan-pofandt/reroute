# Reroute accounts

**Status:** implemented on the branch `feature/accounts` on 2026-10-28; not merged, not pushed, not deployed. No real Google or Apple credentials were available, so every provider call was tested against mocks and a development-only fake provider. **Human review required** before any real use.

**Who wrote it:** requested and directed by T.P; written by Claude Sonnet 5.5 via Claude Code at T.P's request (see the [AI-use log](../team/ai-use-log.md)). The legal wording and the store-rule checklist below are an engineer's reading of public rules, not legal advice.

Guest mode is still the default. Nothing in the app needs an account; signing in only syncs settings, saved places and trip history between devices. Code is in `apps/plan-b-mvp/accounts.py` (server), `web/src/accounts/` (store and sync adapter) and `web/src/screens/account.screen.jsx` (screen). Tests: `test_accounts.py` (no network).

## Architecture

- **Server:** a Flask blueprint (`accounts.py`) created by `init_accounts()` from `server.py`. It uses Authlib for the OpenID Connect authorisation URL, PKCE and the code exchange, and `joserfc` (Authlib's JOSE library) to verify ID tokens against the provider's published key set. Everything that touches the network is in one small `Http` class that the tests replace.
- **Store:** SQLite file `PLANB_DATA_DIR/accounts.db` (WAL mode, foreign keys on, versioned migrations). One gunicorn worker is used by the app, so SQLite is enough; move to Postgres only if that changes.
- **Sessions:** server-side and revocable. The cookie (or bearer token) holds a random 256-bit token; only its SHA-256 is stored. Signing out, deleting the account or expiry removes the row, so a stolen token dies with it.
- **Web client:** a module-level store (`useAccount()`) fetches `/api/auth/providers` and `/api/me`, drives a debounced sync loop, and tells the legacy avatar menu the user's name through `window.RerouteAccount`. Sign-in is a full-page redirect, so it works in an installed PWA, a Capacitor shell and a WebView.
- **Off by default:** without `ACCOUNTS_SECRET_KEY` the whole feature is disabled (routes answer 503 or "signed out"), and a provider's button is hidden unless that provider is fully configured.

## Data model

| Table | Columns that matter | Notes |
| --- | --- | --- |
| `users` | `id` (`u_` + random), `display_name`, `email`, `email_verified`, `created_at` | One row per person. Hard-deleted. |
| `identities` | `provider`, `subject` (primary key together), `user_id`, `email`, `last_login` | A user can have several (Google and Apple). Linked by email only when both sides are verified. |
| `sessions` | `id_hash`, `user_id`, `kind` (web or native), `provider`, `expires_at`, `auth_at` | `auth_at` is the last real sign-in (used for the recent-login check on deletion). Expiry rolls: 30 days from last use. |
| `user_data` | `user_id`, `key`, `json`, `version`, `updated_at` | Keys `settings`, `places`, `trips` (pattern `[a-z][a-z0-9_-]{0,39}`), at most 20 keys, 256 KB per value, 1 MB per user. |
| `pending_auth` | `state_hash`, `provider`, `nonce`, `verifier`, `browser_hash`, `next`, `expires_at` | One row per sign-in in progress (10 minutes). This is the server-side state that makes Apple's `form_post` work. Deleted on first use. |
| `apple_tokens` | `user_id`, `client_id`, `refresh_token_enc` | Apple refresh token, Fernet-encrypted with a key derived from `ACCOUNTS_SECRET_KEY`, kept only so deletion can revoke it. |

Nothing else about a person is stored: no password, no provider access tokens, no profile photo.

## Sequence diagrams

### Web sign-in with Google (authorisation code, PKCE, state, nonce)

```mermaid
sequenceDiagram
    participant B as Browser
    participant R as Reroute server
    participant G as Google
    B->>R: GET /auth/google/login?next=/account
    R->>R: random state, nonce, PKCE verifier, browser cookie; store hashes in pending_auth
    R-->>B: 303 to Google (scope openid email profile, code_challenge S256, state, nonce) + planb_pre cookie
    B->>G: user signs in and consents
    G-->>B: 302 to /auth/google/callback?code=...&state=...
    B->>R: GET /auth/google/callback (planb_pre cookie)
    R->>R: delete pending_auth row (single use); check provider, expiry, browser cookie
    R->>G: POST token endpoint (code, code_verifier, client secret)
    G-->>R: id_token
    R->>G: GET key set (cached)
    R->>R: verify signature, iss, aud, exp, nonce; email_verified decides account linking
    R->>R: find or create user, create session
    R-->>B: 303 to next?signed_in=1 + HttpOnly session cookie
```

### Web sign-in with Apple (`response_mode=form_post`)

```mermaid
sequenceDiagram
    participant B as Browser
    participant R as Reroute server
    participant A as Apple
    B->>R: GET /auth/apple/login
    R-->>B: 303 to Apple (scope "name email", response_mode=form_post) + planb_pre cookie (SameSite=None; Secure)
    B->>A: user signs in (may hide email: private relay address)
    A-->>B: auto-submitting form
    B->>R: POST /auth/apple/callback (state, code, user JSON on the first login only)
    Note over R: Apple's POST is cross-site, so only a SameSite=None cookie arrives; the real state lives in pending_auth
    R->>R: ES256 client secret signed from APPLE_PRIVATE_KEY; exchange code
    A-->>R: id_token + refresh_token
    R->>R: verify id_token, take the name from the first-login "user" field, store encrypted refresh token
    R-->>B: 303 to next?signed_in=1 + session cookie
```

### Native sign-in (Capacitor, ID token from the platform SDK)

```mermaid
sequenceDiagram
    participant App as App (native SDK)
    participant R as Reroute server
    App->>App: SDK sign-in with a fresh random nonce (Apple: SDK gets the SHA-256 of it)
    App->>R: POST /auth/native/google or /apple {id_token, nonce, authorization_code (Apple)}
    R->>R: verify signature (JWKS), iss, aud in env list (web, iOS, Android IDs), exp, nonce; refuse a token seen before
    R-->>App: {token (bearer), csrf, user} and a session cookie
    App->>R: later calls with Authorization: Bearer token (no CSRF header needed: not an ambient credential)
```

### Deleting an account

```mermaid
sequenceDiagram
    participant U as Account screen
    participant R as Reroute server
    participant A as Apple
    U->>U: Delete my account, then a second confirm
    U->>R: POST /api/account/delete {confirm: "delete"} + X-CSRF-Token
    R->>R: signed in within the last 10 minutes? if not: 401 reauth (screen asks to sign in again)
    R->>A: POST https://appleid.apple.com/auth/revoke (Apple accounts only)
    A-->>R: 200
    R->>R: DELETE the user row (identities, sessions, data, Apple token cascade)
    R-->>U: {deleted: true}; cookie cleared
```

If Apple cannot be reached, nothing is deleted and the person is told to try again, so a revocation is never skipped.

## HTTP interface

| Endpoint | Purpose |
| --- | --- |
| `GET /api/auth/providers` | Which buttons to show (`google`, `apple`, and `fake` only under `PLANB_DEV=1`) and which native sign-ins exist |
| `GET /auth/<google\|apple>/login?next=` | Start sign-in (303). `next` is a same-site path only |
| `GET`/`POST /auth/<provider>/callback` | Provider return (POST for Apple). Always ends in a redirect to `next` with `signed_in=1` or `auth_error=<code>` |
| `POST /auth/native/<google\|apple>` | Verify an SDK ID token; returns a bearer token and sets a cookie |
| `GET /api/me` | Signed-in user, CSRF token, `reauth_required` |
| `POST /auth/logout` | End this session on the server |
| `GET /api/account/export` | Everything stored, as a JSON download |
| `POST /api/account/delete` | Hard delete (recent sign-in, Apple revoke) |
| `GET /api/account/data`, `PUT /api/account/data/<key>` | Synced data; `PUT` carries the version last seen and answers 409 with the server copy on a mismatch |
| `POST /api/account/merge` | Guest-to-account merge: reports `uploaded`, `kept_server` or `replaced_server` (with the previous value) for every key; the web client sends unknown stamps so the server copy is never replaced |
| `GET /account/delete` | Public, script-free page that explains deletion (the web deletion URL Google Play asks for) |
| `GET /.well-known/apple-developer-domain-association.txt` (also `apple-app-site-association`, `assetlinks.json`) | Content comes from environment variables; 404 when unset |

## Environment variables (names only)

| Variable | Needed for |
| --- | --- |
| `ACCOUNTS_SECRET_KEY` | Accounts at all (32+ characters). Without it everything is off. |
| `PUBLIC_URL` | The redirect URI base `{PUBLIC_URL}/auth/<provider>/callback`; also makes cookies `Secure` when it starts with `https://` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Web Google sign-in |
| `GOOGLE_IOS_CLIENT_ID`, `GOOGLE_ANDROID_CLIENT_ID` | Native Google tokens (comma-separated lists) |
| `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_CLIENT_ID` | Apple web sign-in (Services ID) and the client-secret JWT |
| `APPLE_PRIVATE_KEY` or `APPLE_PRIVATE_KEY_FILE` | The `.p8` key that signs the client secret |
| `APPLE_BUNDLE_ID` | Native Apple tokens (comma-separated) |
| `APPLE_DOMAIN_ASSOCIATION` (`_FILE`) | `/.well-known/apple-developer-domain-association.txt` |
| `APPLE_APP_SITE_ASSOCIATION_JSON`, `ANDROID_ASSETLINKS_JSON` (`_FILE`) | Native deep-link association files |
| `PLANB_DEV`, `ACCOUNTS_FAKE_PROVIDER` | Local testing only: auto-generated secret key and a fake provider. The fake provider cannot be enabled without `PLANB_DEV=1`. |
| `PLANB_CORS_ORIGINS` | Native app origins (`capacitor://localhost,https://localhost,ionic://localhost`, comma list, exact match). Used by `security.py` for CORS headers **and** by the account routes' `Origin` check, so the native app can call `/auth/native/*` and `/api/account/*`. Empty by default. |
| `PLANB_DATA_DIR` | Where `accounts.db` lives. It must be on a persistent disk or volume or accounts vanish on redeploy. |

Values live only in the host's settings or a git-ignored `.env`; `.env.example` lists the names.

## Security decisions

- **OIDC checks:** PKCE (S256), `state` (single use, stored hashed, bound to the browser by the `planb_pre` cookie), `nonce`, signature against the provider's JWKS (key rotation handled with a rate-limited refetch), `iss`, `aud`, `exp` (60 s leeway). Only RS256 and ES256 are accepted. An unverified email never links two accounts.
- **Cookies:** HttpOnly, `Secure` and the `__Host-` prefix on https, `SameSite=Lax`. The one exception is the short-lived Apple pre-auth cookie, which is `SameSite=None; Secure` because Apple answers with a cross-site POST; it carries no identity, only a random handle for the server-side state.
- **Sessions:** 30 days rolling (renewed at most hourly), hashed at rest, revoked on logout and deletion.
- **CSRF:** cookie-authenticated state-changing endpoints require an `X-CSRF-Token` header (an HMAC of the session, returned by `/api/me`: a double-submit that cannot be guessed cross-site), JSON content type, and a matching `Origin`. Bearer-token callers need none.
- **Open redirects:** `next` must be a same-site path; anything with a scheme, host, `//`, backslash or control character becomes `/`.
- **Abuse:** per-IP hourly limits through `limits.py` (login 60, native 30, writes 600, deletion 5); native ID tokens are single use.
- **Fail closed:** no `ACCOUNTS_SECRET_KEY` means no accounts. A random development key is generated only when `PLANB_DEV=1`.
- **Deletion:** hard delete of every row; Apple's token is revoked first. Logs name the internal user id, never the email, tokens or provider error text.
- **No secrets in git:** credentials come from the environment only. The tests use freshly generated throwaway keys.
- **Not done (known limits):** synced data is not end-to-end encrypted; there is no email or password sign-in, account recovery or multi-device session list; SQLite assumes one server process.

## Provider-rule compliance checklist

Tick each against the live rules before submitting. Links are the starting points; the rules change.

- [ ] **Google OAuth verification:** the app only requests the non-sensitive scopes `openid email profile`. Non-sensitive scopes do not need Google's full verification, but production (not Testing) consent screens need a real domain, a privacy policy URL and a homepage, and an authorised domain that is not a public suffix.
- [ ] **Google API Services User Data Policy:** limited use. Data from Google is used only to provide sign-in and sync, is not sold, not used for ads and not transferred except as needed to run the service. The Privacy page says so and names Google as a processor.
- [ ] **Google branding guidelines:** the button uses the unmodified multicolour "G", the label "Continue with Google", the light or dark theme that matches the app, 18 px mark, Roboto Medium 14 px, and is the same size as the Apple button.
- [ ] **Apple App Store guideline 4.8 (login services):** an app that offers Google sign-in must offer an equivalent privacy-preserving option; Sign in with Apple limits data to name and email, lets the person hide their email and does not track. Both buttons ship together.
- [ ] **Apple guideline 5.1.1(v) (account deletion):** an app that supports account creation must let people start deletion inside the app. Account, Delete my account does this, deletes immediately and revokes Apple's token (`https://appleid.apple.com/auth/revoke`).
- [ ] **Apple Human Interface Guidelines for the button:** black or white button, Apple logo, "Sign in with Apple", minimum size respected, equal prominence with other sign-in options.
- [ ] **Google Play data deletion:** the Data safety form needs a web deletion URL: `{PUBLIC_URL}/account/delete` (public, no script, no sign-in).
- [ ] **Privacy text matches reality:** Privacy and Terms (legacy `app.js` and `web/src/screens/legal/*.body.jsx`, identical wording) describe what is collected, why, retention, deletion and export, and Google and Apple as processors. The contact `privacy@reroute.invalid` is a placeholder and must be replaced.
- [ ] **Data safety and App Privacy forms:** declare name, email, user id and the synced app data as collected, linked to the user, used for app functionality, deletable.

## Provider setup, step by step

Use the real address of the deployment for `{PUBLIC_URL}`. The deployment note in the project docs is `https://mediaserver.taildc527c.ts.net`; use that string as `PUBLIC_URL` today and replace it everywhere once a real domain exists. Set the environment variables on the host afterwards and restart.

### Google (web)

1. Google Cloud Console, create or choose a project, then **APIs and Services, OAuth consent screen**.
2. User type **External**. App name Reroute, a support email, and the privacy policy link `{PUBLIC_URL}/privacy`.
3. Scopes: add only `openid`, `.../auth/userinfo.email` and `.../auth/userinfo.profile`.
4. **Keep the publishing status on Testing.** `ts.net` is on the public-suffix list, so Google will not accept it as an authorised domain and the app cannot be moved to production on that address. In Testing mode add each tester's Google address under **Test users** (up to 100). Only test users can sign in. This is enough for the user-testing phase.
5. **Credentials, Create credentials, OAuth client ID**, type **Web application**.
   - Authorised JavaScript origins: `{PUBLIC_URL}` (for example `https://mediaserver.taildc527c.ts.net`).
   - Authorised redirect URIs: `{PUBLIC_URL}/auth/google/callback`.
6. Copy the client ID and secret into `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` on the host (never into the repo).
7. Check: open `{PUBLIC_URL}/api/auth/providers` and see `"google": true`, then press Continue with Google on the Account screen.

### Once a real domain exists

1. Point DNS at the host and set `PUBLIC_URL` to the new address.
2. In Google Cloud add the domain as an authorised domain on the consent screen, update the authorised JavaScript origin and redirect URI, fill in the homepage and privacy links, then choose **Publish app**. Non-sensitive scopes normally publish without review; wait for the status to change.
3. In the Apple Developer account update the Services ID domain and return URL, and upload the new domain association file.
4. Update `capacitor.config.ts` (`server.url` and the app-links entries), the association files and the store listings, and keep the old address redirecting for installed copies.

### Apple (web)

1. Apple Developer account (paid), **Certificates, Identifiers and Profiles**.
2. **Identifiers, App IDs:** create or choose the app's App ID (bundle ID `au.reroute.app` is the current placeholder in `capacitor.config.ts`) and enable **Sign in with Apple**.
3. **Identifiers, Services IDs:** create a Services ID (for example `au.reroute.web`), enable Sign in with Apple, press Configure, choose the primary App ID, and add:
   - Domains and Subdomains: the host of `PUBLIC_URL` (no scheme, for example `mediaserver.taildc527c.ts.net`).
   - Return URLs: `{PUBLIC_URL}/auth/apple/callback`.
4. Apple shows a domain-verification file. Put its exact content in `APPLE_DOMAIN_ASSOCIATION` (or `APPLE_DOMAIN_ASSOCIATION_FILE`). The server then serves it at `{PUBLIC_URL}/.well-known/apple-developer-domain-association.txt`; check it in a browser, then press Verify in Apple's dialog. Apple may refuse some shared or public-suffix domains; if verification fails, wait for the real domain.
5. **Keys:** create a key with **Sign in with Apple** enabled, linked to the primary App ID. Download the `.p8` once. Note the Key ID.
6. Set on the host: `APPLE_TEAM_ID` (Membership page), `APPLE_KEY_ID`, `APPLE_CLIENT_ID` (the Services ID), `APPLE_PRIVATE_KEY` or `APPLE_PRIVATE_KEY_FILE` (the `.p8`). Keep the `.p8` out of git.
7. Apple's email relay: if you want mail to reach people who hide their address, register the sending domain under **Sign in with Apple for Email Communication** (not needed for sign-in itself).

## Going native

1. **Done in code, untested on a device:** `web/src/native/auth.js` (lazy, `@capgo/capacitor-social-login`) makes a fresh random nonce, gives the SDK the nonce (Apple: its SHA-256) and returns `{idToken, nonce, authorizationCode}`. `web/src/accounts/store.js` calls it when `Capacitor.isNativePlatform()` and the server reports `native[provider]` in `/api/auth/providers`, POSTs `{id_token, nonce, authorization_code?}` to `/auth/native/google|apple`, keeps the returned bearer token in `localStorage` (`planb.nativeToken`; move it to Keychain/Keystore with a secure-storage plugin before release, as WebView storage can be cleared) and sends `Authorization: Bearer` on every call. The client IDs the SDK needs come from `native_config` in the same response (public values). Apple sign-in is not offered on Android (it needs the web flow); on the web the redirect flow is unchanged. `src/native/api.js` now rewrites `/auth/...` as well as `/api/...` to `VITE_API_BASE`. Set `PLANB_CORS_ORIGINS` on the server.
2. Create a Google **iOS** client ID (bundle ID `au.reroute.app`) and a Google **Android** client ID (package name and the SHA-1 of the signing key, from Play App Signing for release builds) in Google Cloud. Put them in `GOOGLE_IOS_CLIENT_ID` and `GOOGLE_ANDROID_CLIENT_ID`. The Google SDK's `serverClientId` must be the **web** client ID so the token's audience is on the allowed list.
3. Set `APPLE_BUNDLE_ID` to the app's bundle ID. The same token audience check applies.
4. Serve `apple-app-site-association` and `assetlinks.json` through `APPLE_APP_SITE_ASSOCIATION_JSON` and `ANDROID_ASSETLINKS_JSON` if universal links or app links are used.
5. The native app keeps the returned bearer token in the platform's secure storage (Keychain or Keystore), sends `Authorization: Bearer <token>`, and uses the same `/api/account/*` endpoints.
6. In-app deletion and the web page `{PUBLIC_URL}/account/delete` are both required by the stores.

## Testing

- `python -m unittest test_accounts` (30+ tests, about 7 seconds, no network): PKCE, state and nonce parameters, callback success, failure and replay, Apple `form_post` and first-login name, native token checks (bad audience, issuer, expiry, nonce, signature, replay), CSRF, delete and export, Apple revocation, rate limits, session expiry and rolling, disabled providers, open redirects, security headers.
- Manual: run Flask with `PLANB_DEV=1 ACCOUNTS_FAKE_PROVIDER=1` and press Test sign-in on the Account screen. Real Google and Apple sign-in could not be tried without credentials.

**Human review required:** a team member must read the security decisions against the code, run the provider set-up with real credentials, and have the legal text and store forms reviewed by someone qualified.
