"""Shared pieces of the offline area download: the area limits, bounding-box checks, line simplification and a runner for slow extracts.

The limits live here only. `/api/status` publishes them as `offline_limits` so the app checks the same numbers before asking, and the
server checks them again on every request. An extract (OpenStreetMap from Overpass, or the Translink timetable from the GTFS zip) runs in a
background thread; a request waits for it for at most `WAIT_SECONDS`, so no request comes near gunicorn's 60 second timeout. When the
wait runs out the request is told to try again in a minute, and the finished result is kept so that the retry is answered at once.
Only one request waits on each job and at most `MAX_WAITING` across the server, so waiting downloads can never take all of gunicorn's
8 threads away from trip searches; everyone else is told at once to try again.
"""

import math
import threading
import time

# The area a traveller may download: inside South East Queensland, at most 8 km on each side and 40 km² in all, at least 0.5 km a side.
# Measured on 2026-10-26 for a dense 6 x 6 km box around the Brisbane CBD (see README "Data sources and what is sent where").
REGION = (-28.4, 151.9, -26.0, 153.6)  # south, west, north, east
MAX_SIDE_KM = 8
MAX_AREA_KM2 = 40
MIN_SIDE_KM = 0.5
MAX_DAYS = 7
DEFAULT_DAYS = 3
WAIT_SECONDS = 40
KEEP_SECONDS = 600
MAX_WAITING = 2  # requests that may wait on extracts at the same time, server-wide (gunicorn has 8 threads)
EARTH_KM = 6371.0088  # the mean Earth radius offline.js uses, so both sides measure an area the same way
KM_PER_DEGREE = EARTH_KM * math.pi / 180
# app.js measures with a 6371 km radius at the box's south edge; 1% covers that and float rounding, so a box shown as 8.0 km is accepted.
TOLERANCE = 0.01


def limits():
    """The numbers the app shows and checks before downloading (also the `offline_limits` object in /api/status)."""
    return {"max_side_km": MAX_SIDE_KM, "max_area_km2": MAX_AREA_KM2, "min_side_km": MIN_SIDE_KM, "max_days": MAX_DAYS,
            "default_days": DEFAULT_DAYS, "region": list(REGION)}


class AreaError(ValueError):
    """An area the server will not extract; the message is shown to the traveller."""


def size_km(south, west, north, east):
    """(width km, height km) of a bounding box, as offline.js `areaSize` measures it: the width along the middle latitude."""
    height = (north - south) * KM_PER_DEGREE
    width = (east - west) * KM_PER_DEGREE * math.cos(math.radians((north + south) / 2))
    return width, height


def _inward(value, up):
    """`value` rounded to 4 decimals (about 10 m) towards the inside of the box, so rounding never makes an accepted box bigger."""
    scaled = round(value * 10_000, 6)  # remove float noise such as 1530399.9999999998 before rounding
    return (math.ceil(scaled) if up else math.floor(scaled)) / 10_000


def parse_bbox(args):
    """[south, west, north, east] from query values, else AreaError.

    The limits are checked on the values as sent (with 1% tolerance for the app's slightly different measurement). The box is then rounded
    inwards to 4 decimals (about 10 m) so repeated requests share a cache without the extract ever covering more than was checked.
    """
    try:
        values = [float(args[name]) for name in ("south", "west", "north", "east")]
    except (KeyError, TypeError, ValueError):
        raise AreaError("Give the area as south, west, north and east in decimal degrees.") from None
    if not all(math.isfinite(value) for value in values):
        raise AreaError("Give the area as south, west, north and east in decimal degrees.")
    south, west, north, east = values
    if south >= north or west >= east:
        raise AreaError("The area's south edge must be below its north edge and its west edge left of its east edge.")
    region_south, region_west, region_north, region_east = REGION
    if south < region_south or north > region_north or west < region_west or east > region_east:
        raise AreaError("Offline areas must be inside South East Queensland.")
    width, height = size_km(south, west, north, east)
    if width < MIN_SIDE_KM * (1 - TOLERANCE) or height < MIN_SIDE_KM * (1 - TOLERANCE):
        raise AreaError(f"Choose an area at least {MIN_SIDE_KM:g} km on each side.")
    if width > MAX_SIDE_KM * (1 + TOLERANCE) or height > MAX_SIDE_KM * (1 + TOLERANCE):
        raise AreaError(f"Choose a smaller area: at most {MAX_SIDE_KM:g} km on each side (this one is {width:.1f} by {height:.1f} km).")
    if width * height > MAX_AREA_KM2 * (1 + TOLERANCE):
        raise AreaError(f"Choose a smaller area: at most {MAX_AREA_KM2:g} km² (this one is {width * height:.0f} km²).")
    return [_inward(south, True), _inward(west, True), _inward(north, False), _inward(east, False)]


def parse_days(text):
    """Number of days of timetable (1 to MAX_DAYS, default DEFAULT_DAYS), else AreaError."""
    if text in (None, ""):
        return DEFAULT_DAYS
    try:
        days = int(text)
    except (TypeError, ValueError):
        days = 0
    if not 1 <= days <= MAX_DAYS:
        raise AreaError(f"Choose between 1 and {MAX_DAYS} days of timetable.")
    return days


def inside(bbox, lat, lng):
    return bbox[0] <= lat <= bbox[2] and bbox[1] <= lng <= bbox[3]


# ── Simplification ───────────────────────────────────────────────────────────


