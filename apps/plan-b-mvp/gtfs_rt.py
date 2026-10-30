"""Read Translink SEQ GTFS-Realtime alerts and trip delays without a protobuf dependency.

GTFS-Realtime feeds are Protocol Buffers. Only the small part of the published
schema that Reroute needs is decoded here: service alerts (cause, effect, text,
active period and affected routes) and trip updates (route, cancellation and delay).
"""

from datetime import datetime, timezone
import statistics
import struct
import threading
import time
from urllib.error import URLError
from urllib.request import Request, urlopen

from mycelium_emitter import timed

FEED_BASE = "https://gtfsrt.api.translink.com.au/api/realtime/SEQ/"
CACHE_SECONDS = 60
# Vehicle positions move quickly, so they are cached for less time than alerts.
FEED_TTL = {"VehiclePositions": 15, "TripUpdates": 30}

EFFECTS = {1: "No service", 2: "Reduced service", 3: "Significant delays", 4: "Detour",
           5: "Additional service", 6: "Modified service", 7: "Other effect", 8: "Unknown effect",
           9: "Stop moved", 10: "No effect", 11: "Accessibility issue"}
CAUSES = {1: "Unknown cause", 2: "Other cause", 3: "Technical problem", 4: "Strike", 5: "Demonstration",
          6: "Accident", 7: "Holiday", 8: "Weather", 9: "Maintenance", 10: "Construction",
          11: "Police activity", 12: "Medical emergency"}
DISRUPTIVE_EFFECTS = {1, 2, 3, 4, 6, 9}


class FeedError(Exception):
    """The GTFS-Realtime feed could not be fetched or decoded."""


# ── Minimal Protocol Buffers wire-format reader ─────────────────────────────────

def _varint(data, pos):
    result = shift = 0
    while True:
        if pos >= len(data):
            raise FeedError("Truncated varint in GTFS-Realtime feed.")
        byte = data[pos]
        pos += 1
        result |= (byte & 0x7F) << shift
        if not byte & 0x80:
            return result, pos
        shift += 7
        if shift > 70:
            raise FeedError("Invalid varint in GTFS-Realtime feed.")


def fields(data):
    """Yield (field_number, wire_type, value) for one encoded message."""
    pos = 0
    end = len(data)
    while pos < end:
        key, pos = _varint(data, pos)
        number, wire = key >> 3, key & 7
        if wire == 0:
            value, pos = _varint(data, pos)
        elif wire == 1:
            value, pos = data[pos:pos + 8], pos + 8
        elif wire == 2:
            length, pos = _varint(data, pos)
            value, pos = data[pos:pos + length], pos + length
        elif wire == 5:
            value, pos = data[pos:pos + 4], pos + 4
        else:
            raise FeedError(f"Unsupported protobuf wire type {wire}.")
        if pos > end:
            raise FeedError("Truncated GTFS-Realtime message.")
        yield number, wire, value


def _signed(value):
    """Interpret a varint as a signed 64-bit integer (int32/int64 use two's complement)."""
    return value - (1 << 64) if value >= 1 << 63 else value


def _text(translated):
    """Return the English (or first) translation from a TranslatedString."""
    texts = []
    for number, _, translation in fields(translated):
        if number != 1:
            continue
        text = language = ""
        for inner, _, value in fields(translation):
            if inner == 1:
                text = value.decode("utf-8", "replace")
            elif inner == 2:
                language = value.decode("utf-8", "replace")
        texts.append((language, text))
    for language, text in texts:
        if language.lower().startswith("en"):
            return text
    return texts[0][1] if texts else ""


# ── Decoders for the parts of the schema Reroute uses ────────────────────────────

