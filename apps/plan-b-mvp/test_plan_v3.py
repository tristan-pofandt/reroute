"""Offline checks for v3 planning: turn-by-turn nav, GTFS matching, per-step realtime, weather and traffic effects,
demo overrides and Google API cost counting. Every external service is a fake injected through live_routes.Services."""

from datetime import timedelta
import unittest

import demo_mode
import google_api
import live_routes
from gtfs_rt import realtime_object
from live_routes import InputError, Services, live, plan
from test_live_routes import (BRISBANE, END, NOW, PAYLOAD, START, FakeRoutes, drive_route, limits, option, run, transit_route, walk)
import traffic as traffic_mod
import weather as weather_mod

POLYLINE = "_p~iF~ps|U_ulLnnqC_mqNvxq`@"
DEP_LL = {"latLng": {"latitude": -27.4932, "longitude": 152.9814}}
ARR_LL = {"latLng": {"latitude": -27.4980, "longitude": 153.0100}}


def bus(name="412", seconds=1320, metres=10000, vehicle="BUS", depart="2026-10-19T22:23:00Z", arrive="2026-10-19T22:45:00Z", color="#ff8800", long_name=None):
    line = {"nameShort": name, "vehicle": {"type": vehicle}, "color": color}
    if long_name:
        line["name"] = long_name
    return {"travelMode": "TRANSIT", "staticDuration": f"{seconds}s", "distanceMeters": metres, "polyline": {"encodedPolyline": POLYLINE},
            "startLocation": DEP_LL, "endLocation": ARR_LL, "navigationInstruction": {"instructions": "Bus towards UQ"},
            "transitDetails": {"transitLine": line, "headsign": "UQ Lakes", "stopCount": 8,
                               "stopDetails": {"departureStop": {"name": "Taringa", "location": DEP_LL}, "arrivalStop": {"name": "UQ Lakes", "location": ARR_LL},
                                               "departureTime": depart, "arrivalTime": arrive}}}


def nav_walk(seconds=360, text="Head south on Swann Rd", maneuver="DEPART"):
    return {**walk(seconds, 400, POLYLINE), "navigationInstruction": {"instructions": text, "maneuver": maneuver},
            "startLocation": START, "endLocation": END}


class FakeStatic:
    def __init__(self, match="default"):
        self.calls = []
        self.match = {"route_ids": ["412-5146"], "stop_id": "1683", "dep_stop_ids": ["1683", "1684"], "arr_stop_ids": ["1951"], "colour": "#E463A4",
                      "text_colour": "#1D1D1D", "short_names": ["412"]} if match == "default" else match

    def match_transit(self, *args):
        self.calls.append(args)
        return self.match


class StepMonitor:
    """A monitor with exact step lookups. `realtime` is returned for every step."""

    def __init__(self, realtime=None, alerts=(), delay=None, trip_id=None):
        self.queries, self.realtime, self.alerts, self.delay, self.trip_id = [], realtime or realtime_object("on_time", 0), list(alerts), delay, trip_id

    def step_status(self, query):
        self.queries.append(query)
        realtime = dict(self.realtime)
        if self.trip_id:
            realtime["trip_id"] = self.trip_id
        return {"realtime": realtime, "alerts": self.alerts, "delay": self.delay, "cancelled": 0, "checked": True, "error": None}


def transit_payload(**extra):
    return {"transit_flat_fare": 3, "modes": {"transit": True, "drive": False}, **extra}


def route_with_bus(**kwargs):
    return transit_route([nav_walk(), bus(**kwargs), nav_walk(120, "Walk to Hawken Dr", "TURN_LEFT")])


def transit_nav(result, index=0):
    return next(item for item in option(result, f"transit-{index}")["nav"] if item["transit"])


