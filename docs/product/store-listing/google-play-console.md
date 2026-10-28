# Google Play Console listing draft: Reroute

Prepared by Claude Sonnet 5.5 via Claude Code at T.P's request. **Human review required.** Same caveats as `app-store-connect.md` (form fields, limits and policies are from model knowledge and not re-checked; `TODO` needs the team; "ASSUMES" marks features that were still being built). Shared text (descriptions, review notes, shot list, video storyboard, release checklist) lives in `app-store-connect.md`; this file lists the Play-specific fields.

## Main store listing

| Field | Draft |
|---|---|
| App name (30) | Reroute: Plan B Transit |
| Short description (80) | Beat transit disruptions: public transport first, driving cost and CO2 compared. |
| Full description (4000) | Use the App Store description, plus a first line: "Reroute is an independent student project, not an official Translink or Queensland Government service." |
| Category | Maps & Navigation (alternative: Travel & Local) |
| Tags | Navigation, Public transport (pick from the list offered) |
| Contact email | TODO (public) |
| Website | TODO |
| Privacy policy URL | TODO (public URL of `/privacy`) |
| Default language | English (Australia) |
| App icon 512x512, feature graphic 1024x500 | `icons/` has 512 and maskable; TODO create feature graphic from the logo and the home screenshot |
| Phone screenshots | 2 to 8, min 320 px, 16:9 to 9:16: `screenshots/360x800` and `390x844` (upscale at DPR 2 or 3 for sharpness); tablet 7" and 10" if tablets are supported: `screenshots/820x1180` |
| Promo video | TODO YouTube URL (optional), storyboard in the App Store file |

## App content declarations

- **Privacy policy**: URL above. **Ads**: No ads. **App access**: all functionality available without login; demo mode needs no credentials (instructions: logo > Demo mode). TODO add test credentials only if the reviewer must test sign-in (store in the Play Console, not the repo).
- **Target audience**: 18+ recommended (or 13+); not designed for children; no Families programme.
- **Content rating (IARC questionnaire)**: category "Utility, productivity, communication or other"; violence, sexual content, profanity, controlled substances, gambling: none; **user-generated content / users can interact or exchange content: yes** (ride board, with report, block and moderation); shares location with other users: no (a ride's start point is rounded to about 100 m and shown on the board; ASSUMES that is acceptable, answer "yes" if in doubt); digital purchases: no. Expect a Teen or 12+/PEGI 12 style result.
- **Government apps**: no. **Financial features**: none. **Health**: none. **News**: no.
- **Account deletion**: in-app (Settings > Account > Delete account, ASSUMES) and a public web URL for deletion requests: `{PUBLIC_URL}/account/delete` (public, no script, no sign-in; served by the app, required when accounts exist). TODO enter the real URL.

## Data safety form

Collected and shared data (confirm against the final build; all in transit is encrypted over HTTPS; users can request deletion):

| Data type | Collected | Shared with third parties | Optional | Purpose |
|---|---|---|---|---|
| Approximate location | Yes | Yes: sent to Google (routing/places) and weather providers to answer the request, as a service provider | No (needed for features that use it; the app works with typed addresses) | App functionality |
| Precise location | Yes | Same as above | Yes (permission, foreground only) | App functionality |
| Name | Yes (account sign-in; ride-board display name) | No | Yes | Account management, app functionality |
| Email address | Yes (account) | No | Yes | Account management |
| User IDs | Yes (account id) | No | Yes | Account management |
| Other user-generated content | Yes (ride-board posts, public; reports, blocks and a 90-day moderation log are kept privately) | Posts are visible to other users | Yes | App functionality, fraud prevention and security |
| App interactions | Only if opted in | Processed by PostHog as a service provider | Yes (off by default) | Analytics |
| Crash logs, diagnostics | Only if opted in | Processed by Sentry as a service provider | Yes | App functionality, analytics |
| Device or other IDs | Yes: the random ride-board device id (a header on ride and plan calls; only its HMAC is stored) always; the push token if alerts are on | No (push token goes to Google/Apple delivery services as a processor) | Push token: yes; device id: no (needed for ride-board limits, blocks and bans) | App functionality, fraud prevention and security |

Not collected: contacts, photos, files, calendar, financial info, health, messages, audio, web browsing history, search history (the text typed into place search is sent to Google to return suggestions but is not stored by Reroute; access logs strip query strings, so typed text and coordinates are not logged). No data sold. No data used for advertising or tracking. Data is encrypted in transit. Deletion request mechanism: yes. Every row of this table must match `docs/engineering/privacy-data-map.md`; change that file first.

## Permissions and technical

- Request only `ACCESS_FINE_LOCATION`/`ACCESS_COARSE_LOCATION` (foreground), `INTERNET`, `POST_NOTIFICATIONS` (runtime, only when the person turns alerts on), `VIBRATE`. Do **not** declare background location (triggers a separate review).
- Target API: the level Google currently requires (the audit assumed API 36 from Aug 2026; check). Play App Signing on; upload key kept offline. Deliver an `.aab`. 16 KB page-size compatibility for native libraries (check with Capacitor 8 output).
- If the listing is a Trusted Web Activity instead of the Capacitor shell: serve `/.well-known/assetlinks.json` from the production domain (not implemented in `server.py`).
- Pre-launch report: run it on the internal track and fix crashes and accessibility findings it flags.

## Testing track and launch path

1. Internal testing (immediate, up to 100 testers). 2. Closed testing with **at least 12 testers opted in for 14 continuous days** (personal accounts created after Nov 2023; check the current number; organisation accounts are exempt), then apply for production access (answer the questionnaire about testing). 3. Production with a staged rollout at 5 or 10% (`release-process.md`).

## Reviewer notes (Play "App access" and release notes)

Reuse the review notes in `app-store-connect.md`. Release notes template (500 chars per language): "Version X.Y.Z: new ..., fixed ... Contact: TODO support email."
