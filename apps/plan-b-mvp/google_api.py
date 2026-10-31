"""Small server-side clients for Google Routes, Places (New) and elevation data.

Every function takes the API key as an argument so the key never reaches the browser.
Results that do not change minute to minute (fuel prices, car parks, elevations) are cached.
"""

from contextlib import contextmanager
import contextvars
import json
import math
import re
import threading
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen

from mycelium_emitter import emit, timed
import usage

_NODE = "file:apps/plan-b-mvp/google_api.py"  # Mycelium map node for this module
ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes"
PLACES_NEARBY_URL = "https://places.googleapis.com/v1/places:searchNearby"
PLACES_AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete"
PLACES_DETAILS_URL = "https://places.googleapis.com/v1/places/"
GOOGLE_ELEVATION_URL = "https://maps.googleapis.com/maps/api/elevation/json"
OPEN_METEO_ELEVATION_URL = "https://api.open-meteo.com/v1/elevation"

FUEL_TYPES = {"SP91": "Unleaded 91", "SP91_E10": "E10", "SP95": "Premium 95", "SP98": "Premium 98", "DIESEL": "Diesel", "LPG": "LPG"}


# Approximate Google Maps Platform list prices in USD per 1,000 billable requests, before the free
# monthly usage caps. Open-Meteo, Translink and QLDTraffic are free. Re-check before relying on them.
PRICES_CHECKED = "2026-10-21"  # Place Details Pro re-checked on 2026-10-26: still US$17 per 1,000 after 5,000 free a month
PRICES = {
    ("Routes API", "Compute Routes Essentials"): 5.00,
    ("Routes API", "Compute Routes Pro"): 10.00,
    ("Places API (New)", "Autocomplete Request"): 2.83,
    ("Places API (New)", "Place Details Pro"): 17.00,
    ("Places API (New)", "Nearby Search Pro"): 32.00,
    ("Places API (New)", "Nearby Search Enterprise"): 35.00,
    ("Elevation API", "Elevation"): 5.00,
}
COST_NOTE = (f"Approximate Google list prices in USD per 1,000 requests, checked {PRICES_CHECKED}, before Google's free monthly usage caps. "
             "Drive requests with TRAFFIC_AWARE are priced as Pro; the SKU assignment is an estimate. Open-Meteo, Translink and QLDTraffic are free. Only successful, uncached requests are counted.")


class CostTracker:
    """Counts the real Google requests made while a search runs (cache hits never reach it)."""

    def __init__(self):
        self._lock = threading.Lock()
        self.counts = {}

    def record(self, api, sku):
        with self._lock:
            self.counts[(api, sku)] = self.counts.get((api, sku), 0) + 1

    def summary(self):
        with self._lock:
            counts = dict(self.counts)
        items = []
        for (api, sku), count in sorted(counts.items()):
            unit = PRICES[(api, sku)]
            items.append({"api": api, "sku": sku, "count": count, "unit_usd_per_1000": unit, "usd": round(count * unit / 1000, 5)})
        return {"items": items, "total_usd": round(sum(item["usd"] for item in items), 5), "note": COST_NOTE}


_tracker = contextvars.ContextVar("planb_google_cost_tracker", default=None)


@contextmanager
def tracking():
    tracker = CostTracker()
    token = _tracker.set(tracker)
    try:
        yield tracker
    finally:
        _tracker.reset(token)


def record_request(api, sku):
    usage.count(api, sku)  # the process-wide daily tally behind /admin/usage
    emit("cost", _NODE, "external:" + api, usd=PRICES.get((api, sku), 0) / 1000, api=api, sku=sku)
    tracker = _tracker.get()
    if tracker:
        tracker.record(api, sku)


def with_context(function):
    """Wrap `function` so a worker thread sees the caller's cost tracker (one copy per call)."""
    context = contextvars.copy_context()
    return lambda *args, **kwargs: context.run(function, *args, **kwargs)


class RoutesError(Exception):
    """A Google Routes request failed or returned unusable data."""


class ServiceError(Exception):
    """An optional enrichment service (Places, elevation) failed."""


_cache = {}
_cache_lock = threading.Lock()


def cached(key, seconds, compute):
    now = time.time()
    with _cache_lock:
        hit = _cache.get(key)
        if hit and now - hit[0] < seconds:
            return hit[1]
    value = compute()
    with _cache_lock:
        _cache[key] = (now, value)
    return value


