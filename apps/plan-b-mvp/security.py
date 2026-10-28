"""Baseline web security for the Flask app: response headers (CSP and friends), an explicit CORS allow-list, a request size cap, error
responses that never leak internals, and a log filter that strips query strings (which carry coordinates and search text).

Environment: PLANB_CSP_ENFORCE=0 switches the Content-Security-Policy to report-only (default: enforced), PLANB_CORS_ORIGINS is a comma
list of origins allowed to call the API (default none; the native app uses capacitor://localhost, https://localhost, ionic://localhost),
PLANB_TRUST_PROXY (read by server.py) tells us HTTPS is terminated in front, which enables Strict-Transport-Security.
See docs/engineering/security.md.
"""

import base64
import hashlib
import logging
import os
from pathlib import Path
import re

from flask import jsonify, request
from werkzeug.exceptions import HTTPException

HERE = Path(__file__).resolve().parent
MAX_BODY = 262144  # the largest legitimate POST is 32 KB
CORS_HEADERS = "Content-Type, Authorization, X-Reroute-Device, X-CSRF-Token"
ENDPOINT = "/api/csp-report"

# What the app really loads (found by driving every screen with the policy in report-only mode):
# Google Maps JS (maps.googleapis.com, maps.gstatic.com, tiles from *.googleapis.com / *.google.com / *.ggpht.com), Google Fonts (CSS from
# fonts.googleapis.com, files from fonts.gstatic.com), the RainViewer radar (api./tilecache.rainviewer.com), and data:/blob: images and workers.
GOOGLE = "https://maps.googleapis.com https://*.googleapis.com https://*.gstatic.com https://*.google.com https://*.ggpht.com https://*.googleusercontent.com"
POLICY = {
    "default-src": "'self'",
    "script-src": "'self' https://maps.googleapis.com https://*.gstatic.com {hashes}",
    "style-src": "'self' 'unsafe-inline' https://fonts.googleapis.com",  # React sets style attributes and Google Maps injects styles
    "img-src": f"'self' data: blob: {GOOGLE} https://tilecache.rainviewer.com https://*.rainviewer.com",
    "font-src": "'self' data: https://fonts.gstatic.com",
    "connect-src": f"'self' https://maps.googleapis.com https://*.googleapis.com https://*.gstatic.com https://*.google.com https://api.rainviewer.com https://*.rainviewer.com",
    "worker-src": "'self' blob:",
    "manifest-src": "'self'",
    "media-src": "'self'",
    "object-src": "'none'",
    "base-uri": "'self'",
    "form-action": "'self'",
    "frame-ancestors": "'self'",
    "frame-src": "https://www.google.com",
}
INLINE = re.compile(r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", re.S | re.I)


def inline_hashes():
    """'sha256-...' sources for the inline <script> blocks of the pages we serve (the theme bootstrap), so 'unsafe-inline' is not needed."""
    hashes = set()
    for page in (HERE / "web" / "dist" / "index.html", HERE / "index.html", HERE / "demo.html"):
        try:
            text = page.read_text(encoding="utf-8")
        except OSError:
            continue
        for block in INLINE.findall(text):
            if block.strip():
                hashes.add("'sha256-" + base64.b64encode(hashlib.sha256(block.encode()).digest()).decode() + "'")
    return " ".join(sorted(hashes))


def csp_value():
    policy = {name: value.format(hashes=inline_hashes()).strip() for name, value in POLICY.items()}
    return "; ".join(f"{name} {value}" for name, value in policy.items()) + f"; report-uri {ENDPOINT}"


class StripQuery(logging.Filter):
    """Request lines in access logs carry coordinates and search text in the query string; drop everything after the '?'."""

    def filter(self, record):
        message = record.getMessage()
        if "?" in message:
            record.msg, record.args = re.sub(r'\?[^\s"]*', "", message), ()
        return True


def init_security(app, env=None):
    env = os.environ if env is None else env
    enforce = env.get("PLANB_CSP_ENFORCE", "1") != "0"
    origins = {origin.strip().rstrip("/") for origin in (env.get("PLANB_CORS_ORIGINS") or "").split(",") if origin.strip()}
    app.config["MAX_CONTENT_LENGTH"] = MAX_BODY
    app.config["PLANB_CORS_ORIGINS"] = origins
    csp = csp_value()
    for name in ("werkzeug", "gunicorn.access"):
        logging.getLogger(name).addFilter(StripQuery())

    @app.before_request
    def preflight():
        origin = request.headers.get("Origin", "")
        if request.method == "OPTIONS" and origin:
            if origin in origins:
                response = app.make_response(("", 204))
                response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
                response.headers["Access-Control-Allow-Headers"] = CORS_HEADERS
                response.headers["Access-Control-Max-Age"] = "600"
                return response
            return app.make_response(("", 204))  # no CORS headers: the browser blocks the real request
        return None

    @app.after_request
    def headers(response):
        h = response.headers
        h["Content-Security-Policy" if enforce else "Content-Security-Policy-Report-Only"] = h.get("Content-Security-Policy") or csp
        h["X-Content-Type-Options"] = "nosniff"
        h["Referrer-Policy"] = "strict-origin-when-cross-origin"
        h["Permissions-Policy"] = "geolocation=(self), camera=(), microphone=(), payment=(), usb=(), bluetooth=(), serial=(), interest-cohort=()"
        h["X-Frame-Options"] = "SAMEORIGIN"
        h["Cross-Origin-Opener-Policy"] = "same-origin-allow-popups"  # Google sign-in uses a popup
        if request.is_secure:  # ProxyFix turns X-Forwarded-Proto into the scheme when PLANB_TRUST_PROXY is set
            h["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        origin = request.headers.get("Origin", "")
        if origin in origins:
            h["Access-Control-Allow-Origin"] = origin
            h.add("Vary", "Origin")
        return response

    @app.post(ENDPOINT)
    def csp_report():
        """Violation reports from browsers: logged at WARNING without the page URL (it can hold a query string)."""
        data = request.get_json(silent=True, force=True) or {}
        report = data.get("csp-report") if isinstance(data, dict) else None
        if isinstance(report, dict):
            blocked = str(report.get("blocked-uri", ""))[:120].split("?")[0]
            app.logger.warning("CSP violation: %s blocked %s", str(report.get("violated-directive", ""))[:60], blocked)
        return "", 204

    @app.errorhandler(HTTPException)
    def http_error(error):
        if request.path.startswith(("/api/", "/admin/")):
            response = jsonify({"error": {404: "Not found.", 405: "That method is not allowed.", 413: "The request is too large."}.get(error.code, error.name + ".")})
            response.status_code = error.code
            response.headers["Cache-Control"] = "no-store"
            return response
        return error

    @app.errorhandler(Exception)
    def crash(error):
        app.logger.exception("Unhandled error on %s", request.path)  # the traceback stays in the server log only
        response = jsonify({"error": "Something went wrong on the server."})
        response.status_code = 500
        response.headers["Cache-Control"] = "no-store"
        return response