def decode_alerts(feed):
    alerts = []
    for number, _, entity in fields(feed):
        if number != 2:
            continue
        entity_id = ""
        alert = None
        for inner, _, value in fields(entity):
            if inner == 1:
                entity_id = value.decode("utf-8", "replace")
            elif inner == 5:
                alert = value
        if alert is None:
            continue
        record = {"id": entity_id, "periods": [], "routes": set(), "stops": set(),
                  "cause": None, "effect": None, "header": "", "description": "", "url": ""}
        for inner, _, value in fields(alert):
            if inner == 1:
                period = {"start": None, "end": None}
                for part, _, stamp in fields(value):
                    period["start" if part == 1 else "end"] = stamp
                record["periods"].append(period)
            elif inner == 5:
                for part, _, selector in fields(value):
                    if part == 2:
                        record["routes"].add(selector.decode("utf-8", "replace"))
                    elif part == 5:
                        record["stops"].add(selector.decode("utf-8", "replace"))
            elif inner == 6:
                record["cause"] = value
            elif inner == 7:
                record["effect"] = value
            elif inner == 8:
                record["url"] = _text(value)
            elif inner == 10:
                record["header"] = _text(value)
            elif inner == 11:
                record["description"] = _text(value)
        alerts.append(record)
    return alerts


def _event(data):
    """StopTimeEvent: (delay seconds, absolute epoch time)."""
    delay = time_ = None
    for number, _, value in fields(data):
        if number == 1:
            delay = _signed(value)
        elif number == 2:
            time_ = _signed(value)
    return delay, time_


def decode_trip_updates(feed):
    """Full trip updates: trip and route ids, cancellation, trip-level delay and every stop-time update."""
    trips = []
    for number, _, entity in fields(feed):
        if number != 2:
            continue
        update = None
        for inner, _, value in fields(entity):
            if inner == 3:
                update = value
                break
        if update is None:
            continue
        trip = {"trip_id": "", "route_id": None, "start_date": "", "start_time": "", "cancelled": False,
                "delay": None, "stops": [], "vehicle_id": "", "timestamp": None}
        first_delay = None
        for inner, _, value in fields(update):
            if inner == 1:
                for part, _, field in fields(value):
                    if part == 1:
                        trip["trip_id"] = field.decode("utf-8", "replace")
                    elif part == 2:
                        trip["start_time"] = field.decode("utf-8", "replace")
                    elif part == 3:
                        trip["start_date"] = field.decode("utf-8", "replace")
                    elif part == 5:
                        trip["route_id"] = field.decode("utf-8", "replace")
                    elif part == 4 and field == 3:
                        trip["cancelled"] = True
            elif inner == 2:
                stop = {"sequence": None, "stop_id": "", "arr_delay": None, "arr_time": None, "dep_delay": None, "dep_time": None, "skipped": False}
                for part, _, field in fields(value):
                    if part == 1:
                        stop["sequence"] = field
                    elif part == 2:
                        stop["arr_delay"], stop["arr_time"] = _event(field)
                    elif part == 3:
                        stop["dep_delay"], stop["dep_time"] = _event(field)
                    elif part == 4:
                        stop["stop_id"] = field.decode("utf-8", "replace")
                    elif part == 5 and field == 1:
                        stop["skipped"] = True
                if first_delay is None:
                    # Use the first stop-time update with a reported delay.
                    first_delay = stop["arr_delay"] if stop["arr_delay"] is not None else stop["dep_delay"]
                trip["stops"].append(stop)
            elif inner == 3:
                for part, _, field in fields(value):
                    if part == 1:
                        trip["vehicle_id"] = field.decode("utf-8", "replace")
            elif inner == 4:
                trip["timestamp"] = value
            elif inner == 5:
                trip["delay"] = _signed(value)
        if trip["delay"] is None:
            trip["delay"] = first_delay
        trips.append(trip)
    return trips


def aggregate_delays(trips):
    """Return {route_id: {"delays": [seconds...], "cancelled": n, "trips": n}}."""
    routes = {}
    for trip in trips:
        if not trip["route_id"]:
            continue
        stats = routes.setdefault(trip["route_id"], {"delays": [], "cancelled": 0, "trips": 0})
        stats["trips"] += 1
        if trip["cancelled"]:
            stats["cancelled"] += 1
        elif trip["delay"] is not None:
            stats["delays"].append(trip["delay"])
    return routes


