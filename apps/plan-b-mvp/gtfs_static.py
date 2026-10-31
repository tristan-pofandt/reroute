"""Translink SEQ static GTFS: exact route and stop ids for the steps Google returns, and timetables for offline areas.

The static feed is about 37 MB zipped. It is downloaded in a background thread (never on a request),
reduced to a small JSON index (routes, stops and which routes serve each stop) and cached in
data/gtfs/index.json so a restart is quick. Requests only ever read the in-memory index; until it is
ready, `match_transit` returns None and the planner falls back to keyword matching.

The zip itself is kept as data/gtfs/SEQ_GTFS.zip (replaced atomically by each new download) so that an
offline area's timetable can be cut from it later: `area_timetable` streams stop_times.txt once and keeps
only the stops inside the area and the trips that run on the chosen days (a few seconds for a dense area).
"""

from collections import Counter, OrderedDict
import csv
import io
import json
import math
from pathlib import Path
import threading
import time
from datetime import datetime, timedelta, timezone
import re
import zipfile
from urllib.error import URLError
from urllib.request import Request, urlopen

from gtfs_rt import line_keys, train_codes, train_key_matches
from mycelium_emitter import emit, timed
from offline_area import clip_runs, flat, simplify

URL = "https://gtfsrt.api.translink.com.au/GTFS/SEQ_GTFS.zip"
MAX_AGE = 7 * 86400
RETRY_AFTER = 600
CHECK_EVERY = 6 * 3600
INDEX_VERSION = 1
CELL = 0.002  # degrees, about 220 m
STOP_RADIUS_M = 150
MAX_ROUTE_IDS = 60
MAX_STOPS = 8
DAY_SECONDS = 86400
ARCHIVE = "SEQ_GTFS.zip"
EXTRACT_CACHE = 4  # timetable extracts kept in memory (as JSON bytes, a few MB each)
SHAPE_TOLERANCE_M = 5
BRISBANE = timezone(timedelta(hours=10), "AEST")
WEEKDAYS = ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday")
HEX_COLOUR = re.compile(r"^[0-9A-Fa-f]{6}$")
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
        self.archive_ready = False  # the zip is on disk, so offline timetables can be extracted
        self.archive_error = False
        self._extract_lock = threading.Lock()  # one extract at a time, and never while a new zip replaces the old one
        self._cache_lock = threading.Lock()
        self._extracts = OrderedDict()

    @property
    def archive_path(self):
        return self.directory / ARCHIVE

    # ── Status ──────────────────────────────────────────────────────────────

    def status(self):
        data = self.data
        return {"state": self.state,
                "updated": datetime.fromtimestamp(data["built_at"], timezone.utc).isoformat() if data else None,
                "routes": len(data["routes"]) if data else 0}

    def ready(self):
        return self.state == "ready" and self.data is not None

    def offline_status(self):
        """"ready" when offline timetables can be extracted, "unavailable" after a failed download, else "loading"."""
        if self.ready() and self.archive_ready:
            return "ready"
        if self.state == "error" or self.archive_error:
            return "unavailable"
        return "loading"

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
                self.archive_error = not self.archive_ready
                wait = RETRY_AFTER
            time.sleep(wait)

    def ensure(self):
        """Load the cached index if there is one, and rebuild it from a fresh download when it is older than 7 days.

        An older install kept only index.json; when the zip is missing it is downloaded again (and the index rebuilt from it, so both
        describe the same feed). Matching keeps using the current index throughout.
        """
        path = self.directory / "index.json"
        if self.data is None and path.exists():
            try:
                self._install(json.loads(path.read_text(encoding="utf-8")))
                emit("read", "file:apps/plan-b-mvp/gtfs_static.py", "store:data/gtfs/index.json")
            except (OSError, ValueError, KeyError):
                pass
        if self.data is not None and self._clock() - self.data["built_at"] < MAX_AGE:
            if not self.archive_ready and zipfile.is_zipfile(self.archive_path):
                self.archive_ready, self.archive_error = True, False
            if self.archive_ready:
                return
        self.directory.mkdir(parents=True, exist_ok=True)
        part = self.directory / (ARCHIVE + ".part")
        try:
            with timed("external", "file:apps/plan-b-mvp/gtfs_static.py", "external:translink-gtfs"), self._open(self.url) as response, open(part, "wb") as out:
                while True:
                    chunk = response.read(1 << 20)
                    if not chunk:
                        break
                    out.write(chunk)
            with zipfile.ZipFile(part) as archive:
                index = build_index(archive, self._clock())
            with self._extract_lock:  # an extract may be reading the old zip (and Windows cannot replace an open file)
                part.replace(self.archive_path)
                with self._cache_lock:
                    self._extracts.clear()
                self.archive_ready, self.archive_error = True, False
        finally:
            part.unlink(missing_ok=True)
        temporary = path.with_suffix(".tmp")
        temporary.write_text(json.dumps(index, separators=(",", ":")), encoding="utf-8")
        temporary.replace(path)
        emit("write", "file:apps/plan-b-mvp/gtfs_static.py", "store:data/gtfs/index.json")
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

    # ── Offline area timetables ─────────────────────────────────────────────

    def area_timetable(self, bbox, days, today):
        """The offline pack's `transit` object for bbox [south, west, north, east] and `days` Brisbane dates from `today` (not cached)."""
        if self.offline_status() != "ready":
            raise NotReady(self.offline_status())
        dates = [today + timedelta(days=offset) for offset in range(days)]
        with self._extract_lock:
            with zipfile.ZipFile(self.archive_path) as archive:
                return extract_area(archive, bbox, dates, self.data["built_at"])

    def cached_timetable(self, bbox, days, today):
        """The remembered `area_timetable_json` bytes for this area and these days, else None. Never reads the zip."""
        data = self.data
        if data is None:
            return None
        with self._cache_lock:
            key = (tuple(bbox), days, today.isoformat(), data["built_at"])
            if key in self._extracts:
                self._extracts.move_to_end(key)
                return self._extracts[key]
        return None

    def area_timetable_json(self, bbox, days, today):
        """`area_timetable` as compact JSON bytes, remembered for the last few areas until the next feed download."""
        if self.offline_status() != "ready":
            raise NotReady(self.offline_status())
        key = (tuple(bbox), days, today.isoformat(), self.data["built_at"])
        hit = self.cached_timetable(bbox, days, today)
        if hit is not None:
            return hit
        text = json.dumps(self.area_timetable(bbox, days, today), separators=(",", ":"), ensure_ascii=False).encode("utf-8")
        with self._cache_lock:
            self._extracts[key] = text
            while len(self._extracts) > EXTRACT_CACHE:
                self._extracts.popitem(last=False)
        return text


