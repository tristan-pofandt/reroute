#!/bin/sh
# Same as `make check` for machines without make. Run from the repository root.
#   RELEASE=1 sh scripts/check.sh   also fails on placeholder domains/mailboxes (set the real VITE_*, PLANB_* and PUBLIC_URL values first)
set -e
node scripts/bump-version.mjs --check
cd apps/plan-b-mvp
# python -m unittest also runs test_js_syntax.py (node --check on app.js, motion.js, offline.js, sw.js, demo.js)
PLANB_NO_BACKGROUND=1 PLANB_QUIET=1 python -m unittest -q
if [ "$RELEASE" = "1" ]; then PLANB_REQUIRE_REAL_CONTACTS=1 python placeholders.py --strict; fi
cd web
npm test
npm run build
