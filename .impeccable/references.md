# Reroute motion and style references

Status: partial. Research hit a session limit after the skill search and two web searches. Entries below come from those searches plus general knowledge of the apps. All timings are INFERRED starting points to tune by eye, not measured values. Borrow ideas only, never assets or code. No gallery (Mobbin, Refero, Godly, etc.) was browsed.

Reroute reference: dark "Night Dispatcher", Platform Indigo accent, `--push` / `--ease-out` / `--spring` easings, 380 ms pushes, 420 ms card entrance, 40 ms menu stagger.

## 1. References

| Name and link | What to borrow | Reroute surface |
|---|---|---|
| Apple Maps sheet (iOS 26 floating) - [Expo write-up](https://expo.dev/blog/how-to-create-apple-maps-style-liquid-glass-sheets) | Three detents (peek / medium / full). Sheet floats with an inset gap at peek, gap closes toward full, corner radius shrinks with it. Persistent sheet, never dismissed. Snap spring ~ stiffness 250, damping 25, mass ~1 (from [BottomSheet lib](https://github.com/Wouter125/BottomSheet)); low bounce. Rubber-band past the ends. | Directions bottom sheet |
| Open-source Maps-style sheets - [FramerBottomSheet](https://github.com/NocheVolta/FramerBottomSheet), [UBottomSheet](https://github.com/via-thailand/UBottomSheet) | Pan-to-scroll hand-off: inner list scrolls only when sheet is at top detent; velocity-projected snap (flick picks next detent). Spring damping ~0.75 for state changes (Framer lib default). | Directions bottom sheet |
| Citymapper - https://citymapper.com | Mode filter chips and "Get me somewhere" prompt (praised in [Pratt critique](https://ixd.prattsi.org/2026/02/design-critique-citymapper-ios-app/)). Borrow: route options as compact cards with coloured mode strips, live countdown that ticks without layout shift. Inferred: ~200 ms ease-out on card reorder when ETAs change. | Option cards, journey disrupted panel |
| Transit app - https://transitapp.com | Opens straight to nearby lines with live wait times (per search review). Borrow: big tabular countdown numbers as the hero, route-colour chips. Inferred: number roll or crossfade ~150 ms on update. | Cards, CO2 dashboard numbers |
| Google Maps - https://maps.google.com | Map-to-sheet coupling: map camera padding shifts as sheet moves; route polylines draw in (~600 ms ease-out stroke-dashoffset); alternative routes shown greyed, tap to promote. | Map, directions sheet |
| Moovit - https://moovit.com | Disruption/service-alert banner above route list, per-leg crowding and delay tags. Borrow the pattern only (amber status tag + short reason). | Journey disrupted panel |
| Apple Maps (classic) transit cards | Leg timeline with a vertical line and mode glyph nodes; expands in place with height animation ~300 ms ease-out. | Option card expand |
| Linear (dark app UI) - https://linear.app | Calm dark surfaces, 1 px hairline borders instead of heavy shadows, 120-150 ms hover/press, segmented control with sliding pill. | Cards, toggles |
| Apple segmented control / switch (HIG) | Selected pill slides between segments (~250 ms, low-bounce spring), text colour crossfades; switch knob stretches slightly on press. | Toggles |
| Stripe / Robinhood style number animation | Counting up to value over ~700-900 ms ease-out on first reveal, tabular-nums, then static; chart line draws left to right with same duration; only animate once per view. | CO2 dashboard |
| Skeleton shimmer (Facebook/YouTube pattern) | Skeleton shaped exactly like option cards; slow 1.4 s diagonal shimmer at 6-8% lightness delta (indigo-tinted for dark), swap to content with 150 ms crossfade, no layout shift. | Loading |
| App launch (Apple HIG: launch screens) | Static first frame matching the app background (no white flash), then logo mark fades/scales 0.96 to 1 over ~400 ms and hands off to the map. Keep under 1 s total. | Launch |
| Material 3 navigation drawer - https://m3.material.io | Scrim fades 0 to 32-50% with panel; panel slides ~300 ms emphasized decelerate; exit faster (~200 ms) than enter. Reroute already staggers menu groups 40 ms; keep. | Side menu |
| Staggered list reveal (common in Things 3 / Apple Weather) | 30-40 ms stagger, cap at ~6 items (later ones appear together), 12 px rise + fade, 300-420 ms ease-out. | Cards, dashboard |
| Reduced motion (platform feature) | Swap all slides/scales for ~100 ms opacity fades; already in Reroute, keep for every new item. | All |

## 2. Gaps (transport apps have, Reroute probably lacks)

Ranked by impact vs effort. CHEAP = cheap and high impact.

1. CHEAP - Live countdown plus "leave in N min" per option, with a slow pulse on the live dot (Transit, Citymapper). Low effort, directly serves deadline-fit.
2. CHEAP - Mode filter chips on the options list (bus/train/ferry/walk) (Citymapper). Chips already exist as a component.
3. CHEAP - Skeleton loading shaped like option cards instead of spinners.
4. CHEAP - Sheet detents (peek/medium/full) with map padding follow (Apple/Google Maps).
5. Medium effort, high impact - "Disruption reason + what changed" diff on the panel (old arrival vs new, delay in minutes) (Moovit alerts).
6. Medium - Route polyline draw-in and greyed alternatives on the map; tap to promote.
7. Medium - Per-leg crowding / "next departures" row for each option (Transit).
8. Medium - Save "backup trip" and notifications when a saved route is disrupted (PWA push is limited on iOS).
9. High effort - Fully offline timetable fallback, real-time vehicle positions on the map, accessibility routing (step-free). Valuable but large.

## 3. Skills installed

- Installed: `find-skills` (vercel-labs/skills) with `npx skills add vercel-labs/skills --skill find-skills -g -y`. It landed in `~/.agents/skills/find-skills` and is symlinked for Claude Code. The CLI reported a harmless failure for the PromptScript target only (no global support). Why: the requested discovery tool, and it only searches/installs on request.
- Rejected: `mobbin/skills` (mobbin-search). It uses Mobbin's remote MCP (`https://api.mobbin.com/mcp`), which needs a Mobbin account sign-in, so it conflicts with the no-login rule and gives a paywalled library. Its other bundled skills (redesign-screen with a Python script) are not needed.
- Rejected: `dobroslavradosavljevic/skills@mobbin`, `samhvw8/dot-claude@aesthetic`, `uizze.sh@ui-taste` - not read, unvetted, low relevance.
- Not installed: `diffusionstudio/lottie@text-to-lottie` (10.7K installs). Not read, and Reroute has no Lottie need yet.
- Already available and sufficient: `animate`, `apple-design`, `emil-design-eng`, `animation-performance`, `mobile-native`, `find-animation-opportunities`.
- Not done: no skills for Refero, Godly, Awwwards, Dribbble, Codrops or LottieFiles were found or checked.
