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

### Step B3 done (13:10)

**What changed** (commits `e6adb02` and `9e2f1b9` on `feature/design-fixes`):
- **Quieter CO₂** (`app.js` `makesIt`, `lowestCo2`, `co2Block`, `co2Summary`; `app.css`):
  - `makesIt` (on time when a deadline is set, and no disruption) moved up beside the CO₂ helpers, so the sort from B1 and the CO₂ cues use one definition.
  - `lowestCo2` now chooses only among options that make it. So the Lowest CO₂ badge and the summary never go to a late or disrupted option. With no option that makes it, neither appears. When it leaves options out, it reports that through a new `filtered` flag.
  - The badge is outline-only (`.badge.outline`, which replaces `.badge.solid`): no fill, green text, and a 45% green 1 px border.
  - The summary is now one muted text line with a small green leaf, not a green box. When options were left out, its wording says so: "Greenest of the options on time with no disruption: **412**, about 380 g less CO₂ than driving the same trip alone (51% less)." Or: "Driving alone has the lowest CO₂ of the options on time with no disruption (about 740 g)." The wording also changed from "saves about" to "about … less CO₂ than", which is comparative rather than an impact claim.
  - On option cards, an option that misses shows its CO₂ as one muted line (`.co2-mini`, for example "440 g CO₂ less than driving") instead of the tinted strip. In the detail sheet, it keeps the full strip with its basis line, but in the neutral tone, so the sheet still says where the number comes from.
- **Layout** (`app.js` `resultsScreen`; `app.css` `.none-fit`): the "No option meets all your limits" card (icon, heading and paragraph) is now one amber tinted line. It names what still arrives on time, for example "No option meets every limit. On time: Drive." It names at most two options, then "+N". If nothing arrives on time it says "None arrives on time."
- **Result:** with a deadline at 390×844, the first arrival time's bottom edge moved from 815 px to 566 px when no option fits, and sits at 535 px when some fit. At 320×640 it is at 638 px and 571 px.
- `sw.js` VERSION is now `planb-reroute-11`. `README.md` (the "CO2 focus on results" bullet) describes the new rules.

**Tests:** before, 344 passed and 17 subtests passed. After, 344 passed and 17 subtests passed (`python -m pytest apps/plan-b-mvp -q`, using the B1 venv). Nothing was failing before. No test was added: the logic is front-end only and was checked in the browser.

**Other checks:**
- Browser check: an isolated headless Chrome (Playwright from the npx cache) at 390×844 and 320×640, in Dark and Light. The server ran with a dummy `MAPS_API_KEY` on port 8766. There were two hand-built synthetic plans in `state.plan`:
  - "none fit": a disrupted 428 with the lowest CO₂, three late buses, and a Drive over budget but 16 min early;
  - "some fit": the same plus an on-time 29 + 66 and an on-time 412.