class NavTests(unittest.TestCase):
    def test_transit_nav_has_walk_transit_and_walk_items_with_geometry(self):
        result = run(transit_payload(), routes=FakeRoutes(transit=[route_with_bus()]))
        items = option(result, "transit-0")["nav"]
        self.assertEqual([item["mode"] for item in items], ["walk", "transit", "walk"])
        first = items[0]
        self.assertEqual((first["instruction"], first["maneuver"], first["distance_m"], first["duration_s"]), ("Head south on Swann Rd", "DEPART", 400, 360))
        self.assertEqual((first["start"], first["end"]), ([START["latLng"]["latitude"], START["latLng"]["longitude"]], [END["latLng"]["latitude"], END["latLng"]["longitude"]]))
        self.assertEqual(len(first["polyline"]), 3)
        self.assertIsNone(first["transit"])
        self.assertEqual(items[2]["maneuver"], "TURN_LEFT")
        self.assertEqual(set(first), {"mode", "instruction", "maneuver", "distance_m", "duration_s", "start", "end", "polyline", "transit"})

    def test_transit_item_uses_the_step_polyline_and_carries_line_details(self):
        result = run(transit_payload(), routes=FakeRoutes(transit=[route_with_bus()]))
        item = transit_nav(result)
        self.assertEqual(len(item["polyline"]), 3)
        self.assertEqual(item["instruction"], "Take 412 from Taringa to UQ Lakes")
        transit = item["transit"]
        self.assertEqual((transit["line"], transit["vehicle"], transit["headsign"], transit["colour"]), ("412", "bus", "UQ Lakes", "#FF8800"))
        self.assertEqual((transit["departure_stop"], transit["arrival_stop"], transit["stops"]), ("Taringa", "UQ Lakes", 8))
        self.assertEqual(transit["departure_time"], "2026-10-20T08:23:00+10:00")
        self.assertEqual(transit["arrival_time"], "2026-10-20T08:45:00+10:00")
        self.assertEqual((transit["route_ids"], transit["stop_id"], transit["trip_id"]), ([], None, None))
        self.assertEqual(sorted(transit), sorted(["line", "name", "vehicle", "headsign", "colour", "departure_stop", "arrival_stop", "departure_time", "arrival_time",
                                                  "stops", "route_ids", "stop_id", "trip_id", "realtime", "live_query"]))
        self.assertEqual(transit["realtime"]["label"], "No live data")

    def test_drive_nav_lists_every_step_as_drive(self):
        step = {"navigationInstruction": {"instructions": "Turn right onto Beatrice St", "maneuver": "TURN_RIGHT"}, "staticDuration": "62s", "distanceMeters": 524,
                "polyline": {"encodedPolyline": POLYLINE}, "startLocation": START, "endLocation": END}
        route = drive_route()
        route["legs"][0]["steps"] = [step, {**step, "navigationInstruction": {"instructions": "Continue", "maneuver": "MANEUVER_UNSPECIFIED"}}]
        result = run({"modes": {"transit": False, "drive": True}, "vehicle": {"fuel_price": 2.0}, "parking_cost": 0, "budget": 50}, routes=FakeRoutes(drive=[route]))
        items = option(result, "drive-0")["nav"]
        self.assertEqual([(item["mode"], item["maneuver"]) for item in items], [("drive", "TURN_RIGHT"), ("drive", None)])
        self.assertEqual(items[0]["instruction"], "Turn right onto Beatrice St")
        self.assertEqual(len(items[0]["polyline"]), 3)

    def test_requests_ask_google_for_maneuvers_and_step_locations(self):
        routes = FakeRoutes()
        run({"modes": {"transit": True, "drive": True}}, routes=routes)
        for _, _, mask in routes.calls:
            for field in ("navigationInstruction.maneuver", "steps.startLocation", "steps.endLocation"):
                self.assertIn(field, mask)
        drive_mask = next(mask for _, body, mask in routes.calls if body["travelMode"] == "DRIVE")
        self.assertIn("steps.polyline.encodedPolyline", drive_mask)

    def test_rideshare_and_internal_fields_do_not_leak(self):
        result = run({"modes": {"transit": True, "drive": False, "rideshare": True}, "transit_flat_fare": 3}, routes=FakeRoutes(transit=[route_with_bus()]))
        self.assertEqual(option(result, "rideshare-0")["nav"], [])
        self.assertNotIn("_steps", option(result, "transit-0"))


