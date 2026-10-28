#!/bin/sh
# Same as `make check` for machines without make. Run from the repository root.
set -e
cd apps/plan-b-mvp
PLANB_NO_BACKGROUND=1 PLANB_QUIET=1 python -m unittest -q
cd web
npm test
npm run build
