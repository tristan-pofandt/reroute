"""Run the Plan B app (Flask) and keep the Google Maps key on the server.

Local: `python server.py`. Production: `gunicorn -w 1 --threads 8 server:app` (one worker, because the
background monitor threads and caches live in the process).
"""

from datetime import datetime, timedelta
import io
import json
import logging
import os
from pathlib import Path
import re
import threading
import time
from urllib.parse import urlsplit

from flask import Flask, Response, jsonify, request, send_from_directory
from werkzeug.middleware.proxy_fix import ProxyFix

import google_api
from google_api import RoutesError, ServiceError
from gtfs_rt import FeedError, Monitor
from gtfs_static import Static
from limits import DailyCap, RateLimiter, is_loopback
from live_routes import BRISBANE, InputError, Services, live, plan
from push import Push, PushError
from rides import Board, RideError
from traffic import Traffic
import weather as weather_mod
from weather import Weather

VERSION = "3"
HERE = Path(__file__).resolve().parent
FILES = {
    "/": ("index.html", "text/html; charset=utf-8"),
    "/index.html": ("index.html", "text/html; charset=utf-8"),
    "/app.js": ("app.js", "text/javascript; charset=utf-8"),
    "/app.css": ("app.css", "text/css; charset=utf-8"),
    "/demo.html": ("demo.html", "text/html; charset=utf-8"),
    "/demo.js": ("demo.js", "text/javascript; charset=utf-8"),
    "/styles.css": ("styles.css", "text/css; charset=utf-8"),
    "/favicon.svg": ("favicon.svg", "image/svg+xml"),
}
# The key is read from the environment first, then from a local .env file. The Prototype 6
# .env is used as a fallback so the team's existing key works without copying it.
ENV_FILES = (HERE / ".env", HERE.parent / "prototype-6-2026-09-23" / ".env")
UNSET = object()
SAFE_NAME = re.compile(r"^[A-Za-z0-9._-]{1,80}$")
ROUTE_ID = re.compile(r"^[A-Za-z0-9._-]{1,40}$")


def load_key():
    if os.getenv("MAPS_API_KEY"):
        return os.environ["MAPS_API_KEY"].strip(), "environment"
    for path in ENV_FILES:
        try:
            for line in path.read_text(encoding="utf-8").splitlines():
                name, _, value = line.partition("=")
                value = value.strip().strip('"').strip("'")
                if name.strip() == "MAPS_API_KEY" and value and value != "your_key_here":
                    return value, path.relative_to(HERE.parent).as_posix()
        except OSError:
            continue
    return None, None


def _int(name, default):
    try:
        return int(os.getenv(name, default))
    except ValueError:
        return default


def reply(value, status=200):
    response = jsonify(value)
    response.status_code = status
    response.headers["Cache-Control"] = "no-store"
    return response


def failure(message, status):
    return reply({"error": message}, status)


def _coordinates(args, default=None):
    """lat and lng query values inside Australia, else ValueError."""
    if default is None and ("lat" not in args or "lng" not in args):
        raise ValueError
    lat, lng = float(args.get("lat", default[0] if default else 0)), float(args.get("lng", default[1] if default else 0))
    if not (-45 < lat < -9 and 110 < lng < 155):
        raise ValueError
    return lat, lng


