"""Who is posting (a pseudonymous id) and the operator moderation queue at /admin/moderation.

The queue is off (404) unless PLANB_ADMIN_TOKEN is set. Sign in with that token (the page asks for it and sets a short HttpOnly cookie), or send it
as `Authorization: Bearer <token>` for the JSON form. See docs/engineering/ride-board-moderation.md for the operator runbook.
"""

import hashlib
import hmac
import os
import re

from flask import Response, jsonify, redirect, request
from markupsafe import escape
from urllib.parse import urlsplit

from rides import RideError

DEVICE = re.compile(r"^[A-Za-z0-9_-]{16,64}$")
COOKIE = "planb_admin"
ADMIN_CSP = "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"


def actor_id(board, accounts=None, address=""):
    """The poster id for this request: the signed-in account, else the device id header, else the network address (a weak last resort)."""
    if accounts is not None and getattr(accounts, "enabled", False):
        bearer = request.headers.get("Authorization", "")
        token = bearer[7:].strip() if bearer.lower().startswith("bearer ") else request.cookies.get("__Host-planb_session" if accounts.secure else "planb_session")
        found = accounts.load_session(token) if token else None
        if found:
            return board.poster_id("account", found[0]["user_id"])
    device = request.headers.get("X-Reroute-Device", "")
    if DEVICE.match(device):
        return board.poster_id("device", device)
    return board.poster_id("address", address or request.remote_addr or "")


