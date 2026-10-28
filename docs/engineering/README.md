# Engineering

Explain technical choices that are not evident from the source code alone.

This area can include:

- system context and architecture;
- data models and data handling;
- interface and API contracts;
- quality and testing strategy;
- local development and operational concepts;
- security and privacy considerations.

Application-specific setup commands belong with the relevant application under `apps/`.
- [Store-readiness audit (2026-10-28)](store-readiness-audit-2026-10-28.md): Apple/Google store gaps, form comparison and roadmap.

- [Accessibility pass (2026-10-28)](accessibility.md): rem text scaling, axe results and manual checks still needed.
- [Analytics, crash reporting and health endpoints](analytics-implementation.md): consent-gated events, Sentry, `/healthz`, `/admin/usage`, Privacy-page text.
- [Release process](release-process.md): versioning, signing, TestFlight/Play testing, staged rollout, rollback, monitoring.
- [Accounts](accounts.md): optional Google and Apple sign-in, data model, sequence diagrams, security decisions, store-rule checklist, provider setup steps and going native.
- [Ride board moderation](ride-board-moderation.md): report, block, filter, rate limits, auto-hide, operator queue and runbook.
- [Security hardening](security.md): threat model, headers table, what was fixed, residual risks.
- [Data and software licences](data-licences.md): attributions behind the Licences page and the Translink licence mismatch.
