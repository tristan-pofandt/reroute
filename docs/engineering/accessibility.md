# Reroute accessibility pass (2026-10-28)

Prepared by Claude Sonnet 5.5 via Claude Code at T.P's request. **Human review required.** Automated checks catch roughly a third of real problems; nothing here was tested with VoiceOver, TalkBack or a physical phone.

## What changed

- **Text follows the system font size.** All 210 `font-size` px values in `app.css`, `ambient.css` and `listview.css` are now `rem` (1rem = 16px) and `html { font-size: 100% }` is set, so the default is pixel-identical (screenshot diff before/after, 17 screens: 0.000% differing pixels; only `/privacy` differed, because another agent changed its text at the same time). `safety.css` (two sizes) was converted afterwards.
- **Large-text layout.** `web/src/textScale.js` sets `html[data-text="large"]` when the root font size is above 18px (above 112%). A short block at the end of `app.css` then wraps rows, stacks columns and lets the Demo pill, Home button and labels grow. At the default size the attribute is never set, so the designed layout is untouched.
- Fixed-size boxes that held text (place labels, number inputs, the Demo pill, the Home button, the panic time input) are now rem or `min-height`.
- `prefers-contrast: more` (stronger muted text and borders) and `forced-colors: active` (system focus colour, borders on controls) basics added. `prefers-color-scheme` was already supported (Auto/Light/Dark); `prefers-reduced-motion` plus the in-app Reduce motion switch were already wired in CSS and `reduced.js`/`haptics.js` (haptics tests added).
- `lang="en-AU"` was already set. Dialogs, menus and sheets already carry `role="dialog"`, `aria-modal`, a labelled title and Escape handling; the new consent sheet follows the same pattern and traps focus.

## Method

`web/scripts/a11y-audit.mjs` (dev only; `axe-core` and `playwright-core` are devDependencies and never shipped) opens the built app in system Chrome at 390x844 with demo mode and a fixture plan, visits home, menu, settings, journey, results, an option sheet, next steps, dashboard, rides, weather, offline area, terms, privacy, sources, panic and the demo sheet, and injects axe (rules: WCAG 2.0/2.1/2.2 A and AA plus best practice). `--text 130|200` emulates a larger system font; `--theme light`. `shot-diff.mjs` compares two screenshot folders; `montage.mjs` tiles them.

```
npm run build && (cd .. && python server.py)         # in another shell
node scripts/a11y-audit.mjs --out ../../../tmp/shots --axe [--text 200] [--theme light]
```

## Results

| Check | Before | After |
|---|---|---|
| axe violations, dark theme, 17 screens | 6 nodes in 3 rules | **0** (integration pass, 2026-10-28) |
| axe violations, light theme | same 6 | **0** |
| Default-size pixel change | n/a | 0.000% (16 of 17 screens; privacy changed by other work) |
| Horizontal page scroll at 130% and 200% | none | none |
| Console errors on all screens | 0 | 0 |
| 200% text: clipped or overlapping elements | demo pill clipped, "FROM" label overlapped the input, header Home button off screen, settings theme row overlapped, results-sheet times clipped | all fixed; remaining below |

Fixed in the integration pass without a visible change at the default size: the trip-summary `.chips` strip, the 24-hour weather strip, the option-sheet and alert-sheet scrollers and the map-failure box are keyboard-focusable (`tabindex="0"`, outline only on keyboard focus); the home tiles use `aria-level="2"` on their `h3` so heading order holds; the offline-area screen has a visually hidden `h1`; the offline-area "Timetables for 1 day / 3 days / 7 days" row wraps at large text. The earlier `/terms` finding was the harness reading the offline-area page (it could not leave it until a Home press); `a11y-audit.mjs` now waits for transitions and returns Home after the offline-area step. Re-run at 100% in dark and light: 0 violations, no horizontal overflow, no console errors. At 200% text the dark theme also gave 0; the light 200% run found one node on the weather strip before `weather.screen.jsx` got the same `tabIndex` and was not repeated afterwards.

Remaining visual issue at 200% on a 390px screen: the weather hero is cramped but readable.

Contrast: axe's colour-contrast rule passed on all screens in both themes (live text on solid tokens). Gradient and image backgrounds (home hero) and the `--text-faint` token on cards should be checked by hand.

## Manual checks still needed

1. VoiceOver (iOS) and TalkBack (Android): reading order of home, results cards, option sheet, map picker, panic flow; announcement of async status (the `#net-banner` live region exists; search results and download progress need checking).
2. Dynamic Type / system font size on a real device in the Capacitor shell at the largest setting.
3. Keyboard-only and switch access on desktop: focus order and visible focus in menus and sheets.
4. Map picker and drag interactions: confirm a non-drag alternative exists (WCAG 2.5.7).
5. Touch targets: axe `target-size` (WCAG 2.2) raised nothing; spot-check small icon buttons with real thumbs.
6. Zoom: pinch zoom is allowed (no `user-scalable=no`); verify 400% browser zoom reflow.
7. Reduced motion: confirm on iOS "Reduce Motion" that Lenis smooth scroll and the page transitions switch off.
