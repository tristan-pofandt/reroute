# Reroute user testing plan (20-30 real users)

**Date:** 2026-10-28
**Prepared by:** Claude Sonnet 5.5 via Claude Code at T.P's request.
**Human review required:** yes. A team member must review every section, especially the ethics section, which the AI cannot decide, before any participant is contacted.
**Status:** Plan only. Reroute has not been participant-tested in the field. Every number below (quotas, thresholds, durations, costs) is an assumption chosen to make the plan concrete, not a finding. Nothing here records participant statements or consent.

Related: [MVP scope](mvp-scope-2026-10-20.md), [hypothesis register](../discovery/assumptions/hypothesis.md), [business model canvas](business-model-canvas.md), [analytics and metrics plan](analytics-and-metrics-2026-10-28.md), [monetisation brainstorm](monetisation-brainstorm-2026-10-28.md), [Reroute README](../../apps/plan-b-mvp/README.md).

## 1. What this plan is for

Reroute (a Brisbane/SEQ public-transport-first planner with CO2 avoided versus driving, a "Journey disrupted?" mode, offline areas and a ride board) has only been seen by interview participants through fictional prototypes (P006-P011, P106-P110, P306-P310, P405-P409). The current app has had no real-world use by outsiders. This plan answers three questions in order:

1. Can a stranger use it without help (usability)?
2. Do people use it for their real trips over 2-4 weeks, and does it change or reinforce public-transport use (value and habit)?
3. Is there any sign that someone, other than the traveller, would pay (viability)? See the monetisation brainstorm.

## 2. Hypotheses this plan tests, and what would count as a signal

Thresholds are proposals for the team to agree before data collection (pre-register them in a test card). They are assumptions, not industry benchmarks.

| Hypothesis | Existing card | Field measure | Proposed signal (assumption) | Disprove signal |
| --- | --- | --- | --- | --- |
| H-P02 convenient, not confusing | TC-P02 (test-card-07) | Task success without help; SUS; time on task | 4 of 5 round-1 users complete each core task unaided; median SUS 68 or more in the pilot | Repeated help requests on the same screen |
| H-P14 Journey disrupted? helps stressed travellers act sooner | no dedicated card yet | Staged scenario in round 1; real uses in the pilot | Participant picks a feasible option in under 60 s in the staged scenario; some real uses logged | No real disrupted uses in 4 weeks AND staged task not faster than usual app |
| H-P15 true driving cost reduces default driving | no card yet | Mode-choice questions before and after; cost-card interviews | Car-dependent participants say the driving-cost line changed or confirmed a decision | Cost line ignored in the diary |
| H-P18 personal impact encourages repeat PT use | no card yet | Impact dashboard opens; D7/D30 return; diary | Dashboard opened by at least half of active users; users can say what CO2 means | Dashboard never opened after week 1 |
| H-P17 ride sharing | no card yet | Ride board views, posts, joins | Any genuine post and join; safety concerns recorded | Zero posts (expected at n=30; do not over-read) |
| H-P03 / push alerts | TC-P03 (test-card-08) | push_enabled rate; alert open rate | At least a third of users enable alerts; alerts opened | Alerts muted or disabled within a week |
| H-P20 live-data cues build calibrated trust | TC-P15 (test-card-22) | Comprehension probe: "is this price live, estimated or unavailable?" | Most can say which; fewer than 2 of 5 misread | Many misreads |
| H-P21 live vehicle map | TC-P16 (test-card-23) | Task: locate approaching bus | Correct location from map | Confuses vehicle with stop |
| H-P19 colour and hierarchy | TC-P14 (test-card-21) | Find arrival time, pick feasible option | Not a field question; keep to the controlled comparison in the card | n/a |
| H-P06/P08/P10/P12 beats Moovit/Google/Translink/Apple in disruption | TC-P10 etc. (cards 11, 13, 15, 17) | Within-subject staged comparison in round 1 | Only run if the team has time; counterbalance order | See cards |
| H-T01/T05 disruption is real and frequent for the segment | test_card_01 / test-card-05 | Diary: count disruptions per week | Median at least 1 disruption per participant per fortnight (assumption) | Most participants report none |

The offline-area feature has its own card ([test-card-offline-journeys](../discovery/experiments/test%20cards/test-card-offline-journeys.md)); fold its tasks into round 1.

## 3. Recruitment

### 3.1 Who and how many

