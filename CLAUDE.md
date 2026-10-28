# Reroute (COMP1100-45) project instructions for Claude Code

@AGENTS.md

Reroute is a public-transport-first trip planner for Brisbane / South East Queensland, built as a PWA with a Flask back end and a React shell, with Capacitor projects for the stores. The repo rules in `AGENTS.md` (above) apply to everything here: evidence and interview safety, no secrets, keep each area in its folder.

## Where things are

- App: `apps/plan-b-mvp/` (Flask `server.py`, `accounts.py`, `rides.py`, `push.py`; legacy screens in `app.js` and `app.css`; React shell in `web/`; native projects in `web/android/` and `web/ios/`). Internal names keep `planb` (storage keys, `PLANB_*` env vars, service-worker cache prefix).
- Docs: `docs/engineering/` (start with `README.md`; `handoff-checklist-2026-10-28.md` is the ordered list of what only a human can do), `docs/product/` (feature logs, store listing, testing and monetisation plans), `docs/team/ai-use-log.md`.
- Deployment: `infra/plan-b-mvp/` (multi-stage Dockerfile builds the React shell). The homelab pulls `main` every 2 minutes and rebuilds, so **pushing to `main` deploys**.

## Commands (run from `apps/plan-b-mvp` unless noted)

- Python tests: `python -m unittest -q`
- React shell: `cd web && npm ci && npm run build && npm test`
- Run locally: `python server.py` (http://127.0.0.1:8000); `HOST=0.0.0.0` exposes it on the LAN
- Syntax check legacy scripts: `node --check app.js motion.js offline.js sw.js`
- Release checks: `python placeholders.py --strict`, `scripts/check.sh` (see `docs/engineering/release-process.md`)

## Working rules

- Branches: `main` is the deployed demo build. Do not push or merge to `main` unless asked. Work on `feature/*` branches; commit messages end with the Co-Authored-By line from the session.
- Never commit secrets: provider keys, Firebase files, keystores, `.p8` keys and `.env` files stay out of git and the vault. Env var names are documented in `infra/plan-b-mvp/README.md` and `.env.example`.
- Legacy `app.js` renders screens as HTML strings; the React shell in `web/` bridges to it. When changing Privacy or Terms text, edit the React body and run `web/scripts/sync_legacy_legal.py` (a test fails if they differ).
- Motion: all easing, timing and stagger values live in `web/src/choreography.js`; transform and opacity only; honour reduced motion. Leave the scroll-reveal logic in `web/src/motion/scroll3d.js` alone unless asked.
- Do not change the fictional interview scenario files `demo.html`, `demo.js` and `styles.css`.
- After meaningful work, add or update the matching feature log in `docs/product/`, the AI-use log entry, and the docs index, crediting Claude and noting that human review is required.
- Dev servers started in a session keep running: stop what you start.

## Personal context

If `CLAUDE.local.md` exists next to this file (it is git-ignored), it points to the owner's personal Obsidian vault with project history and homelab notes: follow it. Otherwise ignore this section.
