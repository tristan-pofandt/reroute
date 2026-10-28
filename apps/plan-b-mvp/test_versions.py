"""One version source (web/package.json): the native files, /healthz and the lock file must agree with it."""
import json
import shutil
import subprocess
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
SCRIPT = HERE.parents[1] / "scripts" / "bump-version.mjs"


class VersionTests(unittest.TestCase):
    @unittest.skipUnless(shutil.which("node"), "node not installed")
    def test_native_files_agree_with_package_json(self):
        done = subprocess.run(["node", str(SCRIPT), "--check"], capture_output=True, text=True)
        self.assertEqual(done.returncode, 0, done.stderr)

    @unittest.skipUnless(shutil.which("node"), "node not installed")
    def test_dry_run_bump_changes_nothing(self):
        before = (HERE / "web" / "package.json").read_bytes()
        done = subprocess.run(["node", str(SCRIPT), "minor", "--dry-run"], capture_output=True, text=True)
        self.assertEqual(done.returncode, 0, done.stderr)
        pkg = json.loads(before)
        major, minor, _ = map(int, pkg["version"].split("."))
        self.assertIn(f"{pkg['version']} (build {pkg['buildNumber']}) -> {major}.{minor + 1}.0 (build {pkg['buildNumber'] + 1})", done.stdout)
        self.assertEqual((HERE / "web" / "package.json").read_bytes(), before)

    def test_healthz_reports_package_version(self):
        import ops
        self.assertEqual(ops.app_version(), json.loads((HERE / "web" / "package.json").read_text(encoding="utf-8"))["version"])


if __name__ == "__main__":
    unittest.main()