class MatchingAndRealtimeTests(unittest.TestCase):
    def plan_with(self, static=None, monitor=None, **payload):
        return run(transit_payload(**payload), routes=FakeRoutes(transit=[route_with_bus()]), static=static, monitor=monitor)

    def test_static_match_fills_route_ids_stop_id_and_colour(self):
        static = FakeStatic()
        result = self.plan_with(static=static)
        item = transit_nav(result)
        self.assertEqual((item["transit"]["route_ids"], item["transit"]["stop_id"], item["transit"]["colour"]), (["412-5146"], "1683", "#E463A4"))
        bus_segment = next(segment for segment in option(result, "transit-0")["segments"] if segment["kind"] == "bus")
        self.assertEqual(bus_segment["colour"], "#E463A4")
        short, long_name, category, headsign, dep, arr = static.calls[0]
        self.assertEqual((short, category, headsign), ("412", "bus", "UQ Lakes"))
        self.assertEqual((dep, arr), ([-27.4932, 152.9814], [-27.498, 153.01]))

    def test_without_a_match_google_colour_and_keywords_remain(self):
        result = self.plan_with(static=FakeStatic(match=None), monitor=StepMonitor())
        transit = transit_nav(result)["transit"]
        self.assertEqual((transit["route_ids"], transit["colour"]), ([], "#FF8800"))
        self.assertEqual(transit["live_query"]["route_ids"], [])
        self.assertIn("412", transit["live_query"]["names"])

    def test_live_query_is_the_opaque_query_for_api_live(self):
        monitor = StepMonitor(trip_id="trip-9")
        result = self.plan_with(static=FakeStatic(), monitor=monitor)
        transit = transit_nav(result)["transit"]
        query = transit["live_query"]
        self.assertEqual(query["route_ids"], ["412-5146"])
        self.assertEqual(query["stop_ids"], ["1683", "1684"])
        self.assertEqual(query["trip_id"], "trip-9")
        self.assertEqual(query["scheduled"], int(NOW.replace(hour=8, minute=23).timestamp()))
        self.assertEqual((query["category"], query["line"], query["sim"]), ("bus", "412", False))
        self.assertEqual(transit["trip_id"], "trip-9")
        self.assertNotIn("trip_id", transit["realtime"])
        self.assertEqual(monitor.queries[0]["scheduled"], query["scheduled"])

    def test_exact_step_delay_shifts_arrival_and_alerts_flow_into_the_option_summary(self):
        alert = {"id": "a1", "header": "412 diverted", "effect": "Detour", "disruptive": True, "lines": ["412"], "route_ids": ["412-5146"]}
        monitor = StepMonitor(realtime_object("late", 4, alerts=["a1"]), alerts=[alert], delay=4)
        result = self.plan_with(static=FakeStatic(), monitor=monitor)
        bus_option = option(result, "transit-0")
        self.assertEqual(bus_option["arrival"], "2026-10-20T08:58:00+10:00")
        self.assertEqual(bus_option["scheduled_arrival"], "2026-10-20T08:54:00+10:00")
        self.assertEqual(bus_option["realtime"]["delay"], 4)
        self.assertEqual([a["id"] for a in bus_option["realtime"]["alerts"]], ["a1"])
        self.assertNotIn("route_ids", bus_option["realtime"]["alerts"][0])
        self.assertEqual(transit_nav(result)["transit"]["realtime"]["label"], "4 min late")
        self.assertEqual(limits(bus_option), {"disruption"})

    def test_a_cancelled_step_is_a_disruption_reason(self):
        monitor = StepMonitor(realtime_object("cancelled"))
        bus_option = option(self.plan_with(static=FakeStatic(), monitor=monitor), "transit-0")
        self.assertFalse(bus_option["fits"])
        self.assertIn("A service on this route is cancelled", [reason["text"] for reason in bus_option["reasons"]])

    def test_monitors_without_exact_lookups_still_give_each_step_a_realtime_object(self):
        class Legacy:
            def status_for_lines(self, names):
                return {"alerts": [], "delay": 3, "cancelled": 0, "checked": True, "error": None}

        result = self.plan_with(monitor=Legacy())
        self.assertEqual(transit_nav(result)["transit"]["realtime"]["label"], "3 min late")
        self.assertEqual(option(result, "transit-0")["arrival"], "2026-10-20T08:57:00+10:00")

    def test_a_static_index_that_is_still_loading_is_just_unmatched(self):
        class Loading:
            def match_transit(self, *args):
                return None

        self.assertEqual(transit_nav(self.plan_with(static=Loading()))["transit"]["route_ids"], [])


