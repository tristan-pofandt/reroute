# Reroute analytics and metrics plan (20-30 users)

**Date:** 2026-10-28
**Prepared by:** Claude Sonnet 5.5 via Claude Code at T.P's request.
**Human review required:** yes. Tool prices, free tiers and legal points must be checked against the vendors' current pages and, for privacy, against advice the team trusts, before anything is installed.
**Status:** Plan only. No analytics code exists or was added. All thresholds, prices and example numbers are assumptions unless a source is named. Reroute has not been participant-tested in the field.

Related: [user testing plan](user-testing-plan-2026-10-28.md), [monetisation brainstorm](monetisation-brainstorm-2026-10-28.md), [Reroute README](../../apps/plan-b-mvp/README.md), [hypothesis register](../discovery/assumptions/hypothesis.md).

## 1. Principles for 20-30 users

1. At this scale, dashboards add little; the goal is a clean event log the team can query and read, plus qualitative tools. Do not buy anything.
2. Collect the least data that answers a named question. Every event maps to a metric or hypothesis (section 5).
3. No personal information in events: no names, emails, addresses, place names, raw coordinates, free text.
4. Consent before collection, retention limit, deletion on request.
5. Keep cost near zero. The only variable cost that matters is Google Maps Platform (section 9).

## 2. Tool comparison

