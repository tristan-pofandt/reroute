"""The legacy app.js Privacy and Terms text must be identical to the React bodies (web/scripts/sync_legacy_legal.py rewrites it)."""
import importlib.util
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent


class LegalSyncTests(unittest.TestCase):
    def test_app_js_matches_react_bodies(self):
        spec = importlib.util.spec_from_file_location("sync_legacy_legal", HERE / "web/scripts/sync_legacy_legal.py")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        self.assertTrue(module.main(check=True), "run: python web/scripts/sync_legacy_legal.py")


if __name__ == "__main__":
    unittest.main()
