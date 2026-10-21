"""Validate a journey request and build honest, comparable Plan B options.

One search combines Google Routes (public transport and driving), live fuel prices and car parks
from Places API (New), walking elevation, Translink GTFS-Realtime alerts and delays, CO2 estimates,
an Uber hand-off and matching shared rides. Every figure that cannot be known is labelled unknown.
"""

from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
import math
import re
from typing import Callable, Optional
from urllib.parse import urlencode

import google_api
from google_api import RoutesError, ServiceError, decode_polyline, metres

try:
    from zoneinfo import ZoneInfo
    BRISBANE = ZoneInfo("Australia/Brisbane")
except Exception:  # Windows without the tzdata package. Brisbane has no daylight saving.
    BRISBANE = timezone(timedelta(hours=10), "AEST")

TRANSIT_FIELDS = ",".join((
    "routes.duration", "routes.distanceMeters", "routes.polyline.encodedPolyline",
    "routes.legs.startLocation", "routes.legs.endLocation",
    "routes.legs.steps.travelMode", "routes.legs.steps.staticDuration", "routes.legs.steps.distanceMeters",
    "routes.legs.steps.polyline.encodedPolyline", "routes.legs.steps.navigationInstruction.instructions",
    "routes.legs.steps.transitDetails", "routes.travelAdvisory.transitFare",
))
DRIVE_FIELDS = ",".join((
    "routes.duration", "routes.distanceMeters", "routes.polyline.encodedPolyline",
    "routes.legs.startLocation", "routes.legs.endLocation",
    "routes.legs.steps.navigationInstruction.instructions", "routes.legs.steps.staticDuration",
    "routes.travelAdvisory.tollInfo",
))

# CO2 per litre burned (kg). Combustion-only factors; upstream fuel production is excluded.
FUEL_CO2_PER_L = {"DIESEL": 2.68, "LPG": 1.51}
PETROL_CO2_PER_L = 2.31
# Default kg CO2e per passenger-km. Approximate averages adapted from UK government
# conversion factors; Brisbane's real values differ (for example, Queensland's grid mix
# affects electric trains). The traveller can change them in Settings.
DEFAULT_FACTORS = {"bus": 0.105, "rail": 0.035, "tram": 0.029, "ferry": 0.019}
RIDESHARE_L_PER_100KM = 7.0
WALK_M_PER_MIN = 80
VEHICLE_CATEGORY = {
    "BUS": "bus", "INTERCITY_BUS": "bus", "TROLLEYBUS": "bus", "SHARE_TAXI": "bus",
    "RAIL": "rail", "HEAVY_RAIL": "rail", "COMMUTER_TRAIN": "rail", "HIGH_SPEED_TRAIN": "rail",
    "LONG_DISTANCE_TRAIN": "rail", "METRO_RAIL": "rail", "SUBWAY": "rail", "MONORAIL": "rail",
    "TRAM": "tram", "LIGHT_RAIL": "tram", "CABLE_CAR": "tram", "FUNICULAR": "tram", "GONDOLA_LIFT": "tram",
    "FERRY": "ferry",
}
TRANSIT_MODE_FILTER = {"bus": ["BUS"], "train": ["TRAIN", "RAIL", "SUBWAY"], "tram": ["LIGHT_RAIL"]}
LATLNG = re.compile(r"^\s*(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$")


class InputError(ValueError):
    """User input that should be corrected before a route lookup."""


@dataclass
class Services:
    """External lookups, injectable so tests never touch the network."""
    routes: Callable = google_api.compute_routes
    fuel: Optional[Callable] = google_api.fuel_price
    parking: Optional[Callable] = google_api.parking_near
    climb: Optional[Callable] = google_api.climb
    monitor: object = None
    board: object = None
    extra: dict = field(default_factory=dict)


# ── Input validation ────────────────────────────────────────────────────────────

def seconds(value):
    """Parse a protobuf Duration in the JSON form used by Routes API."""
    if not isinstance(value, str) or not value.endswith("s"):
        raise RoutesError("Google returned a route without a valid duration.")
    try:
        number = float(value[:-1])
    except ValueError as error:
        raise RoutesError("Google returned a route without a valid duration.") from error
    if not math.isfinite(number) or number < 0:
        raise RoutesError("Google returned a route without a valid duration.")
    return number


