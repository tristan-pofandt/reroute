"""Offline checks for the Open-Meteo weather rules and the QLDTraffic incident rules."""

from datetime import datetime, timedelta, timezone
import unittest

import traffic
import weather
from weather import BRISBANE, Weather

NOW = datetime(2026, 10, 21, 8, 10, tzinfo=BRISBANE)


def forecast(code=0, prob=0, mm=0.0, apparent=22.0, gust=15.0, hours=30):
    """An Open-Meteo style response whose hourly series starts at 2026-10-21 00:00 and is the same every hour."""
    times = [(datetime(2026, 10, 21) + timedelta(hours=n)).strftime("%Y-%m-%dT%H:%M") for n in range(hours)]

    def series(value):
        return [value] * hours

    return {"current": {"time": "2026-10-21T08:00", "temperature_2m": 21.0, "apparent_temperature": apparent, "precipitation": mm, "weather_code": code,
                        "wind_speed_10m": 9.0, "wind_gusts_10m": gust, "is_day": 1},
            "hourly": {"time": times, "temperature_2m": series(20.0), "apparent_temperature": series(apparent), "precipitation_probability": series(prob),
                       "precipitation": series(mm), "weather_code": series(code), "wind_speed_10m": series(9.0), "wind_gusts_10m": series(gust), "is_day": series(1)}}


class BadWeatherRuleTests(unittest.TestCase):
    def test_each_bad_weather_rule_and_the_fine_case(self):
        self.assertEqual(weather.assess(0, 10, 0.0, 24, 20), (False, None, None))
        self.assertEqual(weather.assess(3, 49, 0.4, 34.9, 49.9)[0], False)
        self.assertEqual(weather.assess(3, 50, 0.0, 24, 20)[:2], (True, "rain"))
        self.assertEqual(weather.assess(3, 0, 0.5, 24, 20)[:2], (True, "rain"))
        self.assertEqual(weather.assess(95, 10, 0.0, 24, 20)[:2], (True, "storm"))
        self.assertEqual(weather.assess(99, 0, 0.0, 24, 20)[:2], (True, "storm"))
        self.assertEqual(weather.assess(65, 10, 0.1, 24, 20), (True, "rain", "Heavy rain forecast"))
        self.assertEqual(weather.assess(82, 10, 0.1, 24, 20)[:2], (True, "rain"))
        self.assertEqual(weather.assess(0, 0, 0.0, 35, 20)[:2], (True, "heat"))
        self.assertEqual(weather.assess(0, 0, 0.0, 24, 50)[:2], (True, "wind"))

    def test_storm_outranks_rain_and_the_phrase_includes_the_chance(self):
        self.assertEqual(weather.assess(95, 90, 5.0, 40, 80)[1], "storm")
        self.assertEqual(weather.assess(3, 70, 0.0, 24, 20)[2], "Rain likely (70% chance)")

    def test_walking_warning_needs_bad_weather_and_five_minutes_of_walking(self):
        self.assertIsNone(weather.walking_warning(None, None, 20))
        self.assertIsNone(weather.walking_warning("rain", "Rain likely", 4))
        self.assertIsNone(weather.walking_warning("rain", "Rain likely", None))
        self.assertEqual(weather.walking_warning("rain", "Rain likely (70% chance)", 5), "Rain likely (70% chance): about 5 min of this route is walking outside.")

    def test_icons(self):
        self.assertEqual(weather.icon_for(0, True), "sun")
        self.assertEqual(weather.icon_for(0, False), "moon")
        self.assertEqual(weather.icon_for(2, True), "cloud-sun")
        self.assertEqual(weather.icon_for(3), "cloud")
        self.assertEqual(weather.icon_for(45), "fog")
        self.assertEqual(weather.icon_for(53), "drizzle")
        self.assertEqual(weather.icon_for(63), "rain")
        self.assertEqual(weather.icon_for(96), "storm")
        self.assertEqual(weather.icon_for(73), "snow")
        self.assertEqual(weather.icon_for(0, True, apparent=38), "heat")
        self.assertEqual(weather.icon_for(1, True, gust=70), "wind")