def _post_json(url, key, body, field_mask, timeout=18):
    request = Request(url, data=json.dumps(body).encode("utf-8"), headers={
        "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": field_mask,
    }, method="POST")
    with timed("external", _NODE, "external:" + str(urlsplit(url).hostname)), urlopen(request, timeout=timeout) as response:
        return json.load(response)


def _get_json(url, timeout=15, headers=None):
    request = Request(url, headers={"User-Agent": "Reroute-student-MVP", **(headers or {})})
    with timed("external", _NODE, "external:" + str(urlsplit(url).hostname)), urlopen(request, timeout=timeout) as response:
        return json.load(response)


# ── Geometry helpers ────────────────────────────────────────────────────────────

def decode_polyline(encoded):
    """Decode a Google encoded polyline into [[lat, lng], ...]."""
    points, index, lat, lng = [], 0, 0, 0
    while index < len(encoded):
        for coordinate in range(2):
            result = shift = 0
            while True:
                if index >= len(encoded):
                    return points
                byte = ord(encoded[index]) - 63
                index += 1
                result |= (byte & 0x1F) << shift
                shift += 5
                if byte < 0x20:
                    break
            delta = ~(result >> 1) if result & 1 else result >> 1
            if coordinate == 0:
                lat += delta
            else:
                lng += delta
        points.append([lat / 1e5, lng / 1e5])
    return points


def metres(a, b):
    """Great-circle distance in metres between two [lat, lng] points."""
    lat1, lng1, lat2, lng2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lng2 - lng1) / 2) ** 2
    return 2 * 6_371_000 * math.asin(math.sqrt(h))


def resample(points, spacing=40):
    """Keep roughly one point every `spacing` metres, always keeping both ends."""
    if len(points) < 2:
        return list(points)
    kept = [points[0]]
    travelled = 0.0
    for previous, point in zip(points, points[1:]):
        travelled += metres(previous, point)
        if travelled >= spacing:
            kept.append(point)
            travelled = 0.0
    if kept[-1] != points[-1]:
        kept.append(points[-1])
    return kept


# ── Routes API ──────────────────────────────────────────────────────────────────

def compute_routes(key, body, field_mask):
    try:
        data = _post_json(ROUTES_URL, key, body, field_mask)
        record_request("Routes API", "Compute Routes Pro" if body.get("routingPreference") == "TRAFFIC_AWARE" else "Compute Routes Essentials")
        return data.get("routes", [])
    except HTTPError as error:
        raise RoutesError(f"Google Routes returned HTTP {error.code}. Check the key, billing, quota and Routes API access.") from error
    except (URLError, TimeoutError, OSError) as error:
        raise RoutesError("Google Routes could not be reached. Try again shortly.") from error
    except (ValueError, AttributeError) as error:
        raise RoutesError("Google returned an unreadable route response.") from error


# ── Places API (New): fuel prices and car parks ─────────────────────────────────

def _money(value):
    if not isinstance(value, dict):
        return None
    return int(value.get("units", 0) or 0) + int(value.get("nanos", 0) or 0) / 1_000_000_000


TRANSIT_TYPES = {"transit_station", "bus_station", "bus_stop", "train_station", "subway_station", "light_rail_station", "ferry_terminal"}


def autocomplete(key, text, session, lat=-27.4698, lng=153.0251):
    """Place suggestions for partly typed text, biased to around the traveller (Australia only)."""
    def compute():
        body = {"input": text, "includedRegionCodes": ["au"], "languageCode": "en-AU",
                "locationBias": {"circle": {"center": {"latitude": lat, "longitude": lng}, "radius": 50000}}}
        if session:
            body["sessionToken"] = session
        try:
            data = _post_json(PLACES_AUTOCOMPLETE_URL, key, body,
                              "suggestions.placePrediction.placeId,suggestions.placePrediction.text,"
                              "suggestions.placePrediction.structuredFormat,suggestions.placePrediction.types", timeout=8)
            record_request("Places API (New)", "Autocomplete Request")
        except (HTTPError, URLError, TimeoutError, OSError, ValueError) as error:
            raise ServiceError("Address suggestions are unavailable.") from error
        results = []
        for suggestion in data.get("suggestions", []):
            prediction = suggestion.get("placePrediction") or {}
            structured = prediction.get("structuredFormat") or {}
            main = (structured.get("mainText") or {})
            secondary = (structured.get("secondaryText") or {}).get("text", "")
            full = (prediction.get("text") or {}).get("text") or ", ".join(part for part in (main.get("text"), secondary) if part)
            if not prediction.get("placeId") or not full:
                continue
            types = set(prediction.get("types") or [])
            results.append({
                "place_id": prediction["placeId"], "text": full, "main": main.get("text") or full, "secondary": secondary,
                "matches": [[m.get("startOffset", 0), m.get("endOffset", 0)] for m in main.get("matches", [])],
                "kind": "transit" if types & TRANSIT_TYPES else "street" if types & {"route", "street_address", "premise"} else "place",
            })
        return results[:6]
    return cached(("autocomplete", text.casefold(), round(lat, 1), round(lng, 1)), 300, compute)


