# `make check` runs what CI runs. Needs python 3.13 deps (pip install -r apps/plan-b-mvp/requirements.txt) and node 22.
APP := apps/plan-b-mvp

.PHONY: check test-py test-web build audit
check: test-py test-web build

test-py:
	cd $(APP) && PLANB_NO_BACKGROUND=1 PLANB_QUIET=1 python -m unittest -q
test-web:
	cd $(APP)/web && npm test
build:
	cd $(APP)/web && npm run build
audit:
	cd $(APP)/web && npm audit --omit=dev --audit-level=high
	cd $(APP) && pip-audit -r requirements.txt