Target 25 pilot participants (range 20-30), recruited as a purposive mix, not a random sample. Quotas (assumptions):

| Quota | Target n | Why |
| --- | --- | --- |
| PT-dependent (no car, or car rarely used for this trip) | 10 | Primary segment from the canvas: students and workers with fixed commitments |
| Car-available, drives for most trips, willing to try PT | 10 | Tests the driving-cost and CO2 value; secondary segment hypothesis |
| Mixed or occasional PT users | 5 | Fills the gap; tests the unfamiliar-route case |
| Of these, UQ students | at least 10 | Easiest to reach; note this biases towards young, tech-comfortable users |
| Non-student workers or older adults | at least 5 | Reduces the student-only bias; likely hard to get, record the gap honestly |
| iPhone / Android | roughly 12 / 13 | PWA install and push behave differently; iOS push needs the app added to the home screen |

Spread the routes: aim for at least 3 distinct corridors, for example UQ St Lucia (Green Bridge, Park Road/Dutton Park, Toowong), Brisbane Metro and busway to the CBD, and a Queensland Rail line (Ipswich, Caboolture, Gold Coast, Redcliffe lines) so that train disruption (H-T05) is represented. Add at least 3 participants outside the inner suburbs (an outer-suburb commuter changes the car-versus-PT picture and the offline-area story).

### 3.2 Where

