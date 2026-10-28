"""Placeholder domains and mailboxes: always check the report works; fail on any leftover only when PLANB_REQUIRE_REAL_CONTACTS=1 (release job)."""
import os
import shutil
import subprocess
import unittest
from pathlib import Path

import placeholders
import site_config


class PlaceholderTests(unittest.TestCase):
    def test_report_finds_placeholders_in_env_and_files(self):
        found = placeholders.report({"PLANB_SUPPORT_EMAIL": "support@reroute.invalid", "PUBLIC_URL": "https://app.example.org"})
        self.assertTrue(any(line.startswith("PLANB_SUPPORT_EMAIL") for line in found))
        self.assertTrue(any(line.startswith("VITE_API_BASE: unset") for line in found))
        self.assertFalse(any(line.startswith("PUBLIC_URL") for line in found))

    def test_native_hit_detection_ignores_comments(self):
        self.assertFalse(placeholders.PLACEHOLDER.search("host.example.org"))
        self.assertTrue(placeholders.PLACEHOLDER.search('android:host="reroute.example"'))

    def test_server_contacts_follow_env(self):
        old = os.environ.get("PLANB_PRIVACY_EMAIL")
        os.environ["PLANB_PRIVACY_EMAIL"] = "privacy@example.org"
        try:
            self.assertEqual(site_config.privacy_email(), "privacy@example.org")
        finally:
            os.environ.pop("PLANB_PRIVACY_EMAIL") if old is None else os.environ.__setitem__("PLANB_PRIVACY_EMAIL", old)

    @unittest.skipUnless(shutil.which("node"), "node not installed")
    def test_set_domain_dry_run_matches_every_native_file(self):
        script = Path(__file__).resolve().parents[2] / "scripts" / "set-domain.mjs"
        done = subprocess.run(["node", str(script), "--domain", "app.example.org", "--dry-run"], capture_output=True, text=True)
        self.assertEqual(done.returncode, 0, done.stderr)
        self.assertEqual(len([l for l in done.stdout.splitlines() if l.startswith(("would change", "unchanged"))]), 3)
        self.assertEqual(subprocess.run(["node", str(script), "--domain", "https://bad"], capture_output=True).returncode, 2)

    @unittest.skipUnless(os.getenv("PLANB_REQUIRE_REAL_CONTACTS") == "1", "release check: set PLANB_REQUIRE_REAL_CONTACTS=1 with the real env values")
    def test_no_placeholders_remain(self):
        self.assertEqual(placeholders.report(), [], "placeholders remain; run: python placeholders.py")


if __name__ == "__main__":
    unittest.main()
