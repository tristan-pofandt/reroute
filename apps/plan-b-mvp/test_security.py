"""Security headers, CORS, request size limit, error responses and log scrubbing."""

import logging
import os
import unittest
from unittest.mock import patch

from security import StripQuery, csp_value
from test_server import make_app


class HeaderTests(unittest.TestCase):
    def setUp(self):
        self.app, self.client = make_app()

    def test_security_headers_on_pages_and_api(self):
        for path in ("/", "/api/status", "/nothing-here"):
            h = self.client.get(path).headers
            self.assertIn("default-src 'self'", h["Content-Security-Policy"], path)
            self.assertIn("frame-ancestors 'self'", h["Content-Security-Policy"], path)
            self.assertEqual(h["X-Content-Type-Options"], "nosniff")
            self.assertIn("geolocation=(self)", h["Permissions-Policy"])
            self.assertIn("camera=()", h["Permissions-Policy"])
            self.assertEqual(h["Referrer-Policy"], "strict-origin-when-cross-origin")
            self.assertNotIn("Strict-Transport-Security", h)  # plain HTTP
            self.assertNotIn("Access-Control-Allow-Origin", h)

    def test_hsts_only_over_https(self):
        self.assertIn("max-age", self.client.get("/api/status", base_url="https://reroute.example").headers["Strict-Transport-Security"])

    def test_csp_can_be_report_only(self):
        with patch.dict(os.environ, {"PLANB_CSP_ENFORCE": "0"}):
            _, client = make_app()
        h = client.get("/api/status").headers
        self.assertNotIn("Content-Security-Policy", h)
        self.assertIn("report-uri /api/csp-report", h["Content-Security-Policy-Report-Only"])

    def test_csp_allows_only_the_known_hosts(self):
        csp = csp_value()
        self.assertNotIn("*;", csp.replace("https://*.", ""))
        self.assertIn("object-src 'none'", csp)
        self.assertNotIn("script-src 'self' 'unsafe-inline'", csp)

    def test_csp_report_endpoint_logs_without_the_page_url(self):
        with self.assertLogs(self.app.logger, "WARNING") as logs:
            r = self.client.post("/api/csp-report", data='{"csp-report":{"violated-directive":"img-src","blocked-uri":"https://x.example/a?lat=1"}}',
                                 content_type="application/csp-report")
        self.assertEqual(r.status_code, 204)
        self.assertNotIn("lat=1", logs.output[0])


class CorsTests(unittest.TestCase):
    def test_no_cors_by_default_and_an_allow_list_when_set(self):
        _, client = make_app()
        self.assertNotIn("Access-Control-Allow-Origin", client.get("/api/status", headers={"Origin": "https://evil.example"}).headers)
        self.assertNotIn("Access-Control-Allow-Origin", client.options("/api/rides", headers={"Origin": "capacitor://localhost"}).headers)
        with patch.dict(os.environ, {"PLANB_CORS_ORIGINS": "capacitor://localhost, https://localhost"}):
            _, client = make_app()
        ok = client.get("/api/status", headers={"Origin": "capacitor://localhost"})
        self.assertEqual(ok.headers["Access-Control-Allow-Origin"], "capacitor://localhost")
        self.assertNotIn("Access-Control-Allow-Origin", client.get("/api/status", headers={"Origin": "https://evil.example"}).headers)
        pre = client.options("/api/rides", headers={"Origin": "https://localhost", "Access-Control-Request-Method": "POST"})
        self.assertEqual((pre.status_code, pre.headers["Access-Control-Allow-Origin"]), (204, "https://localhost"))
        self.assertIn("X-Reroute-Device", pre.headers["Access-Control-Allow-Headers"])
        posted = client.post("/api/rides/mine", json={"tokens": []}, headers={"Origin": "capacitor://localhost"})  # the native shell may call the API
        self.assertEqual(posted.status_code, 200)
        self.assertEqual(client.post("/api/rides/mine", json={"tokens": []}, headers={"Origin": "https://evil.example"}).status_code, 403)


class ErrorTests(unittest.TestCase):
    def setUp(self):
        self.app, self.client = make_app()

    def test_oversized_bodies_are_refused(self):
        r = self.client.post("/api/rides/mine", data=b"x" * 300000, content_type="application/json")
        self.assertIn(r.status_code, (400, 413))

    def test_unknown_api_paths_and_methods_are_json(self):
        r = self.client.get("/api/nope")
        self.assertEqual((r.status_code, r.get_json()), (404, {"error": "Not found."}))
        self.assertEqual(self.client.delete("/api/status").get_json(), {"error": "That method is not allowed."})

    def test_unhandled_errors_do_not_leak_details(self):
        @self.app.get("/api/boom")
        def boom():
            raise RuntimeError("secret-internal-detail /srv/app/key.pem")
        self.app.testing = False
        self.app.config["PROPAGATE_EXCEPTIONS"] = False
        with self.assertLogs(self.app.logger, "ERROR"):
            r = self.client.get("/api/boom")
        self.assertEqual((r.status_code, r.get_json()), (500, {"error": "Something went wrong on the server."}))
        self.assertNotIn("secret", r.get_data(as_text=True))


class LogTests(unittest.TestCase):
    def test_query_strings_are_stripped_from_access_logs(self):
        record = logging.LogRecord("werkzeug", logging.INFO, "", 0, '127.0.0.1 - - "%s" %s', ("GET /api/weather?lat=-27.47&lng=153.02 HTTP/1.1", 200), None)
        StripQuery().filter(record)
        self.assertEqual(record.getMessage(), '127.0.0.1 - - "GET /api/weather HTTP/1.1" 200')


if __name__ == "__main__":
    unittest.main()