class NotReady(Exception):
    """The timetable zip is not on disk yet (still downloading) or could not be downloaded. The argument is the offline status."""


def _lines(raw, size=1 << 22):
    """Lines of a binary file without their newline, read in large chunks (much faster than iterating a zip member line by line)."""
    rest = b""
    while True:
        chunk = raw.read(size)
        if not chunk:
            break
        lines = (rest + chunk).split(b"\n")
        rest = lines.pop()
        yield from lines
    if rest:
        yield rest


def _columns(raw, *names):
    """(indexes of the named columns, whether one of them is the last column, so its values may end in a carriage return)."""
    header = raw.readline().decode("utf-8-sig").strip().split(",")
    indexes = [header.index(name) for name in names]
    return indexes, max(indexes) == len(header) - 1


def _quoted(line):
    """The values of a byte line that has quotes, through the csv module (the slow path; Translink quotes only a few names)."""
    return [value.encode("utf-8") for value in next(csv.reader([line.decode("utf-8")]), [])]


def _seconds(text):
    """Seconds after midnight of the service day for b"HH:MM:SS" (hours may be 24 or more), or None when blank."""
    text = text.strip()
    if not text:
        return None
    hours, minutes, seconds = text.split(b":")
    return int(hours) * 3600 + int(minutes) * 60 + int(seconds)


def running_services(archive, dates):
    """{YYYYMMDD: set of service_ids running that day} from calendar.txt with calendar_dates.txt exceptions applied (1 adds, 2 removes)."""
    wanted = {date.strftime("%Y%m%d"): WEEKDAYS[date.weekday()] for date in dates}
    running = {day: set() for day in wanted}
    names = set(archive.namelist())
    if "calendar.txt" in names:
        for row in _csv_rows(archive, "calendar.txt"):
            service = row.get("service_id", "")
            for day, weekday in wanted.items():
                if service and (row.get("start_date") or "").strip() <= day <= (row.get("end_date") or "").strip() and (row.get(weekday) or "").strip() == "1":
                    running[day].add(service)
    if "calendar_dates.txt" in names:
        for row in _csv_rows(archive, "calendar_dates.txt"):
            day, service, kind = (row.get("date") or "").strip(), row.get("service_id", ""), (row.get("exception_type") or "").strip()
            if day in running and service:
                if kind == "1":
                    running[day].add(service)
                elif kind == "2":
                    running[day].discard(service)
    return running


