"""Validate a real journey request and normalise Google Routes estimates for Plan B."""

from datetime import datetime, timedelta
import json
import math
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

BRISBANE = ZoneInfo("Australia/Brisbane")
ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes"
TRANSIT_FIELDS = ",".join((
    "routes.duration", "routes.legs.steps.travelMode", "routes.legs.steps.staticDuration",
    "routes.legs.steps.navigationInstruction.instructions", "routes.legs.steps.transitDetails",
    "routes.travelAdvisory.transitFare",
))
DRIVE_FIELDS = "routes.duration,routes.legs.steps.navigationInstruction.instructions,routes.legs.steps.staticDuration"


class InputError(ValueError):
    """User input that should be corrected before a route lookup."""


class RoutesError(Exception):
    """A Google Routes request failed or returned unusable data."""


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


def validate(payload, now=None):
    if not isinstance(payload, dict):
        raise InputError("Enter a journey to search.")
    origin = payload.get("origin")
    destination = payload.get("destination")
    if not all(isinstance(value, str) and 3 <= len(value.strip()) <= 200 and not any(ord(char) < 32 for char in value) for value in (origin, destination)):
        raise InputError("Enter an origin and destination of 3–200 characters each.")
    origin, destination = origin.strip(), destination.strip()
    if origin.casefold() == destination.casefold():
        raise InputError("Choose different starting and destination places.")
    if not all(isinstance(payload.get(field), str) and "T" in payload[field] for field in ("departure", "deadline")):
        raise InputError("Enter a valid departure and arrival deadline.")
    try:
        departure = datetime.fromisoformat(payload["departure"])
        deadline = datetime.fromisoformat(payload["deadline"])
    except (KeyError, TypeError, ValueError) as error:
        raise InputError("Enter a valid departure and arrival deadline.") from error
    if departure.tzinfo or deadline.tzinfo:
        raise InputError("Enter local Brisbane date and time without a time zone suffix.")
    departure = departure.replace(tzinfo=BRISBANE)
    deadline = deadline.replace(tzinfo=BRISBANE)
    now = now or datetime.now(BRISBANE)
    if departure <= now or departure > now + timedelta(days=100):
        raise InputError("Choose a future departure within 100 days.")
    if deadline <= departure:
        raise InputError("The arrival deadline must be after departure.")
    try:
        budget = float(payload["budget"])
        walking_value = float(payload["walking"])
    except (KeyError, TypeError, ValueError, OverflowError) as error:
        raise InputError("Enter a fare limit and maximum walking time.") from error
    if not math.isfinite(walking_value) or not walking_value.is_integer():
        raise InputError("Walking time must be a whole number of minutes.")
    walking = int(walking_value)
    if not math.isfinite(budget) or not 0 <= budget <= 500 or not 0 <= walking <= 120:
        raise InputError("Use a fare limit from $0 to $500 and walking from 0 to 120 minutes.")
    modes = payload.get("modes")
    if not isinstance(modes, dict) or not any(modes.get(mode) is True for mode in ("transit", "drive")):
        raise InputError("Select public transport or driving to search.")
    return {"origin": origin, "destination": destination, "departure": departure,
            "deadline": deadline, "budget": budget, "walking": walking,
            "modes": {mode: modes.get(mode) is True for mode in ("transit", "drive")}}


def google_fetch(key, body, field_mask):
    request = Request(ROUTES_URL, data=json.dumps(body).encode("utf-8"), headers={
        "Content-Type": "application/json", "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": field_mask,
    }, method="POST")
    try:
        with urlopen(request, timeout=18) as response:
            return json.load(response).get("routes", [])
    except HTTPError as error:
        raise RoutesError(f"Google Routes returned HTTP {error.code}. Check the key, billing, quota and Routes API access.") from error
    except (URLError, TimeoutError) as error:
        raise RoutesError("Google Routes could not be reached. Try again shortly.") from error
    except (ValueError, AttributeError) as error:
        raise RoutesError("Google returned an unreadable route response.") from error


def request_body(journey, mode):
    body = {
        "origin": {"address": journey["origin"]},
        "destination": {"address": journey["destination"]},
        "travelMode": "TRANSIT" if mode == "transit" else "DRIVE",
        "departureTime": journey["departure"].isoformat(),
        "languageCode": "en-AU", "units": "METRIC",
        "computeAlternativeRoutes": True,
    }
    if mode == "drive":
        body["routingPreference"] = "TRAFFIC_AWARE"
    return body