class WeatherTests(unittest.TestCase):
    class FakeWeather:
        def __init__(self, result):
            self.result, self.calls = result, []

        def forecast(self, lat, lng, at=None, now=None, force=False):
            self.calls.append((lat, lng, at))
            return self.result

    RAIN = weather_mod.simulate("rain", now=NOW)

    def test_bad_weather_warns_on_options_with_five_or_more_minutes_of_walking(self):
        service = self.FakeWeather(self.RAIN)
        result = run(transit_payload(), weather=service, routes=FakeRoutes(transit=[transit_route(), transit_route([walk(120), bus(), walk(60)], duration=2000)]))
        walking = option(result, "transit-0")
        short = option(result, "transit-1")
        self.assertEqual(walking["walking_minutes"], 8)
        self.assertIn("Heavy rain forecast", walking["weather_warning"])
        self.assertIn("8 min", walking["weather_warning"])
        self.assertEqual(short["walking_minutes"], 3)
        self.assertIsNone(short["weather_warning"])
        self.assertTrue(result["weather"]["bad"])
        self.assertNotIn("kind", result["weather"])
        self.assertEqual(service.calls[0][:2], (START["latLng"]["latitude"], START["latLng"]["longitude"]))
        self.assertEqual(service.calls[0][2], NOW + timedelta(minutes=20))

    def test_fine_weather_and_missing_weather_give_no_warning(self):
        fine = run(transit_payload(), weather=self.FakeWeather(weather_mod.simulate("clear", now=NOW)))
        self.assertIsNone(option(fine, "transit-0")["weather_warning"])
        self.assertFalse(fine["weather"]["bad"])
        missing = run(transit_payload(), weather=self.FakeWeather(None))
        self.assertIsNone(missing["weather"])
        self.assertIsNone(option(missing, "transit-0")["weather_warning"])
        self.assertIsNone(run(transit_payload())["weather"])