def _number(payload, name, low, high, default=None, whole=False):
    value = payload.get(name, default)
    if value in (None, ""):
        if default is None:
            return None
        value = default
    try:
        value = float(value)
    except (TypeError, ValueError, OverflowError) as error:
        raise InputError(f"Enter a valid {name.replace('_', ' ')}.") from error
    if not math.isfinite(value) or not low <= value <= high or (whole and not value.is_integer()):
        raise InputError(f"{name.replace('_', ' ').capitalize()} must be {'a whole number ' if whole else ''}from {low:g} to {high:g}.")
    return int(value) if whole else value


def _place(value, label):
    if not isinstance(value, str) or not 3 <= len(value.strip()) <= 200 or any(ord(char) < 32 for char in value):
        raise InputError(f"Enter a {label} of 3–200 characters.")
    return value.strip()


def validate(payload, now=None):
    if not isinstance(payload, dict):
        raise InputError("Enter a journey to search.")
    now = now or datetime.now(BRISBANE)
    origin = _place(payload.get("origin"), "starting point")
    destination = _place(payload.get("destination"), "destination")
    if origin.casefold() == destination.casefold():
        raise InputError("Choose different starting and destination places.")
    purpose = payload.get("purpose", "planb")
    if purpose not in ("planb", "regular", "panic"):
        raise InputError("Unknown search type.")

    def local(name):
        text = payload.get(name)
        if text in (None, ""):
            return None
        if not isinstance(text, str) or "T" not in text:
            raise InputError("Enter valid dates and times.")
        try:
            value = datetime.fromisoformat(text)
        except ValueError as error:
            raise InputError("Enter valid dates and times.") from error
        if value.tzinfo:
            raise InputError("Enter local Brisbane date and time without a time zone suffix.")
        return value.replace(tzinfo=BRISBANE)

    if payload.get("leave_now") is True or purpose == "panic":
        departure = now + timedelta(minutes=1)
    else:
        departure = local("departure")
        if departure is None:
            raise InputError("Enter a departure time or choose Leave now.")
        if departure <= now - timedelta(minutes=2) or departure > now + timedelta(days=100):
            raise InputError("Choose a departure from now to 100 days ahead.")
        departure = max(departure, now + timedelta(minutes=1))
    deadline = local("deadline")
    if deadline is None and purpose == "planb":
        raise InputError("Enter the time you need to arrive by.")
    if deadline is not None and deadline <= departure:
        raise InputError("The arrival deadline must be after departure.")

    modes = payload.get("modes")
    if not isinstance(modes, dict):
        raise InputError("Choose at least one way to travel in Settings.")
    modes = {mode: modes.get(mode) is True for mode in ("transit", "drive", "rideshare")}
    if not any(modes.values()):
        raise InputError("Choose at least one way to travel in Settings.")
    transit_modes = payload.get("transit_modes") or {}
    transit_modes = {mode: transit_modes.get(mode, True) is not False for mode in ("bus", "train", "tram", "ferry")}
    if modes["transit"] and not any(transit_modes.values()):
        raise InputError("Turn on at least one public transport type, or turn public transport off.")

    vehicle = payload.get("vehicle") or {}
    fuel_type = vehicle.get("fuel_type", "SP91")
    if fuel_type not in google_api.FUEL_TYPES:
        raise InputError("Choose a supported fuel type.")
    factors = dict(DEFAULT_FACTORS)
    for name, value in (payload.get("emission_factors") or {}).items():
        if name in factors:
            factors[name] = _number({"value": value}, "value", 0, 1)
    avoid = payload.get("avoid_lines") or []
    if not isinstance(avoid, list) or len(avoid) > 10 or not all(isinstance(line, str) and 0 < len(line.strip()) <= 30 for line in avoid):
        raise InputError("List up to 10 disrupted services.")
    return {
        "origin": origin, "destination": destination, "purpose": purpose,
        "departure": departure, "deadline": deadline,
        "budget": _number(payload, "budget", 0, 500, 20),
        "walking": _number(payload, "walking", 0, 120, 15, whole=True),
        "modes": modes, "transit_modes": transit_modes,
        "fuel_l_per_100km": _number(vehicle, "fuel_l_per_100km", 2, 30, 8),
        "fuel_type": fuel_type,
        "fuel_price": _number(vehicle, "fuel_price", 0.5, 5),
        "parking_cost": _number(payload, "parking_cost", 0, 200),
        "flat_fare": _number(payload, "transit_flat_fare", 0, 50),
        "factors": factors,
        "avoid_lines": {line.strip().upper() for line in avoid},
        "want_elevation": payload.get("want_elevation", True) is not False,
        "ride_tokens": [token for token in (payload.get("ride_tokens") or [])[:20] if isinstance(token, str)],
    }