class BuildTests(unittest.TestCase):
    def test_current_conditions_and_the_next_six_hours_when_departing_now(self):
        result = weather.build(forecast(code=61, prob=80, mm=1.2), now=NOW)
        self.assertEqual(set(result["current"]), {"temp_c", "apparent_c", "code", "label", "icon", "wind_kmh", "gust_kmh", "precip_mm", "is_day"})
        self.assertEqual((result["current"]["label"], result["current"]["icon"]), ("Light rain", "rain"))
        self.assertEqual(len(result["hours"]), 6)
        self.assertEqual(result["hours"][0]["time"], "2026-10-21T08:00:00+10:00")
        self.assertEqual(set(result["hours"][0]), {"time", "temp_c", "precip_prob", "code", "icon"})
        self.assertTrue(result["bad"])
        self.assertFalse(result["simulated"])
        self.assertEqual(result["source"], "Open-Meteo")
        self.assertIn("fetched_at", result)

    def test_a_later_departure_uses_that_hours_forecast(self):
        raw = forecast(code=0, prob=0)
        for key in ("precipitation_probability", "weather_code"):
            raw["hourly"][key][17] = 90 if key == "precipitation_probability" else 63
        later = weather.build(raw, at=datetime(2026, 10, 21, 17, 30, tzinfo=BRISBANE), now=NOW)
        self.assertTrue(later["bad"])
        self.assertEqual(later["hours"][0]["time"], "2026-10-21T17:00:00+10:00")
        self.assertEqual(later["current"]["code"], 63)
        self.assertFalse(weather.build(raw, now=NOW)["bad"])

    def test_departure_outside_the_forecast_is_none(self):
        self.assertIsNone(weather.build(forecast(hours=10), at=datetime(2026, 10, 25, 9, 0, tzinfo=BRISBANE), now=NOW))
        self.assertIsNone(weather.build({"hourly": {"time": []}}, now=NOW))

    def test_hours_near_the_end_of_the_forecast_are_fewer_than_six(self):
        result = weather.build(forecast(hours=10), at=datetime(2026, 10, 21, 8, 30, tzinfo=BRISBANE), now=NOW)
        self.assertEqual(len(result["hours"]), 2)

    def test_simulated_weather_is_flagged_and_bad_except_clear(self):
        for kind in ("rain", "storm", "heat"):
            result = weather.simulate(kind, now=NOW)
            self.assertTrue(result["simulated"], kind)
            self.assertTrue(result["bad"], kind)
            self.assertEqual(result["source"], "Simulated")
            self.assertEqual(len(result["hours"]), 6)
        clear = weather.simulate("clear", now=NOW)
        self.assertEqual((clear["bad"], clear["simulated"], clear["current"]["icon"]), (False, True, "sun"))
        self.assertEqual(weather.simulate("heat", now=NOW)["current"]["icon"], "heat")
        self.assertNotIn("kind", weather.public(weather.simulate("rain", now=NOW)))


class WeatherClientTests(unittest.TestCase):
    def test_forecast_is_cached_for_ten_minutes_per_kilometre_cell(self):
        calls, clock = [], [0.0]

        def fetch(url):
            calls.append(url)
            return forecast()

        client = Weather(fetch=fetch, clock=lambda: clock[0])
        client.forecast(-27.4701, 153.0201, now=NOW)
        client.forecast(-27.4702, 153.0199, now=NOW)
        self.assertEqual(len(calls), 1)
        client.forecast(-27.60, 153.0201, now=NOW)
        self.assertEqual(len(calls), 2)
        clock[0] += 601
        client.forecast(-27.4701, 153.0201, now=NOW)
        self.assertEqual(len(calls), 3)
        client.forecast(-27.4701, 153.0201, now=NOW, force=True)
        self.assertEqual(len(calls), 4)

    def test_failures_and_bad_responses_are_none(self):
        def broken(url):
            raise OSError("offline")

        self.assertIsNone(Weather(fetch=broken).forecast(-27.47, 153.02, now=NOW))
        self.assertIsNone(Weather(fetch=lambda url: {"unexpected": 1}).forecast(-27.47, 153.02, now=NOW))
        self.assertIsNone(Weather(fetch=lambda url: "text").forecast(-27.47, 153.02, now=NOW))


# ── Traffic ───────────────────────────────────────────────────────────────────

ROUTE = [[-27.5000 + 0.0009 * n, 153.0000] for n in range(40)]  # a straight 4 km drive north, one point every ~100 m
WHEN = datetime(2026, 10, 21, 8, 30, tzinfo=BRISBANE)


def feature(event_type="Crash", subtype="Single vehicle", impact_type="Lanes affected", impact_subtype="Lane or lanes reduced", road="Moggill Road",
            geometry=None, start="2026-10-21T07:00:00+10:00", end=None, identifier=1):
    return {"type": "Feature", "geometry": geometry or {"type": "MultiPoint", "coordinates": [[153.0000, -27.4800]]},
            "properties": {"id": identifier, "event_type": event_type, "event_subtype": subtype, "status": "Published",
                           "impact": {"impact_type": impact_type, "impact_subtype": impact_subtype}, "road_summary": {"road_name": road},
                           "duration": {"start": start, "end": end}, "description": "Something happened"}}


def parsed(**kwargs):
    return traffic.parse_event(feature(**kwargs))


