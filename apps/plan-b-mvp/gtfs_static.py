"""Translink SEQ static GTFS: exact route and stop ids for the steps Google returns.

The static feed is about 37 MB zipped. It is downloaded in a background thread (never on a request),
reduced to a small JSON index (routes, stops and which routes serve each stop) and cached in
data/gtfs/index.json so a restart is quick. Requests only ever read the in-memory index; until it is
ready, `match_transit` returns None and the planner falls back to keyword matching.
"""

import csv
import io
import json
import math
from pathlib import Path
import threading
import time
from datetime import datetime, timezone
import zipfile
from urllib.error import URLError
from urllib.request import Request, urlopen

from gtfs_rt import line_keys, train_codes, train_key_matches

URL = "https://gtfsrt.api.translink.com.au/GTFS/SEQ_GTFS.zip"
MAX_AGE = 7 * 86400
RETRY_AFTER = 600
CHECK_EVERY = 6 * 3600
INDEX_VERSION = 1
CELL = 0.002  # degrees, about 220 m
STOP_RADIUS_M = 150
MAX_ROUTE_IDS = 60
MAX_STOPS = 8
# GTFS route_type for each category used by the planner (basic codes plus the common extended ones).
ROUTE_TYPES = {"bus": {3, 700, 701, 702, 703, 704, 705, 706, 707, 708, 709, 710, 711, 712, 713, 714, 715},
               "rail": {1, 2, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109},
               "tram": {0, 900, 901, 902, 903, 904, 905, 906}, "ferry": {4, 1000, 1200}}


def _metres(lat1, lng1, lat2, lng2):
    x = math.radians(lng2 - lng1) * math.cos(math.radians((lat1 + lat2) / 2))
    y = math.radians(lat2 - lat1)
    return 6_371_000 * math.hypot(x, y)


def _csv_rows(archive, name):
    with archive.open(name) as raw:
        yield from csv.DictReader(io.TextIOWrapper(raw, encoding="utf-8-sig", newline=""))


def _float(text):
    try:
        return float(text)
    except (TypeError, ValueError):
        return None


def build_index(archive, built_at=None):
    """Reduce an open GTFS zip to the small index used for matching. stop_times.txt is streamed once."""
    routes, route_index = {}, {}
    for row in _csv_rows(archive, "routes.txt"):
        route_id = row.get("route_id", "")
        if not route_id:
            continue
        try:
            kind = int(row.get("route_type") or -1)
        except ValueError:
            kind = -1
        route_index[route_id] = len(route_index)
        routes[route_id] = [row.get("route_short_name", ""), row.get("route_long_name", ""), kind,
                            (row.get("route_color") or "").strip(), (row.get("route_text_color") or "").strip()]
    route_ids = list(routes)
    trip_route, headsigns = {}, {}
    for row in _csv_rows(archive, "trips.txt"):
        index = route_index.get(row.get("route_id", ""))
        if index is None:
            continue
        trip_route[row["trip_id"]] = index
        sign = (row.get("trip_headsign") or "").strip()
        if sign:
            headsigns.setdefault(index, set()).add(sign)
    stops = {}
    for row in _csv_rows(archive, "stops.txt"):
        lat, lng = _float(row.get("stop_lat")), _float(row.get("stop_lon"))
        if lat is None or lng is None or row.get("location_type") not in (None, "", "0"):
            continue
        stops[row["stop_id"]] = [row.get("stop_name", ""), round(lat, 6), round(lng, 6)]
    stop_routes = {}
    with archive.open("stop_times.txt") as raw:
        header = raw.readline().decode("utf-8-sig").strip().split(",")
        trip_col, stop_col = header.index("trip_id"), header.index("stop_id")
        for line in raw:
            parts = line.rstrip(b"\r\n").split(b",")
            if b'"' in line:
                parts = next(csv.reader([line.decode("utf-8")]))
                trip, stop = parts[trip_col], parts[stop_col]
            else:
                trip, stop = parts[trip_col].decode("utf-8"), parts[stop_col].decode("utf-8")
            index = trip_route.get(trip)
            if index is not None:
                stop_routes.setdefault(stop, set()).add(index)
    stop_routes = {stop: sorted(indexes) for stop, indexes in stop_routes.items() if stop in stops}
    return {"version": INDEX_VERSION, "built_at": built_at if built_at is not None else time.time(),
            "route_ids": route_ids, "routes": routes, "stops": {stop: stops[stop] for stop in stop_routes},
            "stop_routes": stop_routes, "headsigns": {route_ids[i]: sorted(signs) for i, signs in headsigns.items()}}


def _normal(text):
    text = (text or "").lower().replace(" station", "").replace(" railway", "")
    return "".join(char for char in text if char.isalnum() or char == " ").strip()