# ── Route requests ──────────────────────────────────────────────────────────────

def waypoint(text):
    match = LATLNG.match(text)
    if match:
        return {"location": {"latLng": {"latitude": float(match[1]), "longitude": float(match[2])}}}
    return {"address": text}


def request_body(journey, mode):
    body = {
        "origin": waypoint(journey["origin"]), "destination": waypoint(journey["destination"]),
        "travelMode": "TRANSIT" if mode == "transit" else "DRIVE",
        "departureTime": journey["departure"].isoformat(),
        "languageCode": "en-AU", "units": "METRIC", "computeAlternativeRoutes": True,
    }
    if mode == "transit":
        allowed = [kind for name, kinds in TRANSIT_MODE_FILTER.items() if journey["transit_modes"][name] for kind in kinds]
        if not all(journey["transit_modes"][name] for name in TRANSIT_MODE_FILTER):
            body["transitPreferences"] = {"allowedTravelModes": sorted(set(allowed))}
    else:
        body["routingPreference"] = "TRAFFIC_AWARE"
        body["extraComputations"] = ["TOLLS"]
        body["routeModifiers"] = {"vehicleInfo": {"emissionType": "DIESEL" if journey["fuel_type"] == "DIESEL" else "GASOLINE"}}
    return body


def _latlng(location):
    lat_lng = (location or {}).get("latLng") or {}
    if "latitude" in lat_lng and "longitude" in lat_lng:
        return [lat_lng["latitude"], lat_lng["longitude"]]
    return None


def _stamp(text):
    if not text:
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).astimezone(BRISBANE)
    except ValueError:
        return None


def _clock(value):
    return f"{value.hour % 12 or 12}:{value.minute:02d} {'am' if value.hour < 12 else 'pm'}"


# ── Option building ─────────────────────────────────────────────────────────────

def _finish_walk(details, next_stop):
    """Close an open run of walking steps as one plain step, keeping the turn-by-turn directions."""
    if not details or not details[-1].get("merging"):
        return
    walk = details[-1]
    minutes = math.ceil(walk["seconds"] / 60) if walk["timed"] else None
    target = f"to {next_stop}" if next_stop else "to your destination"
    walk["title"] = f"Walk{f' about {minutes} min' if minutes else ''} {target}"
    walk["minutes"] = minutes
    for key in ("seconds", "timed", "merging"):
        walk.pop(key)


