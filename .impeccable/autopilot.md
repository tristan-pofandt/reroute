# Autopilot log (unattended Impeccable workflow, 27 Oct 2026)

Runner: `C:\Users\tpofa\.claude\autopilot\` (session-bound timer started from a Claude Code CLI session). Nothing is pushed, merged or opened as a PR.

## Stage A complete (10:51)

- Critique snapshot: `.impeccable/critique/2026-10-26T21-49-09Z__apps-plan-b-mvp.md` (24/40, five P1s).
- Decisions were answered by Tristan before leaving; they're in the snapshot's "Decisions" section. Action plan: the snapshot's "Action plan (in order)".
- Note: the stage-A prompt was truncated by a quoting bug in the runner (fixed at 12:40; prompts now go via stdin).

## Stage B plan (branch `feature/design-fixes`, from `feature/impeccable-context`)

| Step | Impeccable commands | Critique issues | Effort |
|---|---|---|---|
| B1 | shape + build | 1, 2: unknown price as its own state, deadline-fit sort, `recommend()` prefers buffer near the deadline; update `test_plan_v3.py` / `test_live_routes.py`; check the "FASTEST WAY NOW" wording | xhigh |
| B2 | clarify | 2, 4: Journey disrupted? answer content; Impact Dashboard honesty | high |
| B3 | quieter + layout | 3, 1: CO₂ only on options that make the deadline; first arrival above the fold; one-line "No option meets…" | high |
| B4 | harden | 5 + audit P1s: card tab stops and labels, announce the disrupted answer, focus trap in panels, focus on navigate, contrast fixes | xhigh |
| B5 | polish + review-animations | Final pass, DESIGN.md if tokens changed, ai-use-log entry, summary and phone checklist | high |

## Progress

### Step B1 done (12:52)

**What changed** (commits `24908ef` and `9acab78` on `feature/design-fixes`):
- **Unknown price as its own state** (`live_routes.py` `_limits`, mirrored in `offline.js` `limits`): an unknown price no longer adds a failed cost reason, so it no longer makes an option miss its limits. `cost_known` stays false and `cost_unknown_text` explains why. A known part of the cost that is already over the budget (for example fuel without parking) still fails. In `app.js`, the badge reads "Price unknown" (the existing indigo `badge info` style used for "Simulated"). The results count adds "· price unknown for N". The trade-off line shows the reason. The sheet header reads "Fits your other limits · price unknown", and its cost check shows the neutral dash with "Unknown". When only part of the cost is known, it shows "$X+", and that part fails the check if it is over the budget. Next steps says "Route chosen · price unknown" in the amber confirm style instead of "Route confirmed".
- **Deadline-fit sort** (`app.js` `sortedOptions`, `SORT_WHY_DEADLINE`, `makesIt`): when a deadline is set, Best fit and Public transport first put the options that arrive on time with no disruption first. Public transport first only reorders inside that group, and the rest follow by earliest arrival. The sort explanation line describes this. Without a deadline, and for the Earliest, Cheapest, Least walking and Lowest CO₂ sorts, nothing changed.
- **`recommend()`** (`live_routes.py`, mirrored in `offline.js`): it still uses only undisrupted options, on time first, with public transport preferred. If the least-effort on-time option would leave fewer than `CLOSE_BUFFER_MIN` = 10 spare minutes, the option with the most spare minutes wins and effort only breaks ties. The reason then ends "…, the most time to spare of the options that are on time". With 10 or more spare minutes, or no deadline, the least-effort rule is unchanged.
- **Wording (part e):** the new rule is not always the fastest, so "FASTEST WAY NOW" becomes "BEST WAY NOW". The home line becomes "Get the best working way there now — on time first, no decisions." The same wording now appears in the button's accessible name, the hidden loading label ("Finding the best working option", which also drops the word "safe") and the `manifest.webmanifest` shortcut description.
- `sw.js` VERSION is now `planb-reroute-9`. `README.md` describes both rules.
- **Tests:** in `test_live_routes.py`, the unknown-fare test now expects fits, and the paid-parking test now expects fits. There is a new test for a known part-cost over budget, and the Uber test now expects fits. Three new `recommend()` tests cover a close deadline, plenty of time, and a tie in spare minutes. In `test_plan_v3.py`, a new demo-mode test checks that the most-spare-time rule never brings back a disrupted option.

**Tests:** before, 339 passed and 17 subtests passed. After, 344 passed and 17 subtests passed (`python -m pytest apps/plan-b-mvp -q`). Nothing was failing before. Note: pytest isn't installed in the system Python 3.13, and the repo `venv` points at a missing Python 3.14. I ran pytest from a throwaway venv outside the repo (`%LOCALAPPDATA%\Temp\reroute-pytest-venv`, which uses the system site packages). Later steps can reuse it.

**Other checks:**
- A Node check (outside the repo) confirms that `offline.js` `limits`/`recommend` and the new `app.js` sort give the expected results on synthetic options.
- Browser check: an isolated headless Chrome at 390 px, because the Playwright MCP browser was locked by another process. The server ran with a dummy `MAPS_API_KEY`, and `/api/plan` was answered with synthetic plans built by `live_routes.plan` from the test fakes. **0 billed Google searches.** I saw the home line, the results count and sort line, the "Price unknown" badge on the Uber and Drive cards, the drive sheet ("$1.44+"), next steps, and the Journey disrupted? answer. There, the old rule would have picked a 414 with 0 min to spare; the new rule picks a 29 + 66 with 10 min. There were no console errors, and the server was stopped afterwards.
- The Impeccable detector on `app.js` found only the 3 known inline-style radius false positives.

**Decisions I made:**
1. "Close" means the easiest on-time option would leave fewer than 10 spare minutes, which is twice the "Tight" badge's 5. This is a team assumption, not a measured value. When the deadline is close, "most buffer" and "earliest arrival" pick the same option, and spare time is counted in whole minutes, so effort breaks ties within a minute.
2. "Makes the deadline" for sorting means arriving on time with no disruption flag. That is the same definition the CO₂ decision uses, so step B3 can reuse `makesIt`.
3. The deadline-fit order applies to the two default sorts, Best fit and Public transport first. The other four sorts are explicit choices and stay as they were.
4. Public transport is still preferred inside `recommend()`. Tristan's decision changed only the effort rule.
5. An unknown price counts as fitting, so it can take the top card's green "best" ring under Best fit. Its own badge and the count line keep it honest. Marking the earliest on-time option is left to B3.
6. I reworded the label rather than making the rule always pick the earliest arrival, so that the "when the deadline is close" part of the decision stays.
7. Historical logs (`docs/product/reroute-refinements-log-2026-10-22.md` and the v2 feature log) still quote the old wording, as dated records. I didn't edit them.

**Skipped, or for Tristan:**
- `recommend()` still ignores the walking and cost limits, as it did before. With the new rule, it can now pick an option that is over the walking limit when that option has more spare time. In the browser check, the 29 + 66 has 11 min walking against a 10-min limit, chosen over a 414 that fits but has 0 min to spare. Whether a user limit should outrank spare time when the deadline is close is a product call.
- An unknown walking time ("Walking time unavailable") is still a failed limit. The step asked only about price.
- These belong to later steps and were not touched: the CO₂ summary and badge on disrupted or late options (B3), "Route confirmed" for estimates (B2/B5), and the deadline buffer and avoided disruption on the Journey disrupted? answer (B2).

### Step B2 done (13:03)

**What changed** (commits `997d9c7` and `24fb02e` on `feature/design-fixes`):
- **Journey disrupted? answer** (`app.js` `panicScreen`, new `deadlineLine`, `avoidedFacts`, `searchingText`; `app.css`):
  - Under the arrival time, a line gives the spare time against the deadline in the buffer colours: "3 min before your 8:55 am deadline", "Arrives right at your … deadline" or "N min after your … deadline". It adds "tomorrow" when a "by" time that had already passed was moved to the next day, so that rollover is no longer silent.
  - A fact pill names each disrupted option the answer avoids, with its reason and Simulated label, for example "Avoids the 412 · Translink alert · Simulated". At most two are shown, then "N more disrupted". It is left out when the answer is itself disrupted, because then nothing was avoided.
  - Both search buttons (Get me there and Show routes) now show visible text while loading: "Checking routes and live services…", or "Checking the offline timetable…" in offline mode. The shimmer stays.
  - "See other options" no longer resets the stack to Home. Results open on top of the answer, Back returns to it, and no second search is made. `navigate()` skips the re-locate when coming back to a finished answer. The answer is drawn only for the plan it came from (`state.panic.plan`), so a later search falls back to the form instead of showing a different plan's pick.
  - In those results, the answer's card has a second badge, "Best way now" (indigo `badge info`, bolt icon), stacked under its status badge (`.card-badges`).
- **Impact Dashboard** (`app.js` `dashboardScreen`, `impactTotals`, `weeklyStreak`, `goalCard`, `equivalentCard`, `streakCard`, `impactPanel`, home tile, Settings row, `log-trip` toast):
  - The hero reads "Estimated CO₂ avoided … vs driving the same trips alone". The subtitle says these are estimates for planned trips, not measured travel. The chart and table headings say "Estimated" too.
  - Saved shows "Unknown" when every logged saving is unknown (new `unknownSaved` count and `savedText`), on the dashboard, its table and the home tile. With some unknown, the KPI says "vs driving · N unknown". The money chart says trips with an unknown cost are left out.
  - The km line reads "This month's estimate is about the CO₂ of driving 1.8 km in your car" and "About N km of driving in total".
  - The goal is named "the team's default goal of 10 kg … It is an assumption, not a target you set" while it equals the default (`goalText`). That covers the goal card, the ring's label, next steps, the empty state and the Settings row ("Starts at the team's default of 10 kg").
  - Streak: only finished weeks count. The current week shows "This week so far: N planned trips, none by car" and counts once it ends. A car trip logged this week still ends the streak at once. The fine print says logged trips are plans, not checked travel.
  - The "Not driving N%" KPI is gone. The row is now Saved / Trips (planned) / Not by car (N of M). Home's "low-car trips" became "planned not by car".
  - With no trips, only the subtitle, the empty-state message and the estimates notice show, with no cards of zeros.
  - Units: the toast and goal card now use the same formatter as the hero ("330 g" rather than "0.3 kg" beside "330 g").
- `sw.js` VERSION is now `planb-reroute-10`. `README.md` describes all of the above.

**Tests:** before, 344 passed and 17 subtests passed. After, 344 passed and 17 subtests passed (`python -m pytest apps/plan-b-mvp -q`, using the B1 venv). Nothing was failing before. No test covers these front-end strings, and no test was added: the logic is browser-only and was checked in the browser.

**Browser check:** the Playwright MCP browser was locked again, so I used an isolated headless Chrome (Playwright from the npx cache) at 390×844, Dark. The server ran with a dummy `MAPS_API_KEY`, and `/api/plan` was answered with a synthetic plan from `test_plan_v3`'s fakes (the 412 is disrupted and simulated, the 66 is recommended, deadline 8:55). **0 billed Google searches.** I saw the loading text, the answer ("3 min before your 8:55 am deadline", "Avoids the 412 · Translink alert · Simulated"), the "Best way now" badge in See other options, and Back returning to the answer with one plan request in total. On the dashboard I saw the empty state, then one bus trip with an unknown saving ("Unknown", the default-goal wording, the km wording, and "No streak yet" with this week so far). There were no console errors. Scripts and screenshots are outside the repo in `%LOCALAPPDATA%\Temp\reroute-b2\`. The server was stopped afterwards. The stop command matched two `python.exe server.py` processes, which I took to be the venv launcher and its child.

**Decisions I made:**
1. "Fix the streak logic" means the current week counts only once it has ended, so one trip logged before travelling can no longer make a "1 week" streak. I kept the streak rather than removing it. Tristan's decision was to fix it.
2. Logged trips are called "planned" in copy. I didn't add a log-after-travel flow, because that is a new feature and a product decision.
3. I removed the "Not driving %" KPI. With a few logged trips it overclaims ("100%"), and it repeated the count beside it. Replacing it with "Trips: N planned" was the smallest honest swap.
4. "Team default" is detected as goal == 10 kg. A traveller who deliberately sets 10 kg will still see "team's default", which remains true.
5. The empty state hides the goal, km and streak cards entirely, rather than showing them below the message. Change goal is still in Settings.
6. The pick badge appears only when the results belong to the same plan as the answer (`state.plan === state.panic.plan`). It uses `badge info`, the indigo already used for "Simulated" and "Price unknown", because the One Signal Rule rules out red or green for "act here".
7. Loading text is plain text in the button, which keeps the shimmer. The step asked for visible text. I didn't add an announcement, which is B4's job.

**Skipped, or for Tristan / later steps:**
- The critique's other issue-2 fixes were not in this step's list: putting Start directions right under the answer and collapsing the driving steps (B3 layout or B5), and Uber never being recommended while "My car" is on by default (product call).
- Announcing the answer and moving focus to it (B4 harden). The loading text is not announced to screen readers yet. The button is disabled with `aria-busy`.
- The "Saves X CO₂ compared with driving" panel on next steps and the green "I'm taking this trip" button are unchanged (B3 quieter / B5 polish).
- The dashboard's eyebrow labels and the ring are the existing DESIGN.md anatomy and were kept. The critique's question 4 (a dashboard with no streak or ring) remains open for Tristan.
- Live searches: none were made.
