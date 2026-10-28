# Privacy data map

Prepared by Claude Sonnet 5.5 via Claude Code at T.P's request, 2026-10-28. **Human review required:** this is an engineer's inventory, not legal advice. It is the source of truth the store privacy forms must match: the Apple App Privacy answers in `docs/product/store-listing/app-store-connect.md` and the Google Play Data safety answers in `google-play-console.md` are derived from the table below. The user-facing text is `web/src/screens/legal/privacy.body.jsx` (and the identical text in `app.js`). Change this file first when a feature collects something new, then the policy, then the forms.

Key: **Linked** = tied to an account or a durable identifier of a person or device. **Device** = only on the person's phone or browser. Retention figures are the code's behaviour unless marked TODO.

## Data items

| Data item | Where stored | Why | Retention | Who can access | Deletion path |
|---|---|---|---|---|---|
| Settings, saved places (with Google place IDs), recent places, last trip places, trip and CO2 history, demo prefs, `blockedPosters` | Device: browser `localStorage` (keys `planb.*`) | App works the way the person set it up | Until cleared | The person (and anyone with the device) | Clear browser storage / uninstall |
| Ride-board membership tokens, disruption-watch details (`rideTokens`, `watches`, `bgwatch`) | Device `localStorage` | Let the person manage their own posts and alerts | Until cleared | The person | Clear storage; leave ride / unsubscribe |
| Device id (`deviceId`, random 16-64 chars) | Device `localStorage`; sent as header `X-Reroute-Device` on `/api/rides*` and `/api/plan*`; only its HMAC (12 hex) is kept server-side | Pseudonymous poster id for rate limits, blocks, bans | Device: until cleared. Server: only as the HMAC inside ride/report/block/ban/log rows | Operator (HMAC only) | Clearing storage gives a new id; posts expire; account deletion removes account-based blocks |
| Offline area (map, places, timetables) | Device IndexedDB | Offline routing | Until deleted | The person | Settings > Offline info > Delete |
| Service worker caches (app files, recent read-only answers) | Device Cache Storage | Open offline | Until cache bump / cleared | The person | Clear site data |
| Location (precise, foreground only) | Not stored. Sent per request to the Reroute server, then to Google / Open-Meteo | Start point, weather, live directions | Server: in memory for a few minutes at most (answer cache) | Operator (transiently) | Nothing to delete |
| Route-search inputs (origin, destination, place IDs, time, modes, limits) | Request body only; Google answers cached in memory | Plan a trip | Minutes; not logged | Operator (transiently) | n/a |
| Access log (method, path **without query string**, status, bytes, time) | Server stdout / host logs | Operations, abuse | Host-defined [TODO: confirm, aim 30 days]. `PLANB_QUIET=1` switches it off | Operator, hosting provider | Host log rotation |
| IP address | In memory for hourly rate limits; hosting provider / proxy logs | Abuse limits | In memory: gone on restart. Host logs: [TODO] | Operator, hosting provider | Restart / host rotation |
| Daily Google request counters | Server memory (`usage.py`) | Cost control; no person information | Until restart | Operator (`/admin/usage`) | n/a |
| Ride post (nickname, broad start/destination labels, coordinates rounded to ~100 m, departure time, meeting point, note, seats, cost, membership tokens, poster id) | `data/rides.sqlite3` `rides` | Shared rides | Deleted 30 min after departure (max 500 live posts) | Other users (public fields only), operator | Leave/expire; operator removal |
| Joiner nickname | `rides.sqlite3` (inside the ride) | Show who joined | With the post | Other users on the post, operator | Leave; expiry |
| Report (reporter poster id, reason, note up to 300 chars) | `rides.sqlite3` `reports` | Moderation (App Store 1.2, Play UGC) | Deleted with the post | Operator only | Post expiry |
| Block (blocker poster id, blocked poster id, nickname) | `rides.sqlite3` `blocks` | Let a person hide someone | Until unblocked (account blocks go with account deletion) | Operator | Unblock; delete account |
| Ban (poster id, reason) | `rides.sqlite3` `bans` | Stop repeat abuse | Until a moderator lifts it | Operator | Appeal to the abuse contact |
| Moderation log (action, poster id, removed post's nickname, meeting point, note) | `rides.sqlite3` `log` | Appeals, accountability | 90 days (`LOG_DAYS`) | Operator | Automatic purge |
| Poster-id salt | `rides.sqlite3` `meta` | Makes poster ids unguessable | Life of the database | Operator | Database deletion |
| Account: user id, display name, email, email-verified flag, created time | `data/accounts.db` `users` | Sign-in, sync | Until the person deletes the account | Operator | Account > Delete my account (immediate, hard delete) |
| Account: provider (Google/Apple) and provider subject id, last login | `accounts.db` `identities` | Recognise returning person | As above | Operator | As above |
| Sessions (SHA-256 of token, kind, expiry) | `accounts.db` `sessions` | Stay signed in | 30 days rolling; revoked on sign-out/delete | Operator | Sign out; delete account |
| Synced data (`settings`, `places`, `trips`) | `accounts.db` `user_data` (not end-to-end encrypted) | Sync between devices | Until deleted | Operator | Delete account; Download my data first (JSON) |
| Pending sign-in state (hashes of state, nonce, verifier) | `accounts.db` `pending_auth` | Secure OAuth | 10 minutes, deleted on use | Operator | Automatic |
| Apple refresh token (encrypted) | `accounts.db` `apple_tokens` | Revoke Apple access on deletion | Until account deletion | Operator (encrypted) | Delete account (revoked first) |
| Session / pre-auth cookies | Browser cookies (`__Host-` session, HttpOnly; short `planb_pre` for Apple only) | Sign-in | Session 30 days rolling; `planb_pre` minutes | The person's browser | Sign out |
| Web push subscription (endpoint, keys) + watched trip (start/destination text, place id, deadline, lines, label) | `data/push.json` | Disruption alerts the person asked for | Watch expires 30 min after the deadline, at most 24 h | Operator | Turn alerts off; automatic expiry |
| Native push token (FCM or APNs) + platform (+ optional watch) | Server push store (native register endpoint) | Disruption alerts in the store apps | Until alerts are turned off / unregistered [confirm when the endpoint ships] | Operator | Turn alerts off in Settings |
| Analytics consent flag, random analytics id (`planb.analyticsId`) | Device `localStorage` | Consent record; per-install random code | Until withdrawal (deleted on "off") | The person | Settings > Share anonymous usage data > off |
| Usage events (allow-listed names/properties, no places/location/text) | PostHog (region TODO) | Understand which features are used | 90 days [TODO confirm in PostHog] | Team via PostHog | Withdraw consent (stops new events); vendor retention deletes old |
| Crash reports (error, stack, release; no user/request data) | Sentry (region TODO) | Fix bugs | 30 days [TODO confirm in Sentry] | Team via Sentry | Withdraw consent; vendor retention |
| Sign-in token exchange (Google/Apple ID token) | Verified in memory; only the claims above are kept; token replay set in memory | Native sign-in | Minutes | n/a | n/a |

Not collected: contacts, photos, files, calendar, financial or health information, microphone or camera, advertising ID, background location, browsing history outside the app, payment information.

## Third parties that receive data

| Recipient | What they receive | When | Role |
|---|---|---|---|
| Google Maps Platform (server) | Route endpoints, time, mode; typed address fragments + session token + location bias; place ids; coordinates for fuel / parking / elevation | Each search | Service provider |
| Google Maps JavaScript, Fonts, gstatic | IP, browser details, map area viewed | Map and font load | Independent (browser contacts them) |
| Google / Apple sign-in | The fact that the person signed in to Reroute | Only if the person signs in | Sign-in provider |
| Open-Meteo | Rounded location | Weather | Service provider |
| RainViewer | IP, map area | Weather page | Independent |
| OpenStreetMap Overpass | Area corners | Offline download | Service provider |
| Translink, QLDTraffic | Nothing about the person | Server feed downloads | Data sources |
| Browser push services, FCM, APNs | Endpoint/token and notification text | Alerts on | Delivery |
| PostHog, Sentry | Allow-listed events / crash data | Only after opt-in | Service providers |
| Hosting provider | All server data at rest and in logs | Always | Processor [TODO: provider and region] |

No data is sold, used for advertising, or used to track people across apps or websites. There is no App Tracking Transparency prompt and no advertising identifier.

## Form answers derived from this map

**Apple App Privacy.** Collected, linked to the user, not used for tracking: Name, Email address, User ID (account), Device ID (push token; the ride-board device id is also a device identifier, see note), Other user content (ride posts), Precise location (sent to our server per request but not stored; the ride board keeps only a ~100 m rounded point, answer "collected" and "not linked" for the request flow). Opt-in only: Product interaction, Crash data, Performance data (not linked; random code). Purposes: App Functionality (all), Analytics (usage and crashes only). Tracking: No.

**Google Play Data safety.** Data collected and shared as in `google-play-console.md`. Device or other IDs: yes (push token **and** the random device id that scopes ride-board limits and blocks). Data encrypted in transit: yes. Deletion: in-app (Account > Delete my account) and `{PUBLIC_URL}/account/delete`.

**Age rating decision.** Reroute is not directed at under-13s (Privacy Policy). Because of the user-generated ride board, do **not** pick 4+: answer the Apple questionnaire honestly (user-generated content: yes, with report/block/filtering) and expect 12+ (older scale) or 13+ (current scale); on Google Play (IARC) expect Teen / PEGI 12. The Play target audience is 18+ (13+ at the lowest), no Families programme. If the ride board is later removed from the store build, 4+ becomes possible; revisit then.

## When something changes

1. Update this table. 2. Update `privacy.body.jsx` (and `terms.body.jsx`) and run `python web/scripts/sync_legacy_legal.py` from `apps/plan-b-mvp` so `app.js` matches (`test_legal_sync.py` fails otherwise). 3. Update both store listing drafts and `PrivacyInfo.xcprivacy`. 4. Bump the policy version and date.
