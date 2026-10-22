"""Offline checks for journey validation, route requests, costs, CO2, realtime and recommendations.

Every external lookup is replaced by a fake injected through live_routes.Services, so no test touches the network.
"""

from datetime import datetime, timedelta
from urllib.parse import parse_qs, urlparse
import unittest

import google_api
import live_routes
from live_routes import BRISBANE, InputError, Services, plan, request_body, validate

NOW = datetime(2026, 10, 20, 8, 0, tzinfo=BRISBANE)
START = {"latLng": {"latitude": -27.4975, "longitude": 153.0137}}
END = {"latLng": {"latitude": -27.4980, "longitude": 153.0100}}
# A well-known sample polyline from Google's documentation; it decodes to three points.
POLYLINE = "_p~iF~ps|U_ulLnnqC_mqNvxq`@"

PAYLOAD = {
    "origin": "Taringa Station, Brisbane QLD",
    "destination": "The University of Queensland, St Lucia QLD",
    "departure": "2026-10-20T08:20",
    "deadline": "2026-10-20T09:00",
    "budget": "5", "walking": "10",
    "modes": {"transit": True, "drive": False},
}


def walk(seconds, metres=400, polyline=None):
    step = {"travelMode": "WALK", "staticDuration": f"{seconds}s", "distanceMeters": metres}
    if polyline:
        step["polyline"] = {"encodedPolyline": polyline}
    return step


def ride(seconds, metres, name, vehicle="BUS", long_name=None):
    line = {"nameShort": name, "vehicle": {"type": vehicle}}
    if long_name:
        line["name"] = long_name
    return {"travelMode": "TRANSIT", "staticDuration": f"{seconds}s", "distanceMeters": metres, "transitDetails": {"transitLine": line}}


def transit_route(steps=None, duration=2040, fare=None):
    """Default: walk 6 min, bus 412 for 22 min over 10 km, walk 2 min. Total 34 min, 8 min walking."""
    steps = steps if steps is not None else [walk(360), ride(1320, 10000, "412"), walk(120)]
    route = {"duration": f"{duration}s", "distanceMeters": 11000, "legs": [{"startLocation": START, "endLocation": END, "steps": steps}]}
    if fare is not None:
        route["travelAdvisory"] = {"transitFare": fare}
    return route


def drive_route(duration=1200, metres=10000, tolls=None):
    route = {"duration": f"{duration}s", "distanceMeters": metres, "legs": [{"startLocation": START, "endLocation": END, "steps": []}]}
    if tolls is not None:
        route["travelAdvisory"] = {"tollInfo": {"estimatedPrice": tolls}}
    return route


AUD_4_50 = {"currencyCode": "AUD", "units": "4", "nanos": 500000000}


def car_park(distance_m=160, paid=True, free=False):
    park = {"name": "UQ Car Park", "distance_m": distance_m, "location": [-27.498, 153.011], "paid": paid, "free": free}
    return {"count": 1, "parks": [park], "radius_m": 800, "any_paid": paid, "any_free": free}


class FakeRoutes:
    """Returns different fixtures per travel mode and records every call."""

    def __init__(self, transit=None, drive=None, fail=()):
        self.transit = [transit_route()] if transit is None else transit
        self.drive = [drive_route()] if drive is None else drive
        self.fail = fail
        self.calls = []

    def __call__(self, key, body, mask):
        self.calls.append((key, body, mask))
        mode = body["travelMode"]
        if mode in self.fail:
            raise google_api.RoutesError(f"{mode} lookup failed.")
        return self.transit if mode == "TRANSIT" else self.drive


class FakeMonitor:
    def __init__(self, status):
        self.status = status
        self.names = []

    def status_for_lines(self, names):
        self.names.append(list(names))
        return self.status


def run(overrides=None, routes=None, now=NOW, **services):
    """Plan a journey with fakes. Fuel, parking, climb and monitor default to None unless supplied."""
    payload = {**PAYLOAD, **(overrides or {})}
    wiring = Services(routes=routes or FakeRoutes(), fuel=None, parking=None, climb=None, monitor=None, board=None)
    for name, value in services.items():
        setattr(wiring, name, value)
    return plan(payload, "test-key", wiring, now)


