import os
import tempfile
import unittest
from unittest import mock

os.environ["PLANB_NO_BACKGROUND"] = "1"  # before importing server, which starts background threads otherwise (as test_server.py)
from server import create_app  # noqa: E402

AUTH = {"Authorization": "Bearer t0ken"}
SECRET = "x" * 40


class AdminApiTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        env = mock.patch.dict(os.environ, {"PLANB_ADMIN_TOKEN": "t0ken", "ACCOUNTS_SECRET_KEY": SECRET})
        env.start()
        self.addCleanup(env.stop)
        self.app = create_app(key=None, data_dir=self.tmp.name)
        self.client = self.app.test_client()

    def tearDown(self):
        self.tmp.cleanup()

    def test_hidden_without_the_token(self):
        self.assertEqual(self.client.get("/admin/api/settings").status_code, 404)
        self.assertEqual(self.client.get("/admin/api/settings", headers={"Authorization": "Bearer wrong"}).status_code, 404)
        self.assertEqual(self.client.post("/admin/api/sessions/revoke", json={}).status_code, 404)
        with mock.patch.dict(os.environ, {"PLANB_ADMIN_TOKEN": ""}):
            self.assertEqual(self.client.get("/admin/api/settings", headers=AUTH).status_code, 404)

    def test_switches_and_caps_change_at_runtime(self):
        before = self.client.get("/admin/api/settings", headers=AUTH).get_json()
        self.assertEqual((before["rides"], before["signin"], before["caps"]["plan"]["limit"]), (True, True, 50))
        after = self.client.post("/admin/api/settings", headers=AUTH, json={"rides": False, "signin": False, "caps": {"plan": 10}}).get_json()
        self.assertEqual((after["rides"], after["signin"], after["caps"]["plan"]["limit"]), (False, False, 10))
        self.assertEqual(self.client.get("/api/rides").status_code, 404)  # the ride board is off
        self.assertFalse(self.client.get("/api/status").get_json()["rides"])
        self.assertIsNone(self.app.extensions["planb"]["services"].board)
        self.assertIn(self.client.post("/auth/native/google", json={}).status_code, (404, 503))
        self.client.post("/admin/api/settings", headers=AUTH, json={"rides": True})
        self.assertIsNotNone(self.app.extensions["planb"]["services"].board)

    def test_bad_input_changes_nothing(self):
        for body in ({"caps": {"plan": -1}}, {"caps": {"plan": "9"}}, {"caps": {"nope": 1}}, {"rides": "off"}, {"other": 1}, [1]):
            self.assertEqual(self.client.post("/admin/api/settings", headers=AUTH, json=body).status_code, 400, body)
        self.assertEqual(self.client.get("/admin/api/settings", headers=AUTH).get_json()["caps"]["plan"]["limit"], 50)

    def test_revoke_one_user_or_everyone(self):
        acct = self.app.extensions["accounts"]
        a, b = acct.login("google", "1", None, False, "A"), acct.login("google", "2", None, False, "B")
        token_a, _ = acct.new_session(a, "web", "google")
        token_b, _ = acct.new_session(b, "web", "google")
        self.assertEqual(self.client.post("/admin/api/sessions/revoke", headers=AUTH, json={"user_id": "bad"}).status_code, 400)
        self.assertEqual(self.client.post("/admin/api/sessions/revoke", headers=AUTH, json={"user_id": a}).get_json(), {"revoked": 1})
        self.assertIsNone(acct.load_session(token_a))
        self.assertIsNotNone(acct.load_session(token_b))
        self.assertEqual(self.client.post("/admin/api/sessions/revoke", headers=AUTH, json={}).get_json(), {"revoked": 1})
        self.assertIsNone(acct.load_session(token_b))


if __name__ == "__main__":
    unittest.main()
