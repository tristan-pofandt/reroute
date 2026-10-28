"""Run the Reroute app (Flask; formerly Plan B) and keep the Google Maps key on the server.

Local: `python server.py`. Production: `gunicorn -w 1 --threads 8 server:app` (one worker, because the
background monitor threads and caches live in the process).
"""

from datetime import datetime, timedelta
import gzip
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

from accounts import init_accounts
import google_api
from google_api import RoutesError, ServiceError
from gtfs_rt import FeedError, Monitor
from gtfs_static import NotReady, Static
from limits import DailyCap, RateLimiter, is_loopback
from live_routes import BRISBANE, PLACE_ID, InputError, Services, live, plan
import offline_area
from ops import init_ops
from offline_area import AreaError, Jobs, Pending, parse_bbox, parse_days
from osm import OSM, OverpassBusy, OverpassError
import push_native
from push import Push, PushError
from moderation import actor_id, init_moderation
from rides import Board, RateLimited, RideError
from security import init_security
from traffic import Traffic
import weather as weather_mod
from weather import Weather

VERSION = "3"
HERE = Path(__file__).resolve().parent
FILES = {
    "/": ("index.html", "text/html; charset=utf-8"),
    "/index.html": ("index.html", "text/html; charset=utf-8"),
    "/terms": ("index.html", "text/html; charset=utf-8"),
    "/privacy": ("index.html", "text/html; charset=utf-8"),
    "/about": ("index.html", "text/html; charset=utf-8"),
    "/account": ("index.html", "text/html; charset=utf-8"),
    "/community": ("index.html", "text/html; charset=utf-8"),
    "/licences": ("index.html", "text/html; charset=utf-8"),
    "/support": ("index.html", "text/html; charset=utf-8"),
    "/app.js": ("app.js", "text/javascript; charset=utf-8"),
    "/app.css": ("app.css", "text/css; charset=utf-8"),
    "/offline.js": ("offline.js", "text/javascript; charset=utf-8"),
    "/motion.js": ("motion.js", "text/javascript; charset=utf-8"),
    "/vendor/gsap.min.js": ("vendor/gsap.min.js", "text/javascript; charset=utf-8"),
    "/vendor/ScrollTrigger.min.js": ("vendor/ScrollTrigger.min.js", "text/javascript; charset=utf-8"),
    "/vendor/Flip.min.js": ("vendor/Flip.min.js", "text/javascript; charset=utf-8"),
    "/vendor/lenis.min.js": ("vendor/lenis.min.js", "text/javascript; charset=utf-8"),
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


def shared_key_warning(server_key, browser_key):
    """A start-up warning when the key served to every browser is also the server's Routes and Places key, else None."""
    if not (server_key and browser_key and server_key == browser_key):
        return None
    return ("WARNING: MAPS_BROWSER_API_KEY is the same key as MAPS_API_KEY. The browser key is sent to every visitor by /api/config, so this key is exposed. "
            "Use a separate browser key restricted to the Maps JavaScript API and to your HTTP referrers, and keep MAPS_API_KEY server-side only.")


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


class Limited(Exception):
    """A visitor has used up their hourly offline downloads; `wait` is the number of seconds until the next one is allowed."""

    def __init__(self, wait):
        super().__init__(wait)
        self.wait = wait


def json_bytes(text):
    """A response for JSON that is already encoded (the large offline extracts), gzipped when the browser accepts it."""
    response = Response(text, mimetype="application/json")
    if len(text) > 1024 and "gzip" in request.headers.get("Accept-Encoding", "").lower():
        response.set_data(gzip.compress(text, 6))  # numbers in JSON shrink about five times, which matters on a phone connection
        response.headers["Content-Encoding"] = "gzip"
    response.headers["Vary"] = "Accept-Encoding"
    response.headers["Cache-Control"] = "no-store"
    return response


def _coordinates(args, default=None):
    """lat and lng query values inside Australia, else ValueError."""
    if default is None and ("lat" not in args or "lng" not in args):
        raise ValueError
    lat, lng = float(args.get("lat", default[0] if default else 0)), float(args.get("lng", default[1] if default else 0))
    if not (-45 < lat < -9 and 110 < lng < 155):
        raise ValueError
    return lat, lng


def create_app(key=UNSET, data_dir=None, monitor=None, board=None, static=None, weather=None, traffic=None, push=None, services=None,
               clock=time.time, public_url=None, osm=None, offline_wait=offline_area.WAIT_SECONDS):
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
    osm = osm if osm is not None else OSM(data / "offline")
    services = services or Services(monitor=monitor, board=board, static=static, weather=weather, traffic=traffic)
    public_url = public_url if public_url is not None else (os.getenv("PUBLIC_URL") or "").strip().rstrip("/") or None
    limiter = RateLimiter(clock)
    plan_limit, autocomplete_limit, fuel_limit = (_int("PLANB_PLAN_LIMIT_PER_HOUR", 40), _int("PLANB_AUTOCOMPLETE_LIMIT_PER_HOUR", 400),
                                                  _int("PLANB_FUEL_LIMIT_PER_HOUR", 120))
    place_limit = _int("PLANB_PLACE_LIMIT_PER_HOUR", 60)
    offline_limit = _int("PLANB_OFFLINE_LIMIT_PER_HOUR", 6)  # each of the map and the timetable; these are not Google requests
    waiting = threading.BoundedSemaphore(offline_area.MAX_WAITING)  # shared, so at most two threads ever wait on offline extracts
    jobs = {"map": Jobs("map", offline_wait, clock, waiting), "transit": Jobs("transit", offline_wait, clock, waiting)}
    caps = {"plan": DailyCap(_int("PLANB_DAILY_GOOGLE_CAP", 50), clock), "autocomplete": DailyCap(_int("PLANB_DAILY_AUTOCOMPLETE_CAP", 500), clock)}
    maps_browser_key = os.getenv("MAPS_BROWSER_API_KEY", "").strip() or None
    warning = shared_key_warning(key, maps_browser_key)
    if warning:
        print(warning, flush=True)

    app = Flask(__name__, static_folder=None)
    app.json.sort_keys = False
    trusted = _int("PLANB_TRUST_PROXY", 0)
    if trusted:
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=trusted, x_proto=trusted, x_host=trusted)
    app.extensions["planb"] = {"key": key, "monitor": monitor, "board": board, "static": static, "weather": weather, "traffic": traffic,
                               "push": push, "services": services, "limiter": limiter, "caps": caps, "osm": osm, "jobs": jobs}
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
            what = "address suggestions. Type the full address instead" if cap == "autocomplete" else "live searches. Try again tomorrow"
            return failure(f"Reroute has reached its daily limit of {what}.", 429)
        return None

    def offline_admit(bucket):
        """A check run only when a new extract is about to start: raises Limited when this device has used its hourly allowance.

        Cached answers, joins of an extract already running and "still preparing" retries are never counted. Counts with or without a key.
        """
        def check():
            address, local = client()
            if local:
                return
            allowed, wait = limiter.allow(bucket, address, offline_limit)
            if not allowed:
                raise Limited(wait)
        return check

    def limited(error):
        response = failure(f"Too many offline downloads from this device. Try again in about {max(1, error.wait // 60)} minute(s).", 429)
        response.headers["Retry-After"] = str(error.wait)
        return response

    def broken(what):
        app.logger.exception("Offline %s extract failed", what)
        return failure("The offline data could not be prepared. Try again later.", 500)

    def preparing(message):
        response = failure(message, 503)
        response.headers["Retry-After"] = "60"
        return response

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
            if urlsplit(origin).netloc.lower() not in allowed and origin.rstrip("/") not in app.config["PLANB_CORS_ORIGINS"]:
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
        except RateLimited as error:
            response = failure(str(error), 429)
            response.headers["Retry-After"] = str(error.wait)
            return response
        except (InputError, RideError) as error:
            return failure(str(error), 400)
        except RoutesError as error:
            return failure(str(error), 502)
        except FeedError as error:
            return failure(str(error), 502)
        except (ValueError, AttributeError, TypeError):
            return failure("Enter a valid request.", 400)

    def serve(name, mimetype):
        # The React shell (web/, built with `npm run build`) replaces index.html when web/dist exists; the legacy page is the fallback.
        dist = HERE / "web" / "dist"
        folder = dist if name == "index.html" and (dist / "index.html").is_file() else HERE
        response = send_from_directory(folder, name, mimetype=mimetype.split(";")[0])
        response.headers["Cache-Control"] = "no-cache"
        return response

    @app.get("/assets/<path:name>")
    def built_asset(name):
        """Hashed Vite output (web/dist/assets): the file name changes with its content, so it can be cached for good."""
        folder = HERE / "web" / "dist" / "assets"
        if not folder.is_dir() or not (folder / name).is_file():
            return failure("Not found.", 404)
        response = send_from_directory(folder, name)
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
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
            "offline_limits": offline_area.limits(), "offline_transit": static.offline_status(),
        })

    @app.get("/api/config")
    def public_config():
        return reply({"maps_browser_key": maps_browser_key})

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

    # Choose on map: the name and address of a place icon the traveller tapped. Counts towards the daily address-lookup cap.
    @app.get("/api/place")
    def place_api():
        if not key:
            return failure("Place names need the Google Maps API key.", 503)
        place_id = request.args.get("id", "")
        if not PLACE_ID.match(place_id):
            return failure("Choose the place on the map again.", 400)
        blocked = guard("place", place_limit, "autocomplete")
        if blocked:
            return blocked
        try:
            found = google_api.place_details(key, place_id)
        except ServiceError as error:
            return failure(str(error), 502)
        if not found:
            return failure("Google has no details for that place.", 404)
        return reply(found)

    @app.get("/api/fuel")
    def fuel():
        if not key:
            return failure("Fuel prices need the Google Maps API key.", 503)
        query = request.args
        try:
            lat, lng = _coordinates(query, (-27.4698, 153.0251))  # inside Australia only (also rejects NaN and infinity)
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
        if request.args.get("detail") == "1":
            found = weather_mod.simulate_detail(demo) if demo != "live" else weather.details(lat, lng)
        else:
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

    # ── Offline area download (OpenStreetMap map and Translink timetable) ─

    # Both extracts run in a background job; a request waits for at most `offline_wait` seconds (40) and otherwise gets a 503 asking to
    # try again in a minute, by when the finished extract is kept for it. So no request comes near gunicorn's 60 second timeout.
    @app.get("/api/offline/map")
    def offline_map():
        try:
            bbox = parse_bbox(request.args)
        except AreaError as error:
            return failure(str(error), 400)
        try:
            # A cached area is answered at once, even while another area is being fetched from Overpass.
            return json_bytes(osm.cached(bbox) or jobs["map"].run(tuple(bbox), lambda: osm.area_json(bbox), offline_admit("offline-map")))
        except Pending as error:
            return preparing(f"{error} Map data for a busy area can take a couple of minutes.")
        except Limited as error:
            return limited(error)
        except OverpassBusy as error:
            return failure(str(error), 429)
        except OverpassError as error:
            return failure(str(error), 502)
        except Exception:  # a bug or bad data must still answer in JSON, not with Flask's HTML error page
            return broken("map")

    @app.get("/api/offline/transit")
    def offline_transit():
        try:
            bbox = parse_bbox(request.args)
            days = parse_days(request.args.get("days"))
        except AreaError as error:
            return failure(str(error), 400)
        if static.offline_status() != "ready":
            return preparing(not_ready_message())
        today = datetime.now(BRISBANE).date()
        try:
            return json_bytes(static.cached_timetable(bbox, days, today)
                              or jobs["transit"].run((tuple(bbox), days, today.isoformat()), lambda: static.area_timetable_json(bbox, days, today),
                                                     offline_admit("offline-transit")))
        except Pending as error:
            return preparing(str(error))
        except Limited as error:
            return limited(error)
        except NotReady:
            return preparing(not_ready_message())
        except Exception:  # a bug or bad GTFS data must still answer in JSON, not with Flask's HTML error page
            return broken("timetable")

    def not_ready_message():
        if static.offline_status() == "unavailable":
            return "The Translink timetable could not be downloaded to the server yet. Try again in a few minutes."
        return "The Translink timetable is still being downloaded to the server. Try again in a few minutes."

    # ── JSON POST API ──────────────────────────────────────────────────────

    @app.post("/api/plan")
    def plan_api():
        blocked = guard("plan", plan_limit, "plan")
        return blocked or post(lambda body: hide_blocked(plan(body, key, services)))

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

    def who():
        return actor_id(board, app.extensions.get("accounts"), client()[0])

    def hide_blocked(result):
        """Drop rides posted by anyone this visitor has blocked from a plan answer."""
        if isinstance(result, dict) and result.get("rides"):
            blocked = {entry["poster"] for entry in board.blocks(who())}
            result["rides"] = [ride for ride in result["rides"] if ride["poster"] not in blocked or ride["is_member"]]
        return result

    @app.post("/api/rides")
    def rides_create():
        return post(lambda body: board.create(body, who()))

    @app.post("/api/rides/join")
    def rides_join():
        return post(lambda body: board.join(str(body.get("id", "")), body.get("nickname"), who()))

    @app.post("/api/rides/leave")
    def rides_leave():
        return post(lambda body: board.leave(str(body.get("id", "")), str(body.get("token", ""))))

    @app.post("/api/rides/mine")
    def rides_mine():
        return post(lambda body: {"rides": board.mine([t for t in body.get("tokens", [])[:20] if isinstance(t, str)])})

    @app.post("/api/rides/report")
    def rides_report():
        return post(lambda body: board.report(str(body.get("id", "")), body.get("reason"), body.get("note"), who()))

    @app.post("/api/rides/block")
    def rides_block():
        return post(lambda body: board.block(who(), ride_id=str(body["id"]) if body.get("id") else None, poster=body.get("poster"), nickname=body.get("nickname")))

    @app.post("/api/rides/unblock")
    def rides_unblock():
        return post(lambda body: board.unblock(who(), str(body.get("poster", ""))))

    @app.get("/api/rides/blocks")
    def rides_blocks():
        return reply({"blocked": board.blocks(who())})

    init_moderation(app, board, limiter=limiter, client=client)

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

    def native_guard():
        # A custom header makes the request non-simple, so a browser only sends it cross-site when CORS allows the origin (CSRF-safe without cookies' token).
        if not push_native.DEVICE.match(request.headers.get("X-Reroute-Device", "")):
            return failure("Send the X-Reroute-Device header.", 400)
        return push_guard()

    @app.post("/api/push/native-register")
    def push_native_register():
        if not push.native_ready():
            return failure("Native push notifications are not set up on this server.", 503)
        accounts = app.extensions.get("accounts")
        return native_guard() or post(lambda body: {"ok": True, "id": push.register_native(body, accounts.request_user(request) if accounts else None)}, limit=16384)

    @app.post("/api/push/native-unregister")
    def push_native_unregister():
        return native_guard() or post(lambda body: {"ok": True, "removed": push.unregister_native(body.get("token"))})

    @app.post("/api/push/unsubscribe")
    def push_unsubscribe():
        return post(lambda body: {"removed": push.unsubscribe(body.get("endpoint"))})

    @app.post("/api/push/test")
    def push_test():
        return push_guard() or post(lambda body: {"ok": True, **push.test(body.get("endpoint"), body.get("delay_s", 0))})

    # Accounts (Google / Apple sign-in, synced data); off unless ACCOUNTS_SECRET_KEY is set. See accounts.py.
    init_security(app)
    acct = init_accounts(app, data, limiter=limiter, client=client, public_url=public_url, trusted_proxy=bool(trusted), clock=clock)
    acct.on_delete.append(push.forget_user)

    app.config["PLANB_VERSION"] = VERSION
    init_ops(app, app.extensions["planb"])  # /healthz, /readyz, /admin/usage, optional Sentry (ops.py)

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
    print(f"Reroute running at http://{host}:{port}")
    print("Google Maps key: " + (f"loaded from {app.config['PLANB_KEY_SOURCE']}" if app.extensions["planb"]["key"] else "not found (live search disabled)"))
    app.run(host=host, port=port, threaded=True, use_reloader=False)