class TrafficTests(unittest.TestCase):
    DRIVE = {"modes": {"transit": False, "drive": True}, "vehicle": {"fuel_price": 2.0}, "parking_cost": 0, "budget": 50}

    class FakeTraffic:
        def __init__(self, events=(), available=True):
            self.events_list, self.available = list(events), available

        def events(self):
            return [], self.available

        def on_route(self, points, when, events=None):
            return list(self.events_list)

    @staticmethod
    def incident(delay=5, closure=False, kind="crash", identifier="1"):
        return {"id": identifier, "type": kind, "title": "Crash on Moggill Road", "road": "Moggill Road", "impact": "Lane blocked", "delay_min": delay,
                "lat": -27.49, "lng": 153.0, "simulated": False, "closure": closure}

    def drive_with(self, traffic=None, **overrides):
        route = drive_route()
        route["polyline"] = {"encodedPolyline": POLYLINE}
        wiring = {"traffic": traffic} if traffic else {}
        return run({**self.DRIVE, **overrides}, routes=FakeRoutes(drive=[route]), **wiring)

    def test_incident_delay_shifts_the_drive_arrival_and_keeps_the_scheduled_time(self):
        result = self.drive_with(self.FakeTraffic([self.incident(5)]))
        drive = option(result, "drive-0")
        self.assertEqual(drive["traffic"]["added_delay_min"], 5)
        self.assertEqual(drive["traffic"]["source"], "QLDTraffic")
        self.assertEqual(drive["arrival"], "2026-10-20T08:45:00+10:00")
        self.assertEqual(drive["scheduled_arrival"], "2026-10-20T08:40:00+10:00")
        self.assertEqual(drive["buffer_minutes"], 15)

    def test_closure_is_flagged_and_blocks_the_option_without_adding_minutes(self):
        drive = option(self.drive_with(self.FakeTraffic([self.incident(0, closure=True, kind="hazard")])), "drive-0")
        self.assertTrue(drive["traffic"]["closure"])
        self.assertEqual(drive["traffic"]["added_delay_min"], 0)
        self.assertNotIn("scheduled_arrival", drive)
        self.assertEqual(limits(drive), {"disruption"})
        self.assertIn("road closure", drive["reasons"][0]["text"])

    def test_unavailable_feed_is_reported_and_nothing_shifts(self):
        drive = option(self.drive_with(self.FakeTraffic(available=False)), "drive-0")
        self.assertEqual(drive["traffic"], {"events": [], "added_delay_min": 0, "closure": False, "source": "QLDTraffic", "available": False})
        self.assertEqual(drive["arrival"], "2026-10-20T08:40:00+10:00")

    def test_no_traffic_service_means_no_traffic_object(self):
        self.assertIsNone(option(self.drive_with(), "drive-0")["traffic"])

    def test_rideshare_arrival_includes_the_incident_delay(self):
        route = drive_route()
        route["polyline"] = {"encodedPolyline": POLYLINE}
        result = run({"modes": {"transit": False, "drive": False, "rideshare": True}}, routes=FakeRoutes(drive=[route]), traffic=self.FakeTraffic([self.incident(5)]))
        self.assertEqual(option(result, "rideshare-0")["arrival"], "2026-10-20T08:45:00+10:00")


