# Reroute quality, accessibility, release-engineering and store-listing log (2026-10-28)

Prepared by Claude Sonnet 5.5 via Claude Code at T.P's request, branch `feature/accounts`. **Human review required** for every item below; nothing was run on a phone or a store account.

| Area | What was built | Where |
|---|---|---|
| Accessibility (audit gap 10) | Fonts in rem (pixel-identical at default), large-text layout rules, contrast/forced-colours basics, axe + screenshot harness, results | `app.css`, `web/src/textScale.js`, `web/scripts/a11y-audit.mjs`, [accessibility.md](../engineering/accessibility.md) |
| CI/CD (gap 9) | CI (Python 3.13 tests + pip-audit; Node 22 tests, build, npm audit), Docker build, Dependabot, PR/issue templates, CODEOWNERS placeholder, `make check`, Vitest suite (32 tests) | `.github/`, `Makefile`, `scripts/check.sh`, `web/src/__tests__/` |
| Analytics | Consent-gated allow-listed `track()`, delegated instrumentation, first-run consent sheet, Settings toggle, server Google cost counters and `/admin/usage` | `web/src/analytics/`, `usage.py`, `ops.py`, [analytics-implementation.md](../engineering/analytics-implementation.md) |
| Crash reporting | Lazy opt-in Sentry (web, Flask), error boundary, global handlers, `/healthz`, `/readyz`, `GIT_SHA` build arg | `web/src/errors/`, `ops.py`, `infra/plan-b-mvp/Dockerfile` |
| Store listing | App Store Connect and Google Play drafts, release process, reference screenshots | `docs/product/store-listing/`, [release-process.md](../engineering/release-process.md) |

Defaults: with no build keys the app shows no consent UI and sends nothing; the Settings row appears only in a configured build.

Not done or approximate: remaining axe findings (3 rules) and the offline-area control at 200% (see accessibility.md); `safety.css` still px; analytics event fidelity (see "Known approximations" in the analytics doc); `user_hash` server-side HMAC not built; `/admin/usage` is in memory; store screenshots are layout-size references, not store-pixel captures.