def transit_option(route, index, journey):
    if not isinstance(route, dict):
        raise RoutesError("Google returned an invalid route.")
    total_seconds = seconds(route.get("duration"))
    legs = route.get("legs") or [{}]
    leg = legs[0] if isinstance(legs[0], dict) else {}
    steps = leg.get("steps") or []
    if not isinstance(steps, list) or any(not isinstance(step, dict) for step in steps):
        raise RoutesError("Google returned an invalid step list.")
    walking_seconds, itemized, all_timed = 0.0, 0.0, bool(steps)
    walking_known = bool(steps)
    details, segments, walk_paths, lines = [], [], [], []
    vehicle_km = {}
    # Scheduled times: Google's route duration can exclude a long wait for a later service,
    # so arrival is rebuilt from the first boarding and last alighting times when present.
    first_board = last_alight = None
    walk_before = walk_after = 0.0
    for step in steps:
        kind = step.get("travelMode", "")
        step_seconds = seconds(step["staticDuration"]) if step.get("staticDuration") else None
        if step_seconds is None:
            all_timed = False
        else:
            itemized += step_seconds
        encoded = (step.get("polyline") or {}).get("encodedPolyline")
        points = decode_polyline(encoded) if encoded else []
        distance_km = (step.get("distanceMeters") or 0) / 1000
        if kind == "WALK":
            if step_seconds is None:
                walking_known = False
            else:
                walking_seconds += step_seconds
                if first_board is None:
                    walk_before += step_seconds
                else:
                    walk_after += step_seconds
            instruction = " ".join(((step.get("navigationInstruction") or {}).get("instructions") or "").split())
            if details and details[-1]["kind"] == "walk" and details[-1].get("merging"):
                walk = details[-1]
            else:
                walk = {"kind": "walk", "title": "", "seconds": 0, "timed": True, "directions": [], "merging": True}
                details.append(walk)
            if step_seconds is None:
                walk["timed"] = False
            else:
                walk["seconds"] += step_seconds
            if instruction:
                walk["directions"].append(instruction)
            if points:
                walk_paths.append(points)
                segments.append({"kind": "walk", "points": points})
            continue
        transit = step.get("transitDetails") or {}
        _finish_walk(details, ((transit.get("stopDetails") or {}).get("departureStop") or {}).get("name"))
        line = transit.get("transitLine") or {}
        vehicle = ((line.get("vehicle") or {}).get("type") or "BUS").upper()
        category = VEHICLE_CATEGORY.get(vehicle, "bus")
        name = line.get("nameShort") or line.get("name") or "public transport"
        lines.append({"name": name, "full_name": line.get("name") or name, "category": category})
        stops = transit.get("stopDetails") or {}
        board = (stops.get("departureStop") or {}).get("name")
        alight = (stops.get("arrivalStop") or {}).get("name")
        title = f"Take {name}" + (f" from {board}" if board else "") + (f" to {alight}" if alight else "")
        board_time = _stamp(stops.get("departureTime"))
        alight_time = _stamp(stops.get("arrivalTime"))
        if board_time and first_board is None:
            first_board = board_time
        if alight_time:
            last_alight = alight_time
            walk_after = 0.0
        details.append({"kind": category, "title": title, "line": name, "board_time": _clock(board_time) if board_time else None,
                        "stops": transit.get("stopCount"), "headsign": transit.get("headsign"),
                        "minutes": None if step_seconds is None else math.ceil(step_seconds / 60)})
        vehicle_km[category] = vehicle_km.get(category, 0) + distance_km
        if points:
            segments.append({"kind": category, "points": points, "label": name})
    _finish_walk(details, None)
    if not details:
        details = [{"kind": "walk", "title": "Open the full directions in Google Maps", "minutes": None}]
    if not segments and (route.get("polyline") or {}).get("encodedPolyline"):
        segments = [{"kind": "bus", "points": decode_polyline(route["polyline"]["encodedPolyline"])}]
    fare = currency = None
    money = (route.get("travelAdvisory") or {}).get("transitFare") or {}
    if "units" in money or "nanos" in money:
        currency = money.get("currencyCode")
        fare = int(money.get("units", 0)) + int(money.get("nanos", 0)) / 1_000_000_000
    categories = {line["category"] for line in lines}
    title = " + ".join(dict.fromkeys(
        line["full_name"] if line["category"] == "rail" and line["full_name"] != line["name"] else line["name"] for line in lines)) or "Public transport"
    kind_label = {"rail": "Train", "bus": "Bus", "tram": "Light rail", "ferry": "Ferry"}
    return {
        "id": f"transit-{index}", "mode": "transit",
        "kind": next(iter(categories)) if len(categories) == 1 else ("mixed" if categories else "bus"),
        "title": title, "subtitle": " · ".join(kind_label[c] for c in sorted(categories)) or "Public transport",
        "duration_minutes": math.ceil(total_seconds / 60),
        "arrival_dt": max(journey["departure"] + timedelta(seconds=total_seconds),
                          last_alight + timedelta(seconds=walk_after) if last_alight else journey["departure"]),
        "leave_dt": first_board - timedelta(seconds=walk_before) if first_board else None,
        "walking_minutes": math.ceil(walking_seconds / 60) if walking_known else None,
        "transfers": max(0, len(lines) - 1), "lines": lines,
        "cost": fare if currency in (None, "AUD") else None, "cost_known": fare is not None and currency == "AUD",
        "cost_label": "Fare from Google" if fare is not None else "Fare unavailable",
        "cost_breakdown": [{"label": "Public transport fare", "amount": fare}] if fare is not None else [],
        "distance_km": round((route.get("distanceMeters") or 0) / 1000, 1),
        "co2_kg": round(sum(km * journey["factors"][cat] for cat, km in vehicle_km.items()), 2),
        "steps": details, "segments": segments, "walk_paths": walk_paths,
        "other_minutes": math.ceil(max(0, total_seconds - itemized) / 60) if all_timed else None,
        "start": _latlng(leg.get("startLocation")), "end": _latlng(leg.get("endLocation")),
    }