- UQ: student clubs and societies, course Discord/Teams groups (with permission of admins), the COMP1100 cohort's own friends outside the team (the team members' close friends are a bias risk; do not count them toward the 5 round-1 users).
- Public-transport stops and stations near UQ (UQ Lakes busway, Park Road station): intercept recruiting needs the venue's permission and must be low-pressure. Check rules before approaching people on Translink property.
- Workplaces and families reached through team members' networks, with a note that these are warm contacts and that deference bias is likely.
- Brisbane commuter groups on social media (post in line with each group's rules; do not post participant-identifying details).
- Do not use public posts that invite strangers to type their routes into an untested app without a clear notice of what is collected.

### 3.3 Screening (short form, no names stored in Git)

Ask: suburb of the main trip origin (postcode only), usual mode for that trip, car access, how often travelled by PT in the last month, phone type, whether the participant is 18 or over, and whether they will be in SEQ for the full pilot. Exclude people under 18 (parental consent and ethics change materially), team members and their housemates, and anyone who cannot install the app or use a smartphone. Keep the screening answers in the team's private store, keyed by participant code, never in Git.

### 3.4 Incentives

Keep modest and not tied to answering any particular way. Assumed budget: a $10 gift card for round 1 (30-40 minutes), $20 for completing the pilot plus the exit interview, and $5 per diary week completed. Estimated total: roughly 5 x $10 + 25 x $20 + diary 10 x $15 = about $700 at the upper end. This is an assumption; pay nothing the team cannot afford and check whether course rules allow incentives. Never make payment depend on trips logged. State the incentive in the consent text.

## 4. Phased plan

Dates assume the plan starts the week of 2026-11-02. Adjust to the team calendar and to the exam period, which reduces student availability and also changes travel patterns (note this in the results).

| Week | Phase | What happens | Output |
| --- | --- | --- | --- |
| 0 (now to 1 Nov) | Prepare | Ethics decision (section 6). Fix known blockers from the README Limitations. Add analytics and consent (see analytics plan). Prepare the install page/QR, the screening form, scripts, consent text, bug intake form. Dry run with one team member's relative. | Signed-off plan, ethics answer in writing |
| 1 | Round 1: usability, 5 users | 5 moderated sessions of 30-40 minutes, in person or by video call, each on the participant's own phone. Think aloud. Fix severity-1 problems after sessions 2 and 4 (the "5 users find most major issues" rule of thumb is heuristic, not a guarantee). | Issue list ranked by severity; SUS per participant; revised build |
| 2 | Fix and re-test | Fix top issues. Run 2-3 quick re-tests on the fixed screens. Open pilot signup. | Build v-pilot frozen except for severity-1 bugs |
| 3-6 | Field pilot, 20-30 users, 2-4 weeks | Staggered onboarding (5-8 per day over the first week, so that cohorts are comparable). Use the app for real trips. Mid-pilot check-in message at day 7 and day 14. | Event data, diary entries, bug reports |
| 3-6 (in parallel) | Diary study, 8-10 of the pilot users | Short daily or per-trip micro-survey (2 questions) plus a weekly 5-minute reflection. Covers disruption moments that analytics cannot explain. | Qualitative evidence tied to codes |
| 7 | Exit interviews and surveys | 15-20 minute exit interview for 8-10 users (mix of heavy, light and dropped-off). SUS, NPS, willingness-to-pay mini-survey (see analytics plan section 8) for all. | Interview notes (de-identified), survey data |
| 8 | Analysis and write-up | Update test cards and learning cards. Write the honest results note (section 9). Decide what to change and what to stop. | Results doc in docs/discovery/experiments |

If the team has only two weeks, shrink the pilot to 2 weeks, keep round 1, and say plainly that D30 retention was not measured.

### 4.1 Round 1 tasks (moderated, per participant, same order unless counterbalancing)

Give scenarios, not instructions. Do not coach. Record time, errors, help requests and verbatim confusion in the private notes under the participant code.

1. Install: "Open this link and keep it on your phone as you would any app." (Observe the install or add-to-home-screen path; iOS needs Safari.) Success: app on home screen or used in browser; note if they give up.
2. Plan a real trip: "Plan how you would get from your home to uni/work tomorrow at 8:30." Success: results shown and a choice made. Probe afterwards: what is the CO2 line saying?
3. Compare: "Which option would you really take and why?" (H-P05/H-P01: does cost and CO2 matter?) Record the reason given before probing.
4. Driving comparison (car-available participants): "How does this compare with driving for you?" Check that they understand the driving cost and CO2 baseline and their weaknesses.
5. Log the trip and open the Impact Dashboard: "What does this tell you?" (H-P18.)
6. Staged disruption (fictional but built on a real route if possible): "Your train is cancelled and you have a 9:00 deadline. Show me what you would do." Compare "Journey disrupted?" against their usual app, order counterbalanced (TC-P10 family). Time to a feasible choice.
7. Offline: "Imagine you will have no signal around X. Prepare for that." Use the offline-area flow. (offline test card.)
8. Alerts and ride board: "Turn on alerts if you would want them." "Would you offer or join a shared ride? What would worry you?"
9. Finish: SUS (10 questions), one open question ("What would make you stop using this?"), and a pointer to the pilot.

Moderator script skeleton (read verbatim so sessions are comparable): welcome; say it is the app being tested, not them; ask permission for notes (no recording stored in Git, see section 7); remind them they can stop any time; scenarios 1-9; thank and explain next steps.

### 4.2 Pilot protocol

- Onboarding message (one paragraph, plain text): what the app is, what is collected (link to the Privacy page and the consent text), how to withdraw, how to report a bug, the pilot end date.
- Ask participants to use Reroute for at least their regular trips (ideally 3 or more per week), even if they also use their usual app. Do not ask them to travel differently. Changing behaviour on request would contaminate the "mode share" measure.
- Day 0: baseline survey (usual mode, trips per week by mode, car access, attitudes).
- Day 7 and day 14: nudge once, identically for all. Record that a nudge was sent; it will affect retention numbers.
- Last day: exit survey and interview invitation.
- Participants who stop using the app are still asked for a 5-minute "why did you stop" call. This is the most useful evidence and the one most often skipped.

### 4.3 Diary study design

Per-trip micro-survey (optional, sent by a link on the "trip logged" success screen or by the team to a private chat): "How did the trip go compared with what the app said? (better, same, worse)", "Did the app change what you did? (yes/no, how)". Weekly: "Was there a disruption this week? What did you do? Which app did you use?" Capture in a survey tool (see analytics doc) keyed only by participant code.

## 5. Success criteria summary

Agree these before launch and write them in a test card.

| Area | Proposed success criterion (assumption) | What a miss means |
| --- | --- | --- |
| Usability | At least 4 of 5 complete tasks 2, 3 and 5 unaided; median SUS 68 or more | Fix the top issues and re-test before the pilot |
| Activation | At least 60% of pilot users log or plan a trip within 24 hours of install | Onboarding problem or no trigger |
| Habit | At least 8 of 25 users plan a trip in each of weeks 2 and 3 (as a count, with the interval) | Novelty only |
| Value | At least 5 users can name a decision the app changed or confirmed | Unproven value |
| Disruption feature | At least 5 real "Journey disrupted?" uses, or a clear statement of why none occurred | Feature may be rarely needed; narrow positioning |
| Trust | Live/estimated/unavailable labels read correctly by most participants | Fix the labels before scale |
| Reliability | No data-loss bugs; crash-free sessions at least 98% (assumption) | Block wider release |
| Willingness to pay | See monetisation doc; any signal from a buyer-type organisation matters more than an individual's stated price | Do not build billing |

## 6. Ethics and consent

The AI cannot decide this. The rules below are what the team should confirm in writing.

- **Is UQ ethics approval needed?** Unknown; check. Research involving human participants at UQ normally needs review under the National Statement on Ethical Conduct in Human Research unless it is exempt or counts as a teaching activity. The distinction usually turns on whether the work is done to produce generalisable knowledge or for publication, versus a class exercise or product test. Ask the COMP1100 course coordinator and the UQ human research ethics office (the university's own guidance decides, not this document). The existing interviews already hold consent records; follow the same approach as the team has used, and ask whether the interview approval or exemption extends to a field pilot that collects location-related behaviour. Record the answer, the date and who gave it in the team folder.
- **Research versus product pilot.** If the team will publish the findings, treat it as research. If it is a private product test that members join knowingly, privacy law (AU Privacy Act) and platform rules still apply but ethics review may not. A grey area: a course project that presents results to investors or at a showcase. When in doubt, get the written answer.
- **Do not begin recruiting until the ethics answer is in writing.** This is a hard gate.
- **Consent text pointers.** Reuse the wording the team already uses for interviews (see the discovery interview records and AGENTS.md rules on evidence) and add field-pilot items: what the app stores on the device and on the server (planned trips, taps, no names), that Google, Translink and other services receive route queries (see the README "Data sources" table), the analytics tool and its region, how long data is kept, how to withdraw and have data deleted, voluntary participation, incentive terms, who to contact (team contact kept outside Git), and that participation is not part of any course assessment. A missing consent statement is undocumented consent; never infer it.
- **Sign-in and consent.** The accounts system adds Google/Apple sign-in. Do not collect analytics until the consent flag is set (analytics doc section 4).
- **Safety.** The ride board puts strangers in contact. Disable posting for the pilot, or restrict it to participants who know each other, unless safety and moderation are settled. Remind participants not to use the app while walking or driving.
- **Vulnerable participants.** Exclude under-18s. Avoid recruiting people who depend on the team (tutors' students, for example).

## 7. Data handling and what stays out of Git

Per AGENTS.md: no participant names, contact details, consent forms, raw recordings or identifiable transcripts in Git. Use participant codes only. The existing code scheme (P0xx, P1xx, P2xx, P3xx, P4xx per member) is for interviews; for the field pilot use a distinct series such as `F01` to `F30` so that field participants cannot be confused with interview participants.

- Keep the code-to-person key, consent records and contact details in a private location outside the repository (access limited to the team members who need it).
- Do not record sessions to files in the repo. If sessions are recorded, store them privately, delete them after notes are made (target within 30 days, assumption), and say so in consent.
- Analytics events carry only a pseudonymous id (hash of the account id with a secret salt) and the participant code is never sent as an event property. The mapping between participant code and pseudonymous id is held privately and destroyed at the end of analysis.
- Location: do not store raw home or work addresses. Trip events carry a coarse area (for example suburb-level or "inside/outside 1 km grid") at most. See analytics doc.
- Findings go to the repository only as de-identified notes (counts, medians, paraphrased themes). Never paste a direct quote that could identify someone; quotes are only to be added if the participant agreed.
- Retention: delete raw survey exports and the code key after analysis plus a short review window (assumption: 90 days after the pilot ends), or sooner on request.

## 8. Distribution

- **Now:** share the HTTPS link (https://mediaserver.taildc527c.ts.net, per the deployment note in the project notes) and the QR at `/qr.svg`. The PWA installs from Safari on iOS (Share, Add to Home Screen) and from Chrome on Android. Push alerts need the app installed on iOS. Check on a real phone each build; the motion and design work has not been tested on a real phone.
- **Deployment caution:** the deployed instance auto-updates from `main` in about two minutes. Freeze a pilot release (a tagged commit, with a stated cutoff) so the pilot population sees the same build. Bump the service-worker `VERSION` whenever app files change, or users see stale versions.
- **Capacity and cost caps:** the app limits Google-backed requests (defaults: 40 plan searches per visitor per hour, 50 plan searches per day in total, 500 autocomplete lookups per day). A 25-person pilot will hit the daily cap of 50 on a busy day. Raise it deliberately (environment variables in `limits.py`/`server.py`) and set a budget alert in Google Cloud first. Say in the plan how much the team will spend.
- **The homelab is a single point of failure.** Record uptime; if the host goes down, the pilot loses data. Tell participants who to contact.
- **Later:** TestFlight (iOS) and Google Play internal testing require wrapping the PWA in a native shell, a developer account (Apple Developer Program and Google Play Console fees, check current pricing) and store review. Only worth it if push on iOS or install friction becomes the blocker. Not needed for 25 users.

## 9. Bug and feedback intake

- In-app: a "Report a problem" link opening a pre-filled form (participant code, app version, screen). Do not auto-attach trip addresses.
- A shared private chat for urgent problems during the pilot.
- A triage table kept by one named owner (not in Git if it contains participant detail; in Git only de-identified issue text): severity 1 (data loss, wrong route that could mislead a trip, crash), 2 (blocks a task), 3 (annoyance). Severity 1 is fixed within 24 hours; Reroute's route advice must carry the existing "check before you travel" caveats.
- Weekly changelog to participants so that they see feedback acted on (improves retention and goodwill, and is recorded as a nudge).

## 10. How to avoid misleading small-n statistics

What 20-30 users can show:
- Whether severe usability problems exist (a handful of users finds most large problems).
- Whether people use it unprompted for real trips at all, and why they stop.
- Rough scale of API cost per active user.
- The shape of qualitative themes (saturation is plausible for a narrow segment).

What it cannot show:
- Population percentages (a recruited convenience sample is not representative; students over-represented).
- Small differences between groups or between features (no power).
- Long-term retention beyond the pilot window, seasonality, or growth rates.
- Causal claims such as "the app caused mode shift" (no control group; self-selection; novelty and observer effects).
- Willingness to pay from stated prices (hypothetical bias).

Rules for the results note:
1. Report counts with denominators ("14 of 24"), not bare percentages. Present percentages only with a 95% confidence interval; use an exact (Clopper-Pearson) or Wilson interval. For example, 14 of 24 is 58% with a Wilson 95% interval of roughly 39% to 76%, which is wide and says little. (Arithmetic is the team's to verify.)
2. Report medians and the range or interquartile range for skewed measures (trips per week, time on task). Do not report a mean with two decimal places. Never average SUS across fewer than 10 people without showing the individual scores.
3. Do not split the 25 into more than two subgroups for any number. Comparisons between PT-dependent and car-available groups are descriptive only.
4. Separate observation, interpretation and recommendation (as the repository's evidence rules require). Mark anything the AI summarised as pending human review of the source.
5. Count drop-offs. Active users only is survivorship bias; always show the denominator of all installers.
6. Declare the nudges, the incentive, the recruitment channels and the exam-period timing as limits.
7. Declare that the logged-trip data is planned trips, not verified travel (the README states that the impact history counts planned trips). Self-reported mode share and logged intentions are different things.
8. Do not call any metric "validated" or any hypothesis "supported" on this sample alone. Use the repository's labels (provisionally supported, uncertain, refuted for the sample).

## 11. What to be honest about with investors

- The product is a prototype that is not participant-tested in the field as of this date; the first evidence is from fictional-scenario interviews.
- Sample: 20-30 recruited, mostly UQ-adjacent volunteers, with incentives. Not a market validation.
- CO2 figures use assumed emission factors and a driving baseline that the user sets; "CO2 avoided" is an estimate of avoided car emissions only when the trip would otherwise have been driven, which the app cannot know.
- Retention numbers cover at most four weeks; show the raw cohort table, not a smoothed curve.
- Unit economics rest on Google Maps Platform pricing that can change, and on a data licence and terms that restrict some uses (see monetisation doc).
- No customer has paid. Any buyer interest should be reported as interest, with names withheld unless they agreed.
- Show failures and drop-offs alongside successes. An investor who finds the cherry-picked number will discount everything else.

## 12. Review tasks for the team

1. Get the ethics answer in writing (section 6).
2. Agree thresholds in section 5 and create test cards for H-P14, H-P15, H-P17 and H-P18, which have no card yet.
3. Decide whether the ride board is switched off for the pilot.
4. Decide the budget for incentives and Google API costs, and the owner of bug triage.
5. Verify the analytics consent flow exists before enrolling anyone (see the analytics doc TODO list).
