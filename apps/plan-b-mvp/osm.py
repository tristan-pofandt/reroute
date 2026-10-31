"""OpenStreetMap data for an offline area: one Overpass API query, reduced to the pack's compact `map` object.

Google Maps content may not be stored offline, so the offline base map and the road and path network come from OpenStreetMap
(© OpenStreetMap contributors, ODbL 1.0). The server sends Overpass only the area's bounding box. One query returns the routable
roads and paths, ferry lines, railways, water, larger green areas, suburb and area names and a short list of significant places;
`convert` turns it into flat, rounded and simplified polylines that keep every junction so the app can route on them offline.

Overpass is a shared, volunteer-run service, so the server is polite: one fetch at a time (see offline_area.Jobs), a descriptive
User-Agent, a fallback instance only when the main one fails, a daily cap on fetches and a one-day disk cache per area in
data/offline/. `fetch(url, query)` is injectable so the tests never touch the network.
"""

from datetime import datetime, timedelta, timezone
import json
import math
from pathlib import Path
import threading
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from limits import DailyCap
from mycelium_emitter import emit, timed
from offline_area import KM_PER_DEGREE, clip_runs, flat, inside, simplify

URLS = ("https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter")
QUERY_TIMEOUT = 120  # seconds Overpass may spend on the query (a dense 6 x 6 km box took 59 s on a busy instance on 2026-10-26)
HTTP_TIMEOUT = 150  # the fetch runs in a background job, so a slow answer never holds a request open (see offline_area.Jobs)
CACHE_SECONDS = 86400
CACHE_FILES = 20
DAILY_FETCHES = 60  # Overpass asks for well under 10,000 queries and 1 GB a day per user; this keeps Reroute far below that
TOLERANCE_M = 4  # Douglas-Peucker tolerance for roads, rail and water lines
AREA_TOLERANCE_M = 6
MIN_GREEN_M2 = 10_000  # 1 ha: smaller lawns and pocket parks are left out
MIN_PARK_LABEL_M2 = 40_000
MIN_WATER_M2 = 2_000
BRISBANE = timezone(timedelta(hours=10), "AEST")

# OSM highway value -> the pack's way class.
CLASSES = {"motorway": "motorway", "motorway_link": "motorway", "trunk": "trunk", "trunk_link": "trunk", "primary": "primary",
           "primary_link": "primary", "secondary": "secondary", "secondary_link": "secondary", "tertiary": "tertiary",
           "tertiary_link": "tertiary", "unclassified": "residential", "residential": "residential", "road": "residential",
           "service": "service", "living_street": "living", "pedestrian": "pedestrian", "footway": "footway", "cycleway": "cycleway",
           "path": "path", "bridleway": "path", "steps": "steps", "track": "track"}
ROADS = {"motorway", "trunk", "primary", "secondary", "tertiary", "residential", "service", "living"}
ONE_WAY, REVERSED, WALK, CYCLE, DRIVE, BRIDGE, TUNNEL, ROUNDABOUT = 1, 2, 4, 8, 16, 32, 64, 128
NO = {"no", "private", "use_sidepath", "dismount", "discouraged"}
SIDEWALK = {"both", "left", "right", "yes"}
SKIP_SERVICE = {"driveway", "drive-through"}  # private-feeling stubs that add size but no useful routes
RAIL = {"rail", "light_rail", "tram", "subway"}
PLACES = ("city", "town", "suburb", "neighbourhood", "quarter", "locality")
AMENITY_POIS = {"bus_station": "bus_station", "ferry_terminal": "ferry", "hospital": "hospital", "university": "university",
                "college": "college", "library": "library", "police": "police"}
TOURISM = ("attraction", "museum", "gallery", "zoo", "theme_park")


