"""Writes web/scripts/plan.fixture.json: a /api/plan response built from the test fakes (no Google call), for motion-bench.js.
Run from apps/plan-b-mvp:  python web/scripts/make-plan-fixture.py"""
import json, os, sys
sys.path.insert(0, os.getcwd())
from test_server import make_app, plan_body

_, client = make_app()
data = client.post("/api/plan", json=plan_body(modes={"transit": True, "drive": True})).get_json()
json.dump(data, open(os.path.join("web", "scripts", "plan.fixture.json"), "w"))
print(len(data.get("options", [])), "options")