Prices and free tiers change; every price below is "check current pricing" unless a source is named. The one lookup done for this plan: [PostHog's pricing page](https://posthog.com/pricing) and third-party summaries reported a monthly free tier of 1 million analytics events and 5,000 session recordings for PostHog Cloud (check current pricing). For Google Maps Platform, free usage is now per SKU rather than pooled, with caps reported as 10,000 free for Essentials SKUs, 5,000 for Pro and 1,000 for Enterprise, and Places Autocomplete requests at about $2.83 per 1,000 above the free cap ([Woosmap summary of Google's price list](https://www.woosmap.com/blog/is-google-maps-api-free); check [Google's own page](https://developers.google.com/maps/billing-and-pricing/pricing)). The Routes API (New) per-SKU rates were not confirmed in this lookup.

| Tool | Type | Fit for 20-30 users | Privacy and data residency | Cost at this scale | Verdict |
| --- | --- | --- | --- | --- | --- |
| PostHog Cloud (EU or US) | Product analytics, funnels, retention, feature flags, optional replay | Excellent: retention and funnel views built in, SQL access | EU cloud available; you control which properties you send; can disable autocapture and replay | Free tier far above need (check current pricing) | Recommended default |
| PostHog self-hosted on the homelab | Same, self-run | Possible, but the official self-host path wants a multi-service stack (ClickHouse, Kafka, Postgres) that is heavy for a 4 GB LXC that already ran out of memory once | Data stays on the homelab | Free software, real RAM and admin cost; single point of failure | Not now. Revisit only if data must not leave Australia |
| Plausible / Umami (self-hostable) | Privacy-friendly page-view analytics | Good for visits and sources; weak for event funnels, retention and per-user cohorts | Cookie-less by design, little consent friction | Plausible cloud is paid (check current pricing); Umami is free to self-host (light, one container plus Postgres) | Good fallback if the team refuses per-user tracking; cannot give D7/D30 by user |
| Mixpanel | Product analytics | Strong funnels and retention; generous free tier (check current pricing) | US-hosted by default; EU/India residency options (check) | Free at this scale | Fine, but offers nothing PostHog does not; vendor lock-in |
| Amplitude | Product analytics | Similar to Mixpanel | Similar | Free starter plan (check current pricing) | Same as above |
| Firebase Analytics / GA4 | Web/app analytics | Free and familiar; GA4 sampling and consent mode add complexity; poor for custom retention on tiny data | Google-hosted, adtech-linked, heavier consent burden; ties to the same Google ecosystem the app already uses | Free | Avoid: worst privacy story for a CO2/trust brand, and awkward on tiny n |
| Microsoft Clarity / Hotjar | Session replay and heatmaps | Clarity is free; useful to see taps in round 1 | Replay records the screen; may capture typed addresses unless masked; consent needed | Clarity free; Hotjar free tier limited (check) | Optional for round 1 only, with all inputs masked. Prefer watching participants in person |
| Sentry | Error and performance monitoring (front end and Flask) | Needed: crash-free sessions and Python exceptions | Can scrub data; EU region available (check) | Free developer tier (check current pricing) | Recommended |
| Survey tool: Tally / Typeform / Google Forms | Surveys, SUS, NPS, diary | Tally is free and unbranded forms (check); Google Forms is free but Google data; Typeform limits on free plan (check) | Tally has EU hosting claims (check); Forms stores in Google | Free | Tally recommended; Google Forms acceptable; keep forms keyed by participant code only |
| Maze / UserTesting | Remote unmoderated usability | Paid, aimed at larger panels and prototypes in design tools | Participants are recruited from panels, not Brisbane commuters | Paid (check current pricing) | Not needed. Moderated sessions with real commuters are cheaper and better here |
| In-app NPS / SUS | Built-in prompt | Easy: one question after N trips | None beyond the answer | Free (small code) | Use a link to the survey tool, not a custom form, until needed |
| Own server log (Flask) | Server-side events, API cost | Needed regardless: API calls happen server-side | Stays on the homelab | Free | Recommended for cost metrics |

### Recommendation

- **PostHog Cloud (EU region if offered on the free plan) for product events**, with autocapture, session replay and heatmaps turned off, a manual `track()` wrapper and an explicit property allow-list. Rationale: retention, funnels and cohort tables come built in; free tier is vastly larger than 30 users need; no self-hosting load on the homelab. Mark data-residency (Sydney region is not assumed to exist; check) as an open question for the privacy notice.
- **A server-side event table in the app's own data volume** (SQLite or JSON lines) for Google API calls and errors, because the front end does not see them and because they are the unit-economics input. This is independent of the analytics vendor and survives consent refusal (no user data, only counts; see section 4).
- **Sentry** (free tier) for front-end and Flask exceptions, with request bodies and user input scrubbed.
- **Tally or Google Forms** for baseline, SUS, NPS, diary and willingness-to-pay surveys, keyed by participant code.
- **Skip** Mixpanel, Amplitude, GA4, Hotjar, Maze and UserTesting for now. Clarity only for masked round-1 replay if wanted.
- **Estimated cost for the pilot:** about $0 for software if the free tiers hold (check current pricing), plus the Google Maps Platform bill and incentives (see user testing plan).

If the team cannot accept any third-party analytics, fall back to server-side events only (the same schema, posted to the Flask app and stored locally) and query it with SQL. That is a smaller dependency, and at 30 users it is perfectly adequate.

## 3. Privacy-by-design instrumentation

- **Identifiers.** Use `user_hash = HMAC-SHA256(secret, account_id)` truncated to 16 hex characters, with the secret held only on the server (never in the repo). The accounts system (Google/Apple sign-in) is being added on this branch; never send the email, name, provider subject id or the raw account id. Before sign-in or without consent, send nothing, or only a random per-install id that is not linked to an account. Stop using the random id once consent is withdrawn.
- **Participant codes.** Never send an `F01`-style code as an event property. Keep the mapping from code to `user_hash` privately and destroy it at the end of analysis.
- **No PII in properties.** Do not send addresses, place names, free-text search, coordinates, ride-board text, push endpoints or tokens. Use buckets: distance band (0-2, 2-5, 5-10, 10-20, 20+ km), time-of-day band, origin/destination SA2 or suburb-level only if needed (decide after review; default to omit), mode, option rank.
- **Consent.** First run shows a short plain-language banner with two choices: "Allow anonymous usage analytics" and "No thanks". Store the choice locally (the project already uses `planb.*` keys) and, when signed in, on the account. No consent means no PostHog and no Sentry user context. Server-side counters that contain no user identifier (daily Google call totals) may be kept as operational data, but state them in the privacy page.
- **Retention.** PostHog data deleted 90 days after the pilot ends, or sooner on request (assumption; check the tool's controls). Server event table kept 90 days. Sentry 30 days default (check).
- **Deletion and withdrawal.** A participant can ask the team to delete events for their `user_hash`; the team must be able to do it (PostHog person deletion; delete SQL rows).
- **Australian Privacy Act 1988.** The Act and the Australian Privacy Principles apply to organisations above the small-business turnover threshold (a student project may be out of scope today, but investors and later commercial operation will not be). Design as if it applies: notice at collection (APP 5), use only for the stated purpose (APP 6), security (APP 11), cross-border disclosure when data goes to US or EU clouds (APP 8), and access and correction. Reforms to the Act are in progress; check current requirements and take legal advice before commercial launch. This document is not legal advice.
- **Location.** Treat location as sensitive in practice even if not a legally "sensitive" category. Never log raw coordinates in analytics. Server logs may hold request IPs; truncate or rotate them.
- **Sub-processors.** List PostHog, Sentry, the survey tool, Google, Apple, the homelab and Tailscale in the Privacy page. The README's data-sources table is the starting point.
- **Do not commit** keys, project API tokens or exports to Git. The PostHog project key is public by design but keep it in environment config anyway.

## 4. Event schema

Naming: `snake_case` verbs in the past tense. Every event carries these base properties: `app_version`, `platform` (ios/android/desktop), `display_mode` (browser/standalone), `user_hash`, `session_id` (random per visit), `ts` (set by the server or SDK), `consented` implicit (events exist only if consented). Properties below are in addition. "Server" means fired from Flask so that it works without the front end.

| Event | Properties (no PII) | When fired | Why | Metric |
| --- | --- | --- | --- | --- |
| `app_opened` | `source` (qr, link, home_screen, push), `first_open` (bool) | App load after consent | Count sessions and install source | WAU/MAU, sessions per user, acquisition channel |
| `consent_set` | `analytics` (bool) | Consent choice | Audit trail (stored locally and server-side without analytics id if declined) | Consent rate |
| `account_created` | `provider` (google/apple) | After successful sign-in for a new account | Funnel step | Activation funnel, sign-up conversion |
| `sign_in_completed` | `provider` | Returning sign-in | Retention without cookies | Returning users |
| `pwa_installed` | `platform` | `appinstalled` event or standalone detection | Install rate | Install conversion |
| `trip_planned` | `origin_kind` (home/work/saved/gps/typed/map), `dest_kind`, `distance_band`, `depart_when` (now/later), `deadline_set` (bool), `modes_enabled` (list), `results_count`, `latency_ms`, `google_calls` (int) | Results displayed | Core value action | Trips planned per user per week; activation; API cost per active user |
| `option_viewed` | `rank`, `mode`, `disrupted` (bool), `sort` | Detail sheet opened | Which options draw attention | Option funnel |
| `option_selected` | `rank`, `mode`, `sort`, `is_lowest_co2` (bool), `is_cheapest` (bool), `is_fastest` (bool), `co2_saved_g_band`, `cost_band` | User taps start/next steps | Choice behaviour (H-P01, H-P05, H-P18) | Share of selections that are PT or lowest-CO2; CO2 influence |
| `sort_changed` | `sort` | Sort chip tapped | Whether CO2/cost sorts are used | Feature use |
| `trip_logged` | `mode`, `distance_band`, `co2_saved_g_band`, `baseline_was_driving` (bool), `planned_not_travelled_confirmed` (bool) | "I'm taking this trip" | Activation event and impact input (these are planned trips, not verified) | Activation; CO2 per user; PT share |
| `impact_dashboard_opened` | `trips_in_month` (band) | Dashboard shown | H-P18 engagement | Feature adoption |
| `co2_goal_set` | `goal_kg_band` | Goal changed in Settings | Commitment signal | Engagement depth |
| `panic_opened` | `entry` (button, push, watch_alert), `minutes_to_deadline_band` | "Journey disrupted?" opened | H-P14 usage | Disruption-feature use |
| `panic_option_chosen` | `mode`, `seconds_from_open` | Option accepted | Time to act | Time to decision |
| `disruption_alert_shown` | `kind` (cancel, delay, alert), `matched_trip` (bool) | In-app alert for a watched trip | H-P03 reach | Alert reach |
| `watch_started` | `trip_kind` | Watch a trip | Habit signal | Feature use |
| `push_enabled` | `platform`, `granted` (bool) | Permission result | H-P03 opt-in | Push opt-in rate |
| `push_opened` | `kind` | App opened from a push | Value of alerts | Alert open rate |
| `offline_area_downloaded` | `area_km2_band`, `size_mb_band`, `duration_s_band`, `success` (bool) | Download finished | Offline feature use and cost | Offline adoption, bandwidth cost |
| `offline_trip_planned` | `used_offline` (bool) | Plan while offline | Does offline help | Offline value |
| `ride_viewed` | `count_bucket` | Ride board opened | H-P17 interest | Ride board reach |
| `ride_offered` | `seats`, `kind` (seat, split_uber) | Post created | Supply | Ride-board supply |
| `ride_joined` | `kind` | Join/contact | Demand and match | Matches; viral coefficient |
| `invite_shared` | `channel` (qr, link, share_sheet) | Share tapped | Referral | Referral/K-factor |
| `referral_signup` | `channel` | New account with a referral parameter | Viral loop | K-factor, cost per acquired user |
| `external_handoff` | `target` (uber, lime, neuron, google_maps) | Button tapped | Partnership and affiliate potential | Affiliate click-through (monetisation test) |
| `driving_cost_viewed` | `visible` (bool) | Driving comparison shown | H-P15 | Feature reach |
| `settings_changed` | `key` (allow-listed names only) | Setting changed | What users customise | Product fit |
| `survey_prompt_shown` / `survey_completed` | `kind` (sus, nps, wtp, diary) | Prompt/completion | Survey response rate | Response rate |
| `error_shown` | `code`, `screen` | User sees an error | Reliability | Error-free sessions |
| `api_call` (server) | `service` (routes, places_autocomplete, places_details, fuel, elevation), `status`, `latency_ms`, `cached` (bool), `user_hash` or none | Each Google-backed call | Unit economics | API cost per active user |
| `rate_limited` (server) | `bucket` (plan, autocomplete, fuel, place, offline, daily_cap) | Limiter rejects | Cap pressure during pilot | Capacity planning |

Rules: never add free-text properties; version the schema (`schema_version`); review any new event against the "which question does it answer" test.

## 5. Metric definitions

All thresholds are assumptions to be fixed before the pilot starts. With n of 20-30, show counts and denominators, medians and intervals (user testing plan section 10); do not show means or percent-only.

| Metric | Definition | Computation from events | Small-n caveat |
| --- | --- | --- | --- |
| Activation | User has at least one `trip_logged` within 7 days of first `app_opened` (also report within 24 hours and within 30 minutes for sessions) | First `app_opened` per `user_hash`; first `trip_logged` per `user_hash` | Report "k of N activated" |
| Time-to-first-value | Time from first `app_opened` (or `account_created`) to first `trip_planned` that reaches `option_selected` | Per-user difference; report median and range | Median only; a few users dominate means |
| Retention D1 / D7 / D30 | Of users whose first open was on day 0, the share with any `trip_planned` or `app_opened` on day N (also "within N-day window" version) | Cohort table by install week: rows = cohort, columns = day/week; cells = k/N | At N=25, each user is 4 percentage points; D30 can only be measured for users who joined at least 30 days before the end. Show the table, not a curve |
| Weekly retention curve | Share active in week 1, 2, 3, 4 after install | Same, weekly buckets | Plot with intervals or raw dots |
| WAU / MAU / stickiness | WAU = distinct users with `trip_planned` in a rolling 7 days; MAU 30 days; stickiness = WAU / MAU | Counts of `user_hash` | Meaningless in a closed pilot unless the group is held constant; report with the invite population as the denominator |
| Trips planned per user per week | `trip_planned` per active user per week, median, among users active that week, and also among all installed | Event counts | Show both denominators |
| PT share vs usual mode | Self-reported baseline: share of the user's trips by mode (Day-0 survey) versus logged: share of `trip_logged` where `mode` is PT, walk, cycle versus own car | Survey plus events | Logged trips are planned, not verified; users who plan PT and drive are unseen. Treat as an indicator of choice, not behaviour change |
| CO2 avoided per user | Sum of `co2_saved_g` over `trip_logged` per user per month, using the app's own factors | Event property sums; show the median per user | Assumed emission factors; baseline is the same trip driven alone, which many PT users would not have driven; excludes embodied emissions, charging and manufacturing, occupancy. Present as "estimated CO2 compared with driving", never "CO2 saved" in an investor deck without the caveat |
| NPS | Standard "How likely are you to recommend Reroute?" 0-10; promoters (9-10) minus detractors (0-6) | Survey | At n=25 the interval spans tens of points; report counts per band instead |
| SUS | 10-item System Usability Scale scored 0-100; 68 is the commonly cited average | Survey after round 1 and at pilot end | Report each score and the median |
| Willingness to pay | See section 8 | Survey | Hypothetical; pair with a behavioural test |
| Referral / viral coefficient | K = invitations sent per user x conversion of invitations to active users | `invite_shared` and `referral_signup`, or survey "how many people did you tell" | A closed pilot has K near zero by design; only report a lower bound and state that |
| Cost per acquired user | Marketing and incentive spend divided by users reaching activation | Spend ledger / activation count | Pilot incentives and recruiter time are not a real CAC; label "pilot cost per activated user" |
| API cost per active user | Google spend in the month divided by WAU or MAU; computed from `api_call` events times the unit price | Section 9 | Needs a sound price table; verify against the Google invoice |
| Reliability | Crash-free sessions = sessions without an unhandled exception / all sessions (Sentry); also error-free API calls | Sentry plus `error_shown` | Few sessions, so one bug changes the figure |

Investor-facing summary metrics at this stage: activation, week-2 and week-4 retention cohorts, trips per active user per week, API cost per active user, NPS/SUS, and the qualitative "would you be upset if you could not use it" question (Sean Ellis style "very disappointed" share, with its sample size).

## 6. One-page dashboard layout

Keep it a single page; build it in PostHog dashboards or a notebook over the exported events.

1. Header strip: pilot week, N invited, N installed, N consented, build version, last data refresh.
2. Funnel: invited, opened, signed in, planned a trip, selected an option, logged a trip (counts, not percentages).
3. Retention cohort table by install week (k/N), plus D1/D7/D30 once available.
4. Weekly active users (count) and trips planned per active user (median, with a dot per user).
5. Mode split: self-reported baseline versus logged, side by side.
6. CO2 estimate per user (dot plot with median) and the monthly goal progress, with a visible assumptions note.
7. Feature adoption: disruption mode, offline area, push, ride board, impact dashboard (number of users who used each at least once).
8. Cost and capacity: Google calls per day by service, daily cap used, rate-limit hits, cost to date, cost per active user.
9. Quality: crash-free sessions, top errors, open severity-1 bugs.
10. Survey strip: SUS scores, NPS counts, response rate.
Where possible use dot plots and tables rather than percentage tiles at this n.

## 7. Weekly review ritual (30 minutes, same day each week)

1. Check data integrity first (events arriving, consent counts, no PII in properties, schema version).
2. Read the numbers in section 6 top to bottom; write one sentence per panel stating what the data says and what it cannot say.
3. Read all new diary and bug entries (de-identified), tag themes.
4. Pick at most three actions for the week (a fix, a question for the next interview, a cap or budget change).
5. Update the hypothesis status in a draft note (use the repository's labels; do not mark anything supported on this sample alone).
6. Record decisions and any metric definition changes in a dated log so that definitions do not drift.
7. Check Google spend against the budget and the daily cap.

## 8. Willingness-to-pay mini-surveys

Use only in the exit survey, after the participant has used the app for weeks. Treat the output as a rough range, not a price.
- **Van Westendorp** (four questions for a monthly subscription): too cheap (doubts quality), cheap (a bargain), expensive (would think twice), too expensive (would not consider). Plot the cumulative curves and read the range. At n=25 the curves are jagged; report the median of each answer.
- **Gabor-Granger**: show 3-5 price points in random order ("Would you pay $X per month for [specific premium features]?"). Report the share saying yes at each price with a count, not a fitted curve.
- Add the control question: "Have you ever paid for a transport app or feature?" and "How would you pay: yourself, or would you expect your employer/university to pay?" The second answer matters for the B2B2C ideas.
- Also test a behavioural signal: a "Join the waitlist for [premium feature]" button logged as `premium_interest_clicked` (an event to add; no payment taken).
- Hypothetical bias is large: people overstate what they will pay. Never present survey prices as demand.

## 9. API cost per active user (unit economics)

The code already caps Google-backed requests (`apps/plan-b-mvp/limits.py` defines a per-visitor hourly sliding-window limiter and a Brisbane-day counter; `server.py` sets defaults of 40 plan searches per hour per visitor, 50 plan searches per day in total, 500 autocomplete lookups per day, 120 fuel lookups per hour, 60 place lookups per hour per visitor, and 6 offline downloads per hour, which are not Google requests). The 50-per-day plan cap is far below what 25 active users generate, so it must be raised deliberately for the pilot, with a billing budget alert set first.

Illustrative arithmetic, all assumptions:
- Assume each planned trip causes about 2 Google calls on average (one transit route search, one more for driving or cycling comparison, plus occasionally fuel and car-park lookups from Places). Assume an average price of about $0.01 per call (equivalent to $10 per 1,000 calls, a placeholder from the order of magnitude of the quoted list prices; the actual Routes API SKU rates were not confirmed; check current pricing).
- Assume an active user plans 8 trips per week, about 35 per month: 35 x 2 x $0.01 = $0.70 per active user per month, plus autocomplete (session-based; reported as cheap or free per session, check) and elevation.
- For 25 users: about $17.50 per month before free monthly SKU allowances, which may bring it near zero.
- If the app reached 10,000 monthly active users at the same pattern: about $7,000 per month. A premium price of a few dollars a month with a low conversion rate would not cover that, so caching, longer cache of identical routes, dropping redundant comparison calls or an alternative routing source matter for any subscription idea. This is the key unit-economics risk.

Compute for real from `api_call` events: per month, count calls by `service` and `cached`, multiply by the unit price table (kept in a config file, with the date it was checked), divide by active users. Reconcile against the Google Cloud invoice. Also log the cache hit rate.

## 10. Implementation plan (TODO, do not implement here)

All in `apps/plan-b-mvp`. This is a to-do list for the team or another agent.

- [ ] Decide the analytics vendor (section 2) and the consent wording; add the PostHog/Sentry project keys through environment variables (`PLANB_ANALYTICS_KEY`, `PLANB_SENTRY_DSN`), never in the repo.
- [ ] Add a thin `track(name, props)` wrapper in the front end (for example a small `analytics.js`) that: returns immediately if consent is not `granted`; applies an allow-list of event names and property names; drops any property not in the schema; adds the base properties; batches and uses `navigator.sendBeacon`; never throws.
- [ ] Add a consent banner and a Settings toggle storing `planb.analyticsConsent` locally; sync to the account when signed in; honour withdrawal immediately and offer "delete my analytics data".
- [ ] Add a pseudonymous id: `user_hash` computed server-side with HMAC and a server secret, returned by the account/session endpoint; never send the raw account id to the client analytics.
- [ ] Add server-side event logging in `server.py`: a small `events` table or JSONL under `PLANB_DATA_DIR` recording `api_call` and `rate_limited` events (service, status, latency, cached flag, user_hash only if consented), with a retention job.
- [ ] Count Google calls at the wrapper in `google_api.py` (one place), so cost is computed from the real calls; add a price-table config with a "last checked" date and an admin-only `/api/admin/usage` summary (authenticated; not public).
- [ ] Instrument the events in section 4 at the existing call sites in `app.js` (plan, selection, logging, panic, offline, rides, push, share); add a test that no event contains a key outside the allow-list.
- [ ] Add Sentry to Flask and to the front end with `send_default_pii` off and request bodies scrubbed; mask inputs.
- [ ] Add a "Report a problem" link and an in-app survey link prompt (SUS/NPS after N logged trips, once), each opened as an external link.
- [ ] Add `premium_interest_clicked` and `invite_shared` events and a share-with-referral parameter for K-factor measurement.
- [ ] Update the Privacy page text to list analytics, retention and sub-processors; have a human review the wording (the Terms and Privacy wording are currently owned by the team).
- [ ] Add a nightly export of events to CSV on the homelab (for the cohort and dashboard queries) kept off Git.
- [ ] Bump the service-worker `VERSION` when shipping, and freeze the pilot release.
- [ ] Raise `PLANB_DAILY_GOOGLE_CAP` and related limits for the pilot only after a Google billing budget alert exists.

## 11. Most important recommendations

1. Use PostHog Cloud with autocapture and replay off and a strict `track()` allow-list, plus server-side API-call logging, instead of GA4 or heavy session-replay tools.
2. Fix definitions of activation, retention cohorts and API cost per active user before the pilot starts, and report counts, medians and intervals only.
3. Get the unit economics right early: log every Google call and compute cost per active user, because it decides whether any subscription idea can work.