# Place Details fields for a place tapped on the map. displayName, iconMaskBaseUri and iconBackgroundColor are all Place Details Pro fields
# (id is IDs Only, formattedAddress and location are Essentials), so the request stays a single Pro request (checked 2026-10-26).
PLACE_FIELDS = "id,displayName,formattedAddress,location,iconMaskBaseUri,iconBackgroundColor"
PLACE_ICON_BASE = re.compile(r"^https://maps\.gstatic\.com/mapfiles/place_api/icons/[A-Za-z0-9_/.-]+$")
HEX_COLOUR = re.compile(r"^#[0-9A-Fa-f]{6}$")


def _place_icon(data):
    """Google's glyph for the place's category (a one-colour SVG mask that the app draws in white; Google asks for .svg or .png to be appended) and its background colour."""
    base, colour = data.get("iconMaskBaseUri") or "", data.get("iconBackgroundColor") or ""
    if not PLACE_ICON_BASE.match(base) or not HEX_COLOUR.match(colour) or base.endswith((".svg", ".png")):
        return None
    return {"mask": f"{base}.svg", "background": colour.upper()}


def place_details(key, place_id):
    """Name, address, position and category icon of one place (a place icon tapped on the map). One Place Details Pro request."""
    def compute():
        try:
            data = _get_json(f"{PLACES_DETAILS_URL}{place_id}?{urlencode({'languageCode': 'en-AU'})}", timeout=8,
                             headers={"X-Goog-Api-Key": key, "X-Goog-FieldMask": PLACE_FIELDS})
            record_request("Places API (New)", "Place Details Pro")
        except HTTPError as error:
            if error.code == 404:
                return None
            raise ServiceError("Place details are unavailable.") from error
        except (URLError, TimeoutError, OSError, ValueError) as error:
            raise ServiceError("Place details are unavailable.") from error
        location = data.get("location") or {}
        name = (data.get("displayName") or {}).get("text") or ""
        if not name and not data.get("formattedAddress"):
            return None
        return {"place_id": data.get("id") or place_id, "name": name or data["formattedAddress"], "address": data.get("formattedAddress") or "",
                "location": [location["latitude"], location["longitude"]] if "latitude" in location and "longitude" in location else None,
                "icon": _place_icon(data)}
    return cached(("place", place_id), 86400, compute)


def fuel_price(key, lat, lng, fuel_type="SP91"):
    """Average current price of `fuel_type` (AUD/L) at up to 20 stations within 5 km."""
    def compute():
        try:
            data = _post_json(PLACES_NEARBY_URL, key, {
                "includedTypes": ["gas_station"], "maxResultCount": 20,
                "locationRestriction": {"circle": {"center": {"latitude": lat, "longitude": lng}, "radius": 5000}},
            }, "places.fuelOptions")
            record_request("Places API (New)", "Nearby Search Enterprise")
        except (HTTPError, URLError, TimeoutError, OSError, ValueError) as error:
            raise ServiceError("Places API fuel prices are unavailable.") from error
        prices, updated = [], []
        for place in data.get("places", []):
            for entry in (place.get("fuelOptions") or {}).get("fuelPrices", []):
                price = _money(entry.get("price"))
                if entry.get("type") == fuel_type and price and entry.get("price", {}).get("currencyCode", "AUD") == "AUD" and 0.5 < price < 5:
                    prices.append(price)
                    if entry.get("updateTime"):
                        updated.append(entry["updateTime"])
        if not prices:
            return None
        return {"price": round(sum(prices) / len(prices), 3), "stations": len(prices),
                "latest_update": max(updated) if updated else None, "fuel_type": fuel_type}
    return cached(("fuel", round(lat, 2), round(lng, 2), fuel_type), 1800, compute)