def option(result, option_id):
    return next(item for item in result["options"] if item["id"] == option_id)


def limits(item):
    return {reason["limit"] for reason in item["reasons"]}


class ValidationTests(unittest.TestCase):
    def assert_invalid(self, **overrides):
        with self.assertRaises(InputError):
            validate({**PAYLOAD, **overrides}, NOW)

    def test_same_origin_and_destination_is_rejected(self):
        self.assert_invalid(destination="  taringa station, brisbane qld ")

    def test_deadline_before_departure_is_rejected(self):
        self.assert_invalid(deadline="2026-10-20T08:10")

    def test_no_travel_mode_is_rejected(self):
        self.assert_invalid(modes={"transit": False, "drive": False, "rideshare": False})

    def test_push_bike_is_off_when_not_selected(self):
        journey = validate(PAYLOAD, NOW)
        self.assertFalse(journey["modes"]["bicycle"])

    def test_deadline_is_optional(self):
        journey = validate({**PAYLOAD, "deadline": ""}, NOW)
        self.assertIsNone(journey["deadline"])

    def test_the_removed_planb_search_type_becomes_a_regular_search(self):
        self.assertEqual(validate({**PAYLOAD, "purpose": "planb"}, NOW)["purpose"], "regular")

    def test_an_unknown_search_type_is_rejected(self):
        self.assert_invalid(purpose="disrupted")

    def test_unknown_fuel_type_is_rejected(self):
        self.assert_invalid(vehicle={"fuel_type": "UNICORN"})

    def test_leave_now_departs_one_minute_from_now(self):
        journey = validate({**PAYLOAD, "departure": "", "leave_now": True}, NOW)
        self.assertEqual(journey["departure"], NOW + timedelta(minutes=1))

    def test_plan_without_api_key_is_a_routes_error(self):
        with self.assertRaises(google_api.RoutesError):
            plan(PAYLOAD, "", Services(routes=FakeRoutes()), NOW)