def drive_option(route, index, journey):
    if not isinstance(route, dict):
        raise RoutesError("Google returned an invalid route.")
    total_seconds = seconds(route.get("duration"))
    legs = route.get("legs") or [{}]
    leg = legs[0] if isinstance(legs[0], dict) else {}
    steps = [step for step in (leg.get("steps") or []) if isinstance(step, dict)]
    details = [{"kind": "car", "title": (step.get("navigationInstruction") or {}).get("instructions") or "Continue",
                "minutes": math.ceil(seconds(step["staticDuration"]) / 60) if step.get("staticDuration") else None}
               for step in steps]
    encoded = (route.get("polyline") or {}).get("encodedPolyline")
    km = (route.get("distanceMeters") or 0) / 1000
    tolls = None
    toll_info = (route.get("travelAdvisory") or {}).get("tollInfo")
    if toll_info is not None:
        tolls = sum(google_api._money(price) or 0 for price in toll_info.get("estimatedPrice", [])
                    if price.get("currencyCode", "AUD") == "AUD")
    return {
        "id": f"drive-{index}", "mode": "drive", "kind": "car",
        "title": "Drive" + (f" · route {index + 1}" if index else ""), "subtitle": "Your own car",
        "duration_minutes": math.ceil(total_seconds / 60),
        "drive_seconds": total_seconds,
        "arrival_dt": journey["departure"] + timedelta(seconds=total_seconds),
        "walking_minutes": 0, "transfers": 0, "lines": [],
        "distance_km": round(km, 1), "km": km, "tolls": tolls,
        "steps": details[:25] or [{"kind": "car", "title": "Open the full directions in Google Maps", "minutes": None}],
        "segments": [{"kind": "car", "points": decode_polyline(encoded)}] if encoded else [],
        "walk_paths": [], "other_minutes": None,
        "start": _latlng(leg.get("startLocation")), "end": _latlng(leg.get("endLocation")),
    }


def uber_link(start, end, origin_label, destination_label):
    parameters = {"action": "setPickup"}
    if start:
        parameters.update({"pickup[latitude]": f"{start[0]:.6f}", "pickup[longitude]": f"{start[1]:.6f}", "pickup[nickname]": origin_label[:60]})
    else:
        parameters["pickup"] = "my_location"
    if end:
        parameters.update({"dropoff[latitude]": f"{end[0]:.6f}", "dropoff[longitude]": f"{end[1]:.6f}", "dropoff[nickname]": destination_label[:60]})
    return "https://m.uber.com/ul/?" + urlencode(parameters)


def maps_link(origin, destination, mode):
    return "https://www.google.com/maps/dir/?" + urlencode({"api": "1", "origin": origin, "destination": destination,
                                                           "travelmode": {"transit": "transit", "drive": "driving"}.get(mode, "driving")})


# ── Enrichment: costs, parking, CO2, realtime and limits ────────────────────────

def _fuel_cost(km, journey, fuel):
    price = journey["fuel_price"] or (fuel or {}).get("price")
    if price is None:
        return None, None
    litres = km * journey["fuel_l_per_100km"] / 100
    return round(litres * price, 2), price


def _limits(option, journey):
    reasons = []
    deadline = journey["deadline"]
    if deadline and option["arrival_dt"] > deadline:
        reasons.append({"limit": "deadline", "text": "Arrives after your deadline"})
    if option["walking_minutes"] is None:
        reasons.append({"limit": "walking", "text": "Walking time unavailable"})
    elif option["walking_minutes"] > journey["walking"]:
        reasons.append({"limit": "walking", "text": f"More than your {journey['walking']}-minute walking limit"})
    if not option["cost_known"]:
        reasons.append({"limit": "cost", "text": option.get("cost_unknown_text") or "Cost unknown, so your budget can't be confirmed"})
    elif option["cost"] > journey["budget"]:
        reasons.append({"limit": "cost", "text": f"Costs more than your ${journey['budget']:g} limit"})
    realtime = option.get("realtime") or {}
    if any(alert["disruptive"] for alert in realtime.get("alerts", [])):
        reasons.append({"limit": "disruption", "text": "A Translink alert affects this service"})
    if option.get("avoided"):
        reasons.append({"limit": "disruption", "text": "Uses the service you reported as disrupted"})
    return reasons