def parking_near(key, lat, lng, radius=800):
    """Car parks Google lists within `radius` metres of a destination."""
    def compute():
        try:
            data = _post_json(PLACES_NEARBY_URL, key, {
                "includedTypes": ["parking"], "maxResultCount": 10, "rankPreference": "DISTANCE",
                "locationRestriction": {"circle": {"center": {"latitude": lat, "longitude": lng}, "radius": radius}},
            }, "places.displayName,places.location,places.parkingOptions")
            record_request("Places API (New)", "Nearby Search Pro")
        except (HTTPError, URLError, TimeoutError, OSError, ValueError) as error:
            raise ServiceError("Places API car-park search is unavailable.") from error
        parks = []
        for place in data.get("places", []):
            location = place.get("location") or {}
            if "latitude" not in location:
                continue
            options = place.get("parkingOptions") or {}
            point = [location["latitude"], location["longitude"]]
            parks.append({
                "name": (place.get("displayName") or {}).get("text") or "Car park",
                "distance_m": round(metres([lat, lng], point)),
                "location": point,
                "paid": any(options.get(flag) for flag in ("paidParkingLot", "paidStreetParking", "paidGarageParking")),
                "free": any(options.get(flag) for flag in ("freeParkingLot", "freeStreetParking", "freeGarageParking")),
            })
        parks.sort(key=lambda park: park["distance_m"])
        return {"count": len(parks), "parks": parks[:5], "radius_m": radius,
                "any_free": any(park["free"] for park in parks), "any_paid": any(park["paid"] for park in parks)}
    return cached(("parking", round(lat, 3), round(lng, 3), radius), 3600, compute)


# ── Elevation: Google Elevation API when enabled, otherwise Open-Meteo ──────────

_google_elevation_denied_until = 0.0


def _google_elevations(key, points):
    global _google_elevation_denied_until
    if not key or time.time() < _google_elevation_denied_until:
        return None
    locations = "|".join(f"{lat:.5f},{lng:.5f}" for lat, lng in points)
    try:
        data = _get_json(f"{GOOGLE_ELEVATION_URL}?{urlencode({'locations': locations, 'key': key})}")
    except (HTTPError, URLError, TimeoutError, OSError, ValueError):
        return None
    if data.get("status") != "OK":
        _google_elevation_denied_until = time.time() + 600
        return None
    record_request("Elevation API", "Elevation")
    return [result.get("elevation") for result in data.get("results", [])]


def _open_meteo_elevations(points):
    query = urlencode({"latitude": ",".join(f"{p[0]:.5f}" for p in points), "longitude": ",".join(f"{p[1]:.5f}" for p in points)})
    try:
        data = _get_json(f"{OPEN_METEO_ELEVATION_URL}?{query}")
    except (HTTPError, URLError, TimeoutError, OSError, ValueError) as error:
        raise ServiceError("Elevation data is unavailable.") from error
    return data.get("elevation")


def elevations(key, points):
    """Elevation in metres for each point, plus the source used. Batches of 100."""
    values, source = [], None
    for start in range(0, len(points), 100):
        batch = points[start:start + 100]
        result = _google_elevations(key, batch)
        if result and len(result) == len(batch):
            source = source or "Google Elevation API"
        else:
            result = _open_meteo_elevations(batch)
            if not result or len(result) != len(batch):
                raise ServiceError("Elevation data is unavailable.")
            source = source or "Open-Meteo (Copernicus 90 m terrain model)"
        values.extend(result)
    return values, source


def climb(key, segments):
    """Total uphill and downhill metres along a list of walking point lists."""
    sampled = [resample(points) for points in segments if len(points) >= 2]
    flat = [point for points in sampled for point in points]
    if not flat:
        return {"gain_m": 0, "loss_m": 0, "source": None}
    cache_key = ("climb", tuple((round(p[0], 4), round(p[1], 4)) for p in flat))

    def compute():
        heights, source = elevations(key, flat)
        gain = loss = 0.0
        index = 0
        for points in sampled:
            run = heights[index:index + len(points)]
            index += len(points)
            for a, b in zip(run, run[1:]):
                if a is None or b is None:
                    continue
                if b > a:
                    gain += b - a
                else:
                    loss += a - b
        return {"gain_m": round(gain), "loss_m": round(loss), "source": source}
    return cached(cache_key, 86400, compute)