class RequestBodyTests(unittest.TestCase):
    def test_transit_preferences_only_when_a_transit_type_is_off(self):
        everything_on = validate(PAYLOAD, NOW)
        self.assertNotIn("transitPreferences", request_body(everything_on, "transit"))
        no_bus = validate({**PAYLOAD, "transit_modes": {"bus": False}}, NOW)
        allowed = request_body(no_bus, "transit")["transitPreferences"]["allowedTravelModes"]
        self.assertEqual(allowed, ["LIGHT_RAIL", "RAIL", "SUBWAY", "TRAIN"])

    def test_latlng_origin_becomes_a_location_waypoint(self):
        journey = validate({**PAYLOAD, "origin": "-27.4975,153.0137"}, NOW)
        body = request_body(journey, "drive")
        self.assertEqual(body["origin"], {"location": {"latLng": {"latitude": -27.4975, "longitude": 153.0137}}})
        self.assertEqual(body["destination"], {"address": PAYLOAD["destination"]})
        self.assertEqual(body["travelMode"], "DRIVE")

    def test_chosen_suggestion_place_id_is_used_instead_of_the_address(self):
        journey = validate({**PAYLOAD, "destination_place_id": "ChIJexamplePlaceId_123"}, NOW)
        body = request_body(journey, "transit")
        self.assertEqual(body["destination"], {"placeId": "ChIJexamplePlaceId_123"})
        self.assertEqual(body["origin"], {"address": PAYLOAD["origin"]})

    def test_malformed_place_id_is_rejected(self):
        with self.assertRaises(InputError):
            validate({**PAYLOAD, "origin_place_id": "bad id with spaces"}, NOW)

    def test_each_mode_is_requested_with_its_own_travel_mode(self):
        routes = FakeRoutes()
        run({"modes": {"transit": True, "drive": True}}, routes=routes)
        self.assertEqual(sorted(call[1]["travelMode"] for call in routes.calls), ["DRIVE", "TRANSIT"])
        self.assertTrue(all(call[0] == "test-key" for call in routes.calls))

    def test_tolls_are_requested_only_when_driving_is_enabled(self):
        driving = validate({**PAYLOAD, "modes": {"transit": False, "drive": True}}, NOW)
        no_car = validate({**PAYLOAD, "modes": {"transit": False, "drive": False, "rideshare": True}}, NOW)
        self.assertEqual(request_body(driving, "drive")["extraComputations"], ["TOLLS"])
        self.assertNotIn("extraComputations", request_body(no_car, "drive"))

    CYCLE_MODES = {"transit": False, "drive": False, "rideshare": False, "scooter": True, "ebike": True, "bicycle": True}

    def cycle_route(self, metres=4000, duration="900s"):
        step = {"staticDuration": "300s", "distanceMeters": 1500, "polyline": {"encodedPolyline": POLYLINE}, "startLocation": START, "endLocation": END,
                "navigationInstruction": {"instructions": "Head  north", "maneuver": "DEPART"}}
        route = {"distanceMeters": metres, "polyline": {"encodedPolyline": POLYLINE}, "legs": [{"startLocation": START, "endLocation": END, "steps": [step]}]}
        if duration:
            route["duration"] = duration
        return route

    def test_scooter_ebike_and_push_bike_share_a_bicycle_route_but_remain_separate_options(self):
        routes = FakeRoutes(drive=[self.cycle_route()])
        result = run({"modes": self.CYCLE_MODES}, routes=routes)
        self.assertEqual({item["id"] for item in result["options"]}, {"scooter-0", "ebike-0", "bicycle-0"})
        bicycle_request = next(call[1] for call in routes.calls if call[1]["travelMode"] == "BICYCLE")
        self.assertEqual(bicycle_request["travelMode"], "BICYCLE")
        self.assertTrue(all(not item["cost_known"] for item in result["options"]))
        self.assertTrue(all(item["duration_minutes"] > 0 for item in result["options"]))
        self.assertTrue(all("not checked" in item["cost_unknown_text"].lower() for item in result["options"]))

    def test_cycle_options_report_zero_tailpipe_co2_with_an_honest_note(self):
        result = run({"modes": {**self.CYCLE_MODES, "drive": True}}, routes=FakeRoutes(drive=[self.cycle_route()]))
        for mode in ("scooter", "ebike", "bicycle"):
            item = option(result, f"{mode}-0")
            self.assertEqual(item["co2_kg"], 0)
            self.assertIn("No tailpipe emissions", item["co2_note"])
            self.assertIn("not counted", item["co2_note"])
            self.assertEqual(item["vs_drive"]["co2_saved_kg"], result["baseline"]["co2_kg"])

    def test_push_bike_uses_googles_cycling_duration_and_the_others_use_assumed_speeds(self):
        result = run({"modes": self.CYCLE_MODES}, routes=FakeRoutes(drive=[self.cycle_route(metres=4000, duration="1500s")]))
        self.assertEqual(option(result, "bicycle-0")["duration_minutes"], 25)
        self.assertIn("Google's cycling time", option(result, "bicycle-0")["subtitle"])
        self.assertEqual(option(result, "scooter-0")["duration_minutes"], 16)
        self.assertEqual(option(result, "ebike-0")["duration_minutes"], 12)
        self.assertIn("15 km/h assumed", option(result, "scooter-0")["subtitle"])
        self.assertIn("assumed", option(result, "scooter-0")["notice"])

    def test_push_bike_falls_back_to_an_assumed_speed_without_a_google_duration(self):
        result = run({"modes": self.CYCLE_MODES}, routes=FakeRoutes(drive=[self.cycle_route(metres=6000, duration=None)]), )
        item = option(result, "bicycle-0") if any(o["id"] == "bicycle-0" for o in result["options"]) else None
        self.assertIsNone(item)  # 6 km is over the push-bike limit
        result = run({"modes": self.CYCLE_MODES}, routes=FakeRoutes(drive=[self.cycle_route(metres=3000, duration=None)]))
        self.assertEqual(option(result, "bicycle-0")["duration_minutes"], 15)
        self.assertIn("12 km/h assumed", option(result, "bicycle-0")["subtitle"])

    def test_push_bike_is_only_offered_for_short_trips(self):
        limit = live_routes.PUSH_BIKE_MAX_KM
        result = run({"modes": self.CYCLE_MODES}, routes=FakeRoutes(drive=[self.cycle_route(metres=limit * 1000 + 500)]))
        self.assertEqual({item["id"] for item in result["options"]}, {"scooter-0", "ebike-0"})
        self.assertTrue(any("Push bike is only offered" in note for note in result["notes"]))
        result = run({"modes": self.CYCLE_MODES}, routes=FakeRoutes(drive=[self.cycle_route(metres=limit * 1000)]))
        self.assertIn("bicycle-0", {item["id"] for item in result["options"]})

    def test_cycle_options_get_directions_from_the_google_cycling_steps(self):
        item = option(run({"modes": self.CYCLE_MODES}, routes=FakeRoutes(drive=[self.cycle_route()])), "ebike-0")
        self.assertEqual(len(item["nav"]), 1)
        self.assertEqual(item["nav"][0]["mode"], "ebike")
        self.assertEqual(item["steps"][0]["title"], "Head north")
        self.assertIn("travelmode=bicycling", item["maps_url"])
        bare = option(run({"modes": self.CYCLE_MODES}, routes=FakeRoutes(drive=[{**self.cycle_route(), "legs": [{}]}])), "ebike-0")
        self.assertEqual(bare["nav"], [])
        self.assertEqual(len(bare["steps"]), 1)

    def test_panic_mode_never_recommends_an_unchecked_cycle_option(self):
        payload = {"modes": {**self.CYCLE_MODES, "transit": True, "drive": True}, "purpose": "panic", "departure": "", "deadline": "2026-10-20T10:00", "transit_flat_fare": 3}
        result = run(payload, routes=FakeRoutes(drive=[self.cycle_route()]))
        self.assertNotIn(result["recommended_id"], {"scooter-0", "ebike-0", "bicycle-0"})
        only = run({"modes": self.CYCLE_MODES, "purpose": "panic", "departure": ""}, routes=FakeRoutes(drive=[self.cycle_route()]))
        self.assertIn(only["recommended_id"], {"scooter-0", "ebike-0", "bicycle-0"})


