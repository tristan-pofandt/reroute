# Reroute monetisation brainstorm and ranking

**Date:** 2026-10-28
**Prepared by:** Claude Sonnet 5.5 via Claude Code at T.P's request.
**Human review required:** yes. This is a brainstorm. Figures are assumptions, legal points are flags to check with the licensors or a lawyer, and nothing here is a validated revenue model. The existing [business model canvas](business-model-canvas.md) states that no revenue model has been validated and that no buyer has been asked; that remains true.
**Status:** Reroute has not been participant-tested in the field. No customer, organisation or partner has been contacted for this document.

Related: [user testing plan](user-testing-plan-2026-10-28.md), [analytics and metrics plan](analytics-and-metrics-2026-10-28.md), [business model canvas](business-model-canvas.md), [competitor comparison](competitors/team-competitor-comparison-2026-09-25.md), [Reroute README](../../apps/plan-b-mvp/README.md).

## 1. Starting facts and constraints

- Reroute is free to use, a public-transport-first planner for Brisbane/SEQ with CO2 versus driving, a "Journey disrupted?" mode, offline areas, live Translink vehicles/alerts, weather and traffic, a ride board, and (on this branch) accounts.
- Strong free competitors exist: Google Maps, Apple Maps, Moovit, Citymapper (check availability in Brisbane) and the official Translink app and journey planner. The competitor files report that none is built disruption-first, which is itself an untested claim (H-P06, H-P08, H-P10, H-P12).
- Variable cost per active user is real: Google charges per route and place call (see [analytics plan section 9](analytics-and-metrics-2026-10-28.md)). A free consumer app with no revenue loses money with each active user.
- The only user-supported evidence so far is interview feedback on fictional prototypes. Nobody has said they would pay.

## 2. Shared assumptions for the size-of-prize arithmetic

All are assumptions; replace with sourced figures before use. "Check" means look up the ABS, Translink, TMR or university annual report.

| Assumption | Value used | Confidence |
| --- | --- | --- |
| SEQ population | about 5.5 million | Medium; check ABS regional population |
| Share who use public transport in a typical week | 10-15%, so roughly 550,000-825,000 | Low; depends on definition; check TMR and Translink patronage reports |
| People who commute to work or study by public transport regularly | use 400,000 as a round placeholder | Low |
| University students across SEQ (UQ, QUT, Griffith, USQ and others) | about 200,000 | Low; check each university's annual report |
| Employers in SEQ with 500 or more employees | about 300 | Low; check ABS counts of businesses by size |
| Reroute reachable share in year 1-3 | 0.1% to 1% of regular PT users | Pure guess; used to show scale, not forecast |
| Free to paid conversion for consumer apps | 1-5% | Common industry rule of thumb, not sourced here; check |
| App store commission | 15% to 30% | See legal section; check current rules |

Every "prize" below equals (number of payers) x (price) with a stated share. These are Fermi estimates, not forecasts.

## 3. The ideas

### 3.1 B2B2C: employers and universities (commuter programs)

- **Who pays:** the organisation: universities (parking and transport demand management), large employers (sustainability and travel plans, ESG reporting, staff wellbeing), property managers and developers with travel plans, event organisers (single-event crowd movement).
- **What they get:** a branded or white-labelled commute planner for their sites with disruption alerts, an aggregated and consented CO2 reporting dashboard (the canvas already notes this hypothesis), and a way to shift staff away from car parking.
- **Price points (assumptions):** $2-6 per active user per month, or a flat licence of $5,000-$30,000 per organisation per year for pilots; event organisers $1,000-$10,000 per event.
- **Size of prize (estimate):** 300 large employers x 5% adopting x $15,000 per year = $225,000 per year. Add 5 universities x 30% adopting x $30,000 = $45,000. Total on the order of $270,000 per year in a good early scenario; most scenarios are far smaller. Check the number of organisations that must produce travel plans or report emissions.
- **Barriers:** long sales cycles (months), procurement and security reviews, need for single sign-on and privacy compliance, proof that the tool changes behaviour (which is not yet shown), and a champion inside the organisation.
- **Legal:** employee data consent; aggregated reporting must not identify individuals; Google Maps Platform terms and the free Translink data licence must permit the commercial resale of the service (see section 4). Privacy Act obligations apply to the buyer and to the service provider.
- **Validation experiment with the 20-30 test users:** (1) ask the employed and student participants in the exit interview whether their organisation has a commuter or parking program and who owns it (record counts and roles, not names); (2) with consent, introduce one participant's workplace or a UQ contact (Parking and Transport Services, Sustainability) for a 20-minute discovery call; (3) show the aggregated dashboard mockup with the pilot's data and ask "what would you need to see before you would pay?" and "which budget would this come from?". Success signal: two organisations agree to a written pilot or to put the product in a budget conversation.
- **Investor wants to see:** a signed pilot letter of intent, activation and retention among employees, evidence of behaviour change (even if directional), a repeatable sales path, and gross margin after API cost.