def init_moderation(app, board, limiter=None, client=None, env=None):
    env = os.environ if env is None else env

    def token():
        return (env.get("PLANB_ADMIN_TOKEN") or "").strip()

    def cookie_value():
        return hmac.new(token().encode(), b"planb admin cookie", hashlib.sha256).hexdigest()

    def authed():
        supplied = request.headers.get("Authorization", "")
        supplied = supplied[7:].strip() if supplied.lower().startswith("bearer ") else request.headers.get("X-Admin-Token", "")
        if supplied and hmac.compare_digest(supplied.encode(), token().encode()):
            return True
        return hmac.compare_digest(request.cookies.get(COOKIE, "").encode(), cookie_value().encode())

    def throttled():
        """True after too many failed sign-ins from this address."""
        address = client()[0] if client else request.remote_addr
        return bool(limiter) and not limiter.allow("admin-fail", address, 10, 900)[0]

    def same_origin():
        origin = request.headers.get("Origin")
        return not origin or urlsplit(origin).netloc.lower() == request.host.lower()

    def wants_json():
        return request.args.get("format") == "json" or request.accept_mimetypes.best == "application/json" or request.headers.get("Authorization")

    def respond(body, status=200, mimetype="text/html"):
        response = Response(body, status=status, mimetype=mimetype)
        response.headers.update({"Cache-Control": "no-store", "X-Robots-Tag": "noindex", "Content-Security-Policy": ADMIN_CSP, "Referrer-Policy": "no-referrer"})
        return response

    def page(inner, status=200):
        return respond(f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Reroute moderation</title><style>body{{font:15px/1.4 system-ui,sans-serif;margin:16px;max-width:900px;background:#f6f7fa;color:#14161c}}
article{{background:#fff;border:1px solid #d6d9e0;border-radius:10px;padding:12px;margin:12px 0}}.flag{{border-color:#c0392b}}
button{{font:inherit;padding:6px 12px;margin:4px 6px 0 0;border-radius:8px;border:1px solid #888;background:#fff;cursor:pointer}}button.danger{{color:#fff;background:#c0392b;border-color:#c0392b}}
small,code{{color:#555}}input{{font:inherit;padding:6px;width:100%;box-sizing:border-box}}</style></head><body>{inner}</body></html>""", status)

    def item_html(item):
        reports = "".join(f"<li>{escape(r['reason'])}: {escape(r['note'] or '(no note)')} <small>by {escape(r['reporter'] or 'anon')}</small></li>" for r in item["reports"])
        hidden = ' <b>HIDDEN from the board</b>' if item["status"] == "flagged" else ""
        form = lambda action, label, cls="": (f'<form method="post" action="/admin/moderation/action" style="display:inline"><input type="hidden" name="action" value="{action}">'
                                              f'<input type="hidden" name="id" value="{escape(item["id"])}"><button class="{cls}">{label}</button></form>')
        return (f'<article class="{"flag" if item["status"] == "flagged" else ""}"><b>{escape(item["nickname"])}</b> ({escape(item["kind"])}){hidden}<br>'
                f'{escape(item["origin_label"])} to {escape(item["destination_label"])}. Meet: {escape(item["meet_point"])}. Note: {escape(item["note"] or "-")}<br>'
                f'<small>post {escape(item["id"])}, poster <code>{escape(item["poster"] or "unknown")}</code>, leaves {escape(item["depart_at"])}</small>'
                f'<ul>{reports}</ul>{form("approve", "Approve (keep up)")}{form("remove", "Remove post", "danger")}{form("ban", "Remove and ban poster", "danger")}</article>')

    @app.get("/admin/moderation")
    def admin_queue():
        if not token():
            return respond("Not found.", 404, "text/plain")
        if not authed():
            if throttled():
                return respond("Too many attempts.", 429, "text/plain")
            if wants_json():
                return respond('{"error":"Unauthorised."}', 401, "application/json")
            return page('<h1>Reroute moderation</h1><form method="post" action="/admin/moderation/login"><label>Admin token<input type="password" name="token" autocomplete="off" autofocus></label><button>Sign in</button></form>', 401)
        data = board.queue()
        if wants_json():
            return respond(jsonify(data).get_data(), 200, "application/json")
        bans = "".join(f'<li><code>{escape(b["poster"])}</code> since {escape(b["at"])} <form method="post" action="/admin/moderation/action" style="display:inline"><input type="hidden" name="action" value="unban"><input type="hidden" name="poster" value="{escape(b["poster"])}"><button>Unban</button></form></li>' for b in data["bans"])
        log = "".join(f'<li><small>{escape(row["at"])} {escape(row["action"])} {escape(row["ride_id"] or "")} <code>{escape(row["poster"] or "")}</code> {escape(row["detail"])}</small></li>' for row in data["log"])
        return page(f'<h1>Reroute moderation</h1><p>Target: act on reports within 24 hours. {len(data["items"])} post(s) with reports.</p>'
                    f'{"".join(item_html(i) for i in data["items"]) or "<p>Nothing to review.</p>"}<h2>Banned posters</h2><ul>{bans or "<li>None</li>"}</ul><h2>Recent actions</h2><ul>{log or "<li>None</li>"}</ul>')

    @app.post("/admin/moderation/login")
    def admin_login():
        if not token():
            return respond("Not found.", 404, "text/plain")
        if throttled() or not same_origin():
            return respond("Too many attempts.", 429, "text/plain")
        if not hmac.compare_digest(request.form.get("token", "").encode(), token().encode()):
            address = client()[0] if client else request.remote_addr
            if limiter:
                limiter.allow("admin-fail", address, 10, 900)
            return page('<h1>Reroute moderation</h1><p>That token was not accepted.</p><p><a href="/admin/moderation">Try again</a></p>', 401)
        response = redirect("/admin/moderation", 303)
        response.set_cookie(COOKIE, cookie_value(), max_age=8 * 3600, httponly=True, samesite="Strict", secure=request.is_secure, path="/admin")
        response.headers["Cache-Control"] = "no-store"
        return response

    @app.post("/admin/moderation/action")
    def admin_action():
        if not token():
            return respond("Not found.", 404, "text/plain")
        if not authed() or not same_origin():
            return respond('{"error":"Unauthorised."}', 401, "application/json")
        source = request.get_json(silent=True) if request.is_json else request.form
        source = source if hasattr(source, "get") else {}
        try:
            board.moderate(str(source.get("action", "")), str(source.get("id") or "") or None, str(source.get("poster") or "") or None)
        except RideError as error:
            return respond(jsonify({"error": str(error)}).get_data(), 400, "application/json")
        if request.is_json:
            return respond('{"ok":true}', 200, "application/json")
        return redirect("/admin/moderation", 303)