class TransitTests(unittest.TestCase):
    def test_google_fare_marks_cost_known(self):
        result = run(routes=FakeRoutes(transit=[transit_route(fare=AUD_4_50)]))
        bus = option(result, "transit-0")
        self.assertEqual(bus["cost"], 4.5)
        self.assertTrue(bus["cost_known"])
        self.assertEqual(bus["cost_label"], "Fare from Google")
        self.assertEqual(bus["arrival"], "2026-10-20T08:54:00+10:00")
        self.assertEqual(bus["walking_minutes"], 8)
        self.assertTrue(bus["fits"])

    def test_flat_fare_is_applied_when_google_gives_no_fare(self):
        bus = option(run({"transit_flat_fare": "3.5"}), "transit-0")
        self.assertEqual(bus["cost"], 3.5)
        self.assertTrue(bus["cost_known"])
        self.assertIn("Flat fare", bus["cost_label"])
        self.assertTrue(bus["fits"])

    def test_missing_fare_without_flat_fare_does_not_fit(self):
        bus = option(run(), "transit-0")
        self.assertFalse(bus["cost_known"])
        self.assertFalse(bus["fits"])
        self.assertEqual(limits(bus), {"cost"})
        self.assertIn("Fare unavailable", bus["reasons"][0]["text"])

    def test_deadline_miss_has_a_reason_and_negative_buffer(self):
        bus = option(run({"deadline": "2026-10-20T08:40", "transit_flat_fare": 3}), "transit-0")
        self.assertEqual(limits(bus), {"deadline"})
        self.assertEqual(bus["buffer_minutes"], -14)

    def test_walking_limit_reason(self):
        bus = option(run({"walking": 5, "transit_flat_fare": 3}), "transit-0")
        self.assertEqual(limits(bus), {"walking"})
        self.assertIn("5-minute walking limit", bus["reasons"][0]["text"])

    def test_duplicate_transit_routes_are_deduplicated(self):
        slower = transit_route(duration=2400)
        result = run(routes=FakeRoutes(transit=[transit_route(), transit_route(), slower]))
        self.assertEqual([item["id"] for item in result["options"] if item["mode"] == "transit"], ["transit-0", "transit-2"])

    def test_ferry_routes_are_excluded_when_ferries_are_off(self):
        ferry = transit_route([walk(120), ride(900, 3000, "CityCat", vehicle="FERRY"), walk(120)], duration=1200)
        routes = FakeRoutes(transit=[ferry, transit_route()])
        kept = run(routes=routes)
        self.assertEqual(len([item for item in kept["options"] if item["mode"] == "transit"]), 2)
        filtered = run({"transit_modes": {"ferry": False}}, routes=routes)
        transit = [item for item in filtered["options"] if item["mode"] == "transit"]
        self.assertEqual([item["lines"][0]["name"] for item in transit], ["412"])

    def test_walking_steps_with_polylines_request_elevation(self):
        seen = []

        def climb(key, paths):
            seen.append(paths)
            return {"gain_m": 12, "loss_m": 3, "source": "fake"}

        route = transit_route([walk(360, polyline=POLYLINE), ride(1320, 10000, "412"), walk(120)])
        bus = option(run(routes=FakeRoutes(transit=[route]), climb=climb), "transit-0")
        self.assertEqual(bus["elevation"]["gain_m"], 12)
        self.assertEqual(len(seen), 1)
        self.assertEqual(len(seen[0][0]), 3)
        self.assertNotIn("walk_paths", bus)