def query(bbox):
    """The single Overpass QL query for bbox [south, west, north, east]: ways with node ids, the nodes' coordinates and tagged places."""
    south, west, north, east = bbox
    box = f"({south},{west},{north},{east})"
    highways = "|".join(CLASSES)
    return f"""[out:json][timeout:{QUERY_TIMEOUT}];
(
  way["highway"~"^({highways})$"]{box};
  way["route"="ferry"]{box};
  way["railway"~"^(rail|light_rail|tram|subway)$"]{box};
  way["natural"~"^(water|coastline)$"]{box};
  way["waterway"~"^(river|riverbank)$"]{box};
  way["leisure"="park"]{box};
  way["landuse"~"^(grass|recreation_ground)$"]{box};
)->.lines;
(
  relation["type"="multipolygon"]["natural"="water"]{box};
  relation["type"="multipolygon"]["waterway"="riverbank"]{box};
  relation["type"="multipolygon"]["leisure"="park"]{box};
  relation["type"="multipolygon"]["landuse"~"^(grass|recreation_ground)$"]{box};
)->.areas;
way(r.areas)->.members;
(.lines; .members;)->.ways;
.ways out body qt;
.areas out body qt;
node(w.ways);
out skel qt;
(
  node["place"~"^({"|".join(PLACES)})$"]{box};
  nwr["railway"~"^(station|halt)$"]{box};
  nwr["public_transport"="station"]{box};
  nwr["amenity"~"^({"|".join(AMENITY_POIS)})$"]{box};
  nwr["shop"="mall"]{box};
  nwr["leisure"="stadium"]{box};
  nwr["tourism"~"^({"|".join(TOURISM)})$"]{box};
);
out tags center qt;
"""


class OverpassError(Exception):
    """OpenStreetMap data could not be fetched; the message is shown to the traveller (HTTP 502)."""


class OverpassBusy(Exception):
    """Reroute has used up its daily share of Overpass requests (HTTP 429)."""


# ── Tags to classes and flags ────────────────────────────────────────────────


def _allowed(tags, keys, default):
    """Access for one mode: the most specific tag that is present decides (for example foot before access), else the default."""
    for key in keys:
        value = (tags.get(key) or "").strip().lower()
        if value:
            return value not in NO
    return default


def classify(tags):
    """(class, flags, name) for a way the app can draw or route on, or None to leave it out."""
    if tags.get("route") == "ferry" and "highway" not in tags:
        return "ferry", 0, tags.get("name")  # drawn only: ferry times come from the Translink timetable, not from walking speed
    kind = CLASSES.get(tags.get("highway"))
    if kind is None or tags.get("area") == "yes" and kind not in ("pedestrian", "footway"):
        return None
    if kind == "service" and (tags.get("service") in SKIP_SERVICE or (tags.get("access") or "").lower() in ("private", "no")):
        return None
    major = kind in ("motorway", "trunk")
    # Motorways and trunk roads: no walking unless tagged (a footpath along one, sidewalk=both, is enough).
    walk = _allowed(tags, ("foot", "access"), not major or tags.get("sidewalk") in SIDEWALK)
    # Queensland lets people ride on footpaths unless a sign says otherwise, so footways and pedestrian streets allow cycling by default.
    cycle = _allowed(tags, ("bicycle", "vehicle", "access"), kind not in ("motorway", "trunk")) if kind != "steps" else _allowed(tags, ("bicycle",), False)
    # Only road classes can ever be driven: a footway or steps tagged access=yes is open to people, not cars.
    drive = kind in ROADS and _allowed(tags, ("motorcar", "motor_vehicle", "vehicle", "access"), True)
    flags = (WALK if walk else 0) | (CYCLE if cycle else 0)
    oneway = (tags.get("oneway") or "").strip().lower()
    roundabout = tags.get("junction") in ("roundabout", "circular")
    if drive:
        if oneway in ("reversible", "alternating"):
            drive = False  # direction changes by time of day: not safe to route on offline
        elif oneway in ("yes", "true", "1") or (oneway == "" and (tags.get("highway") == "motorway" or roundabout)):
            flags |= ONE_WAY
        elif oneway in ("-1", "reverse"):
            flags |= REVERSED
    if drive:
        flags |= DRIVE
    if not flags & (WALK | CYCLE | DRIVE):
        return None
    if tags.get("bridge") not in (None, "no"):
        flags |= BRIDGE
    if tags.get("tunnel") not in (None, "no", "culvert"):
        flags |= TUNNEL
    if roundabout:
        flags |= ROUNDABOUT
    name = tags.get("name")
    if kind in ("footway", "path", "cycleway", "steps", "track") and tags.get("footway") in ("sidewalk", "crossing"):
        name = None  # a footpath beside a road or a crossing: the road already carries the name
    return kind, flags, name


# ── Geometry helpers ─────────────────────────────────────────────────────────


def _area_m2(points):
    """Absolute area of a ring of (lat, lng) points in square metres (shoelace formula on a flat projection)."""
    if len(points) < 3:
        return 0.0
    scale = math.cos(math.radians(points[0][0])) * KM_PER_DEGREE * 1000
    total = 0.0
    for (lat1, lng1), (lat2, lng2) in zip(points, points[1:] + points[:1]):
        total += (lng1 * scale) * (lat2 * KM_PER_DEGREE * 1000) - (lng2 * scale) * (lat1 * KM_PER_DEGREE * 1000)
    return abs(total) / 2


