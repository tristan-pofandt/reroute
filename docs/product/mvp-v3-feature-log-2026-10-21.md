# Plan B MVP v3 feature log

**Status:** Implemented on 2026-10-21 for team review. Built with Claude Code assistance (see the [AI-use log](../team/ai-use-log.md)). No participant has tested v3 and nothing has been deployed, so nothing below is user evidence.

This log records what the [Plan B MVP](../../apps/plan-b-mvp/README.md) v3 builds from two inputs: the [design system brief](../design/design-system.md) (a design prompt, a token list, a reference page and a Flask snippet) and the "Further features" section at the end of the [prototype ideas](../design/prototype_ideas.md). It extends the [v2 feature log](mvp-v2-feature-log-2026-10-21.md) and the [MVP scope of 2026-10-20](mvp-scope-2026-10-20.md); the interview evidence behind the original scope is traced there. Both inputs are the student's own design proposals, not participant findings, and this log does not add any interview evidence.

## Design system rules to features

Paths below are in `apps/plan-b-mvp/`. "Checked" means the developer check on 2026-10-21 described in [What was checked](#what-was-checked), not participant testing.

| Design-system rule (summarised) | What was built | Where | Boundary and what remains untested |
| --- | --- | --- | --- |
| Pressed and active states: scale to 0.98, shift alpha | Every button, row, chip, segmented control, stepper and icon button scales to 0.98 and shifts its fill when pressed | `app.css` | Not tried on real touch hardware |
| Focus states with high-contrast accessible rings | `:focus-visible` rings use the focus border token with a 3 px accent glow, with a larger glow on buttons and chips | `app.css` | Not tested with a screen reader or keyboard-only participants |
| Loading states: custom shimmer or skeleton, no spinning wheels | Skeleton shimmer for the weather widget, map, route results, background-alert setup, Refresh live data, demo push and re-planning; no spinners | `app.css`, `app.js` | Perceived speed is a design judgement |
| Empty, error and success states that transition smoothly | Feedback banners that fade and slide in and out; success and error variants, including after "Refresh live data" (auto-dismiss after 3 seconds) and the copy-link button | `app.css`, `app.js` | Wording of messages has not been reviewed by the team |
| Mobile tap targets at least 44 by 44 | Buttons, icon buttons, steppers, inputs and rows set a 44 px minimum | `app.css` | A full audit of every element was not done; some dense list text is smaller |
| Avoid generic AI clichés; editorial layout with asymmetry and breathing room | Left-aligned eyebrow plus heading hierarchy, a home banner with the Plan B logo, 16 and 24 px spacing steps, no centred feature blocks or purple gradients | `app.css`, `index.html`, `app.js` | Whether the look reads as "premium" is a team judgement. The accent is the brief's indigo (#6366F1), not purple-gradient styling |
| Layered surfaces: base, elevated, card, 1 px translucent borders, explicit shadows | Surface tokens (`--bg-base` #090A0F, `--bg-surface` #13151D, `--bg-card` #181B24) with the brief's border, text and accent tokens, plus extra tokens for semantic colours | `app.css` | Extra tokens (success, error, warning, route colours) are additions beyond the brief |
| Clean unified SVG iconography, no emojis as functional accents | One inline SVG icon set (Lucide-style) used for all UI icons | `app.js` (the `I` map) | The icons are hand-written, not imported from Lucide or Heroicons |
| Remove unused CSS and redundant or bloated JavaScript | `app.css` and `app.js` were rewritten for v3 and the v2 phone frame and fake status bar were removed | `app.css`, `app.js` | No automated unused-CSS or dead-code tool was run for this log; `app.js` is still one large file |
| Animate only hardware-accelerated properties (`transform`, `opacity`) | Page pushes, sheets, banners, the QR card, shimmer and vehicle marker moves use `transform` and `opacity` | `app.css`, `app.js` | The brief's `transition: all` token is used for hover and state changes, so other properties can animate there too; reduced motion is respected through the setting and the system preference |
| Lazy loading and code-splitting | Leaflet (script and stylesheet) loads the first time a map appears, and the QR image is lazy-loaded | `app.js` | There is no code-splitting of the app itself and no build step, by design. Inter is requested from Google Fonts at load |
| Dials: more airiness, less stark contrast, glide transitions | Generous padding and `-0.01em` and `-0.025em` letter spacing, soft off-tone colours instead of pure black or white (including a derived Light theme with #EEF0F5, #FCFCFE and #0F1222), and the `--transition-smooth` token | `app.css` | The Light theme colours are derived by the build, not supplied by the brief. Dark is now the default |
| Tokens for a mobile PWA, with Inter, 4 px spacing base and `max-width: 480px` | Tokens copied exactly where the brief gave a value; on phones the app fills the screen with safe-area insets and on desktop it is a centred column up to 480 px wide | `app.css`, `index.html` | Tested in a headless desktop browser at phone width, not on a real phone |
| Flask back end with an `/api/sync` endpoint | The server moved from the Python standard library to Flask (see [Decisions](#decisions-and-deviations)). `POST /api/sync` refreshes alerts, vehicles and weather, and the home screen "Refresh live data" button calls it | `server.py`, `requirements.txt`, `app.js` | The reference page's placeholder sync was replaced with real refreshes. The brief's `debug=True` on `0.0.0.0` was not used |

## Further features to features

| Further feature (summarised) | What was built | Data source | Boundary and what remains untested |
| --- | --- | --- | --- |
| Load Translink's static GTFS feed to find the correct disrupted bus or train line | `gtfs_static.py` downloads the SEQ GTFS zip in a background thread (about 37 MB, about 20 seconds to build), caches a 1.3 MB index (1,211 routes and 12,861 stops at the check), refreshes it when older than 7 days, and matches each Google transit step to route IDs, stop IDs and, where TripUpdates allow, the trip ID. Alerts and delays then match by route ID; the v2 keyword matcher remains the fallback. Route colours come from the feed | Translink SEQ static GTFS (`gtfsrt.api.translink.com.au/GTFS/SEQ_GTFS.zip`, no key) | Route IDs matched the realtime feeds exactly in a developer check of one trip; wider matching accuracy is untested. Searches never wait for the download, so a cold start briefly uses keyword matching |
| Installable PWA with background Web Push notifications that monitor disruptions | Manifest, icons and a service worker (offline app shell, network-first API reads, push handling). A "Watch this trip in the background" toggle subscribes the browser and sends the trip's route IDs to the server, where a thread checks every 60 seconds and sends one push per new disruptive alert or cancellation. Opening the notification re-plans the trip avoiding the disrupted lines. Watches expire 30 minutes after the deadline (3 hours with none) | Web Push (pywebpush) with VAPID keys from the environment or generated into `data/vapid.json`; Translink alerts and trip updates | Push was verified end to end only in headless Microsoft Edge (a real subscription and a delivered test push). Not verified: a real phone, iPhone and Safari (the app must be added to the Home Screen first), HTTPS hosting, tapping a notification. Monitoring stops when the server stops or a free host sleeps |
| Deploy so any investor or student can open it on the day via a QR code | `GET /qr.svg` returns a QR code of `PUBLIC_URL` or the address the request came to, and a Share sheet shows the code, the link, a copy button and the system share sheet. A Dockerfile, a Render blueprint and a Cloudflare quick-tunnel route are prepared in [`infra/plan-b-mvp/`](../../infra/plan-b-mvp/README.md), with per-visitor and daily limits | segno (QR); `limits.py`; deployment files | The deployment configuration is prepared, not deployed. The Dockerfile, Render blueprint and tunnel have not been built or run, and no public URL exists. A Terms of Use and Privacy Policy are still required before public use |
| Add GTFS-Realtime vehicle positions, and show in the steps whether the bus is delayed, ahead or on time, updating live | `VehiclePositions` is decoded with a 15-second cache. Each transit step shows "On time", "N min late", "N min early", "Cancelled" or "No live data", polled every 15 seconds on the next-steps and directions screens, and a vehicle marker on the map moves between updates | Translink SEQ GTFS-Realtime VehiclePositions and TripUpdates (no key) | About 800 to 1,000 vehicles were in the feed in the check, and bearing is usually absent, so markers do not rotate by bearing (rotation is unverified). "On time" and "early" are reported only for an exactly matched trip; otherwise "No live data" unless the route's median delay is a minute or more. The vehicle marker is shown before boarding but not while riding |
| Live directions within the app like Google Maps, instead of delegating | A navigation screen follows GPS with the next maneuver and distance for walking and driving, boarding and alight countdowns for transit legs, a step list, optional voice, a screen wake lock, skip step, re-centre, and "Re-plan from here" after about 10 seconds more than 60 m from a walking or driving step. Demo mode can play a journey back at 25 times speed | Google Routes step geometry and maneuvers (`nav.py`), browser geolocation, speech synthesis, Wake Lock | Directions are in-app, but the Google Maps link is kept as a secondary "Open in Google Maps". Real outdoor GPS directions, the wake lock and voice prompts are unverified. Very short Google walking steps can clutter the step list. It is not a replacement for a full navigation product |
| Weather widget on the start screen from Open-Meteo, with a warning if bad weather and walking is required | A widget shows current conditions and the next hours. Bad weather is a precipitation chance of 50% or more, 0.5 mm per hour or more, thunderstorm or heavy rain codes, apparent temperature of 35 degrees or more, or gusts of 50 km/h or more; options with 5 or more minutes of walking then show a warning | Open-Meteo forecast API (no key), cached 10 minutes per cell of about 1 km | Thresholds are team design assumptions. The widget uses Brisbane weather unless location access was already granted. Accuracy of the forecast is Open-Meteo's, not checked here |
| Include QLDTraffic open data so driving is more accurate | Events within 150 m of a driving route are attached. A closed road within 60 m flags and blocks the option; a crash, hazard or flood adds 5 minutes, roadworks or a special event add 2, and the total is capped at 20 and labelled as an estimate. Google's traffic-aware drive time already includes normal congestion | QLDTraffic open data events API with the public key from the Queensland Government open data portal (570 events at the check) | The delay numbers are design assumptions, not measured. A closure farther than 60 m away is shown without delay. The public key is shared and could be rate-limited; if the service fails the app says traffic is unavailable |
| Full demo mode for investors with a menu of weather, disrupted mode, traffic and anything else important | A demo menu with weather (Live, Clear, Rain, Storm, Heatwave), disrupted mode (None, Train, Bus, Ferry, Light rail, All public transport), traffic (Live, Heavy, Crash on route), running late (0, 5, 10 or 20 minutes), start point (current location or a preset Taringa Station trip), simulate journey and "Send test disruption push in 10 s". A Demo mode pill stays visible and every simulated value is labelled "Simulated" | `demo_mode.py`, `weather.py` and `traffic.py` simulations, `app.js` | Simulated disruptions are invented and do not use real alerts. If no option uses the chosen kind of service, nothing is marked disrupted and a note says so. Not tried by investors or on a phone |
| In demo mode only, show the Google API cost per search | Each demo search lists its Google requests and an approximate cost in US dollars (a first demo search cost about US$0.10 in the check). It is never shown outside demo mode | Constant list-price table in `google_api.py`, checked 2026-10-21 | Costs are list-price estimates before Google's free monthly usage, not a bill. Only successful, uncached requests are counted, and the prices need re-checking before reuse |

## Decisions and deviations

- **Stack:** The server is now Flask. The design-system brief specified Flask, production deployment uses gunicorn (`gunicorn -w 1 --threads 8 server:app`, one worker because the push monitor, the GTFS loader and the feed caches live in the process), and the front end stays plain HTML, CSS and JavaScript with no build step. The v2 statements "standard library only" and "no packages to install" are no longer true: Python 3.13 and `pip install -r requirements.txt` (Flask, pywebpush, cryptography, segno, gunicorn) are needed. The brief mentions Framer Motion, which needs a build step; v3 uses CSS animations instead.
- **Dark first:** The default theme changed to Dark to follow the brief's tokens. Light and Auto remain in Settings, using derived off-tone colours.
- **Phone frame removed:** v2's fake phone hardware and status bar were removed because v3 is an installable app.
- **Deployment prepared, not performed:** The Dockerfile, Render blueprint, Cloudflare tunnel steps and key advice are in `infra/plan-b-mvp/`. They were written and checked for syntax only. Nothing was built, applied or deployed, and no one has scanned the QR code on a phone.
- **QR code:** The QR is served by the app at `/qr.svg` rather than being a printed image in the repository, because the address is not known until deployment.
- **Directions:** Live directions are in-app, but the Google Maps hand-off stays as a secondary link.
- **Demo labels and cost:** Every simulated value says "Simulated", and the Google cost appears only in demo mode, as the brief asked. The cost uses list prices, not billing data.
- **Elevation:** The Google Elevation API worked on the team key during v3 testing (the v2 log and README said it was not enabled), so it is used and Open-Meteo is only the fallback.
- **Vehicle marker:** The marker is shown before boarding but not while riding.
- **Abuse protection:** A per-visitor hourly limit (`PLANB_PLAN_LIMIT_PER_HOUR`, default 40) and a daily cap (`PLANB_DAILY_GOOGLE_CAP`, default 1500) apply to Google-backed endpoints. These were not in the brief; they reduce but do not remove the cost risk of a public URL.
- **Scope shift:** The [MVP scope](mvp-scope-2026-10-20.md) excluded vehicle tracking, accounts and background push notifications. v3 adds vehicle positions and background push monitoring. Booking, payment and accounts are still excluded.

## What was checked

- 242 offline unit tests pass (`python -m unittest`, from `apps/plan-b-mvp/`). They make no network calls and cannot verify external data.
- Developer checks against the real services on 2026-10-21 on the team key: the static GTFS route IDs matched the realtime feeds exactly for the checked trip; VehiclePositions returned about 800 to 1,000 vehicles; the public QLDTraffic key returned 570 events; Open-Meteo worked without a key; the Google Elevation API worked; a first demo search cost about US$0.10 at list prices.
- Push was verified end to end only in headless Microsoft Edge, with a real subscription and a delivered test push.
- Not verified: a real phone, iPhone and Safari, HTTPS deployment, the Dockerfile, the Render blueprint and the Cloudflare tunnel, real outdoor GPS directions, the wake lock, voice prompts, tapping a notification and bus bearing rotation.
- This is developer checking. No participant has tested v3, and no learning card or hypothesis decision should rely on it.

## Known issues

- The app shell is cached first, so `VERSION` in `sw.js` must be bumped on every deploy or visitors see old files for one visit.
- Very short Google walking steps clutter the step list.
- The vehicle marker is shown before boarding but not while riding.
- The weather widget uses Brisbane weather unless location access was already granted.
- A Terms of Use and Privacy Policy are still required before public deployment.
- Rate limits and caps depend on correct proxy settings (`PLANB_TRUST_PROXY`) on a host; a free host sleeps and stops background push monitoring.

## Suggested next tests

These are tasks for the team to plan and record. They do not report results.

1. Agree owners and dates in the team's GitHub Project, then have a team member who did not build v3 review the code, this log and the README.
2. Try the app on a real Android phone and an iPhone: install it, turn on background alerts, send the demo test push, tap the notification and confirm it re-plans.
3. Deploy once to a private test address, scan the QR code on a phone, check the Origin handling and the limits, and check the Google key restrictions and quota before inviting anyone else.
4. Walk a real route outdoors with live directions to check GPS following, the off-route prompt, the wake lock and voice prompts.
5. Compare the app's live delay status and vehicle positions with Translink's own information during a real disruption, and record any wrongly matched line or trip.
6. Check the weather thresholds and the traffic delay numbers (5 minutes, 2 minutes, 20-minute cap) with the team, and decide whether they should be changed.
7. Write the Terms of Use and Privacy Policy that Google's Routes API policy requires before any public deployment.
8. Run the existing observed scenario tasks from the MVP scope, including Panic mode, with consenting participants, recording participant observations only in approved de-identified interview records with documented consent before any learning card is updated.

## Related

- [Design system brief and tokens](../design/design-system.md)
- [Prototype ideas, including the further features](../design/prototype_ideas.md)
- [v2 feature log](mvp-v2-feature-log-2026-10-21.md)
- [MVP scope and evidence trail, 2026-10-20](mvp-scope-2026-10-20.md)
- [Plan B MVP README](../../apps/plan-b-mvp/README.md)
- [Deployment notes](../../infra/plan-b-mvp/README.md)