class DriveTests(unittest.TestCase):
    DRIVE = {"modes": {"transit": False, "drive": True}, "vehicle": {"fuel_price": 2.0, "fuel_l_per_100km": 10}}

    def test_cost_is_fuel_plus_tolls_plus_parking(self):
        toll = [{"currencyCode": "AUD", "units": "3", "nanos": 500000000}]
        routes = FakeRoutes(drive=[drive_route(tolls=toll)])
        drive = option(run({**self.DRIVE, "parking_cost": 5, "budget": 50}, routes=routes), "drive-0")
        # 10 km at 10 L/100 km is 1 L at $2.00, plus $3.50 tolls and $5 parking.
        self.assertEqual(drive["cost"], 10.5)
        self.assertTrue(drive["cost_known"])
        self.assertEqual([item["amount"] for item in drive["cost_breakdown"]], [2.0, 3.5, 5])
        self.assertTrue(drive["fits"])

    def test_cost_is_incomplete_when_paid_parking_is_nearby_and_cost_unknown(self):
        drive = option(run(self.DRIVE, parking=lambda key, lat, lng: car_park()), "drive-0")
        self.assertFalse(drive["cost_known"])
        self.assertEqual(drive["cost"], 2.0)
        self.assertIn("parking cost", drive["cost_label"])
        self.assertIn("cost", limits(drive))
        self.assertIn("Paid parking", drive["reasons"][-1]["text"])

    def test_free_parking_nearby_makes_cost_known(self):
        free = car_park(paid=False, free=True)
        drive = option(run(self.DRIVE, parking=lambda key, lat, lng: free), "drive-0")
        self.assertTrue(drive["cost_known"])
        self.assertEqual(drive["cost"], 2.0)

    def test_arrival_includes_walk_from_nearest_car_park(self):
        drive = option(run({**self.DRIVE, "parking_cost": 0}, parking=lambda key, lat, lng: car_park(distance_m=160)), "drive-0")
        # 20 min driving from 8:20 plus a 160 m walk at 80 m/min (2 min).
        self.assertEqual(drive["arrival"], "2026-10-20T08:42:00+10:00")
        self.assertEqual(drive["walking_minutes"], 2)
        self.assertEqual(drive["steps"][-1]["kind"], "walk")

    def test_fuel_price_comes_from_the_fuel_service_when_not_set(self):
        asked = []

        def fuel(key, lat, lng, fuel_type):
            asked.append((lat, lng, fuel_type))
            return {"price": 1.9, "stations": 4, "fuel_type": fuel_type}

        payload = {"modes": {"transit": False, "drive": True}, "parking_cost": 0}
        drive = option(run(payload, fuel=fuel), "drive-0")
        # Default 8 L/100 km over 10 km is 0.8 L at $1.90.
        self.assertEqual(drive["cost"], 1.52)
        self.assertEqual(asked, [(-27.4975, 153.0137, "SP91")])

    def test_co2_uses_fuel_specific_factors(self):
        petrol = option(run({**self.DRIVE, "parking_cost": 0}), "drive-0")
        diesel = option(run({**self.DRIVE, "parking_cost": 0, "vehicle": {**self.DRIVE["vehicle"], "fuel_type": "DIESEL"}}), "drive-0")
        self.assertEqual(petrol["co2_kg"], 2.31)
        self.assertEqual(diesel["co2_kg"], 2.68)


