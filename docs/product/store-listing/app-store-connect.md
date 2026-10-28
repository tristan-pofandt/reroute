# App Store Connect listing draft: Reroute

Prepared by Claude Sonnet 5.5 via Claude Code at T.P's request. **Human review required.** Draft text and answers based on the app's code and docs on branch `feature/accounts` on 2026-10-28; field limits and questionnaires are from the model's knowledge and must be checked against the live App Store Connect form. `TODO` marks a value only the team can supply. **Prototype-state assumptions are flagged "ASSUMES"**: accounts, ride-board report/block tools and the native wrapper were being built concurrently and were not verified as shipped.

## Core

| Field | Draft |
|---|---|
| Name (30) | Reroute: Plan B Transit |  
| Subtitle (30) | Beat the disruption, go greener |
| Bundle ID | `au.reroute.app` (placeholder in `capacitor.config.ts`; TODO confirm, cannot change later) |
| Primary category | Navigation |
| Secondary category | Travel |
| Promotional text (170, editable any time) | Planning around a cancelled train or a late bus? Reroute shows public transport first, the real cost of driving, and the CO2 you avoid. Brisbane and South East Queensland. |
| Keywords (100, comma separated, no spaces) | transit,brisbane,translink,bus,train,ferry,commute,co2,carbon,disruption,journey,planner,offline |
| Support URL | TODO (a real page with a monitored contact; required) |
| Marketing URL | TODO (optional) |
| Privacy Policy URL | TODO (public URL of `/privacy`; required) |
| Copyright | TODO year and legal name |

**Description (4000).**

> Reroute helps you get where you are going when public transport does not behave. It is built for everyday trips in Brisbane and South East Queensland.
>
> - Plan a trip with public transport first, compared against driving, walking, bike and e-scooter options, with arrival time against your deadline.
> - See the true cost of driving (fuel, an optional parking estimate) and the CO2 you avoid by choosing another way.
> - "Journey disrupted?" gives the best way there right now when a service is cancelled or delayed.
> - Live vehicles and service alerts from Translink open data, weather and road conditions on one screen.
> - Download an area for offline use so the map and timetables still work with no signal.
> - Optional alerts about disruptions to trips you are watching.
> - A ride board to share a car or split a ride with other commuters (posts are public; you can report or block users).
> - Your settings and trips stay on your device unless you create an account. Anonymous usage data is optional and off by default.
>
> Reroute is an independent student project. It is not an official Translink or Queensland Government service. Timetable and live data come from Translink open data (CC BY 4.0); maps and routing use Google Maps Platform and OpenStreetMap contributors. Times, costs and CO2 figures are estimates, not guarantees; always check signs and announcements.

(ASSUMES the ride-board report/block tools and accounts ship in this build; delete those bullets otherwise.)

**What's New template (4000).**

> Version X.Y.Z
> - New: ...
> - Improved: ...
> - Fixed: ...
> Questions or problems: TODO support email.

## Age rating questionnaire (answer honestly; check the current form)

Cartoon/fantasy violence none; realistic violence none; sexual content none; profanity none; horror none; medical none; alcohol/tobacco/drugs none; gambling none; contests none. **Unrestricted web access: no** (no general browser; links open the system browser). **User-generated content: yes** (ride board notes of up to 140 characters, public, with report and block, filtering and moderation). Decision: do not choose 4+ (the ride board is user-generated content and the app asks for a nickname and meeting place); expect 12+ on the old scale or 13+ on the current one, and set it no lower than the form returns. The Privacy Policy says the app is not directed at under-13s. See `docs/engineering/privacy-data-map.md`. Account sign-in is optional.

## App Privacy ("nutrition label") answers

Data types and how they flow (confirm against the final build):

| Data type | Collected | Linked to user | Used for tracking | Purpose |
|---|---|---|---|---|
| Precise location (when using the app) | Yes, sent to the server to plan trips and nearby data; the ride board keeps only a point rounded to about 100 m | Not linked (no account needed); ASSUMES not joined to the account | No | App functionality |
| Coarse location | Yes (same flows) | No | No | App functionality |
| Name | Yes, only with account sign-in (and a ride-board display name if used) | Yes | No | App functionality, account |
| Email address | Yes, only with account sign-in | Yes | No | App functionality, account |
| User ID | Yes, with account | Yes | No | App functionality |
| Other user content (ride-board posts, reports) | Yes | Yes (tied to the account when signed in, otherwise to the device id) | No | App functionality |
| Product interaction (usage events) | Only if the person opts in | No (random per-install code) | No | Analytics |
| Crash data / performance data | Only if the person opts in | No | No | App functionality, analytics |
| Device ID (push token; random ride-board device id) | Push token only if alerts are enabled; the device id always (its HMAC is stored with posts, reports and blocks) | Yes (it scopes blocks and bans to a device) | No | App functionality |
| Search history, contacts, photos, health, financial info, browsing history | No | | | |