def decode_trip_delays(feed):
    """Return {route_id: {"delays": [seconds...], "cancelled": n, "trips": n}}."""
    return aggregate_delays(decode_trip_updates(feed))


def _float(value):
    if len(value) == 4:
        return struct.unpack("<f", value)[0]
    if len(value) == 8:
        return struct.unpack("<d", value)[0]
    return None


def decode_vehicle_positions(feed):
    """Vehicle positions. Latitude, longitude and bearing are protobuf floats (wire type 5, fixed32)."""
    vehicles = []
    for number, _, entity in fields(feed):
        if number != 2:
            continue
        message = None
        for inner, _, value in fields(entity):
            if inner == 4:
                message = value
        if message is None:
            continue
        record = {"trip_id": "", "route_id": "", "lat": None, "lng": None, "bearing": None, "speed": None,
                  "label": "", "vehicle_id": "", "stop_id": "", "stop_sequence": None, "status": None, "timestamp": None}
        for inner, _, value in fields(message):
            if inner == 1:
                for part, _, field in fields(value):
                    if part == 1:
                        record["trip_id"] = field.decode("utf-8", "replace")
                    elif part == 5:
                        record["route_id"] = field.decode("utf-8", "replace")
            elif inner == 2:
                for part, position_wire, field in fields(value):
                    if position_wire not in (1, 5):
                        continue
                    coordinate = _float(field)
                    if part == 1:
                        record["lat"] = coordinate
                    elif part == 2:
                        record["lng"] = coordinate
                    elif part == 3:
                        record["bearing"] = coordinate
                    elif part == 5:
                        record["speed"] = coordinate
            elif inner == 3:
                record["stop_sequence"] = value
            elif inner == 4:
                record["status"] = value
            elif inner == 5:
                record["timestamp"] = value
            elif inner == 7:
                record["stop_id"] = value.decode("utf-8", "replace")
            elif inner == 8:
                for part, _, field in fields(value):
                    if part == 1:
                        record["vehicle_id"] = field.decode("utf-8", "replace")
                    elif part == 2:
                        record["label"] = field.decode("utf-8", "replace")
        lat, lng = record["lat"], record["lng"]
        if lat is None or lng is None or not (-90 <= lat <= 90 and -180 <= lng <= 180):
            continue
        record["lat"], record["lng"] = round(lat, 6), round(lng, 6)
        if record["bearing"] is not None:
            record["bearing"] = round(record["bearing"]) % 360
        vehicles.append(record)
    return vehicles


# ── Route matching ──────────────────────────────────────────────────────────────

def route_key(route_id):
    """Translink route_id values look like '412-4161'; the part before '-' is the public line name."""
    return route_id.split("-", 1)[0].strip().upper()


def line_keys(name):
    """Possible feed keys for a Google transit line short name such as '412', 'BCC 412' or 'Springfield line'."""
    name = (name or "").strip().upper()
    keys = {name}
    if " " in name:
        keys.add(name.split()[-1])
    return {key for key in keys if key}


# Translink train route_ids join two station-group codes (for example 'IPBR').
# These codes are matched by keyword in Google's line name; the match is approximate.
TRAIN_CODES = {
    "AIRPORT": "BD", "BEENLEIGH": "BN", "CABOOLTURE": "CA", "CLEVELAND": "CL", "DOOMBEN": "DB",
    "FERNY GROVE": "FG", "GOLD COAST": "VL", "VARSITY": "VL", "GYMPIE": "GY", "IPSWICH": "IP",
    "NAMBOUR": "NA", "SUNSHINE COAST": "NA", "REDCLIFFE": "RP", "KIPPA-RING": "RP", "ROSEWOOD": "RW",
    "SHORNCLIFFE": "SH", "SPRINGFIELD": "SP",
}


def train_codes(name):
    name = (name or "").upper()
    return {code for word, code in TRAIN_CODES.items() if word in name}