class EmissionsAndComparisonTests(unittest.TestCase):
    def test_transit_co2_uses_category_factors_times_step_km(self):
        steps = [walk(120), ride(1200, 10000, "412"), ride(1200, 20000, "Ipswich", vehicle="HEAVY_RAIL"), walk(120)]
        bus_and_train = option(run(routes=FakeRoutes(transit=[transit_route(steps)])), "transit-0")
        # Bus 10 km x 0.105 plus rail 20 km x 0.035.
        self.assertEqual(bus_and_train["co2_kg"], 1.75)
        self.assertEqual(bus_and_train["transfers"], 1)
        self.assertEqual(bus_and_train["kind"], "mixed")

    def test_emission_factor_overrides_apply(self):
        result = run({"emission_factors": {"bus": 0.2}})
        self.assertEqual(option(result, "transit-0")["co2_kg"], 2.0)
        self.assertEqual(result["factors"]["rail"], live_routes.DEFAULT_FACTORS["rail"])

    def test_vs_drive_reports_time_co2_and_cost_savings(self):
        route = transit_route(fare=AUD_4_50)
        overrides = {"modes": {"transit": True, "drive": True}, "vehicle": {"fuel_price": 2.0}, "parking_cost": 0, "budget": 50}
        result = run(overrides, routes=FakeRoutes(transit=[route]))
        bus, drive = option(result, "transit-0"), option(result, "drive-0")
        self.assertNotIn("vs_drive", drive)
        # Bus arrives 8:54, drive 8:40. Drive CO2 is 0.8 L x 2.31 = 1.85 kg; bus is 1.05 kg.
        self.assertEqual(bus["vs_drive"], {"minutes": 14, "co2_saved_kg": 0.8, "cost_saved": -2.9})
        self.assertEqual(result["baseline"]["co2_kg"], 1.85)

    def test_rideshare_links_to_uber_with_unknown_cost(self):
        result = run({"modes": {"transit": False, "drive": False, "rideshare": True}})
        uber = option(result, "rideshare-0")
        self.assertTrue(uber["uber_url"].startswith("https://m.uber.com/ul/?"))
        query = parse_qs(urlparse(uber["uber_url"]).query)
        self.assertEqual(float(query["pickup[latitude]"][0]), -27.4975)
        self.assertEqual(float(query["pickup[longitude]"][0]), 153.0137)
        self.assertEqual(float(query["dropoff[latitude]"][0]), -27.498)
        self.assertEqual(float(query["dropoff[longitude]"][0]), 153.01)
        self.assertIsNone(uber["cost"])
        self.assertFalse(uber["cost_known"])
        self.assertFalse(uber["fits"])
        self.assertEqual([item["id"] for item in result["options"]], ["rideshare-0"])


