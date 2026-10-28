"""Server-side public contacts: one place, read from the environment (the React build reads VITE_* with the same values; keep them equal).
The defaults are placeholders that never resolve; `python placeholders.py` reports any still in use."""
import os

DEFAULTS = {
    "PLANB_SUPPORT_EMAIL": "support@reroute.invalid",
    "PLANB_ABUSE_EMAIL": "abuse@reroute.invalid",
    "PLANB_PRIVACY_EMAIL": "privacy@reroute.invalid",
}


def _get(name):
    return (os.getenv(name) or "").strip() or DEFAULTS[name]


def support_email():
    return _get("PLANB_SUPPORT_EMAIL")


def abuse_email():
    return _get("PLANB_ABUSE_EMAIL")


def privacy_email():
    return _get("PLANB_PRIVACY_EMAIL")