### 3.2 Councils, Translink/TMR and government service contracts

- **Who pays:** state and local government (TMR, Translink, Brisbane City Council, other SEQ councils) for disruption communications, mode-shift campaigns, or a Translink-branded companion app; they also run innovation challenges.
- **Price points (assumptions):** $20,000-$150,000 for a trial or campaign; recurring $50,000+ a year only if adopted.
- **Size of prize (estimate):** there are about 12 SEQ councils plus TMR/Translink (check). Suppose 3 pilots x $60,000 = $180,000 in one good year. Highly uncertain.
- **Barriers:** government procurement, probity, preference for incumbents, data sovereignty, the fact that Translink publishes its own app and may see Reroute as competition or a collaborator. Political timing.
- **Legal:** Translink's open data licence (the README records the static GTFS as CC BY 4.0 and the realtime feeds as keyless public feeds; check the exact licence terms and the realtime terms for commercial use, attribution and rate limits). Commercial use of open data is generally allowed under CC BY with attribution; the realtime feeds' terms must be checked separately. A government contract may require Australian-hosted data and security assessments.
- **Validation experiment:** share the de-identified pilot results (disruption frequency, which alerts users acted on) with one TMR/Translink innovation contact or the Brisbane council's transport team and ask whether the data answers any question they currently pay to answer. Success signal: a meeting booked or an invitation to an open-data challenge.
- **Investor wants to see:** a government reference customer, a credible data licence position, and low dependence on a single buyer.

### 3.3 Carbon and green-mobility rewards, partner discounts

