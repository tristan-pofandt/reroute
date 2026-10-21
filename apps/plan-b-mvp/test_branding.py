"""The app is named Reroute. These checks keep the old product name out of the user-visible files.

Storage keys (planb.*), environment variables (PLANB_*) and module names intentionally keep the old name so saved data and deployment
configuration keep working; they are not checked here.
"""

import json
import re
import unittest
from pathlib import Path

HERE = Path(__file__).parent


def read(name):
    return (HERE / name).read_text(encoding="utf-8")


class BrandingTests(unittest.TestCase):
    def test_manifest_uses_the_new_name(self):
        manifest = json.loads(read("manifest.webmanifest"))
        self.assertEqual(manifest["name"], "Reroute")
        self.assertEqual(manifest["short_name"], "Reroute")
        self.assertNotIn("Plan B", json.dumps(manifest))

    def test_page_title_and_app_title_use_the_new_name(self):
        page = read("index.html")
        self.assertIn("<title>Reroute</title>", page)
        self.assertIn('name="apple-mobile-web-app-title" content="Reroute"', page)
        self.assertNotIn("Plan B", page)

    def test_service_worker_and_logo_use_the_new_name(self):
        self.assertNotIn("Plan B", read("sw.js"))
        self.assertNotIn("Plan B", read("favicon.svg"))
        # The cache prefix must stay "planb-" so activate() still deletes caches from older versions.
        self.assertTrue(re.search(r'const VERSION = "planb-', read("sw.js")))

    def test_front_end_only_mentions_plan_b_in_the_file_comment(self):
        for name in ("app.js", "app.css"):
            lines = [line for line in read(name).splitlines() if "Plan B" in line]
            self.assertEqual(len(lines), 1, name)
            self.assertIn("formerly Plan B", lines[0])

    def test_server_strings_use_the_new_name(self):
        for name in ("server.py", "push.py", "google_api.py", "gtfs_rt.py", "gtfs_static.py", "traffic.py", "weather.py", "live_routes.py"):
            for line in read(name).splitlines():
                if "Plan B" in line or "PlanB" in line:
                    self.assertIn("formerly Plan B", line, f"{name}: {line.strip()}")

    def test_disrupted_journey_entry_is_gone_from_the_front_end(self):
        script = read("app.js")
        for removed in ("My journey is disrupted", 'data-purpose="planb"', "Find my Plan B", "Choose your Plan B"):
            self.assertNotIn(removed, script)


if __name__ == "__main__":
    unittest.main()
