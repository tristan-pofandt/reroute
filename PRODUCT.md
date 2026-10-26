# Product

<!-- impeccable:product-schema 1 -->

Product context for design work on **Reroute** ([`apps/plan-b-mvp/`](apps/plan-b-mvp/README.md)). Drafted with AI assistance on 2026-10-27 for team review. It summarises and links the project documents and does not replace them. Out of scope: the earlier household water-savings direction, the Streamlit prototypes (`apps/prototype-*`) and the Figma prototype.

## Platform

web

## Users

- **Primary:** university students and workers in South East Queensland who use public transport for time-sensitive commitments (classes, exams, practicals, work meetings) and may need a practical fallback when a service is late, cancelled, missed, overcrowded or unable to stop. This segment is accepted for the problem (H-T01), not for the product.
- **Their jobs:** plan an everyday trip; when a journey is disrupted, decide quickly whether to wait, reroute or change mode; compare arrival time, cost, walking and transfers against their own limits (H-T03).
- **Secondary:** showcase visitors who open the app from the QR poster, usually on a phone, once and with little context. Demo mode can simulate disruption, weather and traffic for them, and labels every simulated value.

## Product Purpose

Reroute plans everyday trips with public transport first, shows the CO2 each option avoids compared with driving alone, and helps a traveller choose a practical alternative when a public-transport journey is disrupted.

The team leads with everyday planning and the CO2 focus (team decision, 2026-10-27). That lead rests on untested hypotheses H-P14 to H-P18. The evidence-backed core is the disruption-recovery comparison (H-T01 and H-T03 accepted; H-P04 uncertain; H-P05 provisionally supported within five draft accounts). The interim Iteration 2 synthesis cautions against claiming mode shift as an outcome.

Success measures have not been agreed. The MVP scope says to agree them before any test.

## Positioning

The candidate distinction, which is unproven, is a deadline-first, explainable comparison. The traveller's deadline and limits come first. Every option shows its arrival buffer, cost (including driving's fuel, tolls and parking), walking, transfers and CO2 together, with a plain reason why it fits or misses. Route planning, alternatives, alerts, live information, navigation and saved places are common to Google Maps, Apple Maps, Citymapper, Moovit and Translink, and must not be presented as unique. No advantage over any competitor is claimed: the competitor tests (H-P06 to H-P13) are pending, and the CO2 and full-driving-cost framing was not part of the competitor comparison.

## Operating Context

- Used on a phone, often outdoors and under time pressure, as an installable web app. On desktop it is a centred column up to 480 px wide.
- Brisbane and South East Queensland only. It uses Translink static and realtime feeds, Google Routes and Places, QLDTraffic, Open-Meteo, RainViewer, and OpenStreetMap for offline areas.
- The interim Iteration 2 records describe travellers combining several apps by hand, such as Google Maps and the official Translink app.
- Not deployed. It runs locally or from the prepared configuration in `infra/plan-b-mvp/`. Showcase use depends on a self-hosted address being up.

## Capabilities and Constraints

- The full feature list, and what has not been verified, are in [`apps/plan-b-mvp/README.md`](apps/plan-b-mvp/README.md) and its feature and refinement logs.
- **Estimates stay labelled as estimates.** Google Routes results are not confirmed disruption notices or guaranteed arrivals. "On time" appears only for an exactly matched trip. These are team assumptions, not verified values: the CO2 factors, the $0.50 flat fare, the traffic-delay minutes, the micromobility speeds and hire prices, and the 10 kg monthly goal. There is no Uber price, parking availability is not live, and offline results are timetable estimates.
- **Google terms:** route content appears only on Google Maps, with Google's logo and attribution visible. "Google Maps" text attribution goes beside Places or Routes content shown outside a map. Google content is never stored offline.
- **No accounts.** Settings, places and impact history stay in the browser. The ride board stores rounded points and no contact details, and it is unmoderated, so identity and safety are not addressed.
- Google bills per request. Per-visitor and daily limits reduce, but do not remove, cost risk.
- **Terminology:** users see "Reroute". "Plan B" remains in internal identifiers and in the fictional interview scenario (`demo.html`). Feature names: Plan a trip, Journey disrupted? (formerly Panic mode), Impact Dashboard, Lowest CO2, Demo mode, Use Offline Maps.
- **Open decisions:** success measures; the revenue model (none validated); whether alerts, saved places or the CO2 focus bring people back (untested).

## Brand Commitments

- The name is Reroute. The logo mark is a direct route broken by a disruption, with the route curving around it, unchanged from Plan B.
- Voice: plain-language labels and a one-line trade-off sentence on each option. Every simulated value says "Simulated".
- The app implements the visual brief in [`docs/design/design-system.md`](docs/design/design-system.md). Visual decisions belong in a future DESIGN.md, not here.

## Evidence on Hand

| Source | Status |
| --- | --- |
| [`docs/team/chosen-hypothesis.md`](docs/team/chosen-hypothesis.md) | H-T01 accepted for the defined segment; H-T03 accepted. Problem evidence only. |
| [`docs/discovery/synthesis/2026-09-25-iteration-2-combined-synthesis.md`](docs/discovery/synthesis/2026-09-25-iteration-2-combined-synthesis.md) | Interim: 14 of 20 source records are draft, and the synthesis is pending team review. |
| [`docs/product/value-propositions/value-proposition-canvas.md`](docs/product/value-propositions/value-proposition-canvas.md) | Customer profile is evidence-based; value map is provisional; v2 additions are untested. |
| [`docs/product/business-model-canvas.md`](docs/product/business-model-canvas.md) | Business model is untested; there is no willingness-to-pay evidence. |
| [`docs/product/mvp-scope-2026-10-20.md`](docs/product/mvp-scope-2026-10-20.md) | MoSCoW scope traced to 21 prototype records (P006 to P011 final; P106 to P110, P306 to P310 and P405 to P409 draft). |
| [`docs/product/competitors/team-competitor-comparison-2026-09-25.md`](docs/product/competitors/team-competitor-comparison-2026-09-25.md) | Draft for team review; competitor tests pending. |
| [`docs/submission-evidence-map.md`](docs/submission-evidence-map.md) | Authority for what is final, draft and pending. |
| [`apps/plan-b-mvp/README.md`](apps/plan-b-mvp/README.md) | What is built, its data sources, and what has not been verified. |

None of the following exists, so it must not be invented: participant use of Reroute; deployment; adoption, repeat use or willingness to pay; evidence of mode shift; measured CO2 impact; live-data accuracy; competitor advantage; testimonials, user numbers or measured decision times; testing on a real phone or with a screen reader.

## Product Principles

1. **Arrival first.** The traveller's deadline and limits come before cheaper or greener options. CO2 is shown on every option but never overrides feasibility.
2. **Show why.** Each option says why it fits or misses a limit, and unsuitable options stay visible with that reason.
3. **Say where each number comes from.** Live, timetable, estimated, assumed, simulated and offline values are labelled as such.
4. **Help the traveller act, not only decide.** A choice leads to a next step: directions, a watch or a hand-off.
5. **Claim only what the evidence shows.** No product copy implies adoption, mode shift, measured impact or superiority over competitors.

## Accessibility & Inclusion

The target is WCAG 2.2 AA (team decision, 2026-10-27). Conformance has not been verified. The app already has 44 px tap targets, visible focus rings, a reduced-motion setting, and Auto, Light and Dark themes. Colour must always be paired with a text label. Not yet tested: screen readers, keyboard-only use across every screen, and real phones.
