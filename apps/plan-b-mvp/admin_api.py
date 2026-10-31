"""Admin JSON API for an operator dashboard (Mycelium): runtime switches and daily caps, and signing users out.

Off (404) unless PLANB_ADMIN_TOKEN is set; send it as `Authorization: Bearer <token>`. A wrong token also gets 404, as in ops.py.
Changes last until the process restarts; the PLANB_* environment variables stay the defaults.
shortcut: runtime changes are in memory only; persist them if an operator needs them to survive a redeploy.

  GET  /admin/api/settings          {"rides": bool, "signin": bool, "caps": {"plan": {"limit": n, "used_today": n}, ...}}
  POST /admin/api/settings          any of {"rides": bool, "signin": bool, "caps": {"plan": n}} -> the new settings
  POST /admin/api/sessions/revoke   {"user_id": "u_..."} signs out one user; {} signs out everyone -> {"revoked": n}
"""

import hmac
import logging
import os

from flask import jsonify, request

MAX_CAP = 100_000
log = logging.getLogger("planb.admin")


def init_admin_api(app, parts, acct):
    switches, caps, services = parts["switches"], parts["caps"], parts["services"]

    def authorised():
        token = os.getenv("PLANB_ADMIN_TOKEN", "").strip()  # read per request so the token can be rotated without a rebuild
        given = request.headers.get("Authorization", "").removeprefix("Bearer ").strip()
        return bool(token) and hmac.compare_digest(given.encode(), token.encode())

    def deny():
        return jsonify({"error": "Not found."}), 404

    def bad(message):
        return jsonify({"error": message}), 400

    def settings():
        return {"rides": switches["rides"], "signin": acct.enabled and not acct.signin_paused, "accounts": acct.enabled,
                "caps": {name: {"limit": cap.cap, "used_today": cap.used()} for name, cap in caps.items()}}

    def no_store(response):
        response.headers["Cache-Control"] = "no-store"
        return response

    @app.get("/admin/api/settings")
    def admin_settings():
        return no_store(jsonify(settings())) if authorised() else deny()

    @app.post("/admin/api/settings")
    def admin_settings_change():
        if not authorised():
            return deny()
        body = request.get_json(silent=True)
        if not isinstance(body, dict) or set(body) - {"rides", "signin", "caps"}:
            return bad("Send a JSON object with rides, signin or caps.")
        for flag in ("rides", "signin"):
            if flag in body and not isinstance(body[flag], bool):
                return bad(f"{flag} must be true or false.")
        new_caps = body.get("caps", {})
        if not isinstance(new_caps, dict) or set(new_caps) - set(caps):
            return bad(f"caps can only set: {', '.join(caps)}.")
        for name, value in new_caps.items():
            if not isinstance(value, int) or isinstance(value, bool) or not 0 <= value <= MAX_CAP:
                return bad(f"caps.{name} must be a whole number from 0 (no cap) to {MAX_CAP}.")
        if "signin" in body and not acct.enabled:
            return bad("Accounts are not enabled on this server.")
        # validated: apply all at once
        if "rides" in body:
            switches["rides"] = body["rides"]
            services.board = parts["board"] if body["rides"] else None
        if "signin" in body:
            acct.signin_paused = not body["signin"]
        for name, value in new_caps.items():
            caps[name].cap = value
        log.info("admin settings changed: %s", sorted(body))
        return no_store(jsonify(settings()))

    @app.post("/admin/api/sessions/revoke")
    def admin_revoke():
        if not authorised():
            return deny()
        if not acct.enabled:
            return bad("Accounts are not enabled on this server.")
        body = request.get_json(silent=True)
        user_id = body.get("user_id") if isinstance(body, dict) else None
        if user_id is not None and (not isinstance(user_id, str) or not user_id.startswith("u_") or len(user_id) > 64):
            return bad("user_id must be a Reroute user id (u_...).")
        revoked = acct.revoke_sessions(user_id)
        log.info("admin revoked %d session(s)%s", revoked, " for one user" if user_id else " for everyone")
        return no_store(jsonify({"revoked": revoked}))