def train_key_matches(key, codes):
    return len(key) == 4 and key.isalpha() and (key[:2] in codes or key[2:] in codes)


LATE_SECONDS = 60
MATCH_TOLERANCE_SECONDS = 120
NEAR_TERM_SECONDS = 3600


def delay_status(delay_seconds):
    """Classify a delay in seconds as (status, whole minutes). A minute either way still counts as on time."""
    if delay_seconds is None:
        return "unknown", None
    minutes = round(delay_seconds / 60)
    if delay_seconds >= LATE_SECONDS:
        return "late", max(1, minutes)
    if delay_seconds <= -LATE_SECONDS:
        return "early", min(-1, minutes)
    return "on_time", 0


def realtime_object(status="unknown", delay_min=None, vehicle=None, alerts=(), simulated=False):
    """The per-step realtime object shared by /api/plan and /api/live."""
    if status == "late":
        label = f"{delay_min} min late"
    elif status == "early":
        label = f"{-delay_min} min early"
    else:
        label = {"on_time": "On time", "cancelled": "Cancelled"}.get(status, "No live data")
    return {"status": status, "delay_min": delay_min, "label": label, "vehicle": vehicle,
            "alerts": list(alerts), "simulated": simulated}


def _iso(stamp):
    return datetime.fromtimestamp(stamp, timezone.utc).isoformat() if stamp else None


def stop_event(trip, stop_ids):
    """The first stop-time update of `trip` at one of `stop_ids`."""
    return next((stop for stop in trip["stops"] if stop["stop_id"] in stop_ids), None)


def stop_delay(stop):
    """(scheduled epoch, delay seconds) at a stop-time update, using the departure when it has one."""
    if stop["dep_time"] is not None:
        time_, delay = stop["dep_time"], stop["dep_delay"]
    else:
        time_, delay = stop["arr_time"], stop["arr_delay"]
    if time_ is None:
        return None, delay
    return time_ - (delay or 0), delay


def find_trip(trips, trip_id=None, route_ids=(), stop_ids=(), scheduled=None, tolerance=MATCH_TOLERANCE_SECONDS):
    """Exact trip by id, else the trip on one of `route_ids` whose scheduled time at one of `stop_ids` is closest to `scheduled`."""
    if trip_id:
        for trip in trips:
            if trip["trip_id"] == trip_id:
                return trip
    if not (route_ids and stop_ids and scheduled):
        return None
    routes, stops, best, best_gap = set(route_ids), set(stop_ids), None, tolerance + 1
    for trip in trips:
        if trip["route_id"] not in routes:
            continue
        for stop in trip["stops"]:
            if stop["stop_id"] not in stops:
                continue
            planned, _ = stop_delay(stop)
            if planned is not None and abs(planned - scheduled) < best_gap:
                best, best_gap = trip, abs(planned - scheduled)
    return best


