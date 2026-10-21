"""QLDTraffic road events (crashes, hazards, flooding, roadworks, closures) and their effect on a driving route.

Google's TRAFFIC_AWARE route time already includes congestion, so only incidents add delay here, as a labelled
estimate: a full road closure is flagged with no number, crashes, hazards and flooding add 5 minutes, roadworks and
special events add 2, and the total is capped at 20. An event is attached to a route when it lies within 150 m of
the route polyline. The feed failing never breaks a search: the route simply has no traffic information.
"""

from datetime import datetime, timedelta, timezone
import json
import math
import threading
import time
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

URL = "https://api.qldtraffic.qld.gov.au/v2/events"
# The public key the Queensland Government publishes for QLDTraffic on its open data portal.
# Override it with the QLDTRAFFIC_API_KEY environment variable, for example with your own registered key.
PUBLIC_KEY = "3e83add325cbb69ac4d8e5bf433d770b"
CACHE_SECONDS = 300
STALE_SECONDS = 1800
ROUTE_RADIUS_M = 150
CLOSURE_RADIUS_M = 60
MAX_DELAY_MIN = 20
DELAY_BY_TYPE = {"crash": 5, "hazard": 5, "flooding": 5, "roadworks": 2, "special event": 2}
NO_EFFECT = {"No blockage", "N/A", None, ""}
CELL = 0.002
SIMULATED = {"heavy": ("congestion", "Heavy traffic", "Slow-moving traffic", 10),
             "crash": ("crash", "Crash on your route", "Lane blocked", DELAY_BY_TYPE["crash"])}


def metres(lat1, lng1, lat2, lng2):
    x = math.radians(lng2 - lng1) * math.cos(math.radians((lat1 + lat2) / 2))
    return 6_371_000 * math.hypot(x, math.radians(lat2 - lat1))