def _centre(points):
    lat = sum(point[0] for point in points) / len(points)
    lng = sum(point[1] for point in points) / len(points)
    return lat, lng


def clip_ring(points, bbox):
    """Sutherland-Hodgman clip of a closed ring to the box (the box is convex, so the result is one ring, possibly empty)."""
    south, west, north, east = bbox
    edges = ((lambda p: p[0] >= south, lambda a, b: _cut_lat(a, b, south)), (lambda p: p[0] <= north, lambda a, b: _cut_lat(a, b, north)),
             (lambda p: p[1] >= west, lambda a, b: _cut_lng(a, b, west)), (lambda p: p[1] <= east, lambda a, b: _cut_lng(a, b, east)))
    ring = [point for index, point in enumerate(points) if index == 0 or point != points[index - 1]]
    if len(ring) > 1 and ring[0] == ring[-1]:
        ring.pop()
    for keep, cut in edges:
        if not ring:
            break
        result = []
        for index, current in enumerate(ring):
            previous = ring[index - 1]
            if keep(current):
                if not keep(previous):
                    result.append(cut(previous, current))
                result.append(current)
            elif keep(previous):
                result.append(cut(previous, current))
        ring = result
    return ring


def _cut_lat(a, b, lat):
    t = (lat - a[0]) / (b[0] - a[0])
    return lat, a[1] + (b[1] - a[1]) * t


def _cut_lng(a, b, lng):
    t = (lng - a[1]) / (b[1] - a[1])
    return a[0] + (b[0] - a[0]) * t, lng


def join_rings(chains):
    """Join multipolygon member ways (lists of node ids) end to end. Returns (closed rings, chains that could not be closed)."""
    open_chains = [list(chain) for chain in chains if len(chain) >= 2]
    rings, loose = [], []
    while open_chains:
        current = open_chains.pop()
        changed = True
        while current[0] != current[-1] and changed:
            changed = False
            for index, other in enumerate(open_chains):
                if other[0] == current[-1]:
                    current += other[1:]
                elif other[-1] == current[-1]:
                    current += other[-2::-1]
                elif other[-1] == current[0]:
                    current = other[:-1] + current
                elif other[0] == current[0]:
                    current = other[:0:-1] + current
                else:
                    continue
                open_chains.pop(index)
                changed = True
                break
        (rings if current[0] == current[-1] and len(current) >= 4 else loose).append(current)
    return rings, loose


def _area_feature(ring, bbox, tolerance=AREA_TOLERANCE_M):
    """A clipped, simplified and rounded closed ring as a flat list, or None when nothing of it is inside the box."""
    clipped = clip_ring(ring, bbox)
    if len(clipped) < 3:
        return None
    clipped.append(clipped[0])
    kept = [clipped[index] for index in simplify(clipped, tolerance)]
    return flat(kept[:-1]) if len(kept) >= 4 else None


# ── Conversion ───────────────────────────────────────────────────────────────


def _poi_kind(tags):
    # The amenity comes first: ferry terminals and bus stations are also tagged public_transport=station.
    if tags.get("amenity") in AMENITY_POIS:
        return AMENITY_POIS[tags["amenity"]]
    if tags.get("railway") in ("station", "halt") or tags.get("public_transport") == "station":
        return "station"
    if tags.get("shop") == "mall":
        return "shopping"
    if tags.get("leisure") == "stadium":
        return "stadium"
    if tags.get("tourism") in TOURISM and (tags.get("wikidata") or tags.get("wikipedia")):
        return "attraction"  # only attractions notable enough to have a Wikipedia or Wikidata entry, not every plaque or statue
    return None