class Static:
    """Holds the in-memory index, loads it in the background and answers matching questions."""

    def __init__(self, directory, url=URL, opener=None, clock=time.time):
        self.directory = Path(directory)
        self.url = url
        self._open = opener or self._download
        self._clock = clock
        self._lock = threading.Lock()
        self._thread = None
        self.state = "loading"
        self.error = None
        self.data = None
        self.grid = {}

    # ── Status ──────────────────────────────────────────────────────────────

    def status(self):
        data = self.data
        return {"state": self.state,
                "updated": datetime.fromtimestamp(data["built_at"], timezone.utc).isoformat() if data else None,
                "routes": len(data["routes"]) if data else 0}

    def ready(self):
        return self.state == "ready" and self.data is not None

    # ── Loading (always off the request path) ───────────────────────────────

    def start(self):
        """Start the background loader once."""
        with self._lock:
            if self._thread:
                return
            self._thread = threading.Thread(target=self._run, name="gtfs-static", daemon=True)
            self._thread.start()

    def _run(self):
        while True:
            wait = CHECK_EVERY
            try:
                self.ensure()
            except Exception as error:  # a broken download must never take the server down
                self.error = str(error)
                if not self.ready():
                    self.state = "error"
                wait = RETRY_AFTER
            time.sleep(wait)

    def ensure(self):
        """Load the cached index if there is one, and rebuild it from a fresh download when it is older than 7 days."""
        path = self.directory / "index.json"
        if self.data is None and path.exists():
            try:
                self._install(json.loads(path.read_text(encoding="utf-8")))
            except (OSError, ValueError, KeyError):
                pass
        if self.data is not None and self._clock() - self.data["built_at"] < MAX_AGE:
            return
        self.directory.mkdir(parents=True, exist_ok=True)
        archive_path = self.directory / "SEQ_GTFS.zip.part"
        try:
            with self._open(self.url) as response, open(archive_path, "wb") as out:
                while True:
                    chunk = response.read(1 << 20)
                    if not chunk:
                        break
                    out.write(chunk)
            with zipfile.ZipFile(archive_path) as archive:
                index = build_index(archive, self._clock())
        finally:
            archive_path.unlink(missing_ok=True)
        temporary = path.with_suffix(".tmp")
        temporary.write_text(json.dumps(index, separators=(",", ":")), encoding="utf-8")
        temporary.replace(path)
        self._install(index)

    @staticmethod
    def _download(url):
        request = Request(url, headers={"User-Agent": "Reroute-student-MVP"})
        try:
            return urlopen(request, timeout=60)
        except (URLError, TimeoutError, OSError) as error:
            raise OSError("The Translink static GTFS feed could not be reached.") from error

    def _install(self, index):
        if index.get("version") != INDEX_VERSION:
            raise KeyError("version")
        grid = {}
        for stop_id, (_, lat, lng) in index["stops"].items():
            grid.setdefault((int(lat // CELL), int(lng // CELL)), []).append(stop_id)
        self.grid, self.data, self.state, self.error = grid, index, "ready", None

    # ── Matching ────────────────────────────────────────────────────────────

    def stops_near(self, point, radius=STOP_RADIUS_M):
        """Stop ids within `radius` metres of [lat, lng], nearest first."""
        if not self.ready() or not point:
            return []
        lat, lng = point
        cell = (int(lat // CELL), int(lng // CELL))
        found = []
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                for stop_id in self.grid.get((cell[0] + dy, cell[1] + dx), ()):
                    _, stop_lat, stop_lng = self.data["stops"][stop_id]
                    distance = _metres(lat, lng, stop_lat, stop_lng)
                    if distance <= radius:
                        found.append((distance, stop_id))
        return [stop_id for _, stop_id in sorted(found)]

    def _routes_at(self, stop_ids):
        ids = self.data["route_ids"]
        return {ids[index] for stop_id in stop_ids for index in self.data["stop_routes"].get(stop_id, ())}

    def match_transit(self, short_name, long_name, category, headsign, departure_point, arrival_point):
        """Map one Google transit step to GTFS route_ids and stop_ids, or None when the index cannot decide.

        Routes must serve a stop within 150 m of the boarding point (and of the alighting point when known),
        match the vehicle type, then the line name (bus numbers, train station-group codes) and finally the headsign.
        """
        if not self.ready():
            return None
        departure = self.stops_near(departure_point)
        arrival = self.stops_near(arrival_point)
        if not departure:
            return None
        candidates = self._routes_at(departure)
        if arrival:
            both = candidates & self._routes_at(arrival)
            candidates = both or candidates
        routes = self.data["routes"]
        kinds = ROUTE_TYPES.get(category)
        if kinds:
            typed = {route for route in candidates if routes[route][2] in kinds}
            candidates = typed or candidates
        keys = line_keys(short_name) | line_keys(long_name if category == "bus" else "")
        codes = train_codes(short_name) | train_codes(long_name)
        named = {route for route in candidates
                 if routes[route][0].upper() in keys or (codes and train_key_matches(routes[route][0].upper(), codes))}
        if not named and category == "rail" and long_name:
            wanted = _normal(long_name)
            named = {route for route in candidates if wanted and wanted in _normal(routes[route][1])}
        if not named and short_name and category in ("bus", "ferry"):
            return None  # a numbered line that the index cannot place: let the keyword fallback decide
        candidates = named or candidates
        if not candidates:
            return None
        if len({routes[route][0] for route in candidates}) > 1 and headsign:
            sign = _normal(headsign)
            signs = self.data["headsigns"]
            narrowed = {route for route in candidates if any(sign and (sign in _normal(h) or _normal(h) in sign) for h in signs.get(route, ()))}
            candidates = narrowed or candidates
        ordered = sorted(candidates)[:MAX_ROUTE_IDS]
        boarding = next((stop for stop in departure if candidates & self._routes_at([stop])), departure[0])
        colour = next((routes[route][3] for route in ordered if routes[route][3]), "")
        text = next((routes[route][4] for route in ordered if routes[route][4]), "")
        shorts = sorted({routes[route][0] for route in candidates})
        return {"route_ids": ordered, "stop_id": boarding, "dep_stop_ids": departure[:MAX_STOPS], "arr_stop_ids": arrival[:MAX_STOPS],
                "colour": f"#{colour}" if colour else None, "text_colour": f"#{text}" if text else None, "short_names": shorts}