class Monitor:
    """Fetch and cache the Translink feeds so many requests share one download."""

    def __init__(self, fetch=None, clock=time.time):
        self._fetch = fetch or self._download
        self._clock = clock
        self._lock = threading.Lock()
        self._cache = {}

    @staticmethod
    def _download(name):
        request = Request(FEED_BASE + name, headers={"User-Agent": "Reroute-student-MVP"})
        try:
            with timed("external", "file:apps/plan-b-mvp/gtfs_rt.py", "external:translink-rt", feed=name), urlopen(request, timeout=20) as response:
                return response.read()
        except (URLError, TimeoutError, OSError) as error:
            raise FeedError(f"Translink {name} feed could not be reached.") from error

    def _get(self, name, decoder):
        with self._lock:
            cached = self._cache.get(name)
            if cached and self._clock() - cached[0] < FEED_TTL.get(name, CACHE_SECONDS):
                return cached[1], cached[0]
        decoded = decoder(self._fetch(name))
        stamp = self._clock()
        with self._lock:
            self._cache[name] = (stamp, decoded)
        return decoded, stamp

    def alerts(self, now=None):
        """Active disruptive alerts as JSON-ready dictionaries."""
        alerts, fetched = self._get("Alerts", decode_alerts)
        now = now or self._clock()
        active = []
        for alert in alerts:
            if alert["periods"] and not any((p["start"] or 0) <= now <= (p["end"] or float("inf")) for p in alert["periods"]):
                continue
            effect = alert["effect"]
            active.append({
                "id": alert["id"],
                "header": alert["header"] or "Service alert",
                "description": alert["description"][:600],
                "effect": EFFECTS.get(effect, "Service change"),
                "cause": CAUSES.get(alert["cause"], ""),
                "disruptive": effect in DISRUPTIVE_EFFECTS or effect is None,
                "lines": sorted({route_key(route) for route in alert["routes"]}),
                "route_ids": sorted(alert["routes"]),
                "url": alert["url"],
            })
        return {"alerts": active, "fetched_at": datetime.fromtimestamp(fetched, timezone.utc).isoformat()}

    def trip_updates(self):
        return self._get("TripUpdates", decode_trip_updates)[0]

    def delays(self):
        """Median delay (minutes) and cancellations per public line name."""
        trips, fetched = self._get("TripUpdates", decode_trip_updates)
        routes = aggregate_delays(trips)
        lines = {}
        for route_id, stats in routes.items():
            line = lines.setdefault(route_key(route_id), {"delays": [], "cancelled": 0, "trips": 0})
            line["delays"].extend(stats["delays"])
            line["cancelled"] += stats["cancelled"]
            line["trips"] += stats["trips"]
        summary = {}
        for line, stats in lines.items():
            summary[line] = {
                "median_delay_min": round(statistics.median(stats["delays"]) / 60) if stats["delays"] else None,
                "cancelled": stats["cancelled"], "trips": stats["trips"],
            }
        return summary, datetime.fromtimestamp(fetched, timezone.utc).isoformat()

    def vehicles(self, route_ids=None, limit=100):
        """Current vehicle positions, optionally only for some route_ids. Returns (list, fetched_at iso)."""
        found, fetched = self._get("VehiclePositions", decode_vehicle_positions)
        wanted = set(route_ids) if route_ids else None
        result = []
        for vehicle in found:
            if wanted is not None and vehicle["route_id"] not in wanted:
                continue
            result.append({"trip_id": vehicle["trip_id"], "route_id": vehicle["route_id"], "lat": vehicle["lat"], "lng": vehicle["lng"],
                           "bearing": vehicle["bearing"], "label": vehicle["label"], "updated": _iso(vehicle["timestamp"])})
            if len(result) >= limit:
                break
        return result, _iso(fetched)

    def refresh(self, min_age=5):
        """Re-download alerts, vehicle positions and trip updates unless they are younger than `min_age` seconds."""
        with self._lock:
            for name, (stamp, _) in list(self._cache.items()):
                if self._clock() - stamp >= min_age:
                    del self._cache[name]
        alerts = self.alerts()
        vehicles, fetched = self.vehicles(limit=1_000_000)
        try:
            self.trip_updates()
        except FeedError:
            pass
        return alerts, len(vehicles), fetched

    def status_for_lines(self, names):
        """Alerts and delay summary for the given Google line names. Never raises."""
        result = {"alerts": [], "delay": None, "cancelled": 0, "checked": False, "error": None}
        keys, codes = set(), set()
        for name in names:
            keys |= line_keys(name)
            codes |= train_codes(name)
        if not keys:
            return result
        try:
            alerts = self.alerts()["alerts"]
            result["alerts"] = [alert for alert in alerts
                                if keys & set(alert["lines"]) or any(train_key_matches(line, codes) for line in alert["lines"])]
            summary, _ = self.delays()
            if codes:
                keys |= {key for key in summary if train_key_matches(key, codes)}
            delays = [summary[key]["median_delay_min"] for key in keys if key in summary and summary[key]["median_delay_min"] is not None]
            result["delay"] = max(delays) if delays else None
            result["cancelled"] = sum(summary[key]["cancelled"] for key in keys if key in summary)
            result["checked"] = True
        except FeedError as error:
            result["error"] = str(error)
        return result

    def step_status(self, query):
        """Live status of one transit step from exact GTFS ids, falling back to keyword matching. Never raises.

        `query` is the opaque live_query built by the planner: route_ids, stop_ids, trip_id, scheduled (epoch
        seconds of the planned departure) and names (Google line names for the keyword fallback).
        Returns {"realtime": realtime object, "alerts": [alert dicts], "delay", "cancelled", "checked", "error"}.
        """
        route_ids = set(query.get("route_ids") or [])
        stop_ids = set(query.get("stop_ids") or [])
        scheduled = query.get("scheduled")
        result = {"realtime": realtime_object(), "alerts": [], "delay": None, "cancelled": 0, "checked": False, "error": None}
        if not route_ids:
            keyword = self.status_for_lines(query.get("names") or [])
            result.update({key: keyword[key] for key in ("alerts", "cancelled", "checked", "error")})
            result["delay"] = keyword["delay"]
            status, minutes = delay_status(None if keyword["delay"] is None else keyword["delay"] * 60)
            result["realtime"] = realtime_object(status, minutes, alerts=[alert["id"] for alert in keyword["alerts"]])
            return result
        errors = []
        try:
            result["alerts"] = [alert for alert in self.alerts()["alerts"] if route_ids & set(alert["route_ids"])]
        except FeedError as error:
            errors.append(str(error))
        trips = []
        try:
            trips = self.trip_updates()
        except FeedError as error:
            errors.append(str(error))
        result["error"] = errors[0] if errors else None
        result["checked"] = not errors
        alert_ids = [alert["id"] for alert in result["alerts"]]
        trip = find_trip(trips, query.get("trip_id"), route_ids, stop_ids, scheduled)
        result["cancelled"] = sum(1 for other in trips if other["route_id"] in route_ids and other["cancelled"])
        if trip:
            stop = stop_event(trip, stop_ids)
            delay = trip["delay"]
            if stop and stop_delay(stop)[1] is not None:
                delay = stop_delay(stop)[1]
            if trip["cancelled"] or (stop and stop["skipped"]):
                status, minutes = "cancelled", None
            else:
                status, minutes = delay_status(delay)
            result["delay"] = minutes
            result["realtime"] = realtime_object(status, minutes, self._vehicle_for(trip, stop), alert_ids)
            result["realtime"]["trip_id"] = trip["trip_id"]
            return result
        near = scheduled is None or scheduled - self._clock() <= NEAR_TERM_SECONDS
        delays = [other["delay"] for other in trips
                  if other["route_id"] in route_ids and not other["cancelled"] and other["delay"] is not None] if near else []
        # Without the exact trip only a route-wide late median is reported: "on time" or "early" would be a guess.
        status, minutes = delay_status(statistics.median(delays)) if delays else ("unknown", None)
        if status == "late":
            result["delay"] = minutes
            result["realtime"] = realtime_object(status, minutes, alerts=alert_ids)
        else:
            result["realtime"] = realtime_object(alerts=alert_ids)
        return result

    def _vehicle_for(self, trip, stop):
        try:
            found, _ = self._get("VehiclePositions", decode_vehicle_positions)
        except FeedError:
            return None
        vehicle = next((item for item in found if item["trip_id"] == trip["trip_id"]), None)
        if not vehicle:
            return None
        away = None
        if stop and stop["sequence"] is not None and vehicle["stop_sequence"] is not None and stop["sequence"] >= vehicle["stop_sequence"]:
            away = stop["sequence"] - vehicle["stop_sequence"]
        return {"lat": vehicle["lat"], "lng": vehicle["lng"], "bearing": vehicle["bearing"], "label": vehicle["label"],
                "updated": _iso(vehicle["timestamp"]), "stops_away": away}

    def realtime_for(self, query):
        return self.step_status(query)["realtime"]