def convert(data, bbox, now=None):
    """The pack's `map` object from an Overpass JSON answer to `query(bbox)`."""
    nodes, ways, relations, tagged = {}, {}, [], []
    for element in data.get("elements", ()):
        kind = element.get("type")
        if kind == "node":
            if "lat" in element and "lon" in element:
                nodes[element["id"]] = (element["lat"], element["lon"])
            if element.get("tags"):
                tagged.append((element.get("tags"), element.get("lat"), element.get("lon")))
        elif kind in ("way", "relation"):
            if "nodes" in element:
                ways[element["id"]] = element
            if "members" in element:
                relations.append(element)
            if "center" in element and element.get("tags"):
                tagged.append((element["tags"], element["center"].get("lat"), element["center"].get("lon")))
    routable, uses = [], {}
    for way_id, way in ways.items():
        found = classify(way.get("tags") or {})
        if found is None:
            continue
        ids = [node for node in way["nodes"] if node in nodes]
        if len(ids) < 2:
            continue
        routable.append((way_id, found, ids))
        for node in set(ids):
            uses[node] = uses.get(node, 0) + 1
    out_ways = []
    for way_id, (kind, flags, name), ids in routable:
        points = [nodes[node] for node in ids]
        for start, end in clip_runs(points, bbox):
            run_ids, run = ids[start:end], points[start:end]
            if len(run) < 2:
                continue
            junctions = [index for index, node in enumerate(run_ids) if uses[node] >= 2]
            kept = simplify(run, TOLERANCE_M, junctions)
            marks = set(junctions) | {0, len(run) - 1}
            out_ways.append({"c": kind, "n": name, "f": flags, "p": flat(run[index] for index in kept),
                             "j": [position for position, index in enumerate(kept) if index in marks], "id": way_id})
    rail, water, green, pois = [], [], [], []
    for relation in relations:
        tags = relation.get("tags") or {}
        chains = []
        for member in relation.get("members", ()):
            if member.get("type") == "way" and member.get("role") in ("outer", "") and member.get("ref") in ways:
                chains.append([node for node in ways[member["ref"]]["nodes"] if node in nodes])
        rings, loose = join_rings(chains)
        _add_area(tags, [[nodes[node] for node in ring] for ring in rings], [[nodes[node] for node in chain] for chain in loose], bbox,
                  water, green, pois)
    for way_id, way in ways.items():
        tags = way.get("tags") or {}
        points = [nodes[node] for node in way["nodes"] if node in nodes]
        if len(points) < 2:
            continue
        if tags.get("railway") in RAIL and not tags.get("service"):
            for start, end in clip_runs(points, bbox):
                run = points[start:end]
                rail.append({"n": tags.get("name"), "k": tags["railway"], "p": flat(run[index] for index in simplify(run, TOLERANCE_M))})
        elif tags.get("waterway") == "river" or tags.get("natural") == "coastline":
            kind = "river" if tags.get("waterway") == "river" else "coastline"
            for start, end in clip_runs(points, bbox):
                run = points[start:end]
                water.append({"k": kind, "p": flat(run[index] for index in simplify(run, TOLERANCE_M)), "closed": False})
        elif way["nodes"][0] == way["nodes"][-1] and len(points) >= 4:
            _add_area(tags, [points], [], bbox, water, green, pois)  # a closed way tagged as water or a green area (others are ignored)
    places = []
    for tags, lat, lng in tagged:
        if lat is None or lng is None or not inside(bbox, lat, lng) or not tags.get("name"):
            continue
        if tags.get("place") in PLACES:
            places.append({"n": tags["name"], "k": tags["place"], "lat": round(lat, 5), "lng": round(lng, 5)})
        kind = _poi_kind(tags)
        if kind:
            pois.append({"n": tags["name"], "k": kind, "lat": round(lat, 5), "lng": round(lng, 5)})
    return {"source": "OpenStreetMap contributors via the Overpass API", "attribution": "© OpenStreetMap contributors", "licence": "ODbL 1.0",
            "fetched_at": (now or datetime.now(BRISBANE)).isoformat(timespec="seconds"), "bbox": list(bbox),
            "ways": out_ways, "rail": rail, "water": water, "green": green, "places": _dedupe(places), "pois": _dedupe(pois)}


def _add_area(tags, rings, loose, bbox, water, green, pois):
    """Water and green polygons (and a label for a large named park) from closed rings; open water chains become shore lines."""
    is_water = tags.get("natural") == "water" or tags.get("waterway") == "riverbank"
    is_green = tags.get("leisure") == "park" or tags.get("landuse") in ("grass", "recreation_ground")
    if not (is_water or is_green):
        return
    for ring in rings:
        size = _area_m2(ring)
        if size < (MIN_WATER_M2 if is_water else MIN_GREEN_M2):
            continue
        feature = _area_feature(ring, bbox)
        if feature is None:
            continue
        if is_water:
            water.append({"k": "water", "p": feature, "closed": True})
        else:
            green.append({"p": feature})
            if tags.get("leisure") == "park" and tags.get("name") and size >= MIN_PARK_LABEL_M2:
                lat, lng = _centre(ring)
                if inside(bbox, lat, lng):
                    pois.append({"n": tags["name"], "k": "park", "lat": round(lat, 5), "lng": round(lng, 5)})
    if is_water:
        for chain in loose:
            for start, end in clip_runs(chain, bbox):
                run = chain[start:end]
                if len(run) >= 2:
                    water.append({"k": "water", "p": flat(run[index] for index in simplify(run, TOLERANCE_M)), "closed": False})


