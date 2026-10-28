"""Placeholder report: lists every reroute.invalid / reroute.example value still in use.
  python placeholders.py            report (exit 0)
  python placeholders.py --strict   exit 1 if any remain (release checklist / CI release job; same as PLANB_REQUIRE_REAL_CONTACTS=1 in test_placeholders.py)
Two kinds: files that carry a placeholder as the shipped value (native files, which scripts/set-domain.mjs rewrites), and environment values that
should be set for a release (the same ones the server and the web build read)."""
import os
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PLACEHOLDER = re.compile(r"reroute\.(?:invalid|example)")
# Native files must carry the real domain in the repo; the web/server contacts are env-driven, their source defaults are expected placeholders.
NATIVE_FILES = (
    "web/android/app/src/main/AndroidManifest.xml",
    "web/ios/App/App/App.entitlements",
    "web/capacitor.config.ts",
)
ENV_REQUIRED = (
    "PUBLIC_URL", "VITE_API_BASE", "VITE_SITE_DOMAIN",
    "VITE_SUPPORT_EMAIL", "VITE_ABUSE_EMAIL", "VITE_PRIVACY_EMAIL",
    "PLANB_SUPPORT_EMAIL", "PLANB_ABUSE_EMAIL", "PLANB_PRIVACY_EMAIL",
)


def native_hits():
    hits = []
    for name in NATIVE_FILES:
        path = HERE / name
        for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if PLACEHOLDER.search(line) and not line.lstrip().startswith(("<!--", "//")):
                hits.append(f"{name}:{number}: {line.strip()}")
    return hits


def env_hits(env=None):
    env = os.environ if env is None else env
    return [f"{key}: {'unset' if not env.get(key, '').strip() else env[key]}" for key in ENV_REQUIRED
            if not env.get(key, "").strip() or PLACEHOLDER.search(env[key])]


def report(env=None):
    return native_hits() + env_hits(env)


if __name__ == "__main__":
    found = report()
    for line in found:
        print(line)
    print(f"{len(found)} placeholder value(s) remaining." if found else "No placeholders remaining.")
    sys.exit(1 if found and "--strict" in sys.argv else 0)