class DemoTests(unittest.TestCase):
    def test_parse_validates_and_defaults(self):
        self.assertIsNone(demo_mode.parse(None))
        self.assertEqual(demo_mode.parse({}), {"weather": "live", "disrupted": "none", "traffic": "live", "late_min": 0})
        self.assertEqual(demo_mode.parse({"weather": "storm", "late_min": 10.0})["late_min"], 10)
        for bad in ({"weather": "snow"}, {"disrupted": "rocket"}, {"traffic": "jam"}, {"late_min": 31}, {"late_min": -1}, {"late_min": "5"}, {"late_min": 2.5}, "yes"):
            with self.assertRaises(ValueError):
                demo_mode.parse(bad)

    def test_bad_demo_settings_are_an_input_error(self):
        with self.assertRaises(InputError):
            run(transit_payload(demo={"weather": "snow"}))

    def test_simulated_alert_on_the_first_option_using_the_chosen_mode_with_late_minutes(self):
        routes = FakeRoutes(transit=[route_with_bus(), transit_route([nav_walk(), bus(name="66", depart="2026-10-19T22:30:00Z", arrive="2026-10-19T22:50:00Z"), nav_walk(120)])])
        result = run(transit_payload(demo={"disrupted": "bus", "late_min": 10}), routes=routes, static=FakeStatic(), monitor=StepMonitor())
        self.assertTrue(result["demo"])
        first, second = option(result, "transit-0"), option(result, "transit-1")
        item = transit_nav(result)["transit"]
        self.assertTrue(item["realtime"]["simulated"])
        self.assertEqual((item["realtime"]["status"], item["realtime"]["label"]), ("late", "10 min late"))
        self.assertIn("demo-412", item["realtime"]["alerts"])
        self.assertTrue(item["live_query"]["sim"])
        self.assertTrue(first["realtime"]["alerts"][-1]["simulated"])
        self.assertFalse(first["fits"])
        self.assertEqual(first["arrival"], "2026-10-20T09:04:00+10:00")
        second_item = next(step for step in second["nav"] if step["transit"])["transit"]
        self.assertFalse(second_item["realtime"]["simulated"])
        self.assertTrue(second["fits"])

    def test_all_public_transport_disrupts_every_transit_option(self):
        routes = FakeRoutes(transit=[route_with_bus(), transit_route([nav_walk(), bus(name="66", depart="2026-10-19T22:30:00Z", arrive="2026-10-19T22:50:00Z"), nav_walk(120)])])
        result = run(transit_payload(demo={"disrupted": "all"}), routes=routes)
        self.assertEqual([option(result, f"transit-{n}")["fits"] for n in (0, 1)], [False, False])

    def test_a_mode_no_option_uses_is_explained_in_notes(self):
        result = run(transit_payload(demo={"disrupted": "ferry"}), routes=FakeRoutes(transit=[route_with_bus()]))
        self.assertTrue(option(result, "transit-0")["fits"])
        self.assertIn("Demo mode: no option uses ferry, so nothing was marked as disrupted.", result["notes"])

    def test_simulated_weather_replaces_the_real_forecast_and_is_flagged(self):
        class Real:
            def forecast(self, *args, **kwargs):
                raise AssertionError("the real forecast must not be fetched")

        result = run(transit_payload(demo={"weather": "storm"}), weather=Real())
        self.assertTrue(result["weather"]["simulated"])
        self.assertEqual(result["weather"]["current"]["icon"], "storm")
        self.assertIn("Thunderstorms", option(result, "transit-0")["weather_warning"])
        self.assertTrue(run(transit_payload(demo={"weather": "heat"}))["weather"]["simulated"])

    def test_simulated_traffic_incident_on_the_drive_route(self):
        route = drive_route()
        route["polyline"] = {"encodedPolyline": POLYLINE}
        result = run({"modes": {"transit": False, "drive": True}, "vehicle": {"fuel_price": 2.0}, "parking_cost": 0, "budget": 50, "demo": {"traffic": "crash"}},
                     routes=FakeRoutes(drive=[route]))
        drive = option(result, "drive-0")
        self.assertEqual((drive["traffic"]["added_delay_min"], drive["traffic"]["source"]), (5, "Simulated"))
        self.assertTrue(drive["traffic"]["events"][0]["simulated"])
        self.assertEqual(drive["scheduled_arrival"], "2026-10-20T08:40:00+10:00")

    def test_no_demo_key_means_no_api_cost_and_demo_false(self):
        result = run(transit_payload())
        self.assertFalse(result["demo"])
        self.assertNotIn("api_cost", result)

    def test_live_applies_the_simulation_only_to_simulated_queries(self):
        class Monitor:
            def step_status(self, query):
                return {"realtime": realtime_object("on_time", 0), "alerts": [], "delay": 0, "cancelled": 0, "checked": True, "error": None}

        services = Services(monitor=Monitor())
        plain = {"route_ids": ["412-5146"], "category": "bus", "line": "412"}
        demo = {"disrupted": "bus", "late_min": 5}
        results = live({"queries": [plain, {**plain, "sim": True}, {**plain, "sim": True, "category": "rail"}], "demo": demo}, services)["results"]
        self.assertEqual([r["simulated"] for r in results], [False, True, False])
        self.assertEqual(results[1]["label"], "5 min late")
        self.assertEqual(live({"queries": [{**plain, "sim": True}]}, services)["results"][0]["simulated"], False)


class LiveEndpointTests(unittest.TestCase):
    def test_live_validates_the_query_list_and_each_query(self):
        services = Services()
        for bad in (None, {}, {"queries": []}, {"queries": [{}] * 9}, {"queries": ["x"]}, {"queries": [{"route_ids": "x"}]},
                    {"queries": [{"route_ids": ["a"] * 81}]}, {"queries": [{"scheduled": "soon"}]}, {"queries": [{"category": "rocket"}]}):
            with self.assertRaises(InputError, msg=str(bad)):
                live(bad, services)

    def test_results_keep_the_order_and_work_without_a_monitor(self):
        results = live({"queries": [{"line": "a"}, {"line": "b"}]}, Services())
        self.assertEqual([r["label"] for r in results["results"]], ["No live data", "No live data"])
        self.assertIn("fetched_at", results)