class TrafficRuleTests(unittest.TestCase):
    def test_delay_rules_by_event_type(self):
        self.assertEqual(traffic.delay_for(parsed(event_type="Crash")), 5)
        self.assertEqual(traffic.delay_for(parsed(event_type="Hazard", subtype="Debris on road")), 5)
        self.assertEqual(traffic.delay_for(parsed(event_type="Flooding", subtype="Flash flooding")), 5)
        self.assertEqual(traffic.delay_for(parsed(event_type="Roadworks", subtype="Planned roadworks")), 2)
        self.assertEqual(traffic.delay_for(parsed(event_type="Special event", subtype="N/A")), 2)
        self.assertEqual(traffic.delay_for(parsed(event_type="Congestion", subtype="Recurring")), 0)

    def test_full_road_closure_is_flagged_with_no_number(self):
        closed = parsed(event_type="Roadworks", impact_type="Closures", impact_subtype="Road closed to all traffic")
        self.assertTrue(closed["closure"])
        self.assertEqual(traffic.delay_for(closed), 0)
        self.assertFalse(parsed(impact_type="Closures", impact_subtype="Partial lane closures")["closure"])

    def test_roadworks_without_a_traffic_effect_add_nothing(self):
        self.assertEqual(traffic.delay_for(parsed(event_type="Roadworks", impact_type="No blockage", impact_subtype=None)), 0)
        self.assertEqual(traffic.delay_for(parsed(event_type="Roadworks", impact_type="N/A", impact_subtype="")), 0)

    def test_total_is_capped_at_twenty_and_repeats_on_one_road_count_once(self):
        def event(n, kind="crash", road=None):
            return {"id": str(n), "type": kind, "road": road if road is not None else f"Road {n}", "delay_min": 5, "closure": False}

        self.assertEqual(traffic.summarise([event(n) for n in range(10)])["added_delay_min"], 20)
        self.assertEqual(traffic.summarise([event(1, road="Same Rd"), event(2, road="Same Rd")])["added_delay_min"], 5)
        self.assertEqual(traffic.summarise([])["added_delay_min"], 0)
        shape = traffic.summarise([event(1)])
        self.assertEqual(set(shape), {"events", "added_delay_min", "closure", "source", "available"})
        self.assertEqual(shape["source"], "QLDTraffic")

    def test_parse_reads_lines_points_and_geometry_collections(self):
        line = {"type": "MultiLineString", "coordinates": [[[153.0, -27.49], [153.0, -27.48]]]}
        self.assertEqual(parsed(geometry=line)["lines"], [[(-27.49, 153.0), (-27.48, 153.0)]])
        collection = {"type": "GeometryCollection", "geometries": [{"type": "Point", "coordinates": [153.0, -27.49]},
                                                                  {"type": "LineString", "coordinates": [[153.0, -27.49], [153.001, -27.49]]}]}
        event = parsed(geometry=collection)
        self.assertEqual((len(event["points"]), len(event["lines"])), (1, 1))
        self.assertIsNone(traffic.parse_event(feature(geometry={"type": "MultiPoint", "coordinates": []})))
        self.assertIsNone(traffic.parse_event({"properties": {}, "geometry": None}))

    def test_title_and_impact_text(self):
        event = parsed(event_type="Crash", subtype="Single vehicle", road="Moggill Road", impact_subtype="Lane or lanes reduced")
        self.assertEqual((event["title"], event["impact"]), ("Single vehicle on Moggill Road", "Lane or lanes reduced"))
        self.assertEqual(parsed(event_type="Special event", subtype="N/A", road="")["title"], "Special event")

    def test_events_are_only_active_between_their_start_and_end(self):
        self.assertTrue(traffic.active(parsed(), WHEN))
        self.assertFalse(traffic.active(parsed(start="2026-10-22T07:00:00+10:00"), WHEN))
        self.assertFalse(traffic.active(parsed(end="2026-10-21T08:00:00+10:00"), WHEN))
        self.assertTrue(traffic.active(parsed(start="2026-10-21T09:15:00+10:00"), WHEN))  # starts within the hour after departure


