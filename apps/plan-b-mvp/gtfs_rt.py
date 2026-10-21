"""Read Translink SEQ GTFS-Realtime alerts and trip delays without a protobuf dependency.

GTFS-Realtime feeds are Protocol Buffers. Only the small part of the published
schema that Plan B needs is decoded here: service alerts (cause, effect, text,
active period and affected routes) and trip updates (route, cancellation and delay).
"""

from datetime import datetime, timezone
import statistics
import threading
import time
from urllib.error import URLError
from urllib.request import Request, urlopen

FEED_BASE = "https://gtfsrt.api.translink.com.au/api/realtime/SEQ/"
CACHE_SECONDS = 60

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


# ── Decoders for the parts of the schema Plan B uses ────────────────────────────

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


def decode_trip_delays(feed):
    """Return {route_id: {"delays": [seconds...], "cancelled": n, "trips": n}}."""
    routes = {}
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
        route_id = None
        cancelled = False
        delay = None
        for inner, _, value in fields(update):
            if inner == 1:
                for part, _, field in fields(value):
                    if part == 5:
                        route_id = field.decode("utf-8", "replace")
                    elif part == 4 and field == 3:
                        cancelled = True
            elif inner == 5:
                delay = _signed(value)
            elif inner == 2 and delay is None:
                # Use the first stop-time update with a reported delay.
                for part, _, event in fields(value):
                    if part in (2, 3) and delay is None:
                        for event_field, _, event_value in fields(event):
                            if event_field == 1:
                                delay = _signed(event_value)
                                break
        if not route_id:
            continue
        stats = routes.setdefault(route_id, {"delays": [], "cancelled": 0, "trips": 0})
        stats["trips"] += 1
        if cancelled:
            stats["cancelled"] += 1
        elif delay is not None:
            stats["delays"].append(delay)
    return routes


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


class Monitor:
    """Fetch and cache the Translink feeds so many requests share one download."""

    def __init__(self, fetch=None, clock=time.time):
        self._fetch = fetch or self._download
        self._clock = clock
        self._lock = threading.Lock()
        self._cache = {}

    @staticmethod
    def _download(name):
        request = Request(FEED_BASE + name, headers={"User-Agent": "PlanB-student-MVP"})
        try:
            with urlopen(request, timeout=20) as response:
                return response.read()
        except (URLError, TimeoutError, OSError) as error:
            raise FeedError(f"Translink {name} feed could not be reached.") from error

    def _get(self, name, decoder):
        with self._lock:
            cached = self._cache.get(name)
            if cached and self._clock() - cached[0] < CACHE_SECONDS:
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
                "url": alert["url"],
            })
        return {"alerts": active, "fetched_at": datetime.fromtimestamp(fetched, timezone.utc).isoformat()}

    def delays(self):
        """Median delay (minutes) and cancellations per public line name."""
        routes, fetched = self._get("TripUpdates", decode_trip_delays)
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