def _colour(text):
    text = (text or "").strip()
    return f"#{text.upper()}" if HEX_COLOUR.match(text) else None


def extract_area(archive, bbox, dates, built_at=None, now=None):
    """Cut the contract's `transit` object out of an open GTFS zip.

    Keeps the stops inside bbox [south, west, north, east], the trips whose service runs on one of `dates` and that call at two or more
    of those stops (only their in-box calls, in order, as [stop index, arrival s, departure s, ...]), the routes they belong to, and one
    simplified in-box shape per route (the shape most of its kept trips use). Each GTFS trip is stored once with its service, so a
    trip that runs on several of the days is not repeated. stop_times.txt and shapes.txt are each streamed once.

    The day before the first date is added to `services` (not to `days`) when some of its trips are still running in the box after
    midnight (times above 24:00), so a trip just after midnight on day one can be planned: offline.js already looks at the previous
    service day's trips. Of a service that runs only on that previous day, only those after-midnight trips are kept.
    """
    south, west, north, east = bbox
    previous = dates[0] - timedelta(days=1)
    running = running_services(archive, [previous, *dates])
    late = running.pop(previous.strftime("%Y%m%d"))
    active = set().union(*running.values()) if running else set()
    trips = {}
    for row in _csv_rows(archive, "trips.txt"):
        if (row.get("service_id") in active or row.get("service_id") in late) and row.get("trip_id"):
            trips[row["trip_id"].encode("utf-8")] = (row.get("route_id", ""), row["service_id"], (row.get("trip_headsign") or "").strip(),
                                                     (row.get("shape_id") or "").strip())
    stops = {}
    for row in _csv_rows(archive, "stops.txt"):
        lat, lng = _float(row.get("stop_lat")), _float(row.get("stop_lon"))
        if lat is None or lng is None or row.get("location_type") not in (None, "", "0"):
            continue
        if south <= lat <= north and west <= lng <= east:
            stops[row["stop_id"].encode("utf-8")] = (row.get("stop_name", "").strip(), round(lat, 6), round(lng, 6))
    calls = {}
    with archive.open("stop_times.txt") as raw:
        columns, ends_line = _columns(raw, "trip_id", "arrival_time", "departure_time", "stop_id", "stop_sequence")
        trip_col, arrival_col, departure_col, stop_col, sequence_col = columns
        last = max(columns)
        # The hot loop (3.5 million rows for SEQ) is written out in full: a helper call per row costs about a second.
        for line in _lines(raw):
            if ends_line:
                line = line.rstrip(b"\r")
            parts = line.split(b",", last + 1) if b'"' not in line else _quoted(line)
            if len(parts) <= last:
                continue
            stop = parts[stop_col]
            if stop in stops:
                trip = parts[trip_col]
                if trip in trips:
                    calls.setdefault(trip, []).append((int(parts[sequence_col]), stop, parts[arrival_col], parts[departure_col]))
    patterns = []
    for trip, rows in calls.items():
        if len(rows) < 2:
            continue
        rows.sort()
        sequence = []
        for _, stop, arrival, departure in rows:
            arrive, depart = _seconds(arrival), _seconds(departure)
            if arrive is None and depart is None:
                continue  # an untimed stop: Translink times every stop, so this is rare
            sequence.append((stop, depart if arrive is None else arrive, arrive if depart is None else depart))
        if len(sequence) >= 2:
            route_id, service, headsign, shape = trips[trip]
            if service not in active and sequence[-1][2] < DAY_SECONDS:
                continue  # a previous-day-only service: only its trips still running after midnight matter
            patterns.append((route_id, service, headsign, shape, sequence))
    route_rows = {}
    used_routes = {pattern[0] for pattern in patterns}
    for row in _csv_rows(archive, "routes.txt"):
        if row.get("route_id") in used_routes:
            try:
                kind = int(row.get("route_type") or -1)
            except ValueError:
                kind = -1
            route_rows[row["route_id"]] = [row.get("route_short_name", "").strip(), row.get("route_long_name", "").strip(), kind,
                                           _colour(row.get("route_color")), _colour(row.get("route_text_color"))]
    patterns = [pattern for pattern in patterns if pattern[0] in route_rows]
    route_ids = sorted(route_rows, key=lambda route: (route_rows[route][2], route_rows[route][0], route))
    route_index = {route: index for index, route in enumerate(route_ids)}
    service_ids = sorted({pattern[1] for pattern in patterns})
    service_index = {service: index for index, service in enumerate(service_ids)}
    stop_ids = sorted({stop for pattern in patterns for stop, _, _ in pattern[4]})
    stop_index = {stop: index for index, stop in enumerate(stop_ids)}
    seen, out_trips, shape_votes = set(), [], {}
    for route_id, service, headsign, shape, sequence in sorted(patterns, key=lambda p: (route_index[p[0]], p[4][0][2], p[2], p[1])):
        times = []
        for stop, arrive, depart in sequence:
            times.extend((stop_index[stop], arrive, depart))
        key = (route_id, service, headsign, tuple(times))
        if key in seen:
            continue  # the same journey listed twice under one service
        seen.add(key)
        out_trips.append([route_index[route_id], service_index[service], headsign, times])
        if shape:
            shape_votes.setdefault(route_index[route_id], Counter())[shape] += 1
    shapes = _area_shapes(archive, bbox, {route: votes.most_common(1)[0][0] for route, votes in shape_votes.items()})
    services = {}
    if any(pattern[1] in late and pattern[4][-1][2] >= DAY_SECONDS for pattern in patterns):
        services[previous.isoformat()] = sorted(service_index[service] for service in late if service in service_index)
    for date in dates:
        day = date.strftime("%Y%m%d")
        services[date.isoformat()] = sorted(service_index[service] for service in running.get(day, ()) if service in service_index)
    feed_built = datetime.fromtimestamp(built_at, timezone.utc).isoformat() if built_at is not None else None
    return {"source": "Translink SEQ static GTFS", "attribution": "Translink (CC BY 4.0)", "feed_built_at": feed_built,
            "generated_at": (now or datetime.now(BRISBANE)).isoformat(timespec="seconds"), "timezone": "Australia/Brisbane",
            "days": [date.isoformat() for date in dates], "routes": [route_rows[route] for route in route_ids],
            "stops": [[stop.decode("utf-8"), *stops[stop]] for stop in stop_ids], "services": services, "service_ids": service_ids,
            "trips": out_trips, "shapes": shapes}