class PolylineProximityTests(unittest.TestCase):
    def client(self, *features):
        return traffic.Traffic(fetch=lambda url: {"features": list(features)}, clock=lambda: 0)

    def on_route(self, *features):
        client = self.client(*features)
        return client.on_route(ROUTE, WHEN)

    def test_event_within_150_m_is_attached_and_one_300_m_away_is_not(self):
        near = feature(geometry={"type": "MultiPoint", "coordinates": [[153.0012, -27.48]]}, identifier=1)  # about 120 m east
        far = feature(geometry={"type": "MultiPoint", "coordinates": [[153.0030, -27.48]]}, identifier=2)  # about 300 m east
        found = self.on_route(near, far)
        self.assertEqual([e["id"] for e in found], ["1"])
        self.assertTrue(100 <= found[0]["distance_m"] <= 150)
        self.assertEqual(set(found[0]) - {"distance_m"}, {"id", "type", "title", "road", "impact", "delay_min", "lat", "lng", "simulated", "closure"})
        self.assertEqual((found[0]["delay_min"], found[0]["simulated"]), (5, False))

    def test_a_long_event_line_crossing_the_route_is_found_between_its_vertices(self):
        crossing = feature(geometry={"type": "LineString", "coordinates": [[152.9900, -27.4800], [153.0100, -27.4800]]})  # vertices 1.1 km either side
        self.assertEqual(len(self.on_route(crossing)), 1)

    def test_events_outside_the_route_box_or_time_window_are_ignored(self):
        elsewhere = feature(geometry={"type": "MultiPoint", "coordinates": [[153.5, -28.0]]})
        old = feature(end="2026-10-21T08:00:00+10:00")
        self.assertEqual(self.on_route(elsewhere, old), [])

    def test_a_closure_only_counts_when_it_is_on_the_route_itself(self):
        closed = {"event_type": "Hazard", "impact_type": "Closures", "impact_subtype": "Road closed to all traffic"}
        on_road = feature(**closed, geometry={"type": "MultiPoint", "coordinates": [[153.0002, -27.48]]}, identifier=1)
        side_street = feature(**closed, geometry={"type": "MultiPoint", "coordinates": [[153.0012, -27.47]]}, identifier=2)
        found = {e["id"]: e for e in self.on_route(on_road, side_street)}
        self.assertTrue(found["1"]["closure"])
        self.assertFalse(found["2"]["closure"])
        self.assertEqual(found["2"]["delay_min"], 0)
        self.assertTrue(traffic.summarise(list(found.values()))["closure"])

    def test_empty_route_has_no_events(self):
        self.assertEqual(self.client(feature()).on_route([], WHEN), [])

    def test_simulated_incidents_are_flagged_and_follow_the_rules(self):
        crash = traffic.simulate("crash", ROUTE)
        self.assertEqual((crash["added_delay_min"], crash["source"], crash["events"][0]["simulated"], crash["events"][0]["type"]), (5, "Simulated", True, "crash"))
        self.assertIn("simulated", crash["events"][0]["title"].lower())
        heavy = traffic.simulate("heavy", ROUTE)
        self.assertEqual((heavy["added_delay_min"], heavy["events"][0]["type"]), (10, "congestion"))
        self.assertAlmostEqual(heavy["events"][0]["lng"], 153.0)


class TrafficClientTests(unittest.TestCase):
    def test_events_are_cached_for_five_minutes_and_use_the_api_key_parameter(self):
        urls, clock = [], [0]

        def fetch(url):
            urls.append(url)
            return {"features": [feature()]}

        client = traffic.Traffic(key="abc", fetch=fetch, clock=lambda: clock[0])
        self.assertEqual(client.events()[1], True)
        client.events()
        self.assertEqual(len(urls), 1)
        self.assertIn("apikey=abc", urls[0])
        clock[0] = 301
        client.events()
        self.assertEqual(len(urls), 2)

    def test_default_key_is_the_published_public_key(self):
        self.assertEqual(traffic.Traffic().key, traffic.PUBLIC_KEY)

    def test_feed_failure_is_unavailable_but_a_recent_copy_is_served(self):
        state = {"fail": False}
        clock = [0]

        def fetch(url):
            if state["fail"]:
                raise OSError("offline")
            return {"features": [feature()]}

        client = traffic.Traffic(fetch=fetch, clock=lambda: clock[0])
        self.assertEqual(client.events()[1], True)
        state["fail"], clock[0] = True, 400
        events, available = client.events()
        self.assertEqual((len(events), available), (1, True))
        clock[0] = 5000
        self.assertEqual(client.events(), ([], False))
        self.assertEqual(traffic.Traffic(fetch=lambda url: {"unexpected": 1}).events(), ([], False))

    def test_near_point_lists_active_events_nearest_first(self):
        client = traffic.Traffic(fetch=lambda url: {"features": [
            feature(geometry={"type": "MultiPoint", "coordinates": [[153.02, -27.5]]}, identifier=1),
            feature(geometry={"type": "MultiPoint", "coordinates": [[153.001, -27.5]]}, identifier=2),
            feature(geometry={"type": "MultiPoint", "coordinates": [[154.0, -27.5]]}, identifier=3)]}, clock=lambda: 0)
        events, available = client.near_point(-27.5, 153.0, 5, WHEN)
        self.assertEqual(([e["id"] for e in events], available), (["2", "1"], True))


if __name__ == "__main__":
    unittest.main()