def plan(payload, key, services=None, now=None):
    services = services or Services()
    journey = validate(payload, now)
    now = now or datetime.now(BRISBANE)
    if not key:
        raise RoutesError("Live routes need a Google Maps API key on the server (MAPS_API_KEY).")
    errors, notes = [], []

    def fetch(mode):
        try:
            routes = services.routes(key, request_body(journey, mode), TRANSIT_FIELDS if mode == "transit" else DRIVE_FIELDS)
            if not isinstance(routes, list):
                raise RoutesError("Google returned an invalid route list.")
            return routes
        except RoutesError as error:
            errors.append(f"{'Public transport' if mode == 'transit' else 'Driving'}: {error}")
            return []

    # Driving is always fetched: it is the baseline for cost and CO2 savings, and it powers rideshare.
    with ThreadPoolExecutor(max_workers=2) as pool:
        transit_future = pool.submit(fetch, "transit") if journey["modes"]["transit"] else None
        drive_routes = pool.submit(fetch, "drive").result()
        transit_routes = transit_future.result() if transit_future else []

    transit = []
    for index, route in enumerate(transit_routes[:4]):
        try:
            option = transit_option(route, index, journey)
        except RoutesError as error:
            errors.append(f"Public transport: {error}")
            continue
        if not journey["transit_modes"]["ferry"] and any(line["category"] == "ferry" for line in option["lines"]):
            continue
        signature = (tuple(line["name"] for line in option["lines"]), option["arrival_dt"], option["walking_minutes"])
        if any(signature == (tuple(line["name"] for line in other["lines"]), other["arrival_dt"], other["walking_minutes"]) for other in transit):
            continue
        transit.append(option)
    drives = []
    for index, route in enumerate(drive_routes[:2]):
        try:
            drives.append(drive_option(route, index, journey))
        except RoutesError as error:
            errors.append(f"Driving: {error}")
    drives.sort(key=lambda option: option["drive_seconds"])

    start = next((option["start"] for option in drives + transit if option.get("start")), None)
    end = next((option["end"] for option in drives + transit if option.get("end")), None)

    # Enrich in parallel: fuel price near the start, car parks near the destination,
    # walking elevation for public transport, and Translink realtime for each line.
    def get_fuel():
        if journey["fuel_price"] or not start or not services.fuel or not drives:
            return None
        try:
            return services.fuel(key, start[0], start[1], journey["fuel_type"])
        except ServiceError as error:
            notes.append(str(error))
            return None

    def get_parking():
        if not end or not services.parking or not drives:
            return None
        try:
            return services.parking(key, end[0], end[1])
        except ServiceError as error:
            notes.append(str(error))
            return None

    def get_climb(option):
        if not journey["want_elevation"] or not services.climb or not option["walk_paths"]:
            return None
        try:
            return services.climb(key, option["walk_paths"])
        except ServiceError as error:
            notes.append(str(error))
            return None

    def get_realtime(option):
        if not services.monitor or not option["lines"]:
            return None
        return services.monitor.status_for_lines([line["name"] for line in option["lines"]] + [line["full_name"] for line in option["lines"]])

    with ThreadPoolExecutor(max_workers=8) as pool:
        fuel_future = pool.submit(get_fuel)
        parking_future = pool.submit(get_parking)
        climb_futures = [pool.submit(get_climb, option) for option in transit]
        realtime_futures = [pool.submit(get_realtime, option) for option in transit]
        fuel = fuel_future.result()
        parking = parking_future.result()
        for option, climb_future, realtime_future in zip(transit, climb_futures, realtime_futures):
            option["elevation"] = climb_future.result()
            option["realtime"] = realtime_future.result()

    # Public transport: realtime adjustment and avoided services.
    for option in transit:
        realtime = option.get("realtime") or {}
        option["scheduled_arrival_dt"] = option["arrival_dt"]
        if realtime.get("delay") and realtime["delay"] > 0:
            option["arrival_dt"] += timedelta(minutes=realtime["delay"])
        names = {line["name"].upper() for line in option["lines"]}
        option["avoided"] = bool(journey["avoid_lines"] & names)
        option["cost_unknown_text"] = "Fare unavailable, so your budget can't be confirmed"
        if not option["cost_known"] and journey["flat_fare"] is not None:
            option["cost"], option["cost_known"] = journey["flat_fare"], True
            option["cost_label"] = "Flat fare from your Settings (Google gave no fare)"
            option["cost_breakdown"] = [{"label": "Public transport flat fare (your setting)", "amount": journey["flat_fare"]}]

    # Driving: fuel, tolls, parking and the walk from the nearest car park.
    nearest_park = (parking or {}).get("parks", [None])[0] if parking and parking.get("parks") else None
    park_walk = math.ceil(nearest_park["distance_m"] / WALK_M_PER_MIN) if nearest_park else None
    for option in drives:
        fuel_cost, price = _fuel_cost(option["km"], journey, fuel)
        breakdown = []
        if fuel_cost is not None:
            breakdown.append({"label": f"Fuel ({option['km']:.1f} km at ${price:.2f}/L, {journey['fuel_l_per_100km']:g} L/100 km)", "amount": fuel_cost})
        if option["tolls"]:
            breakdown.append({"label": "Tolls (Google estimate)", "amount": round(option["tolls"], 2)})
        parking_known = journey["parking_cost"] is not None or bool(parking and parking["count"] and not parking["any_paid"] and parking["any_free"])
        if journey["parking_cost"] is not None:
            breakdown.append({"label": "Parking (your setting)", "amount": journey["parking_cost"]})
        elif parking_known:
            breakdown.append({"label": "Parking (free parking listed nearby)", "amount": 0})
        option["cost_known"] = fuel_cost is not None and parking_known
        option["cost"] = round(sum(item["amount"] for item in breakdown), 2) if option["cost_known"] else (round(sum(item["amount"] for item in breakdown), 2) if breakdown else None)
        option["cost_breakdown"] = breakdown
        option["cost_label"] = "Fuel, tolls and parking" if option["cost_known"] else "Partial: " + ", ".join(
            part for part, missing in (("fuel price", fuel_cost is None), ("parking cost", not parking_known)) if missing) + " unknown"
        option["cost_unknown_text"] = ("Paid parking near the destination; add a typical parking cost in Settings"
                                       if parking and parking["any_paid"] and journey["parking_cost"] is None
                                       else "Driving cost is incomplete")
        option["fuel_price"] = price
        litres = option["km"] * journey["fuel_l_per_100km"] / 100
        option["co2_kg"] = round(litres * FUEL_CO2_PER_L.get(journey["fuel_type"], PETROL_CO2_PER_L), 2)
        option["parking"] = parking
        if park_walk:
            option["walking_minutes"] = park_walk
            option["arrival_dt"] += timedelta(minutes=park_walk)
            option["steps"].append({"kind": "walk", "title": f"Park at {nearest_park['name']} and walk about {nearest_park['distance_m']} m", "minutes": park_walk})
        option["parking_note"] = ("No car parks are listed near the destination" if parking is not None and not parking["count"]
                                  else f"{parking['count']} car park{'s' if parking['count'] != 1 else ''} listed within {parking['radius_m']} m"
                                  + (" · paid" if parking["any_paid"] else "") + (" · free options" if parking["any_free"] else "")
                                  if parking else "Parking availability not checked")

    baseline = drives[0] if drives else None
    options = [option for option in transit]
    if journey["modes"]["drive"]:
        options.extend(drives)

    # Rideshare: the driving route, opened in Uber for the live price and pickup time.
    if journey["modes"]["rideshare"] and baseline:
        km = baseline["km"]
        options.append({
            "id": "rideshare-0", "mode": "rideshare", "kind": "rideshare", "title": "Uber", "subtitle": "Rideshare",
            "duration_minutes": baseline["duration_minutes"], "arrival_dt": journey["departure"] + timedelta(seconds=baseline["drive_seconds"]),
            "walking_minutes": 0, "transfers": 0, "lines": [], "distance_km": baseline["distance_km"],
            "cost": None, "cost_known": False, "cost_label": "Live price shown in Uber",
            "cost_breakdown": [], "cost_unknown_text": "Price and pickup wait are shown in Uber",
            "co2_kg": round(km * RIDESHARE_L_PER_100KM / 100 * PETROL_CO2_PER_L, 2),
            "steps": [{"kind": "rideshare", "title": "Open Uber to see the live price and pickup time", "minutes": None},
                      {"kind": "rideshare", "title": f"Ride about {baseline['duration_minutes']} min ({baseline['distance_km']} km)", "minutes": baseline["duration_minutes"]}],
            "segments": baseline["segments"], "walk_paths": [], "other_minutes": None,
            "start": baseline["start"], "end": baseline["end"], "pickup_unknown": True,
            "uber_url": uber_link(start, end, journey["origin"], journey["destination"]),
        })

    for option in options:
        option["reasons"] = _limits(option, journey)
        option["fits"] = not option["reasons"]
        option["maps_url"] = maps_link(journey["origin"], journey["destination"], option["mode"])
        if baseline and option is not baseline:
            option["vs_drive"] = {
                "minutes": round((option["arrival_dt"] - baseline["arrival_dt"]).total_seconds() / 60),
                "co2_saved_kg": round(baseline["co2_kg"] - option["co2_kg"], 2),
                "cost_saved": round(baseline["cost"] - option["cost"], 2) if baseline.get("cost_known") and option.get("cost_known") else None,
            }

    options.sort(key=lambda option: (not option["fits"], option["arrival_dt"]))
    matches = []
    if services.board and start and end:
        try:
            matches = services.board.matches(start, end, journey["departure"], journey["ride_tokens"])
        except ValueError:
            matches = []

    def public(option):
        hidden = {"arrival_dt", "scheduled_arrival_dt", "leave_dt", "walk_paths", "drive_seconds", "km", "tolls"}
        result = {key: value for key, value in option.items() if key not in hidden}
        result["arrival"] = option["arrival_dt"].isoformat()
        leave = option.get("leave_dt")
        result["leave_at"] = (leave if leave and leave > journey["departure"] else journey["departure"]).isoformat()
        result["door_to_door_minutes"] = math.ceil((option["arrival_dt"] - max(journey["departure"], leave or journey["departure"])).total_seconds() / 60)
        if option.get("scheduled_arrival_dt") and option["scheduled_arrival_dt"] != option["arrival_dt"]:
            result["scheduled_arrival"] = option["scheduled_arrival_dt"].isoformat()
        if journey["deadline"]:
            result["buffer_minutes"] = math.floor((journey["deadline"] - option["arrival_dt"]).total_seconds() / 60)
        return result

    pick = recommend(options, journey) if journey["purpose"] == "panic" else None
    return {
        "options": [public(option) for option in options],
        "recommended_id": pick["id"] if pick else None,
        "recommended_reason": pick["why"] if pick else None,
        "baseline": {"co2_kg": baseline["co2_kg"], "cost": baseline["cost"], "cost_known": baseline["cost_known"],
                     "minutes": baseline["duration_minutes"], "distance_km": baseline["distance_km"]} if baseline else None,
        "fuel": fuel if not journey["fuel_price"] else {"price": journey["fuel_price"], "stations": 0, "manual": True, "fuel_type": journey["fuel_type"]},
        "parking": parking, "rides": matches,
        "errors": errors, "notes": sorted(set(notes)),
        "queried_at": now.isoformat(), "purpose": journey["purpose"],
        "origin": journey["origin"], "destination": journey["destination"], "start": start, "end": end,
        "departure": journey["departure"].isoformat(),
        "deadline": journey["deadline"].isoformat() if journey["deadline"] else None,
        "factors": journey["factors"],
    }


