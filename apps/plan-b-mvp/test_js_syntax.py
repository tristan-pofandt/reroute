"""The legacy browser scripts have no build step, so nothing else parses them: a syntax error in app.js once shipped. `node --check` each one."""
import shutil
import subprocess
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
FILES = ("app.js", "motion.js", "offline.js", "sw.js", "demo.js")


@unittest.skipUnless(shutil.which("node"), "node not installed")
class JsSyntaxTests(unittest.TestCase):
    def test_legacy_scripts_parse(self):
        for name in FILES:
            with self.subTest(file=name):
                done = subprocess.run(["node", "--check", str(HERE / name)], capture_output=True, text=True)
                self.assertEqual(done.returncode, 0, f"{name}: {done.stderr}")


if __name__ == "__main__":
    unittest.main()
