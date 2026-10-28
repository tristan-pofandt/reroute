import os
import tempfile
import unittest

import usage
from server import create_app


class OpsTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        os.environ["PLANB_NO_BACKGROUND"] = "1"
        self.client = create_app(key=None, data_dir=self.tmp.name).test_client()
        usage.reset()

    def tearDown(self):
        os.environ.pop("PLANB_ADMIN_TOKEN", None)
        self.tmp.cleanup()

    def test_health(self):
        body = self.client.get("/healthz").get_json()
        self.assertEqual(body["status"], "ok")
        self.assertIn("version", body)
        self.assertIn(self.client.get("/readyz").status_code, (200, 503))

    def test_admin_usage_hidden_without_token(self):
        self.assertEqual(self.client.get("/admin/usage").status_code, 404)
        os.environ["PLANB_ADMIN_TOKEN"] = "t0ken"
        self.assertEqual(self.client.get("/admin/usage").status_code, 404)
        self.assertEqual(self.client.get("/admin/usage", headers={"Authorization": "Bearer wrong"}).status_code, 404)

    def test_admin_usage_counts(self):
        import google_api
        google_api.record_request("Routes API", "Compute Routes Essentials")
        google_api.record_request("Routes API", "Compute Routes Essentials")
        os.environ["PLANB_ADMIN_TOKEN"] = "t0ken"
        body = self.client.get("/admin/usage", headers={"Authorization": "Bearer t0ken"}).get_json()
        self.assertEqual(body["total_usd"], 0.01)
        self.assertEqual(list(body["days"].values())[0]["requests"], 2)


if __name__ == "__main__":
    unittest.main()