def simplify(points, tolerance_m, keep=()):
    """Douglas-Peucker on [(lat, lng), ...] that always keeps the ends and every index in `keep`. Returns the kept indexes in order.

    Iterative (an explicit stack), so very long lines cannot overflow Python's recursion limit. Distances use a flat projection, which is
    accurate to well under a metre over a few kilometres.
    """
    count = len(points)
    if count <= 2:
        return list(range(count))
    scale = math.cos(math.radians(points[0][0]))
    xy = [(lng * scale * KM_PER_DEGREE * 1000, lat * KM_PER_DEGREE * 1000) for lat, lng in points]
    marks = sorted({0, count - 1, *(index for index in keep if 0 <= index < count)})
    kept = set(marks)
    stack = list(zip(marks, marks[1:]))
    while stack:
        first, last = stack.pop()
        if last - first < 2:
            continue
        (ax, ay), (bx, by) = xy[first], xy[last]
        dx, dy = bx - ax, by - ay
        length = dx * dx + dy * dy
        worst, worst_index = -1.0, None
        for index in range(first + 1, last):
            px, py = xy[index]
            if length == 0:
                distance = math.hypot(px - ax, py - ay)
            else:
                t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / length))
                distance = math.hypot(px - (ax + t * dx), py - (ay + t * dy))
            if distance > worst:
                worst, worst_index = distance, index
        if worst > tolerance_m:
            kept.add(worst_index)
            stack.append((first, worst_index))
            stack.append((worst_index, last))
    return sorted(kept)


def flat(points, digits=5):
    """[(lat, lng), ...] as the flat [lat, lng, lat, lng, ...] list used in the pack, rounded to `digits` decimals (5 is about 1 m)."""
    result = []
    for lat, lng in points:
        result.append(round(lat, digits))
        result.append(round(lng, digits))
    return result


def clip_runs(points, bbox):
    """Split a line into the runs that lie inside the box, each with one extra point beyond the edge where it crosses, so lines reach the edge.

    Returns a list of (start, end) index pairs (end exclusive) into `points`.
    """
    runs, start = [], None
    for index, (lat, lng) in enumerate(points):
        if inside(bbox, lat, lng):
            if start is None:
                start = max(0, index - 1)
        elif start is not None:
            runs.append((start, index + 1))
            start = None
    if start is not None:
        runs.append((start, len(points)))
    return runs


# ── Slow extracts ────────────────────────────────────────────────────────────


class Pending(Exception):
    """The extract is still running (or another one is): ask the traveller to try again in a minute."""


class Jobs:
    """Runs one slow extract at a time in a background thread and lets a request wait for it for at most `wait` seconds.

    A request for a key that is already running joins that job instead of starting another, but only `max_waiters` requests (one) may wait
    on a job, and only as many as the shared `waiting` semaphore allows across the server; any other request is told to try again at once.
    `admit()` is called only when a new job is about to start (it may raise, for example when the visitor's hourly allowance is used up),
    so answers from a finished job and joins of a running one are never counted. A finished result (or error) is handed to the next request
    for that key and then dropped, because the extract functions keep their own caches.
    """

    def __init__(self, name, wait=WAIT_SECONDS, clock=time.time, waiting=None, max_waiters=1):
        self.name = name
        self.wait = wait
        self.max_waiters = max_waiters
        self._clock = clock
        self._lock = threading.Lock()
        self._jobs = {}
        self._waiting = waiting if waiting is not None else threading.BoundedSemaphore(MAX_WAITING)

    def run(self, key, work, admit=None):
        """The result of `work()` for this key, or raises Pending, or re-raises the error `work()` (or `admit()`) raised."""
        with self._lock:
            now = self._clock()
            # A finished job nobody came back for is dropped after ten minutes so it cannot hand out an old answer or hold memory.
            self._jobs = {name: other for name, other in self._jobs.items() if not other["done"].is_set() or now - other["finished"] < KEEP_SECONDS}
            job = self._jobs.get(key)
            if job is not None and job["done"].is_set():
                del self._jobs[key]
                return self._outcome(job)
            if job is None:
                if any(not other["done"].is_set() for other in self._jobs.values()):
                    raise Pending("Another offline download is being prepared. Try again in a minute.")
                if admit is not None:
                    admit()
                job = {"done": threading.Event(), "result": None, "error": None, "finished": None, "waiters": 0}
                self._jobs[key] = job
                threading.Thread(target=self._work, args=(job, work, self._clock), name=f"offline-{self.name}", daemon=True).start()
            if job["waiters"] >= self.max_waiters or not self._waiting.acquire(blocking=False):
                raise Pending("Your offline download is still being prepared. Try again in a minute.")
            job["waiters"] += 1
        try:
            finished = job["done"].wait(self.wait)
        finally:
            with self._lock:
                job["waiters"] -= 1
            self._waiting.release()
        if not finished:
            raise Pending("Your offline download is still being prepared. Try again in a minute.")
        with self._lock:
            if self._jobs.get(key) is job:
                del self._jobs[key]
        return self._outcome(job)

    @staticmethod
    def _outcome(job):
        if job["error"] is not None:
            raise job["error"]
        return job["result"]

    @staticmethod
    def _work(job, work, clock):
        try:
            job["result"] = work()
        except Exception as error:  # handed to the waiting request; a broken extract must never take the server down
            job["error"] = error
        finally:
            job["finished"] = clock()
            job["done"].set()
