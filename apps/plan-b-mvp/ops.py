"""Operations endpoints and optional error reporting: /healthz, /readyz, admin-only /admin/usage, and Sentry when SENTRY_DSN is set."""

import hmac
import json
import os
import re
import time
from pathlib import Path

from flask import jsonify, request

import google_api
import usage

STARTED = time.time()


def app_version():
    """The app's marketing version: web/package.json is the single source (scripts/bump-version.mjs)."""
    try:
        return json.loads((Path(__file__).resolve().parent / "web" / "package.json").read_text(encoding="utf-8"))["version"]
    except (OSError, ValueError, KeyError):
        return ""


def release():
    return os.getenv("GIT_SHA", "").strip()[:40] or "dev"


def _scrub(event, hint):
    """Drop everything that could identify a person before it leaves the server: bodies, cookies, headers, query strings, IPs."""
    request_info = event.get("request") or {}
    for field in ("data", "cookies", "headers", "query_string", "env"):
        request_info.pop(field, None)
    if request_info.get("url"):
        request_info["url"] = re.sub(r"[?#].*", "", request_info["url"])
    event.pop("user", None)
    return event


def init_sentry():
    dsn = os.getenv("SENTRY_DSN", "").strip()
    if not dsn:
        return False
    try:
        import sentry_sdk  # optional dependency: pip install "sentry-sdk[flask]"
    except ImportError:
        return False
    sentry_sdk.init(dsn=dsn, release=release(), send_default_pii=False, before_send=_scrub, traces_sample_rate=0.0,
                    server_name="", environment=os.getenv("SENTRY_ENV", "production"))
    return True


def init_ops(app, parts):
    init_sentry()
    admin = lambda: os.getenv("PLANB_ADMIN_TOKEN", "").strip()  # read per request so the token can be rotated without a rebuild

    def health():
        return {"status": "ok", "version": release(), "app_version": app_version(), "api_version": app.config.get("PLANB_VERSION", ""), "uptime_s": int(time.time() - STARTED)}

    @app.get("/healthz")
    def healthz():  # liveness: the process answers. Uptime Kuma: HTTP keyword "ok"
        response = jsonify(health())
        response.headers["Cache-Control"] = "no-store"
        return response

    @app.get("/readyz")
    def readyz():  # readiness: data stores are usable; the transit index may still be loading, which is reported but not fatal
        data = os.getenv("PLANB_DATA_DIR") or os.path.join(os.path.dirname(__file__), "data")
        checks = {"data_dir": not os.path.isdir(data) or os.access(data, os.W_OK),
                  "gtfs_static": bool(parts["static"].ready())}
        ok = checks["data_dir"]
        response = jsonify({**health(), "status": "ready" if ok else "unavailable", "checks": checks})
        response.status_code = 200 if ok else 503
        response.headers["Cache-Control"] = "no-store"
        return response

    @app.get("/admin/usage")
    def admin_usage():
        token = admin()
        given = request.headers.get("Authorization", "").removeprefix("Bearer ").strip()
        if not token or not hmac.compare_digest(given.encode(), token.encode()):
            return jsonify({"error": "Not found."}), 404  # same answer whether disabled or wrong, so the route is not discoverable
        response = jsonify(usage.summary(google_api.PRICES, google_api.COST_NOTE))
        response.headers["Cache-Control"] = "no-store"
        return response