def _area_shapes(archive, bbox, wanted):
    """{str(route index): flat in-box polyline} for the chosen shape of each route, clipped to the box and simplified to about 5 m."""
    if not wanted or "shapes.txt" not in archive.namelist():
        return {}
    by_shape = {}
    for route, shape in wanted.items():
        by_shape.setdefault(shape.encode("utf-8"), []).append(route)
    points = {}
    with archive.open("shapes.txt") as raw:
        columns, ends_line = _columns(raw, "shape_id", "shape_pt_lat", "shape_pt_lon", "shape_pt_sequence")
        shape_col, lat_col, lng_col, sequence_col = columns
        last = max(columns)
        for line in _lines(raw):
            if ends_line:
                line = line.rstrip(b"\r")
            parts = line.split(b",", last + 1) if b'"' not in line else _quoted(line)
            if len(parts) > last and parts[shape_col] in by_shape:
                try:
                    points.setdefault(parts[shape_col], []).append((int(parts[sequence_col]), float(parts[lat_col]), float(parts[lng_col])))
                except ValueError:
                    continue
    shapes = {}
    for shape, rows in points.items():
        rows.sort()
        line = [(lat, lng) for _, lat, lng in rows]
        kept = []
        for start, end in clip_runs(line, bbox):
            run = line[start:end]
            kept.extend(run[index] for index in simplify(run, SHAPE_TOLERANCE_M))
        if len(kept) >= 2:
            for route in by_shape[shape]:
                shapes[str(route)] = flat(kept)
    return dict(sorted(shapes.items(), key=lambda item: int(item[0])))
