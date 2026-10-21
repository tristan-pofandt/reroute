# Infrastructure

Place configuration used to run, deploy, or operate the project here. Do not add infrastructure merely to make the repository look complete.

Create subfolders only when needed, for example:

- `containers/` for container definitions;
- `deployment/` for deployment manifests;
- `environments/` for non-secret environment configuration;
- `observability/` for logging and monitoring configuration.

Never commit credentials or populated secret files. Document required values and provide safe examples instead.

## Current contents

- [`plan-b-mvp/`](plan-b-mvp/README.md): Dockerfile, Render blueprint and deployment notes (Render, Cloudflare quick tunnel, QR code, key restrictions) for the Plan B MVP in `apps/plan-b-mvp/`. Written but not yet built or deployed.