class RealtimeTests(unittest.TestCase):
    def test_positive_delay_shifts_arrival_and_keeps_scheduled_time(self):
        monitor = FakeMonitor({"alerts": [], "delay": 5, "cancelled": 0, "checked": True, "error": None})
        bus = option(run({"transit_flat_fare": 3}, monitor=monitor), "transit-0")
        self.assertEqual(bus["arrival"], "2026-10-20T08:59:00+10:00")
        self.assertEqual(bus["scheduled_arrival"], "2026-10-20T08:54:00+10:00")
        self.assertEqual(bus["buffer_minutes"], 1)
        self.assertIn("412", monitor.names[0])

    def test_no_delay_leaves_arrival_and_omits_scheduled_arrival(self):
        monitor = FakeMonitor({"alerts": [], "delay": None, "cancelled": 0, "checked": True, "error": None})
        bus = option(run({"transit_flat_fare": 3}, monitor=monitor), "transit-0")
        self.assertEqual(bus["arrival"], "2026-10-20T08:54:00+10:00")
        self.assertNotIn("scheduled_arrival", bus)

    def test_disruptive_alert_adds_a_disruption_reason(self):
        alert = {"id": "a1", "header": "Cancelled", "effect": "No service", "disruptive": True, "lines": ["412"]}
        monitor = FakeMonitor({"alerts": [alert], "delay": None, "cancelled": 0, "checked": True, "error": None})
        bus = option(run({"transit_flat_fare": 3}, monitor=monitor), "transit-0")
        self.assertEqual(limits(bus), {"disruption"})
        self.assertFalse(bus["fits"])

    def test_non_disruptive_alert_does_not_block_the_option(self):
        alert = {"id": "a2", "header": "Lift out", "effect": "No effect", "disruptive": False, "lines": ["412"]}
        monitor = FakeMonitor({"alerts": [alert], "delay": None, "cancelled": 0, "checked": True, "error": None})
        self.assertTrue(option(run({"transit_flat_fare": 3}, monitor=monitor), "transit-0")["fits"])

    def test_avoided_line_adds_a_disruption_reason(self):
        bus = option(run({"transit_flat_fare": 3, "avoid_lines": [" 412 "]}), "transit-0")
        self.assertEqual(limits(bus), {"disruption"})
        self.assertIn("reported as disrupted", bus["reasons"][0]["text"])


class FailureAndRecommendationTests(unittest.TestCase):
    BOTH = {"modes": {"transit": True, "drive": True}, "vehicle": {"fuel_price": 2.0}, "parking_cost": 0}

    def test_failed_drive_lookup_is_reported_and_transit_still_returns(self):
        result = run(self.BOTH, routes=FakeRoutes(fail=("DRIVE",)))
        self.assertEqual(len(result["errors"]), 1)
        self.assertTrue(result["errors"][0].startswith("Driving:"))
        self.assertEqual([item["id"] for item in result["options"]], ["transit-0"])
        self.assertIsNone(result["baseline"])

    def test_failed_transit_lookup_is_reported_and_driving_still_returns(self):
        result = run(self.BOTH, routes=FakeRoutes(fail=("TRANSIT",)))
        self.assertTrue(result["errors"][0].startswith("Public transport:"))
        self.assertEqual([item["id"] for item in result["options"]], ["drive-0"])

    def test_route_without_duration_is_reported_not_raised(self):
        result = run(routes=FakeRoutes(transit=[{"legs": []}]))
        self.assertEqual(result["options"], [])
        self.assertIn("Public transport: Google returned a route without a valid duration.", result["errors"])

    def test_panic_prefers_an_on_time_transit_option_over_a_faster_drive(self):
        payload = {**self.BOTH, "purpose": "panic", "departure": "", "transit_flat_fare": 3}
        result = run(payload)
        # Leaving at 8:01: driving arrives 8:21, the bus 8:35, both before 9:00.
        self.assertEqual(result["recommended_id"], "transit-0")
        self.assertIn("Arrives before your deadline", result["recommended_reason"])
        self.assertEqual(result["departure"], "2026-10-20T08:01:00+10:00")

    def test_panic_falls_back_to_earliest_arrival_when_nothing_is_on_time(self):
        payload = {**self.BOTH, "purpose": "panic", "departure": "", "deadline": "2026-10-20T08:10", "transit_flat_fare": 3}
        result = run(payload)
        self.assertEqual(result["recommended_id"], "drive-0")
        self.assertTrue(result["recommended_reason"].startswith("Nothing makes your deadline"))

    def test_regular_search_has_no_recommendation(self):
        result = run({"purpose": "regular", "deadline": ""})
        self.assertIsNone(result["recommended_id"])


if __name__ == "__main__":
    unittest.main()
