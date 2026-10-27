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
