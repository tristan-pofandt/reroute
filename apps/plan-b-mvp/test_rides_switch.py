"""PLANB_RIDES: the shared-rides feature is on by default and can be switched off with an environment variable."""
import os
import unittest
from unittest.mock import patch

from live_routes import Services
from test_live_routes import FakeRoutes
from test_server import make_app, plan_body


class FakeBoard:
    """Enough of Board for a plan answer: one match, no blocks."""
    def matches(self, *args):
        return [{"id": "r1", "poster": "p1", "is_member": False}]

    def mine(self, tokens):
        return []

    def blocks(self, who):
        return []

    def poster_id(self, kind, value):
        return "me"


def app_with(value):
    env = {} if value is None else {"PLANB_RIDES": value}
    board = FakeBoard()
    with patch.dict(os.environ, env):
        if value is None:
            os.environ.pop("PLANB_RIDES", None)
        return make_app(board=board, services=Services(routes=FakeRoutes(), fuel=None, parking=None, climb=None, board=board))[1]


class RidesSwitchTests(unittest.TestCase):
    def test_off_hides_the_rides_api_status_and_matches(self):
        for value in ("0", "false", "OFF"):
            client = app_with(value)
            for path in ("/api/rides", "/api/rides/join", "/api/rides/mine", "/api/rides/blocks"):
                response = client.post(path, json={}) if path != "/api/rides/blocks" else client.get(path)
                self.assertEqual((response.status_code, response.get_json()), (404, {"error": "Shared rides are switched off."}), (value, path))
            self.assertIs(client.get("/api/status").get_json()["rides"], False)
            self.assertEqual(client.post("/api/plan", json=plan_body()).get_json()["rides"], [])

    def test_default_is_on(self):
        client = app_with(None)
        self.assertIs(client.get("/api/status").get_json()["rides"], True)
        self.assertEqual(client.post("/api/rides/mine", json={"tokens": []}).status_code, 200)
        self.assertEqual(len(client.post("/api/plan", json=plan_body()).get_json()["rides"]), 1)


if __name__ == "__main__":
    unittest.main()
