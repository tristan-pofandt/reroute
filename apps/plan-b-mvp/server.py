"""Run the local Plan B site and keep the Google Routes key on the server."""

from datetime import datetime, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
from urllib.parse import urlsplit

from live_routes import BRISBANE, InputError, RoutesError, plan

HERE = Path(__file__).resolve().parent
FILES = {
    "/": ("index.html", "text/html; charset=utf-8"),
    "/index.html": ("index.html", "text/html; charset=utf-8"),
    "/demo.html": ("demo.html", "text/html; charset=utf-8"),
    "/styles.css": ("styles.css", "text/css; charset=utf-8"),
    "/live.css": ("live.css", "text/css; charset=utf-8"),
    "/demo.js": ("demo.js", "text/javascript; charset=utf-8"),
    "/live.js": ("live.js", "text/javascript; charset=utf-8"),
    "/favicon.svg": ("favicon.svg", "image/svg+xml"),
}


class Handler(BaseHTTPRequestHandler):
    def send_json(self, status, value):
        content = json.dumps(value).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == "/api/status":
            now = datetime.now(BRISBANE)
            departure = now + timedelta(minutes=5)
            deadline = departure + timedelta(minutes=60)
            return self.send_json(200, {
                "live_available": bool(os.getenv("MAPS_API_KEY")),
                "departure": departure.strftime("%Y-%m-%dT%H:%M"),
                "deadline": deadline.strftime("%Y-%m-%dT%H:%M"),
            })
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

    def do_POST(self):
        if urlsplit(self.path).path != "/api/plan":
            return self.send_error(404)
        if self.headers.get("Content-Type", "").split(";", 1)[0].strip().lower() != "application/json":
            return self.send_json(415, {"error": "Send the journey as JSON."})
        origin = self.headers.get("Origin")
        if origin and origin != f"http://{self.headers.get('Host')}":
            return self.send_json(403, {"error": "Journey requests must come from this local app."})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 4096:
                return self.send_json(413, {"error": "Journey request is too large or empty."})
            payload = json.loads(self.rfile.read(length))
            result = plan(payload, os.getenv("MAPS_API_KEY"))
        except InputError as error:
            return self.send_json(400, {"error": str(error)})
        except RoutesError as error:
            return self.send_json(502, {"error": str(error)})
        except ValueError:
            return self.send_json(400, {"error": "Enter a valid journey request."})
        return self.send_json(200, result)


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"Plan B running at http://127.0.0.1:{port}")
    server.serve_forever()
