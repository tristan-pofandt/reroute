# Reroute themes log

**Status:** Implemented on 2026-10-30 on the branch `feature/themes` for team review. Not merged, not pushed and not deployed; `main` (the demo build) is unchanged. Checked in a desktop browser at phone size; not tested on a real phone or with participants.

**Who wrote it:** requested by T.P, who supplied six of the palettes; the rest of the palettes, the names, which colour goes where, and the code were written by Claude Opus 5.5 through Claude Code (see the [AI-use log](../team/ai-use-log.md)). Human review is required before this is treated as final, especially the palette names and the look of each palette on a real phone.

Paths are in `apps/plan-b-mvp/`.

## What changed

| Change | What was built | Where |
| --- | --- | --- |
| Themes button | Settings, Appearance: the Auto/Light/Dark control is replaced by a Themes row that shows the current palette and opens a Themes sheet above Settings. | `app.js` `settingsContent`, `themesSheet` |
| 16 palettes | A 4 x 4 grid of preview swatches (background, card, text line, accent and the two icon tones). Picking one recolours the whole app at once, including the sheet you are in, and is saved on this device with the other settings. | `app.js` `PALETTES`, `app.css` palette rules |
| Original keeps its modes | Original is the old look. When it is selected, the sheet shows the old Auto, Light and Dark control, so nothing is lost. Every other palette has a fixed light or dark base. | `app.js` `themesSheet`, `applyTheme` |
| No flash on load | The theme bootstrap in both `index.html` files applies the saved palette and its light or dark base before first paint. The browser and status-bar colour (`theme-color`) follows the palette's background. | `index.html`, `web/index.html`, `app.js` `applyTheme` |
| Elements that assumed white on the accent | The directions banner icon, the Plan a trip icon chip, the checked switch knob, the demo pill, and the map pins for parking, "you are here" and the picked place now use `--on-accent`. It is white in Original, so Original looks the same as before. | `app.css`, `app.js` `mapIcon` |
| Higher contrast setting | When the system asks for more contrast, palettes darken muted text and strengthen borders from their own colours rather than falling back to Original's greys. | `app.css` `prefers-contrast` block |
| Contrast test | `test_palettes.py` checks every palette against WCAG 2.2 AA (4.5:1 text, 3:1 accent and icon tones, on each surface), that there are 16 with Original first, and that both bootstraps list the same dark palettes as `app.js`. | `test_palettes.py` |
| Cache | Service worker cache bumped to `planb-reroute-23` so installed copies pick up the new CSS. | `sw.js` |

## How a palette works

Each palette sets surfaces (`--bg-void`, `--bg-base`, `--bg-surface`, `--bg-card`, `--bg-pop`), text (`--text-main`, `--text-muted`, `--text-faint`), the accent (`--accent` for fills, `--accent-text` for links and focus, `--on-accent` for text on the accent) and the two icon tones (`--teal`, `--violet`). Borders, fills, accent tints, the chart colour and the nav bar are derived from those in one shared rule. Status colours (on time, delayed, cancelled), route-leg colours, the Reroute logo and partner brand colours (Google, Lime, Neuron) stay the same in every theme so they keep their meaning.

## The palettes

Supplied colours were kept where they passed contrast. Where a supplied colour was too light to read as an accent or icon on its background, it was deepened toward the palette's text colour by the smallest step that passes; the supplied colour is noted.

| Palette | Base | Source | Accent and where the supplied colours went |
| --- | --- | --- | --- |
| Original | Auto, Light or Dark | Existing | Unchanged indigo look. |
| Matcha | Light | New (requested: viby, creamy, soft light green) | Cream surfaces, soft leaf-green fill `#94C985` with dark green text on it, deeper green `#3F7A38` for links and focus; butter and terracotta icon tones. |
| Apricot | Light | Supplied `#F3EAE6 #EF7248 #F3A162 #E49776 #F9C98E` | Blush `#F3EAE6` is the background; coral `#EF7248` is the accent, deepened to `#D46642` with dark text on it; apricot and terracotta are the icon tones. |
| Clay | Light | Supplied `#DCD8D0 #3B3232 #D9886F #A7847C #D8C2B3` | Stone `#DCD8D0` background, espresso `#3B3232` text, clay `#D9886F` accent deepened to `#A8624D` for white text; mauve `#A7847C` icon tone. |
| Harvest | Light | Supplied `#FEF1A5 #A69B02 #746B03 #B64926 #8E2800` (the `O`s in `A69BO2` and `746BO3` were read as zeros) | Butter `#FEF1A5` background, rust `#B64926` accent, deep rust `#8E2800` links, the olives `#746B03` and `#A69B02` (deepened slightly) as icon tones. |
| Fern | Light | Supplied `#324E31 #FEFEFE #7C8D7B #D4D9D4 #A4AFA4` | White and pale sage surfaces, forest `#324E31` accent and links, sage `#7C8D7B` icon tone and faint text. |
| Smoke | Light | Supplied `#A4A3A4 #CECECE #5B5857 #974E50 #C09696` | Light greys (`#CECECE` outermost, lightened slightly inside so red alert text stays readable), wine `#974E50` accent, charcoal `#5B5857` and dusty rose (deepened) icon tones. |
| Sakura | Light | New | Pale pink, cherry-blossom accent. |
| Jacaranda | Light | New (Brisbane's jacarandas) | Pale lilac, jacaranda purple accent, teal icon tone. |
| Glacier | Light | New | Cool blue-grey, steel-blue accent. |
| Dusk Rose | Dark | Supplied `#243636 #FFC8C7 #919985 #D5ADA5 #CBE0CC` | Dark teal `#243636` background, blush `#FFC8C7` accent with dark teal text on it, sage `#919985` faint text, mint and dusty rose icon tones. |
| Tide | Dark | New | Deep navy, aqua accent. |
| Ember | Dark | New | Warm charcoal, amber accent. |
| Moss | Dark | New | Near-black green, fresh green accent. |
| Neon | Dark | New | Deep purple, hot pink accent, cyan icon tone. |
| Graphite | Dark | New | Black and greys only, for OLED screens and people who want no colour. |

## Decisions and limits

- **Matcha exception:** a soft light green fill cannot also reach 3:1 against cream. As requested, Matcha keeps the soft green for buttons and switches, with dark text on them (7.5:1). Its links, focus ring and selected states use the deeper green. The test lists Matcha as the one exception for the accent fill only.
- **Google Maps** follow the palette's light or dark base, not its colours. Recolouring the map per palette was not done.
- **Analytics:** choosing a theme is not tracked (the existing hook only sees `data-setting` changes).
- The Impeccable design skill was not run on this change; the names and colour roles are Claude's suggestions for the team to review.

## Checks run

- `python -m unittest -q`: 448 tests pass (3 new in `test_palettes.py`).
- `node --check app.js motion.js offline.js sw.js`: pass.
- `web`: `npm run build` and `npm test` (75 tests) pass.
- In a browser at 390 x 844: the Themes sheet with Original, Matcha and Neon selected, the home screen in Neon and Matcha, and Settings in Harvest; focus stays on the chosen tile; no console errors.
- Not run: the axe accessibility matrix per palette, real iPhone or Android devices, the native status bar.