Tracking: **No** (no ads, no data broker, no cross-app tracking, so no App Tracking Transparency prompt). Third parties that receive data: Google (Maps Platform), Translink/QLDTraffic (no personal data sent), Open-Meteo and RainViewer (coordinates for weather), PostHog and Sentry (opt-in only). Also supply `PrivacyInfo.xcprivacy` (declares the same plus required-reason APIs). This table must match `docs/engineering/privacy-data-map.md`; change that file first.

## Export compliance

Uses encryption only through standard HTTPS/TLS provided by the OS: answer "Yes, uses encryption" then "exempt (standard encryption only)"; set `ITSAppUsesNonExemptEncryption = NO`. No proprietary or non-standard cryptography. (France distribution may need a separate declaration; check.)

## App Review information

- **Contact**: TODO name, phone, email.
- **Sign-in**: the app works without an account. **Demo mode** needs no login: tap the Reroute logo on the home screen, choose "Demo mode", turn it on (a purple "Demo mode" pill appears). Choose the preset trip "Taringa Station to UQ St Lucia" and tap Show routes to see results from anywhere in the world. If account sign-in is reviewed: TODO demo account credentials (do not put real ones in the repo) or use the Sign in with Apple path.
- **Notes for the reviewer** (paste):

> Reroute plans public-transport trips in South East Queensland, Australia, and compares them with driving and the CO2 avoided. Live data covers Brisbane only, so a reviewer outside Queensland should use Demo mode (logo > Demo mode), which simulates disruptions, weather and traffic and labels every simulated value "Simulated". Location is requested only when you tap "Current location" or "Use my location" and only while the app is open; it is used to find nearby services and is not stored with your identity. Notifications are opt-in from the alerts screen. The ride board is the only user-generated content: posts are at most 140 characters, are filtered, can be reported or blocked from each post (Report / Block), and are reviewed within 24 hours (TODO monitored contact: support email). Account deletion: Settings > Account > Delete account removes the account and its data immediately (ASSUMES; verify in the build). Native features beyond a website: offline map and timetable areas stored on device, local and push notifications, haptics, share sheet, native sign-in (ASSUMES). The app is independent and states it is not an official Translink service. Third-party data is credited in About.

## Screenshot shot list

Required sizes (check current): iPhone 6.9" (1320x2868 or 1290x2796), 6.5" (1284x2778 or 1242x2688) and iPad 13" (2064x2752) if iPad is supported. Capture the demo-mode screens below at the device viewport with device scale factor 3 (the reference captures at 390x844, 430x932, 360x800 and 820x1180 in `screenshots/` come from `web/scripts/a11y-audit.mjs --size WxH`; re-run with scale 3 for store pixels). Demo data only: Taringa Station and UQ St Lucia are public places; nothing personal.

| # | Screen | Caption (max about 7 words) |
|---|---|---|
| 1 | Home (`home.png`) | Go greener when plans break |
| 2 | Journey (`journey.png`) | Plan a trip in seconds |
| 3 | Results (`results.png`) | Public transport first, driving compared |
| 4 | Option sheet (`results-sheet.png`) | See time, cost and CO2 |
| 5 | Panic (`panic.png`) | Disrupted? Find the best way now |
| 6 | Offline area (`offline-area.png`) | Download an area for no-signal trips |
| 7 | Weather (`weather.png`) | Weather and conditions at a glance |
| 8 | Dashboard (`dashboard.png`) | Track the CO2 you avoid |

## App preview video storyboard (15 to 30 s, 886x1920 or per device)

1. 0-3 s: home screen, tagline "Go greener when plans break" (cut to the Plan a trip button). 2. 3-8 s: type a destination, tap Show routes, results appear. 3. 8-13 s: open the first option, scroll time, cost, CO2. 4. 13-19 s: "Journey disrupted?" opens, best way now. 5. 19-24 s: offline area download progress then the map with no signal. 6. 24-28 s: dashboard CO2 total. End card: Reroute logo and "Brisbane and South East Queensland". Use demo mode, no real accounts, no music with unclear licence; no on-screen personal data.

## Release checklist

- [ ] Legal entity and developer account decided; contact details public as required (EU trader status).
- [ ] Bundle ID final; name checked for conflicts (trademark search: IP Australia, USPTO, EUIPO, App Store).
- [ ] Support, privacy and (if used) marketing URLs live; privacy text matches `analytics-implementation.md` and the labels above.
- [ ] Ride-board report, block, filter, moderation contact and EULA/terms in the build (guideline 1.2); account deletion in-app (5.1.1(v)); Sign in with Apple offered if Google sign-in is.
- [ ] Open-Meteo and RainViewer licences cover a public/commercial app (or switched); Google Maps key restrictions per platform; billing budget alert set.
- [ ] `make check` green; `npm audit --omit=dev` and `pip-audit` clean of high issues; accessibility manual checks done.
- [ ] Version and build number bumped; `sw.js` cache bumped; `GIT_SHA` set; production env vars set; no secrets in the repo.
- [ ] Screenshots, preview, description, keywords, age rating, privacy labels, export answer, review notes entered; demo credentials TODO resolved.
- [ ] TestFlight run on a real iPhone (location, push, offline, sign-in, deletion, VoiceOver).
- [ ] Phased release on; monitoring ready (`release-process.md`).