- **0 billed Google searches.** The badge went to the 412, not the disrupted 428. In both plans, every late or disrupted card showed the muted line. The 428's sheet showed the neutral strip. There were no console errors.
- Scripts and screenshots are outside the repo in `%LOCALAPPDATA%\Temp\reroute-b3\` (`before-*`/`after-*`, `card-*`, `sheet-*`). The server was stopped afterwards: two `python.exe server.py` processes, the venv launcher and its child.
- The Impeccable detector found 0 layout-scope findings on `app.js` and `app.css`, and no findings on the changed lines in the full scan.

**Decisions I made:**
1. "Misses" means `!makesIt(o)`, the same definition as B1's sort. An option that is on time but over budget or over the walking limit (Drive in the test plan) keeps the full strip in its normal tone, because the decision was about the deadline and disruption.
2. Without a deadline, only disrupted options lose the badge and the full strip. The summary then says "of the options with no disruption".
3. The Lowest CO₂ sort chip still sorts every option by CO₂, disrupted ones included. It is an explicit choice, and its explanation line says what it does.
4. In the detail sheet, an option that misses keeps a full but neutral strip rather than one line. The sheet is where the basis ("300 g for this trip, against 740 g driving alone") belongs, under Principle 3.
5. The one-line message drops "Change a limit deliberately, or choose and verify". Each card's "See why it doesn't fit" still explains its own miss. The message uses "On time", the same wording as B1's sort line just below it.
6. I made the summary a quiet line, not a box, in the same step. Shrinking only the "No option meets" card already brought the arrival time above the fold. But a green box was still the loudest block above the cards, and the decision was to keep CO₂ quieter.

**Skipped, or for Tristan / later steps:**
- In Light, `--warning-text` on `--warning-soft` measures about 4.1:1 (an audit P1). The new one-line message uses the same recipe as the existing amber banners, so it inherits that. The fix belongs to the colour fixes in B4 or B5.
- The next steps "Saves X CO₂ compared with driving" panel and the green "I'm taking this trip" button are still unchanged (B5 polish).
- Start directions under the Journey disrupted? answer and the collapsed driving steps (critique issue 2) were not part of this step.
- The Light screenshots from the first run were still drawn in Dark, because the app's theme setting overrides the system colour scheme. I checked Light separately by setting `data-theme="light"` (`card-412-light.png`, `sheet-428-light.png`).
- The demo-mode API cost line (about 50 px) was not on screen in this check. With it, the first arrival time would still be above 844 px.
- Live searches: none were made.

### Step B4 done (16:09)

**What changed** (commits `28c19f7`, `7fa857d` and `695bebc` on `feature/design-fixes`):
- **Modal layers** (`app.js`: new `syncInert`, `topLayer`, `expandedMap`, `restoreFocus` and a Tab handler; changes to `openMenu`/`closeMenu`, `showDialog`/`closeDialog`, `openSettings`/`closeSettings`, `openSheet`/`closeSheet`, `openPopup`/`closePopup` and the `map-expand` action). The side menu, Settings, sheets, pop-ups, a full-screen map and dialogs are modal. While one is open, the screen, any layer under it and the demo pill are `inert`, and Tab and Shift+Tab wrap inside it. Escape still closes the top one (the existing handler). Focus returns to the control that opened it. If a re-render replaced that control, focus goes to its "twin" (the element with the same `data-*` attributes), and failing that to the heading. `closeMenu` now always returns focus to the logo first, so Settings or a sheet opened from the menu returns there too. A sheet or pop-up that replaces another one keeps the first opener.
- **Screen changes** (`navigate`, `rerender`, `rerenderSettings`, new `focusLead`): a new screen moves focus to its first `h1` or `h2`. Screens without one lead with the Journey disrupted? answer, the directions banner or the area hint. The outgoing page is made inert during the slide. `rerender()` and `rerenderSettings()` now keep focus on the same control (or its twin) instead of dropping it to `BODY`. This replaces the old rule that only restored `data-field` inputs. Without it, the heading focus was lost as soon as a screen re-rendered (for example when Journey disrupted? finds your location) and every Settings switch dropped focus. Lead elements take focus with no outline (`app.css` `[data-lead]:focus`), because they are not controls.
- **Option cards** (`optionCard`): the `aria-label="Details for …"` is gone, so the card body's own text is its accessible name, for example "29 + 66 Bus · Leave by 8:24 am Fits 8:45 am 10 min early $0.50 fare 8 min walk … Arrives 10 min early, no changes, 8 min walking." The card action ("Choose this option", "See why it doesn't fit" or "Open in Uber") has `tabindex="-1"`. Each card is one tab stop (7 stops for 7 cards, down from 14). The action stays clickable and in the accessibility tree, and the sheet the body opens repeats it.
- **Journey disrupted? answer** (`panicScreen`, `panic-go`): the answer box is `role="group"`, `tabindex="-1"`, `aria-labelledby="panic-label panic-lead panic-answer"`, and gets focus when the answer arrives. Its accessible name reads: "BEST WAY NOW Leave by 8:24 am. 66. 8:52 am arrival 3 min before your 8:55 am deadline Arrives before your deadline … Avoids the 412 · Translink alert · Simulated Running to schedule". Coming back to it from See other options also focuses it.
- **Contrast** (`app.css`):
  - Dark `--accent` #6366F1 → #575AF0 (same hue and saturation): white text 4.47:1 → 5.09:1, and 4.53:1 in the 8% brighter hover state. As a non-text colour it stays at 3.16:1 or more on every Dark surface.
  - The Plan a trip sentence lost its `opacity: 0.88` (it was 3.84:1).
  - Placeholders, `.ac-foot` (the "Suggestions by Google Maps" line), pending `.area-progress` steps and `.map-skeleton` now use `--text-muted` instead of `--text-faint`. The token is unchanged and is left only on decorative marks and disabled steppers.
  - Light `--warning-text` #B45309 → #92400E and `--success-text` #047857 → #065F46. Text on the 10 to 15% tints over base, surface and card is now at least 5.11:1 (amber) and 5.50:1 (green); it was 3.62 to 4.46:1. The tint tones are unchanged.
- **Docs:** `DESIGN.md` has the new token values, the Faint Slate and status-text wording, the Plan a trip sentence, a "Focus between screens and layers" rule under Navigation, the option card's tab stop and name, and an appendix section "Contrast fixes (2026-10-27)" with before and after ratios. `.impeccable/design.json` has the matching canonical and OKLCH values (tonal ramps left as generated) and the component CSS fallbacks. `apps/plan-b-mvp/README.md` has a focus-management bullet and a limitation line.
- `sw.js` VERSION is now `planb-reroute-12`.

**Tests:** before, 344 passed and 17 subtests passed. After, 344 passed and 17 subtests passed (`python -m pytest apps/plan-b-mvp -q`, using the B1 venv). Nothing was failing before. No test was added: the changes are browser-only and were checked in the browser.

**Browser check:** an isolated headless Chrome (Playwright from the npx cache) at 390×844, Dark and Light. The server ran with a dummy `MAPS_API_KEY` on port 8766. `/api/plan` was answered with B2's synthetic panic plan, the results came from B3's "somefit" plan, and `/api/autocomplete` and `/api/place` were stubbed. **0 billed Google searches.** By keyboard:
- Menu: focus moved to Close, 25 Tabs and 25 Shift+Tabs never left it, and the page and demo pill were inert. Escape returned focus to the logo.
- Settings: opened from the menu, focus went to Done, and 60 Tabs never left it. Toggling a switch kept focus on it. Escape returned focus to the logo.
- Profile dialog: focus moved to OK, Tab stayed inside, and Escape returned focus to the avatar.
- `navigate`: Plan a trip focused "Where are you going?", Back focused the home `h1`, and results focused "Your options".
- Results: 1 tab stop on each of the 7 cards. The sheet trapped 40 Tabs each way, and Escape returned to the same card.
- Full-screen map: driven through its action, because the expand button is not focusable without a browser map key. The map became the top layer with the sheet and page inert, and Escape restored them.
- Journey disrupted?: keyboard "Get me there" led to focus on the answer (accessible name above). See other options then Back returned focus to the answer, with one plan request.

There were no console errors. The rendered-page Impeccable detector on home reported no contrast findings, only the known items (the dark glow, Inter, the eyebrow, nested cards and the h1→h3 skip). The source scan found nothing on the changed lines. Scripts, results and screenshots are outside the repo in `%LOCALAPPDATA%\Temp\reroute-b4\`. The server was stopped afterwards: the two `python.exe server.py` processes behind port 8766 (the venv launcher and its child) were stopped by PID. A broader stop command was blocked by the permission classifier.

**Decisions I made:**
1. **"One tab stop per card" means the body.** The body is the stop because its text describes the option. The action is skipped by Tab rather than removed or hidden, so pointer and screen-reader browse users can still use it, and keyboard users reach Choose or Open in Uber in the sheet with one more key press. The alternative, which keeps two stops on cards whose two actions differ, would not meet "one tab stop" as asked.
2. **The card's name is its whole text**, as the instruction said ("remove the aria-label"), not a shorter `aria-labelledby`. The name is long, but it carries the reasons and the Simulated labels that a shorter name would hide (a button's children are presentational).
3. **"Announce" the answer by focusing it with a content-based name** rather than with a live region. A newly inserted live region is often not read, and doing both would read the answer twice.
4. **The trap uses `inert` plus a Tab wrap**, not the native `<dialog>`, so the existing markup, animations and drag-to-close stay as they are. The demo pill is inert while a layer is open, because the layer is modal. It still floats above sheets, so it can't be tapped until the layer closes. The connection banner stays outside the inert set so that it can still announce.
5. **A full-screen map counts as a layer**, because it covers the sheet or screen it came from. Without that, the Tab wrap would have pulled focus back under it.
6. **Focus restore after in-place re-renders** (`rerender`, `rerenderSettings`) was needed for "focus the heading in navigate()" to last, so I included it. It finds the same control by its `data-*` attributes, or else the heading.
7. **Leading elements have no focus outline.** They are not controls (WCAG 2.4.7 covers operable components), and a ring around a heading on every screen change would be noise.
8. **Contrast: the smallest token changes that pass with a margin.**
   - Dark accent: the first same-hue step at which the hover state also passes. #5B5EF0 would pass at rest (4.88:1) but fail on hover (4.33:1).
   - Light amber and green: the next step down in the same Tailwind scales (amber-800 and emerald-800), as the audit suggested. That gives at least 5.1:1 on every tint recipe, including the 15% tint on base and the red-tinted Journey disrupted screen.
   - `text-faint`: the usages changed, not the token, so the decorative tier stays distinct.
   - Light `error-text` was not changed. It already measures 4.54:1 or more on its tints.

**Skipped, or for Tristan / later steps:**
- These audit P2 and P3 items are outside this step: skipped heading levels (home h1→h3, and the Journey screen's only `h2`), `transition: all` and the picker pin's layout animation, field edge contrast, the hero pin overlap, hard-coded colours and Light shadows, the incomplete DESIGN.md scales, and the segmented control's missing group name.
- The search loading state is still not announced. The button is disabled, with visible text and `aria-busy`. While the search runs, focus sits on the Journey disrupted? heading (the disabled button can't hold it), then moves to the answer.
- On a search error, focus stays on that heading and the error banner announces itself (`role="alert"`).
- `accent-soft`, `accent-glow`, `border-focus` and `--chart` still mix from #6366F1. The difference can't be seen. DESIGN.md records it.
- With no working browser map key, the full-screen map's focus behaviour was checked only through its action, not with a real map's keyboard controls. Nothing was checked with a real screen reader or on a phone.
- Live searches: none were made.

### Step B5 done (16:48)

**What changed** (commits `f787402`, `618e3c4`, `f7dc318`, `125c9a4` and `d940235` on `feature/design-fixes`):
- **Polish fixes** (`apps/plan-b-mvp/app.js`, `app.css`):
  - Next steps: the eyebrow says "Route chosen" instead of "Route confirmed", because the route is a Google estimate. The impact panel says "About 290 g less CO₂ than driving (estimate)" instead of "Saves 290 g CO₂ compared with driving", which matches the B3 results wording and the B2 logged state. "I'm taking this trip" is a secondary button instead of a filled green one (the One Signal Rule), so Start directions is the only filled action in the stack. The unused `.btn-success` style was removed.
  - Journey disrupted?: when the answer arrives it is scrolled to the top. Before, `rerender()` kept the form's scroll position, so at 320×640 the "Leave by 8:24 am. 66." line was hidden under the header. At 320 px, "arrival" now sits on the time's baseline (`.when` is a wrapping flex row) instead of dropping about 50 px below it.
  - Results: the outline Lowest CO₂ badge wraps under the CO₂ strip's text instead of squeezing it into a three-line column ("380 g CO₂ less / than driving").
  - Impact Dashboard: the by-mode breakdown uses the same g/kg formatter as the hero ("290 g", not "0.3 kg" beside "290 g").
  - Reduced motion: the rules also set `animation-delay: 0ms`. Before, inline stagger delays stayed in place with `backwards` fill, so under reduced motion the seventh result card stayed invisible for about 330 ms. Checked: with `reducedMotion: reduce`, all 7 cards were at opacity 1 within 450 ms; with full motion they still stagger.
  - `sw.js` VERSION is now `planb-reroute-13`.
- **DESIGN.md:** no token changed in B5, and B4's tokens were already recorded. The component text now matches stage B: loading buttons with words; the Journey disrupted? answer (baseline "arrival", buffer line, avoided-disruption pills); the CO₂ strip only on options that make it, with a muted line or a neutral sheet strip otherwise; the outline Lowest CO₂ badge; the "Price unknown" and "Best way now" info badges; the one-line "No option meets every limit" strip; the quiet CO₂ summary; next steps with a single filled action; no stagger under reduced motion.
- **Critique snapshot:** `critique-storage latest` marked `.impeccable/critique/2026-10-26T21-49-09Z__apps-plan-b-mvp.md` as `closed: true`, because the target had changed since the critique. All five of its P1s were handled in B1 to B4. Only that front-matter line changed.
- **AI-use log:** a new entry in `docs/team/ai-use-log.md` for this unattended run (steps B1 to B5).

**Tests:** before, 344 passed and 17 subtests passed. After, 344 passed and 17 subtests passed (`python -m pytest apps/plan-b-mvp -q`, using the B1 venv). Nothing was failing before. No test was added: the changes are front-end only and were checked in the browser.

**Browser check:** an isolated headless Chrome (Playwright from the npx cache) at 390×844 in Dark and Light, and at 320×640 in Dark. The server ran with a dummy `MAPS_API_KEY` on port 8766. `/api/plan` was answered with B2's synthetic panic plan, the results came from B3's "somefit" and "nonefit" plans, and `/api/autocomplete` and `/api/place` were stubbed. **0 billed Google searches.** It covered Plan a trip, results (some fit and none fit), a miss's detail sheet, next steps before and after logging, the dashboard with one trip and empty, the Journey disrupted? loading state and the answer. Before and after screenshots, the script and the detector output are outside the repo in `%LOCALAPPDATA%\Temp\reroute-b5\`. There were no console errors and no horizontal overflow. The Impeccable detector found 108 findings in `app.js` and `app.css`, against 115 in the critique. They are the known DESIGN.md scale gaps, Inter and `--spring`. The only hit on a changed line was the existing 14 px "arrival" size. The server was stopped afterwards, and port 8766 is free.

**Decisions I made:**
1. "Route confirmed" became "Route chosen". The critique flagged it as reading like a verification of a Google estimate, and PRODUCT.md says estimates stay labelled. B1 had already used "Route chosen · …" for the other states.
2. The green "I'm taking this trip" button became secondary, not indigo. Start directions is already the primary action, and two filled indigo buttons would compete.
3. I fixed the stagger under reduced motion even though it predates stage B. The step rule is to respect reduced motion, and the results cards are one of this step's screens.
4. I kept the critique snapshot's `closed: true` marker that the tool wrote, rather than reverting it, because every priority issue it listed has been addressed.

**Skipped, or for Tristan:**
- **review-animations:** Emil Kowalski's `review-animations` skill can't be started by an agent (it is marked for user invocation only), so it was not run. Run `/review-animations` on `apps/plan-b-mvp/app.css` yourself if you want that review. The motion that changed in stage B: the new `.none-fit` entrance (`fbIn`, 0.3 s ease-out), the CO₂ summary losing its entrance, the outgoing page made inert during the push, and the reduced-motion delay fix.
- **`.impeccable/design.json`** is stale against DESIGN.md (Impeccable reports `design-sidecar-stale`). Its component snippets don't describe the stage B parts. Run `/impeccable document` to refresh it. I didn't, because Impeccable says not to repair drift as a side effect.
- **Not clear defects, or product and content calls:** "Running to schedule" beside "No live data" for the same bus in the synthetic answer (the critique's heuristic 1); the map fallback that names `MAPS_BROWSER_API_KEY`; the empty dashboard's icon tile above its heading; the money chart's $0/$3/$5 axis when every saving is unknown; the toast covering the dashboard's last notice for a few seconds.
- Live searches: none were made.

## Stage B complete

**Summary of every change across B1 to B5** (branch `feature/design-fixes`; nothing pushed, merged or opened as a PR):
- **B1, deadline-first ranking** (`live_routes.py`, `offline.js`, `app.js`, `manifest.webmanifest`, tests):
  - An unknown price is its own state ("Price unknown" badge, "· price unknown for N", "$X+" for a part-known cost) and no longer fails an option.
  - With a deadline, Best fit and Public transport first put the options that arrive on time with no disruption first.
  - `recommend()` prefers the most spare time when the easiest on-time option leaves fewer than 10 minutes.
  - "FASTEST WAY NOW" became "BEST WAY NOW", and the home line became "Get the best working way there now — on time first, no decisions."
- **B2, clarify** (`app.js`, `app.css`):
  - The Journey disrupted? answer shows the buffer against the deadline (including "tomorrow"), "Avoids the 412 · Translink alert · Simulated" pills and visible loading text. "See other options" keeps the answer in the back stack and marks it "Best way now".
  - The Impact Dashboard uses estimate wording throughout, shows "Unknown" instead of $0, uses "about the CO₂ of driving N km", names the team's default 10 kg goal, counts only finished weeks in the streak, drops the "Not driving %" KPI, uses "planned" trips and leads with the empty state.
- **B3, quieter and layout** (`app.js`, `app.css`):
  - The Lowest CO₂ badge, the summary and the full CO₂ strip go only to options that make the deadline with no disruption. The badge is outline-only. Misses get one muted line on their card.
  - The summary is a quiet line, and "No option meets every limit. On time: …" is one line. The first arrival time is now above the fold.
- **B4, harden** (`app.js`, `app.css`, DESIGN.md, `design.json`, README):
  - Modal layers are inert, Tab wraps inside them, and focus returns to the opener. A new screen focuses its heading, and focus is kept through re-renders.
  - Each option card is one tab stop and is named by its own text. The disrupted answer gets focus when it arrives.
  - Contrast: Dark `--accent` #575AF0, the Plan a trip sentence at full opacity, `text-muted` for readable faint text, and Light `--warning-text` #92400E and `--success-text` #065F46.
- **B5, polish** (`app.js`, `app.css`, DESIGN.md, AI-use log): "Route chosen", the estimate wording on next steps, a secondary "I'm taking this trip", the disrupted answer at the top and at 320 px, the CO₂ badge wrap, consistent g/kg, no stagger under reduced motion, DESIGN.md component text, and the AI-use log entry.
- `sw.js` went from `planb-reroute-8` to `planb-reroute-13`, once per step that changed cached files.

**Skipped across stage B, and why:**
- **Product calls for Tristan:**
  - `recommend()` ignores the walking and cost limits, so with the new rule it can pick an option over the walking limit when that option has more spare time (B1).
  - An unknown walking time still fails (B1).
  - "My car" is on by default, and Uber is never recommended (B2).
  - There is no log-after-travel flow. Trips are called "planned" instead (B2).
  - The critique's question 4 on the dashboard's streak and ring is still open (B2).
- **Out of scope by Tristan's decision:** the P2 demo pill overlap and its scenario name.
- **Audit P2 and P3 items not in stage B:**
  - skipped heading levels (home h1→h3);
  - `transition: all` and the picker pin's layout animation;
  - field edge contrast;
  - the hero pin overlap;
  - hard-coded colours and Light shadows;
  - DESIGN.md's incomplete type and radius scales;
  - the segmented control's missing group name;
  - `--spring` on `.area-box`.
- **Critique issue 2 extras not done:** collapsing the driving steps under the disrupted answer. Start directions already sits under the steps.
- **Search state:** the loading state is not announced to screen readers. The button shows text and has `aria-busy`.
- **Tooling:** `review-animations` could not be run by the agent. `.impeccable/design.json` needs `/impeccable document`.
- **Live Google searches:** none in any step, so live routes, real maps and Places were never rendered.

**Final test results:** `python -m pytest apps/plan-b-mvp -q` gave 344 passed and 17 subtests passed. It was 339 passed before B1, and nothing failed at any point. The five new tests are in `test_live_routes.py` and `test_plan_v3.py`.

**Check on your phone** (install or open over HTTPS so the service worker picks up `planb-reroute-13`; a hard refresh may be needed):
- [ ] **Dark:** the home "Journey disrupted?" line, the Plan a trip button text on indigo, the results with a deadline (the first arrival time above the fold, the "No option meets every limit" line, the outline "Lowest CO₂" badge wrapping under its text, and muted CO₂ lines on late cards), next steps ("Route chosen", one filled action) and the dashboard (estimate wording, "Unknown" saved, the team-default goal).
- [ ] **Light:** the same screens. In sun, check that amber "N min late", "Tight" and "Check" and green "Fits" and "0 kg" read clearly on their tinted chips, and that the field edges on Plan a trip are visible enough (audit P2, not fixed).
- [ ] **Real Google maps and routes** (a few billed searches): a Plan a trip search with a deadline 10 to 15 min away. Check that the ranking puts on-time options first, that an Uber or Drive with an unknown price shows "Price unknown" rather than "Check", that the map's Google logo and attribution aren't covered, and that the full-screen map traps focus and Escape closes it.
- [ ] **Journey disrupted?** with demo mode's bus disruption: the loading text, the answer's buffer line and "Avoids … · Simulated" pill, the answer starting at the top on a small phone, See other options with the "Best way now" card, and Back returning to the answer without a new search.
- [ ] **Screen reader** (VoiceOver on iPhone, TalkBack on Android): each result card reads as one item with its arrival, status and reasons. The disrupted answer is read when it arrives. Opening and closing the menu, Settings and a sheet returns you to where you were. A new screen starts at its heading. Check whether the long card names are acceptable or too long.
- [ ] **Reduced motion:** turn on the system Reduce Motion setting (and separately try the in-app setting). Screen pushes, sheets and the menu should be near-instant, all result cards should appear at once, and the shimmer, live-dot ping and Journey disrupted? pulse should stop.
- [ ] **Keyboard** (a Bluetooth keyboard or desktop): Tab never reaches the page behind an open menu, sheet or dialog. On results there is one stop per card, and Enter opens its sheet.
- [ ] **Review the AI's own decisions** in B1 to B5 above, especially the 10-minute close-deadline threshold, removing "Not driving %", and "Route chosen".