def densify(points, step=40):
    """Insert points so no two neighbours are more than `step` metres apart."""
    result = []
    for a, b in zip(points, points[1:]):
        result.append(a)
        gap = metres(a[0], a[1], b[0], b[1])
        for n in range(1, int(gap // step) + 1 if gap > step else 1):
            t = n * step / gap
            result.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
    if points:
        result.append(points[-1])
    return result


class RouteIndex:
    """Grid index of a route polyline for fast "how far is this point from the route" checks."""

    def __init__(self, points):
        self.points = densify([(p[0], p[1]) for p in points], 50)
        self.grid = {}
        for point in self.points:
            self.grid.setdefault((int(point[0] // CELL), int(point[1] // CELL)), []).append(point)

    def nearest(self, lat, lng, limit=ROUTE_RADIUS_M):
        """(distance in metres, route point) of the closest route point within `limit`, else None."""
        reach = int(limit / 200) + 1
        cell = (int(lat // CELL), int(lng // CELL))
        best = None
        for dy in range(-reach, reach + 1):
            for dx in range(-reach, reach + 1):
                for point in self.grid.get((cell[0] + dy, cell[1] + dx), ()):
                    distance = metres(lat, lng, point[0], point[1])
                    if distance <= limit and (best is None or distance < best[0]):
                        best = (distance, point)
        return best


def _coordinates(geometry, lines, points):
    """Collect GeoJSON [lng, lat] coordinates as (lat, lng) lines and single points."""
    kind = geometry.get("type")
    if kind == "Point":
        points.append((geometry["coordinates"][1], geometry["coordinates"][0]))
    elif kind == "MultiPoint":
        points.extend((c[1], c[0]) for c in geometry["coordinates"])
    elif kind == "LineString":
        lines.append([(c[1], c[0]) for c in geometry["coordinates"]])
    elif kind == "MultiLineString":
        lines.extend([(c[1], c[0]) for c in line] for line in geometry["coordinates"])
    elif kind == "GeometryCollection":
        for part in geometry.get("geometries", []):
            _coordinates(part, lines, points)


def _when(text):
    try:
        return datetime.fromisoformat(text) if text else None
    except ValueError:
        return None


def parse_event(feature):
    """One compact event record from a GeoJSON feature, or None when it has no usable geometry."""
    properties = feature.get("properties") or {}
    lines, points = [], []
    try:
        _coordinates(feature.get("geometry") or {}, lines, points)
    except (KeyError, IndexError, TypeError):
        return None
    if not lines and not points:
        return None
    kind = (properties.get("event_type") or "").strip().lower()
    subtype = (properties.get("event_subtype") or "").strip()
    impact = properties.get("impact") or {}
    impact_type, impact_subtype = impact.get("impact_type"), (impact.get("impact_subtype") or "")
    road = ((properties.get("road_summary") or {}).get("road_name") or "").strip()
    duration = properties.get("duration") or {}
    label = subtype if subtype and subtype != "N/A" else (properties.get("event_type") or "Road event")
    closure = impact_type == "Closures" and "road closed" in impact_subtype.lower()
    every = [p for line in lines for p in line] + points
    return {
        "id": str(properties.get("id", "")), "type": kind, "title": f"{label} on {road}" if road else label, "road": road,
        "impact": impact_subtype or (impact_type if impact_type not in NO_EFFECT else "") or (properties.get("description") or "")[:80],
        "impact_type": impact_type, "closure": closure, "start": _when(duration.get("start")), "end": _when(duration.get("end")),
        "lines": lines, "points": points,
        "box": (min(p[0] for p in every), min(p[1] for p in every), max(p[0] for p in every), max(p[1] for p in every)),
    }


def active(event, when):
    return (event["start"] is None or event["start"] <= when + timedelta(hours=1)) and (event["end"] is None or event["end"] >= when)


def delay_for(event):
    """Estimated added minutes for an event by the published rules. Closures and no-effect events add no number."""
    if event["closure"] or event["impact_type"] in NO_EFFECT and event["type"] in ("roadworks", "special event"):
        return 0
    return DELAY_BY_TYPE.get(event["type"], 0)


def _public(event, point, simulated=False, distance=None):
    result = {"id": event["id"], "type": event["type"], "title": event["title"], "road": event["road"], "impact": event["impact"],
              "delay_min": event["delay_min"] if "delay_min" in event else delay_for(event), "lat": round(point[0], 6), "lng": round(point[1], 6),
              "simulated": simulated, "closure": event["closure"]}
    if distance is not None:
        result["distance_m"] = round(distance)
    return result


def summarise(events, source="QLDTraffic", available=True):
    """The per-route `traffic` object from public event dicts: capped total delay and the closure flag."""
    seen, total = set(), 0
    for event in events:
        key = (event["type"], event["road"] or event["id"])
        if key in seen:
            continue
        seen.add(key)
        total += event["delay_min"]
    return {"events": events, "added_delay_min": min(MAX_DELAY_MIN, total), "closure": any(e["closure"] for e in events),
            "source": source, "available": available}


def simulate(kind, route_points):
    """A flagged, invented incident placed in the middle of the drive route (demo mode)."""
    type_, title, impact, delay = SIMULATED[kind]
    middle = route_points[len(route_points) // 2] if route_points else (-27.4698, 153.0251)
    event = {"id": f"sim-{kind}", "type": type_, "title": f"{title} (simulated)", "road": "", "impact": impact, "delay_min": delay,
             "lat": round(middle[0], 6), "lng": round(middle[1], 6), "simulated": True, "closure": False}
    return summarise([event], "Simulated")


class Traffic:
    """Cached QLDTraffic lookups. `fetch(url)` is injectable so tests never touch the network."""

    def __init__(self, key=None, fetch=None, clock=time.time):
        self.key = key or PUBLIC_KEY
        self._fetch = fetch or self._download
        self._clock = clock
        self._lock = threading.Lock()
        self._cache = None

    @staticmethod
    def _download(url):
        request = Request(url, headers={"User-Agent": "PlanB-student-MVP", "Accept": "application/json"})
        with urlopen(request, timeout=15) as response:
            return json.load(response)

    def events(self, now=None):
        """(compact events, available). A stale copy is served for up to 30 minutes if the feed is down."""
        now = self._clock() if now is None else now
        with self._lock:
            cache = self._cache
        if cache and now - cache[0] < CACHE_SECONDS:
            return cache[1], True
        try:
            data = self._fetch(f"{URL}?{urlencode({'apikey': self.key})}")
            parsed = [event for event in (parse_event(feature) for feature in data["features"]) if event]
        except (URLError, TimeoutError, OSError, ValueError, KeyError, TypeError):
            if cache and now - cache[0] < STALE_SECONDS:
                return cache[1], True
            return [], False
        with self._lock:
            self._cache = (now, parsed)
        return parsed, True

    def on_route(self, route_points, when, events=None):
        """Public events within 150 m of the route polyline that are active at `when`, nearest first."""
        events = self.events()[0] if events is None else events
        if not route_points:
            return []
        index = RouteIndex(route_points)
        lats, lngs = [p[0] for p in index.points], [p[1] for p in index.points]
        margin = 0.003
        box = (min(lats) - margin, min(lngs) - margin, max(lats) + margin, max(lngs) + margin)
        found = []
        for event in events:
            low_lat, low_lng, high_lat, high_lng = event["box"]
            if high_lat < box[0] or low_lat > box[2] or high_lng < box[1] or low_lng > box[3] or not active(event, when):
                continue
            candidates = list(event["points"])
            for line in event["lines"]:
                candidates.extend(densify(line, 40))
            best = None
            for lat, lng in candidates:
                hit = index.nearest(lat, lng)
                if hit and (best is None or hit[0] < best[0]):
                    best = (hit[0], (lat, lng))
            if best:
                found.append((best[0], event, best[1]))
        found.sort(key=lambda item: item[0])
        return [self._route_event(event, point, distance) for distance, event, point in found]

    @staticmethod
    def _route_event(event, point, distance):
        result = _public(event, point, distance=distance)
        # Only a closure on the route itself counts as a closure; a closed side street 100 m away is information.
        result["closure"] = event["closure"] and distance <= CLOSURE_RADIUS_M
        if event["closure"] and not result["closure"]:
            result["delay_min"] = 0
        return result

    def near_point(self, lat, lng, radius_km, when, limit=50):
        """Public events whose nearest point is within `radius_km` of a place, nearest first."""
        events, available = self.events()
        found = []
        for event in events:
            if not active(event, when):
                continue
            low_lat, low_lng, high_lat, high_lng = event["box"]
            if metres(lat, lng, min(max(lat, low_lat), high_lat), min(max(lng, low_lng), high_lng)) > radius_km * 1000:
                continue
            best = min(((metres(lat, lng, p[0], p[1]), p) for p in [q for line in event["lines"] for q in line] + event["points"]), default=None)
            if best and best[0] <= radius_km * 1000:
                found.append((best[0], event, best[1]))
        found.sort(key=lambda item: item[0])
        return [_public(event, point, distance=distance) for distance, event, point in found[:limit]], available