def _dedupe(items, radius_m=400):
    """Drop repeats of the same kind and name within `radius_m` (a station is often mapped as a node and as an area)."""
    kept = []
    for item in items:
        for other in kept:
            if other["k"] == item["k"] and other["n"].lower() == item["n"].lower():
                dy = (other["lat"] - item["lat"]) * KM_PER_DEGREE * 1000
                dx = (other["lng"] - item["lng"]) * KM_PER_DEGREE * 1000 * math.cos(math.radians(item["lat"]))
                if math.hypot(dx, dy) <= radius_m:
                    break
        else:
            kept.append(item)
    return kept


# ── Fetching and caching ─────────────────────────────────────────────────────


class OSM:
    """Fetches and caches the offline `map` object per area. `fetch(url, query)` returns parsed JSON and is injectable for tests."""

    def __init__(self, directory, fetch=None, clock=time.time, urls=URLS, daily_cap=DAILY_FETCHES):
        self.directory = Path(directory)
        self._fetch = fetch or self._download
        self._clock = clock
        self.urls = urls
        self._lock = threading.Lock()
        self._cap = DailyCap(daily_cap, clock)

    @staticmethod
    def _download(url, text):
        body = urlencode({"data": text}).encode("ascii")
        request = Request(url, data=body, headers={"User-Agent": "Reroute-student-MVP (offline area download)",
                                                   "Content-Type": "application/x-www-form-urlencoded"})
        with timed("external", "file:apps/plan-b-mvp/osm.py", "external:overpass"), urlopen(request, timeout=HTTP_TIMEOUT) as response:
            return json.load(response)

    def _path(self, bbox):
        return self.directory / ("osm_" + "_".join(f"{value:.4f}" for value in bbox) + ".json")

    def cached(self, bbox):
        """The cached `map` JSON bytes for the area when they are less than a day old, else None. Never contacts Overpass."""
        path = self._path(bbox)
        try:
            if self._clock() - path.stat().st_mtime < CACHE_SECONDS:
                emit("read", "file:apps/plan-b-mvp/osm.py", "store:data/offline/osm_*.json")  # one node for the whole cache: the bbox in the file name is a location
                return path.read_bytes()
        except OSError:
            pass
        return None

    def area_json(self, bbox):
        """The `map` object for the area as compact JSON bytes, from the disk cache when it is less than a day old."""
        path = self._path(bbox)
        with self._lock:
            hit = self.cached(bbox)
            if hit is not None:
                return hit
            data = self._overpass(bbox)
            text = json.dumps(convert(data, bbox, datetime.fromtimestamp(self._clock(), BRISBANE)), separators=(",", ":"),
                              ensure_ascii=False).encode("utf-8")
            self._store(path, text)
            return text

    def _overpass(self, bbox):
        if not self._cap.take():
            raise OverpassBusy("Reroute has reached its daily limit of offline map downloads. Try again tomorrow.")
        text = query(bbox)
        for url in self.urls:
            try:
                data = self._fetch(url, text)
            except (HTTPError, URLError, TimeoutError, OSError, ValueError):
                continue  # busy (429 or 504), unreachable or not JSON: try the other instance
            remark = str((data or {}).get("remark") or "") if isinstance(data, dict) else ""
            if isinstance(data, dict) and isinstance(data.get("elements"), list) and "error" not in remark.lower():
                return data
        raise OverpassError("OpenStreetMap map data could not be downloaded right now. Try again in a few minutes.")

    def _store(self, path, text):
        try:
            self.directory.mkdir(parents=True, exist_ok=True)
            temporary = path.with_suffix(".tmp")
            temporary.write_bytes(text)
            temporary.replace(path)
            emit("write", "file:apps/plan-b-mvp/osm.py", "store:data/offline/osm_*.json", bytes=len(text))
            cached = sorted(self.directory.glob("osm_*.json"), key=lambda item: item.stat().st_mtime, reverse=True)
            for old in cached[CACHE_FILES:]:
                old.unlink(missing_ok=True)
        except OSError:
            pass  # a full or read-only disk only loses the cache