class ApiCostTests(unittest.TestCase):
    def test_costs_are_counted_per_request_across_worker_threads_and_priced(self):
        def routes(key, body, mask):
            google_api.record_request("Routes API", "Compute Routes Pro" if body["travelMode"] == "DRIVE" else "Compute Routes Essentials")
            return [transit_route()] if body["travelMode"] == "TRANSIT" else [drive_route()]

        def fuel(key, lat, lng, fuel_type):
            google_api.record_request("Places API (New)", "Nearby Search Enterprise")
            return {"price": 2.0, "stations": 1, "fuel_type": fuel_type}

        def parking(key, lat, lng):
            google_api.record_request("Places API (New)", "Nearby Search Pro")
            return None

        def climb(key, paths):
            google_api.record_request("Elevation API", "Elevation")
            return {"gain_m": 1, "loss_m": 1, "source": "fake"}

        route = transit_route([walk(360, polyline=POLYLINE), bus(), walk(120)])
        services = Services(routes=lambda key, body, mask: routes(key, body, mask) if body["travelMode"] == "DRIVE" else [route],
                            fuel=fuel, parking=parking, climb=climb)
        result = plan({**PAYLOAD, "modes": {"transit": True, "drive": True}, "demo": {}}, "k", services, NOW)
        cost = result["api_cost"]
        by_sku = {item["sku"]: item for item in cost["items"]}
        self.assertEqual(by_sku["Compute Routes Pro"]["count"], 1)
        self.assertEqual(by_sku["Nearby Search Enterprise"]["count"], 1)
        self.assertEqual(by_sku["Nearby Search Pro"]["count"], 1)
        self.assertEqual(by_sku["Elevation"]["count"], 1)
        self.assertNotIn("Compute Routes Essentials", by_sku)  # the transit fake did not record
        self.assertEqual(by_sku["Compute Routes Pro"]["unit_usd_per_1000"], 10.0)
        self.assertEqual(by_sku["Compute Routes Pro"]["usd"], 0.01)
        self.assertAlmostEqual(cost["total_usd"], 0.01 + 0.035 + 0.032 + 0.005, places=5)
        self.assertEqual(set(cost["items"][0]), {"api", "sku", "count", "unit_usd_per_1000", "usd"})
        self.assertIn("2026-10-21", cost["note"])

    def test_cached_calls_are_not_counted(self):
        original = google_api._post_json
        google_api._post_json = lambda *args, **kwargs: {"suggestions": []}
        try:
            with google_api.tracking() as tracker:
                google_api.autocomplete("k", "uni of queensland unique-test-text", "", -27.5, 153.0)
                google_api.autocomplete("k", "uni of queensland unique-test-text", "", -27.5, 153.0)
            self.assertEqual(tracker.counts, {("Places API (New)", "Autocomplete Request"): 1})
        finally:
            google_api._post_json = original

    def test_failed_requests_are_not_billed_and_no_tracker_means_no_error(self):
        google_api.record_request("Routes API", "Compute Routes Pro")  # no tracker active: ignored
        original = google_api._post_json

        def fail(*args, **kwargs):
            raise OSError("down")

        google_api._post_json = fail
        try:
            with google_api.tracking() as tracker:
                with self.assertRaises(google_api.RoutesError):
                    google_api.compute_routes("k", {"travelMode": "DRIVE"}, "routes.duration")
            self.assertEqual(tracker.counts, {})
        finally:
            google_api._post_json = original

    def test_drive_requests_with_traffic_awareness_are_priced_as_pro(self):
        original = google_api._post_json
        google_api._post_json = lambda *args, **kwargs: {"routes": []}
        try:
            with google_api.tracking() as tracker:
                google_api.compute_routes("k", {"travelMode": "DRIVE", "routingPreference": "TRAFFIC_AWARE"}, "m")
                google_api.compute_routes("k", {"travelMode": "TRANSIT"}, "m")
            self.assertEqual(tracker.counts, {("Routes API", "Compute Routes Pro"): 1, ("Routes API", "Compute Routes Essentials"): 1})
        finally:
            google_api._post_json = original


if __name__ == "__main__":
    unittest.main()