def recommend(options, journey):
    """Panic mode: the easiest undisrupted option that still makes the deadline."""
    undisrupted = [option for option in options
                   if not any(reason["limit"] == "disruption" for reason in option["reasons"])
                   and option["mode"] != "rideshare"]
    pool = undisrupted or [option for option in options if option["mode"] != "rideshare"] or options
    if not pool:
        return None
    deadline = journey["deadline"]
    on_time = [option for option in pool if not deadline or option["arrival_dt"] <= deadline]
    # Prefer public transport when it is on time: no parking search, and the app's purpose.
    on_time = [option for option in on_time if option["mode"] == "transit"] or on_time
    if on_time:
        # Effort: each change counts like 8 extra minutes of walking.
        def effort(option):
            walking = option["walking_minutes"] if option["walking_minutes"] is not None else 30
            return walking + 8 * option["transfers"]
        best = min(on_time, key=lambda option: (effort(option), option["arrival_dt"]))
        changes = "no changes" if best["transfers"] == 0 else f"{best['transfers']} change{'s' if best['transfers'] != 1 else ''}"
        walking = f"{best['walking_minutes']} min walking" if best["walking_minutes"] else "almost no walking"
        why = ("Arrives before your deadline" if deadline else "Gets you there") + f" with {changes} and {walking}"
        if best is not min(on_time, key=lambda option: option["arrival_dt"]):
            why += ", the least effort of the options that are on time"
    else:
        best = min(pool, key=lambda option: option["arrival_dt"])
        why = "Nothing makes your deadline. This is the earliest arrival"
    if not undisrupted:
        why += ". Every option has a Translink alert, so check before you go"
    return {"id": best["id"], "why": why + "."}