- **Who pays:** brands and local businesses (cafes near stations, e-bike shops, gyms), employers (rewards budget), and green-mobility programs.
- **Price points (assumptions):** sponsorship of $500-$5,000 per partner per quarter; cost per redeemed offer $1-$5.
- **Size of prize (estimate):** 40 local partners x $2,000 per year = $80,000 per year at the optimistic end, only with substantial users near those partners.
- **Barriers:** needs enough engaged local users; partner management effort; reward fraud (logged trips are planned, not verified) which makes real carbon credits or tradable rewards unsafe. Do not call anything a verified carbon credit.
- **Legal:** consumer law on offers and prizes (trade promotion permits in some states, check), advertising standards on environmental claims (the ACCC's greenwashing guidance, check), privacy for any redemption tracking.
- **Validation experiment:** put a mock "Partner rewards" card on a test build (a button leading to a waitlist page) and log `premium_interest_clicked`-style clicks; ask 5 participants which reward would change a decision. Success: more than a handful of users click and name specific rewards; a local business agrees to a free trial offer.
- **Investor wants:** proof that a reward changes behaviour, and that CO2 numbers are defensible under scrutiny.

### 3.4 Freemium premium tier (consumers)

- **Who pays:** individual travellers, for offline areas, background push alerts, saved trips, family or group features, widgets, ad-free.
- **Price points (assumptions):** $2-$5 per month or $20-$40 per year; Van Westendorp and Gabor-Granger in the exit survey will give a first range (see the analytics doc).
- **Size of prize (estimate):** 400,000 regular PT commuters x 0.5% reached = 2,000 users; x 3% paying = 60 payers; x $36 per year = $2,160 per year. A bullish case (5,000 x 5% x $36) is $9,000. This shows consumer subscription is tiny alone at the likely reach, and API cost per user ($0.70 per active user per month in the analytics doc example) eats a sizeable fraction of $3 per month after store commission.
- **Barriers:** strong free alternatives, alert and offline features are expected to be free by the user base, store commission and API cost, low willingness to pay in a student segment.
- **Legal:** Apple and Google in-app purchase rules (see section 4). A PWA sold outside the stores avoids the store commission, but the policies differ by platform and change; check. Consumer guarantee law applies.
- **Validation experiment:** add a "Join waitlist for Reroute Plus" button, run the two pricing surveys with the 20-30 users, and ask "would you pay if your usual app offered this free?". Success: at least a quarter of active users give a non-zero price AND click the waitlist.
- **Investor wants:** conversion, churn and gross margin per paying user; it is the weakest standalone story at this stage.

### 3.5 Affiliate and partnerships (micromobility, ride-share, parking, bike shops)

- **Who pays:** e-scooter and e-bike operators (Lime, Neuron), ride-share (Uber), parking apps, bike shops, car-share, for referred customers.
- **Price points (assumptions):** $1-$5 per referred first ride or install, or a revenue share of a few percent. Verify whether any of these run public affiliate programs in Australia (check; many do not).
- **Size of prize (estimate):** 25 users x 4 hand-offs per month x 5% converting to a first ride x $3 = $15 per month at pilot scale. At 10,000 active users the same pattern gives $6,000 per month, but the conversion and payout are guesses.
- **Barriers:** operator willingness, tracking attribution via deep links, conflict with Reroute's CO2 message (ride-share and scooters have CO2 and congestion impacts, and the app does not add charging or manufacturing). Hire prices are only estimates in the app.
- **Legal:** disclose affiliate links (consumer law and ad standards); the Uber and operator terms for deep links; do not use their trademarks beyond permitted use.
- **Validation experiment:** the `external_handoff` event already planned counts taps on Lime/Neuron/Uber/Google Maps buttons; run the pilot and report taps per active user. Then ask one operator for a written partner or affiliate terms. Success: a counted tap rate and one operator reply.
- **Investor wants:** revenue per active user, and evidence that partnerships do not distort recommendations.

### 3.6 Sponsored local-business placement

- **Who pays:** cafes, stores, venues near stops; event promoters.
- **Price points:** $100-$500 per month per business (assumption).
- **Size of prize:** 50 businesses x $200 x 12 = $120,000 per year in the optimistic case; realistic early revenue is a small fraction.
- **Barriers:** needs eyeballs; risks eroding trust in a neutral ranking; Google Places data and local advertising rules limit what can be shown. Do not blend sponsored items into the route ranking.
- **Legal:** Google Maps Platform terms limit using Places content outside Google maps and caching it; label ads clearly.
- **Validation:** low priority. If tested, show 5 pilot users a "nearby offer" card and ask whether it helps or annoys them.

### 3.7 Aggregated, anonymised insights licensed to planners

- **Who pays:** planners and transport consultancies, councils, developers.
- **Price points:** $5,000-$50,000 per dataset or report (assumption).
- **Barriers and risks:** the dataset would be tiny and biased at any near-term scale; commuter flows can re-identify people (small cells in sparse areas); consent must be specific and informed; Google Maps Platform terms restrict deriving and selling datasets from Google content (check carefully before building anything); the Privacy Act and state law apply.
- **Verdict:** treat as a long-term idea only, behind opt-in, k-anonymity thresholds (for example no cell with fewer than 20 users), and legal advice. Not in the 90-day plan beyond a conversation.

### 3.8 Grants and government innovation funding

- **Who pays:** governments and agencies. Candidates to check (eligibility and current rounds not verified): Advance Queensland programs, federal programs such as the Industry Growth Program, R&D Tax Incentive (applies to eligible R&D expenditure by registered companies), Cooperative Research Centre projects, TMR or Translink open-data and innovation challenges, university innovation and entrepreneurship funds (for example UQ Ventures, check), council innovation grants.
- **Price points:** $5,000-$100,000+ depending on the program (assumption). Check eligibility, matching-funds rules, and whether a student project or an unincorporated team qualifies; some require an ABN or company.
- **Size of prize:** one early grant of $10,000-$50,000 is plausible for a student venture; treat as a way to fund the pilot and API costs, not a business model.
- **Barriers:** application effort, reporting, IP and eligibility rules.
- **Validation:** after the pilot, write a one-page grant case using real pilot numbers and submit to one program; success is a pre-application invitation.
- **Investor wants:** grants show external validation but do not replace revenue.

### 3.9 White-label to other cities

- **Who pays:** transit agencies or media companies in other cities; operators of regional networks.
- **Price points:** $10,000-$100,000 set-up plus annual licence (assumption).
- **Size of prize:** 5 regional deals x $40,000 = $200,000, highly speculative.
- **Barriers:** Reroute's data stack is hard-wired to Translink GTFS and Brisbane specifics; each city needs its own GTFS and realtime sources and local CO2 factors. It requires Brisbane success first.
- **Legal:** local open-data licences differ; Google Maps Platform pricing and terms apply to each deployment.
- **Validation:** none now; revisit after a Brisbane reference customer.

### 3.10 Data and API licences

- **Idea:** license Reroute's GTFS-matching, offline-area packager or CO2 calculator as an API to other developers.
- **Who pays:** app developers, researchers, councils.
- **Price points:** $100-$1,000 per month per customer (assumption).
- **Barriers:** the underlying data is open (Translink GTFS under CC BY 4.0 per the README); the value is the code, which is a thin differentiator unless proven; the Google-derived content cannot be resold (check terms).
- **Legal:** attribution under CC BY; the ODbL for OpenStreetMap data (share-alike for derived databases; the README credits OSM contributors). Check whether a commercial licence of realtime feeds is permitted.
- **Verdict:** low priority.

### 3.11 What NOT to do

- Do not sell or share personal or precise location, trip history, home/work inference or device identifiers. This is a privacy and trust failure, likely a legal one, and the app's marketing relies on trust.
- Do not sell advertising targeted from individual trip data.
- Do not present estimated CO2 as verified carbon credits or tradable offsets.
- Do not rank routes by who pays; a sponsored option mixed into the ranking destroys the product's value (H-P20 on trust).
- Do not build billing, subscriptions or payments before a buyer has said yes in writing.
- Do not lift or resell Google Maps Platform content outside its terms.
- Do not run the ride board commercially (commissions on rides) until safety, insurance and legal questions are settled; ride-sharing for reward may trigger transport regulation (check Queensland rules).

## 4. Legal and platform constraints to check (not legal advice)

| Topic | What is known from the project files | What to verify |
| --- | --- | --- |
| Google Maps Platform terms | The app uses Routes, Places (New), Elevation and Maps JavaScript with attribution kept visible; keys are server-side or referrer-restricted | Commercial use is generally allowed on a billing account, but the terms restrict caching or storing content beyond permitted limits, mixing Google data with non-Google maps, building a competing dataset, and re-selling content; the app also shows OSM-based offline maps, which must not be mixed with Google content. Check the current Terms of Service and Service Specific Terms before any paid use or B2B resale |
| Google Maps Platform pricing | Per-SKU free usage replaced a pooled monthly credit; Places Autocomplete about $2.83 per 1,000 above free cap in one summary ([Woosmap](https://www.woosmap.com/blog/is-google-maps-api-free)) | Current Routes API (New) SKU rates; volume discounts; startup credits (check); a billing alert |
| Translink data | README: static GTFS is CC BY 4.0 with no key; realtime feeds have no key | Exact licence text, whether commercial use of realtime feeds is allowed, attribution wording, rate limits, terms changes |
| OpenStreetMap | Credited as "© OpenStreetMap contributors", ODbL | Share-alike obligations for derived databases when offered commercially; Overpass usage policy (heavy use of the public instance is restricted) |
| Apple App Store | Not currently used (PWA) | Digital goods usually require Apple in-app purchase: commission 30%, reduced to 15% for the Small Business Program (under US$1 million in proceeds) and for subscriptions after the first year (check current rules and Australian regulation changes) |
| Google Play | Not currently used | Commission typically 15% on the first US$1 million per year and on subscriptions, otherwise up to 30% (check) |
| Selling outside the stores | A PWA installed from the web is not an app store product | Rules about steering users to web payments differ and are changing by region; check before relying on this |
| Australian Privacy Act | See analytics doc | Application to the company once it has revenue; notifiable data breaches scheme |
| ACCC / consumer law | n/a | Environmental claims must be substantiated; subscription terms; affiliate disclosure |
| Student IP and company structure | n/a | Who owns the code (course IP policy, team agreement) before any commercial deal |

## 5. Comparison and ranking

Scores 1-5 (5 best) are subjective judgments for the team to challenge, not measurements.

| Idea | Size of prize | Evidence today | Speed to first dollar | Fit with trust and CO2 mission | Effort and legal risk (5 = low) | Total |
| --- | --- | --- | --- | --- | --- | --- |
| 3.1 B2B2C employers/universities | 4 | 1 | 2 | 5 | 3 | 15 |
| 3.8 Grants and innovation funding | 2 | 1 | 4 | 5 | 4 | 16 |
| 3.2 Councils / TMR / Translink | 3 | 1 | 2 | 5 | 3 | 14 |
| 3.5 Affiliate / partnerships | 2 | 1 | 4 | 3 | 3 | 13 |
| 3.3 Rewards and discounts | 2 | 1 | 3 | 4 | 3 | 13 |
| 3.4 Freemium consumer tier | 1 | 1 | 3 | 4 | 3 | 12 |
| 3.9 White-label other cities | 3 | 1 | 1 | 4 | 2 | 11 |
| 3.6 Sponsored placement | 2 | 1 | 3 | 2 | 3 | 11 |
| 3.10 Data and API licences | 1 | 1 | 2 | 3 | 3 | 10 |
| 3.7 Insights to planners | 2 | 1 | 1 | 2 | 1 | 7 |
| Selling location data | n/a | n/a | n/a | Do not do | 1 | Exclude |

Evidence is rated 1 for every idea because none has been tested. Grants score highest on this table because they are quick and low-risk, but they fund a business rather than being one, so the shortlist ranks B2B2C first as the revenue hypothesis and treats grants as its funding route.

### Ranked shortlist (for validation, not for building)

1. **B2B2C with a university or large employer** (UQ as the first design partner): best long-term fit and size, depends on proving behaviour change.
2. **Grants and innovation funding** to pay for the pilot and API costs while buyer evidence is built: fastest cash, no dilution, but check eligibility.
3. **Partnerships and affiliate hand-offs**: cheapest to test, because the hand-off buttons and the `external_handoff` event already exist or are planned; modest income.

Hold: councils/TMR (pursue through the same pilot data), rewards, freemium (retest after the willingness-to-pay survey). Park: white-label, sponsored placement, data/API, insights. Exclude: selling location data.

## 6. What an investor would want to see (summary)

- **Traction:** activation, week-2 and week-4 retention, trips per active user per week, with cohort tables and the sample size ([metrics plan](analytics-and-metrics-2026-10-28.md)).
- **Unit economics:** API cost per active user, gross margin per organisation or per paying user, CAC proxy, payback (all currently assumptions).
- **Defensibility:** what stops Google Maps, Apple or Translink from copying a disruption-first flow? Candidate moats are local data matching (exact GTFS line matching), offline areas, an institutional relationship, and a trusted CO2 method. Be honest that most of these are thin today.
- **Evidence of demand from a payer,** not only users: letters of intent or signed pilots.
- **Team:** relevant skills, time commitment, who owns the IP, how decisions are made.
- **Risks disclosed:** reliance on Google and Translink terms, privacy, small sample, uncertain CO2 estimates.

## 7. 90-day validation plan

Start after the ethics answer (see the user testing plan). Dates are placeholders. Each step has a named owner and a stop/continue rule.

| Days | Activity | Output | Decision rule (assumption) |
| --- | --- | --- | --- |
| 1-14 | Run usability round 1 (5 users); add analytics, consent, `external_handoff`, `premium_interest_clicked`; set the Google budget alert; send two grant eligibility queries; list 10 target organisations for B2B2C | Fixed build, instrumented, target list | Stop and fix if more than one severity-1 issue remains |
| 15-45 | Field pilot with 20-30 users (weeks 3-6 of the testing plan); weekly review | Event data, diary | If activation is below 40% (assumption), pause monetisation work and fix value first |
| 30-60 | Book 5 discovery conversations with commuter-program owners (UQ Parking and Transport Services or Sustainability, 2 large employers, 1 council, 1 operator); show de-identified pilot numbers and the aggregated dashboard mockup | Interview notes (de-identified), objections, budget owner | Continue B2B2C only if at least 2 of 5 name a budget and a next step |
| 45-60 | Exit survey: Van Westendorp, Gabor-Granger, "who should pay" question; affiliate tap-through count; reward preference question | WTP range with intervals, tap rate | Treat consumer subscription as a feature, not a business, unless most active users give a non-zero price AND click the waitlist |
| 60-75 | Write the pilot results note with honest caveats; update the business model canvas revenue streams section and hypothesis labels | Results note | Human review before sharing externally |
| 60-90 | Submit one grant or challenge application; propose a paid or in-kind 3-month pilot to the best-fit organisation (scope, success metric, price in the $5,000-$20,000 range as an assumption); ask one operator for written partner terms | Applications and a pilot proposal | Success at day 90: one signed pilot or letter of intent, or one grant shortlisted; otherwise narrow the segment or change the idea |
| 90 | Investor-readiness review: unit economics sheet, defensibility paragraph, risk list | One-page summary | Do not raise until there is at least one external signal |

## 8. Most important recommendations

1. Treat B2B2C (a UQ or large-employer commuter program) as the lead hypothesis, and fund the pilot with a grant; do not build consumer billing yet.
2. Validate payer demand with real conversations and the pilot's de-identified numbers before any code for payments; use the 20-30 users to test waitlist clicks, hand-off taps and willingness-to-pay as weak signals only.
3. Fix unit economics and licences first: cap Google cost per active user, confirm Google Maps Platform and Translink terms for commercial use, and never monetise personal location data.