def route_option(route, mode, index, journey):
    if not isinstance(route, dict):
        raise RoutesError("Google returned an invalid route.")
    duration = math.ceil(seconds(route.get("duration")) / 60)
    arrival = journey["departure"] + timedelta(minutes=duration)
    legs = route.get("legs") or []
    steps = legs[0].get("steps", []) if legs and isinstance(legs[0], dict) else []
    if not isinstance(steps, list) or any(not isinstance(step, dict) for step in steps):
        raise RoutesError("Google returned an invalid step list.")
    walking_seconds = 0
    walking_known = bool(steps) if mode == "transit" else True
    details = []
    transit_legs = 0
    itemized_seconds = 0
    all_steps_timed = bool(steps)
    for step in steps:
        kind = step.get("travelMode", "")
        duration_text = step.get("staticDuration")
        if duration_text:
            step_seconds = seconds(duration_text)
            itemized_seconds += step_seconds
            step_minutes = math.ceil(step_seconds / 60)
        else:
            all_steps_timed = False
            step_minutes = None
        if kind == "WALK":
            if duration_text:
                walking_seconds += seconds(duration_text)
            else:
                walking_known = False
            title = step.get("navigationInstruction", {}).get("instructions") or "Walk to the next stop or destination"
        elif kind == "TRANSIT":
            transit_legs += 1
            transit = step.get("transitDetails", {})
            line = transit.get("transitLine", {})
            name = line.get("nameShort") or line.get("name") or "public transport"
            stop_details = transit.get("stopDetails", {})
            board = stop_details.get("departureStop", {}).get("name")
            alight = stop_details.get("arrivalStop", {}).get("name")
            title = f"Take {name}" + (f" from {board}" if board else "")
            if alight:
                title += f" to {alight}"
            if stop_details.get("departureTime"):
                try:
                    board_time = datetime.fromisoformat(stop_details["departureTime"].replace("Z", "+00:00")).astimezone(BRISBANE)
                except ValueError:
                    board_time = None
                if board_time:
                    title += f" · board at {board_time.hour % 12 or 12}:{board_time.minute:02d} {'am' if board_time.hour < 12 else 'pm'}"
        else:
            title = step.get("navigationInstruction", {}).get("instructions") or "Drive towards your destination"
        details.append({"title": title, "minutes": step_minutes})
    if not details:
        details = [{"title": "Open the full directions in Google Maps", "minutes": None}]
    fare = None
    currency = None
    if mode == "transit":
        money = route.get("travelAdvisory", {}).get("transitFare") or {}
        if "units" in money or "nanos" in money:
            currency = money.get("currencyCode")
            fare = int(money.get("units", 0)) + int(money.get("nanos", 0)) / 1_000_000_000
    walking = math.ceil(walking_seconds / 60) if walking_known else None
    other_minutes = math.ceil(max(0, seconds(route["duration"]) - itemized_seconds) / 60) if all_steps_timed else None
    reasons = []
    if arrival > journey["deadline"]:
        reasons.append("Arrives after your deadline")
    if walking is None and mode == "transit":
        reasons.append("Walking time unavailable")
    elif walking is not None and walking > journey["walking"]:
        reasons.append("Exceeds your walking limit")
    if mode == "transit":
        if fare is None:
            reasons.append("Fare unavailable; budget fit unknown")
        elif currency != "AUD":
            reasons.append("Fare is not in AUD; budget fit unknown")
        elif fare > journey["budget"]:
            reasons.append("Exceeds your total-fare limit")
    else:
        reasons.append("Fuel, parking and other driving costs unknown")
    return {
        "id": f"{mode}-{index}", "mode": mode,
        "title": ("Public transport" if mode == "transit" else "Drive") + (f" · option {index + 1}" if index else ""),
        "duration_minutes": duration, "arrival": arrival.isoformat(),
        "walking_minutes": walking, "fare": fare, "currency": currency,
        "transfers": max(0, transit_legs - 1) if mode == "transit" else 0,
        "steps": details, "other_minutes": other_minutes,
        "reasons": reasons, "fits": not reasons,
    }


def plan(payload, key, fetcher=google_fetch, now=None):
    journey = validate(payload, now)
    if not key:
        raise RoutesError("Live routes need a server-side MAPS_API_KEY.")
    options = []
    errors = []
    for mode in ("transit", "drive"):
        if not journey["modes"][mode]:
            continue
        try:
            routes = fetcher(key, request_body(journey, mode), TRANSIT_FIELDS if mode == "transit" else DRIVE_FIELDS)
            if not isinstance(routes, list):
                raise RoutesError("Google returned an invalid route list.")
            options.extend(route_option(route, mode, index, journey) for index, route in enumerate(routes[:4]))
        except RoutesError as error:
            errors.append(f"{mode.title()}: {error}")
    options.sort(key=lambda option: (not option["fits"], option["arrival"]))
    return {"options": options, "errors": errors,
            "queried_at": (now or datetime.now(BRISBANE)).isoformat(),
            "origin": journey["origin"], "destination": journey["destination"],
            "departure": journey["departure"].isoformat(), "deadline": journey["deadline"].isoformat()}