def create_app(key=UNSET, data_dir=None, monitor=None, board=None, static=None, weather=None, traffic=None, push=None, services=None,
               clock=time.time, public_url=None):
    """Build the Flask app. Every external dependency can be replaced, which is how the tests avoid the network."""
    if key is UNSET:
        key, key_source = load_key()
    else:
        key_source = "test" if key else None
    data = Path(data_dir or os.getenv("PLANB_DATA_DIR") or HERE / "data")
    monitor = monitor or Monitor()
    board = board or Board(data / "rides.json", tz=BRISBANE)
    static = static if static is not None else Static(data / "gtfs")
    weather = weather if weather is not None else Weather()
    traffic = traffic if traffic is not None else Traffic(os.getenv("QLDTRAFFIC_API_KEY") or None)
    push = push if push is not None else Push(data, monitor)
    services = services or Services(monitor=monitor, board=board, static=static, weather=weather, traffic=traffic)
    public_url = public_url if public_url is not None else (os.getenv("PUBLIC_URL") or "").strip().rstrip("/") or None
    limiter = RateLimiter(clock)
    plan_limit, autocomplete_limit, fuel_limit = (_int("PLANB_PLAN_LIMIT_PER_HOUR", 40), _int("PLANB_AUTOCOMPLETE_LIMIT_PER_HOUR", 400),
                                                  _int("PLANB_FUEL_LIMIT_PER_HOUR", 120))
    caps = {"plan": DailyCap(_int("PLANB_DAILY_GOOGLE_CAP", 1500), clock), "autocomplete": DailyCap(_int("PLANB_DAILY_AUTOCOMPLETE_CAP", 15000), clock)}

    app = Flask(__name__, static_folder=None)
    app.json.sort_keys = False
    trusted = _int("PLANB_TRUST_PROXY", 0)
    if trusted:
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=trusted, x_proto=trusted, x_host=trusted)
    app.extensions["planb"] = {"key": key, "monitor": monitor, "board": board, "static": static, "weather": weather, "traffic": traffic,
                               "push": push, "services": services, "limiter": limiter, "caps": caps}
    app.config["PLANB_KEY_SOURCE"] = key_source

    # ── Helpers ────────────────────────────────────────────────────────────

    def client():
        """(address to rate-limit, whether the request is the developer's own machine with no proxy in front)."""
        remote = request.remote_addr or ""
        if is_loopback(remote):
            forwarded = request.headers.get("CF-Connecting-IP") or request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
            return (forwarded, False) if forwarded else (remote, True)
        return remote, False

    def guard(bucket, per_hour, cap=None):
        """A 429 response when this device or the whole day has used up Google-backed requests, else None."""
        address, local = client()
        if not key:
            return None
        if not local:
            allowed, wait = limiter.allow(bucket, address, per_hour)
            if not allowed:
                response = failure(f"Too many requests from this device. Try again in about {max(1, wait // 60)} minute(s).", 429)
                response.headers["Retry-After"] = str(wait)
                return response
        if cap and not caps[cap].take():
            return failure("Plan B has reached its daily limit of live searches. Try again tomorrow.", 429)
        return None

    def read_json(limit=8192, allow_empty=False):
        try:
            length = int(request.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        empty = length == 0 and allow_empty
        if not empty and request.headers.get("Content-Type", "").split(";", 1)[0].strip().lower() != "application/json":
            raise PermissionError(415, "Send the request as JSON.")
        origin = request.headers.get("Origin")
        if origin:
            allowed = {request.host.lower()}
            if is_loopback(request.remote_addr) or trusted:
                allowed |= {h.strip().lower() for h in request.headers.get("X-Forwarded-Host", "").split(",") if h.strip()}
            if public_url:
                allowed.add(urlsplit(public_url).netloc.lower())
            if urlsplit(origin).netloc.lower() not in allowed:
                raise PermissionError(403, "Requests must come from this app.")
        if empty:
            return {}
        if not 0 < length <= limit:
            raise PermissionError(413, "The request is too large or empty.")
        return json.loads(request.get_data(cache=False))

    def post(handler, limit=8192, allow_empty=False):
        try:
            return reply(handler(read_json(limit, allow_empty)))
        except PermissionError as error:
            return failure(error.args[1], error.args[0])
        except PushError as error:
            return failure(str(error), error.status)
        except (InputError, RideError) as error:
            return failure(str(error), 400)
        except RoutesError as error:
            return failure(str(error), 502)
        except FeedError as error:
            return failure(str(error), 502)
        except (ValueError, AttributeError, TypeError):
            return failure("Enter a valid request.", 400)

    def serve(name, mimetype):
        response = send_from_directory(HERE, name, mimetype=mimetype.split(";")[0])
        response.headers["Cache-Control"] = "no-cache"
        return response

    # ── Static files and the PWA ───────────────────────────────────────────

    for path, (name, mimetype) in FILES.items():
        app.add_url_rule(path, f"file-{name}-{path}", lambda name=name, mimetype=mimetype: serve(name, mimetype))

    @app.get("/manifest.webmanifest")
    def manifest():
        if not (HERE / "manifest.webmanifest").is_file():
            return failure("Not found.", 404)
        return serve("manifest.webmanifest", "application/manifest+json")

    @app.get("/sw.js")
    def service_worker():
        if not (HERE / "sw.js").is_file():
            return failure("Not found.", 404)
        response = serve("sw.js", "text/javascript; charset=utf-8")
        response.headers["Service-Worker-Allowed"] = "/"
        return response

    @app.get("/icons/<name>")
    def icon(name):
        if not SAFE_NAME.match(name) or not name.lower().endswith(".png") or not (HERE / "icons" / name).is_file():
            return failure("Not found.", 404)
        response = send_from_directory(HERE / "icons", name, mimetype="image/png")
        response.headers["Cache-Control"] = "public, max-age=86400"
        return response

    @app.get("/qr.svg")
    def qr():
        import segno
        base = request.url_root
        if is_loopback(request.remote_addr) and request.headers.get("X-Forwarded-Proto") == "https" and base.startswith("http://"):
            base = "https://" + base[len("http://"):]  # a local tunnel such as cloudflared terminates https for us
        target = request.args.get("url") or public_url or base
        if not re.fullmatch(r"https?://[^\s]{3,300}", target):
            return failure("Give a web address starting with http:// or https://.", 400)
        buffer = io.BytesIO()
        segno.make(target, error="m").save(buffer, kind="svg", scale=10, border=2, dark="#000000", light="#FFFFFF", xmldecl=False, nl=False)
        return Response(buffer.getvalue(), mimetype="image/svg+xml", headers={"Cache-Control": "public, max-age=3600"})

    # ── Read-only API ──────────────────────────────────────────────────────

    @app.get("/api/status")
    def status():
        now = datetime.now(BRISBANE)
        return reply({
            "live_available": bool(key), "key_source": key_source,
            "now": now.strftime("%Y-%m-%dT%H:%M"),
            "departure": (now + timedelta(minutes=5)).strftime("%Y-%m-%dT%H:%M"),
            "deadline": (now + timedelta(minutes=65)).strftime("%Y-%m-%dT%H:%M"),
            "fuel_types": google_api.FUEL_TYPES,
            "push": push.ready(), "gtfs_static": static.status(), "public_url": public_url, "version": VERSION,
        })

    @app.get("/api/alerts")
    def alerts():
        try:
            return reply(monitor.alerts())
        except FeedError as error:
            return failure(str(error), 502)

    @app.get("/api/autocomplete")
    def autocomplete():
        if not key:
            return failure("Address suggestions need the Google Maps API key.", 503)
        query = request.args
        text = " ".join(query.get("q", "").split())
        session = query.get("session", "")
        if not 2 <= len(text) <= 120 or any(ord(char) < 32 for char in text) or not re.fullmatch(r"[A-Za-z0-9-]{0,64}", session):
            return failure("Type at least two characters.", 400)
        blocked = guard("autocomplete", autocomplete_limit, "autocomplete")
        if blocked:
            return blocked
        try:
            lat, lng = float(query.get("lat", "-27.4698")), float(query.get("lng", "153.0251"))
            if not (-45 < lat < -9 and 110 < lng < 155):
                lat, lng = -27.4698, 153.0251
            return reply({"suggestions": google_api.autocomplete(key, text, session, lat, lng)})
        except ValueError:
            return failure("Enter a valid location.", 400)
        except ServiceError as error:
            return failure(str(error), 502)

    @app.get("/api/fuel")
    def fuel():
        if not key:
            return failure("Fuel prices need the Google Maps API key.", 503)
        query = request.args
        try:
            lat, lng = float(query.get("lat", "-27.4698")), float(query.get("lng", "153.0251"))
            fuel_type = query.get("type", "SP91")
            if fuel_type not in google_api.FUEL_TYPES:
                raise ValueError
            blocked = guard("fuel", fuel_limit)
            if blocked:
                return blocked
            return reply(google_api.fuel_price(key, lat, lng, fuel_type) or {"price": None})
        except ValueError:
            return failure("Enter a valid location and fuel type.", 400)
        except ServiceError as error:
            return failure(str(error), 502)

    @app.get("/api/weather")
    def weather_api():
        try:
            lat, lng = _coordinates(request.args)
        except ValueError:
            return failure("Enter a valid location in Australia.", 400)
        demo = request.args.get("demo", "live")
        if demo not in ("live", "clear", "rain", "storm", "heat"):
            return failure("Demo weather must be live, clear, rain, storm or heat.", 400)
        found = weather_mod.simulate(demo) if demo != "live" else weather.forecast(lat, lng)
        if not found:
            return failure("Weather is unavailable right now.", 502)
        return reply(weather_mod.public(found))

    @app.get("/api/vehicles")
    def vehicles():
        ids = [item for item in request.args.get("route_ids", "").split(",") if item]
        if not ids or len(ids) > 10 or not all(ROUTE_ID.match(item) for item in ids):
            return failure("Give between one and ten route ids.", 400)
        try:
            found, fetched = monitor.vehicles(ids, 100)
        except FeedError as error:
            return failure(str(error), 502)
        return reply({"vehicles": found, "fetched_at": fetched})

    @app.get("/api/traffic")
    def traffic_api():
        try:
            lat, lng = _coordinates(request.args)
            radius = min(50.0, max(0.1, float(request.args.get("radius_km", "10"))))
        except ValueError:
            return failure("Enter a valid location in Australia and a radius in kilometres.", 400)
        events, available = traffic.near_point(lat, lng, radius, datetime.now(BRISBANE))
        return reply({"events": events, "available": available, "fetched_at": datetime.now(BRISBANE).isoformat()})

    # ── JSON POST API ──────────────────────────────────────────────────────

    @app.post("/api/plan")
    def plan_api():
        blocked = guard("plan", plan_limit, "plan")
        return blocked or post(lambda body: plan(body, key, services))

    @app.post("/api/live")
    def live_api():
        return post(lambda body: live(body, services), limit=32768)

    @app.post("/api/sync")
    def sync_api():
        def run(body):
            try:
                found, vehicle_count, fetched = monitor.refresh()
            except FeedError as error:
                raise PermissionError(502, str(error)) from error
            current = None
            try:
                lat, lng = _coordinates(body) if "lat" in body and "lng" in body else (None, None)
            except (ValueError, TypeError) as error:
                raise InputError("Enter a valid location in Australia.") from error
            if lat is not None:
                current = weather_mod.public(weather.forecast(lat, lng, force=True))
            disruptive = sum(1 for alert in found["alerts"] if alert["disruptive"])
            message = f"Live data refreshed: {len(found['alerts'])} alerts ({disruptive} disruptive), {vehicle_count} vehicles"
            return {"status": "success", "message": message + (", weather updated." if current else "."), "alerts": len(found["alerts"]),
                    "disruptive": disruptive, "weather": current, "vehicles": vehicle_count, "fetched_at": found["fetched_at"]}
        address, local = client()
        if key and not local and not limiter.allow("sync", address, 30)[0]:
            return failure("Too many refreshes. Try again in a few minutes.", 429)
        response = post(run, allow_empty=True)
        if response.status_code >= 400:
            response = reply({"status": "error", "message": response.get_json().get("error", "Refresh failed."), "error": response.get_json().get("error", "Refresh failed.")},
                             response.status_code)
        return response

    @app.post("/api/rides")
    def rides_create():
        return post(board.create)

    @app.post("/api/rides/join")
    def rides_join():
        return post(lambda body: board.join(str(body.get("id", "")), body.get("nickname")))

    @app.post("/api/rides/leave")
    def rides_leave():
        return post(lambda body: board.leave(str(body.get("id", "")), str(body.get("token", ""))))

    @app.post("/api/rides/mine")
    def rides_mine():
        return post(lambda body: {"rides": board.mine([t for t in body.get("tokens", [])[:20] if isinstance(t, str)])})

    # ── Push ───────────────────────────────────────────────────────────────

    def push_guard():
        address, local = client()
        if not local and not limiter.allow("push", address, 60)[0]:
            return failure("Too many requests from this device. Try again later.", 429)
        return None

    @app.get("/api/push/key")
    def push_key():
        if not push.ready():
            return failure("Push notifications are not available on this server.", 503)
        return reply({"publicKey": push.public_key})

    @app.post("/api/push/subscribe")
    def push_subscribe():
        return push_guard() or post(lambda body: {"id": push.subscribe(body.get("subscription"), body.get("watch"))}, limit=16384)

    @app.post("/api/push/unsubscribe")
    def push_unsubscribe():
        return post(lambda body: {"removed": push.unsubscribe(body.get("endpoint"))})

    @app.post("/api/push/test")
    def push_test():
        return push_guard() or post(lambda body: {"ok": True, **push.test(body.get("endpoint"), body.get("delay_s", 0))})

    @app.errorhandler(500)
    def server_error(error):
        if request.path.startswith("/api/"):
            return failure("Something went wrong on the server.", 500)
        return error

    return app


# ── Process wiring ─────────────────────────────────────────────────────────────

app = create_app()
_started = threading.Lock()
_started_once = False


def start_background():
    """Start the static GTFS loader, the Translink warm-up and the push monitor, once per process."""
    global _started_once
    if os.getenv("PLANB_NO_BACKGROUND") == "1":
        return
    with _started:
        if _started_once:
            return
        _started_once = True
    parts = app.extensions["planb"]
    parts["static"].start()
    parts["push"].start()

    def warm():
        try:
            parts["monitor"].alerts()
            parts["monitor"].delays()
            parts["monitor"].vehicles()
        except FeedError:
            pass

    threading.Thread(target=warm, name="feed-warmup", daemon=True).start()


start_background()


if __name__ == "__main__":
    host, port = os.getenv("HOST", "127.0.0.1"), int(os.getenv("PORT", "8000"))
    if os.getenv("PLANB_QUIET") == "1":
        logging.getLogger("werkzeug").setLevel(logging.ERROR)
    print(f"Plan B running at http://{host}:{port}")
    print("Google Maps key: " + (f"loaded from {app.config['PLANB_KEY_SOURCE']}" if app.extensions["planb"]["key"] else "not found (live search disabled)"))
    app.run(host=host, port=port, threaded=True, use_reloader=False)
