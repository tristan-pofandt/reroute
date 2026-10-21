"""Run the local Plan B app and keep the Google Maps key on the server."""

from datetime import datetime, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import re
import threading
from urllib.parse import parse_qs, urlsplit

import google_api
from google_api import RoutesError, ServiceError
from gtfs_rt import FeedError, Monitor
from live_routes import BRISBANE, InputError, Services, plan
from rides import Board, RideError

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


KEY, KEY_SOURCE = load_key()
MONITOR = Monitor()
BOARD = Board(HERE / "data" / "rides.json", tz=BRISBANE)
SERVICES = Services(monitor=MONITOR, board=BOARD)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        if os.getenv("PLANB_QUIET") != "1":
            super().log_message(format, *args)

    def send_json(self, status, value):
        content = json.dumps(value).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def query(self):
        return {name: values[0] for name, values in parse_qs(urlsplit(self.path).query).items()}

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == "/api/status":
            now = datetime.now(BRISBANE)
            return self.send_json(200, {
                "live_available": bool(KEY), "key_source": KEY_SOURCE,
                "now": now.strftime("%Y-%m-%dT%H:%M"),
                "departure": (now + timedelta(minutes=5)).strftime("%Y-%m-%dT%H:%M"),
                "deadline": (now + timedelta(minutes=65)).strftime("%Y-%m-%dT%H:%M"),
                "fuel_types": google_api.FUEL_TYPES,
            })
        if path == "/api/alerts":
            try:
                return self.send_json(200, MONITOR.alerts())
            except FeedError as error:
                return self.send_json(502, {"error": str(error)})
        if path == "/api/autocomplete":
            if not KEY:
                return self.send_json(503, {"error": "Address suggestions need the Google Maps API key."})
            query = self.query()
            text = " ".join(query.get("q", "").split())
            session = query.get("session", "")
            if not 2 <= len(text) <= 120 or any(ord(char) < 32 for char in text) or not re.fullmatch(r"[A-Za-z0-9-]{0,64}", session):
                return self.send_json(400, {"error": "Type at least two characters."})
            try:
                lat, lng = float(query.get("lat", "-27.4698")), float(query.get("lng", "153.0251"))
                if not (-45 < lat < -9 and 110 < lng < 155):
                    lat, lng = -27.4698, 153.0251
                return self.send_json(200, {"suggestions": google_api.autocomplete(KEY, text, session, lat, lng)})
            except ValueError:
                return self.send_json(400, {"error": "Enter a valid location."})
            except ServiceError as error:
                return self.send_json(502, {"error": str(error)})
        if path == "/api/fuel":
            if not KEY:
                return self.send_json(503, {"error": "Fuel prices need the Google Maps API key."})
            query = self.query()
            try:
                lat, lng = float(query.get("lat", "-27.4698")), float(query.get("lng", "153.0251"))
                fuel_type = query.get("type", "SP91")
                if fuel_type not in google_api.FUEL_TYPES:
                    raise ValueError
                return self.send_json(200, google_api.fuel_price(KEY, lat, lng, fuel_type) or {"price": None})
            except ValueError:
                return self.send_json(400, {"error": "Enter a valid location and fuel type."})
            except ServiceError as error:
                return self.send_json(502, {"error": str(error)})
        file = FILES.get(path)
        if not file:
            return self.send_error(404)
        content = (HERE / file[0]).read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", file[1])
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def read_json(self, limit=8192):
        if self.headers.get("Content-Type", "").split(";", 1)[0].strip().lower() != "application/json":
            raise PermissionError(415, "Send the request as JSON.")
        origin = self.headers.get("Origin")
        if origin and origin != f"http://{self.headers.get('Host')}":
            raise PermissionError(403, "Requests must come from this local app.")
        length = int(self.headers.get("Content-Length", "0"))
        if not 0 < length <= limit:
            raise PermissionError(413, "The request is too large or empty.")
        return json.loads(self.rfile.read(length))

    def do_POST(self):
        path = urlsplit(self.path).path
        handlers = {
            "/api/plan": lambda body: plan(body, KEY, SERVICES),
            "/api/rides": BOARD.create,
            "/api/rides/join": lambda body: BOARD.join(str(body.get("id", "")), body.get("nickname")),
            "/api/rides/leave": lambda body: BOARD.leave(str(body.get("id", "")), str(body.get("token", ""))),
            "/api/rides/mine": lambda body: {"rides": BOARD.mine([t for t in body.get("tokens", [])[:20] if isinstance(t, str)])},
        }
        handler = handlers.get(path)
        if not handler:
            return self.send_error(404)
        try:
            return self.send_json(200, handler(self.read_json()))
        except PermissionError as error:
            return self.send_json(error.args[0], {"error": error.args[1]})
        except (InputError, RideError) as error:
            return self.send_json(400, {"error": str(error)})
        except RoutesError as error:
            return self.send_json(502, {"error": str(error)})
        except (ValueError, AttributeError, TypeError):
            return self.send_json(400, {"error": "Enter a valid request."})


def warm_feeds():
    """Download the Translink feeds once at start so the first search is quick."""
    try:
        MONITOR.alerts()
        MONITOR.delays()
    except FeedError:
        pass


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    threading.Thread(target=warm_feeds, daemon=True).start()
    print(f"Plan B running at http://127.0.0.1:{port}")
    print("Google Maps key: " + (f"loaded from {KEY_SOURCE}" if KEY else "not found (live search disabled)"))
    server.serve_forever()
