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


def with_days(raw, days=7):
    """Adds Open-Meteo daily series (each day the same) and the extra current fields the weather page uses."""
    dates = [(datetime(2026, 10, 21) + timedelta(days=n)).strftime("%Y-%m-%d") for n in range(days)]
    raw["daily"] = {"time": dates, "weather_code": [61] * days, "temperature_2m_max": [26.0] * days, "temperature_2m_min": [17.0] * days,
                    "precipitation_sum": [2.4] * days, "precipitation_probability_max": [70] * days, "wind_speed_10m_max": [22.0] * days,
                    "wind_gusts_10m_max": [41.0] * days, "wind_direction_10m_dominant": [135] * days, "uv_index_max": [9.1] * days,
                    "sunrise": [f"{d}T05:10" for d in dates], "sunset": [f"{d}T18:05" for d in dates]}
    raw["current"].update({"relative_humidity_2m": 64, "wind_direction_10m": 350})
    return raw


class WeatherPageTests(unittest.TestCase):
    def test_detail_adds_24_hours_seven_days_humidity_and_wind_direction(self):
        result = weather.detail(with_days(forecast(hours=48)), now=NOW)
        self.assertEqual(len(result["hours"]), 6)  # the home widget's part is unchanged
        self.assertEqual(len(result["hourly"]), 24)
        self.assertEqual(result["hourly"][0]["time"], "2026-10-21T08:00:00+10:00")
        self.assertEqual(set(result["hourly"][0]), {"time", "temp_c", "precip_prob", "precip_mm", "wind_kmh", "gust_kmh", "code", "icon"})
        self.assertEqual(len(result["days"]), 7)
        day = result["days"][0]
        self.assertEqual((day["date"], day["label"], day["icon"], day["max_c"], day["min_c"]), ("2026-10-21", "Light rain", "rain", 26.0, 17.0))
        self.assertEqual((day["precip_prob"], day["wind_from"], day["uv"], day["sunrise"]), (70, "SE", 9.1, "2026-10-21T05:10"))
        self.assertEqual((result["current"]["humidity"], result["current"]["wind_from"]), (64, "N"))

    def test_detail_copes_without_daily_data_and_near_the_end_of_the_forecast(self):
        result = weather.detail(forecast(hours=12), now=NOW)
        self.assertEqual(result["days"], [])
        self.assertEqual(len(result["hourly"]), 4)
        self.assertIsNone(result["current"]["humidity"])

    def test_compass_points(self):
        self.assertEqual([weather.compass(d) for d in (0, 44, 46, 180, 315, 359, 360)], ["N", "NE", "NE", "S", "NW", "N", "N"])
        self.assertIsNone(weather.compass(None))

    def test_simulated_detail_is_flagged(self):
        result = weather.simulate_detail("storm", now=NOW)
        self.assertTrue(result["simulated"] and result["bad"])
        self.assertEqual((len(result["hourly"]), len(result["days"])), (24, 7))
        self.assertEqual(result["days"][0]["label"], "Thunderstorm")

    def test_the_request_asks_for_seven_days_and_the_extra_fields(self):
        urls = []
        Weather(fetch=lambda url: urls.append(url) or with_days(forecast(hours=48))).details(-27.47, 153.02, now=NOW)
        self.assertIn("forecast_days=7", urls[0])
        self.assertIn("uv_index_max", urls[0])
        self.assertIn("relative_humidity_2m", urls[0])
        self.assertIsNone(Weather(fetch=lambda url: {"unexpected": 1}).details(-27.47, 153.02, now=NOW))


def with_minutely(raw, mm=(0.0, 0.0, 0.3, 0.6, 0.2, 0.0, 0.0, 0.0), prob=(10, 15, 40, 55, 50, 30, 20, 10), start="2026-10-21T08:00"):
    """Adds Open-Meteo minutely_15 series: eight 15-minute steps from `start`, each the rain in the 15 minutes up to its time."""
    first = datetime.fromisoformat(start)
    raw["minutely_15"] = {"time": [(first + timedelta(minutes=15 * n)).strftime("%Y-%m-%dT%H:%M") for n in range(len(mm))],
                          "precipitation": list(mm), "precipitation_probability": list(prob)}
    return raw


class NextHourRainTests(unittest.TestCase):
    def test_the_next_four_quarter_hours_after_now(self):
        result = weather.next_hour(with_minutely(forecast(hours=48)), now=NOW)  # 8:10, so the 8:00 step (7:45 to 8:00) is past
        self.assertEqual([s["end"] for s in result["steps"]], ["2026-10-21T08:15:00+10:00", "2026-10-21T08:30:00+10:00", "2026-10-21T08:45:00+10:00", "2026-10-21T09:00:00+10:00"])
        self.assertEqual(result["steps"][0], {"start": "2026-10-21T08:00:00+10:00", "end": "2026-10-21T08:15:00+10:00", "precip_mm": 0.0, "precip_prob": 15})
        self.assertEqual((result["total_mm"], result["max_prob"], result["rain_from"], result["step_minutes"]), (1.1, 55, "2026-10-21T08:15:00+10:00", 15))
        self.assertEqual((result["interpolated"], result["source"]), (True, "Open-Meteo model forecast"))

    def test_a_dry_hour_has_no_rain_start(self):
        result = weather.next_hour(with_minutely(forecast(hours=48), mm=(0.0,) * 8, prob=(0,) * 8), now=NOW)
        self.assertEqual((result["total_mm"], result["max_prob"], result["rain_from"]), (0.0, 0, None))

    def test_missing_values_are_skipped_and_probability_is_optional(self):
        raw = with_minutely(forecast(hours=48), mm=(0.0, None, 0.4, 0.0, 0.0, 0.0, 0.0, 0.0))
        del raw["minutely_15"]["precipitation_probability"]
        result = weather.next_hour(raw, now=NOW)
        self.assertEqual(len(result["steps"]), 4)
        self.assertEqual(result["steps"][0]["end"], "2026-10-21T08:30:00+10:00")
        self.assertEqual((result["steps"][0]["precip_prob"], result["max_prob"]), (None, None))

    def test_without_15_minute_data_the_next_hourly_step_is_used(self):
        result = weather.next_hour(forecast(prob=35, mm=0.4, hours=48), now=NOW)
        self.assertEqual((result["step_minutes"], len(result["steps"])), (60, 1))
        self.assertEqual(result["steps"][0], {"start": "2026-10-21T08:00:00+10:00", "end": "2026-10-21T09:00:00+10:00", "precip_mm": 0.4, "precip_prob": 35})
        self.assertIsNone(weather.next_hour({"hourly": {"time": []}}, now=NOW))

    def test_detail_includes_the_next_hour_and_the_request_asks_for_it(self):
        result = weather.detail(with_minutely(with_days(forecast(hours=48))), now=NOW)
        self.assertEqual(len(result["next_hour"]["steps"]), 4)
        urls = []
        Weather(fetch=lambda url: urls.append(url) or with_days(forecast(hours=48))).details(-27.47, 153.02, now=NOW)
        self.assertIn("minutely_15=precipitation%2Cprecipitation_probability", urls[0])
        self.assertIn("forecast_minutely_15=8", urls[0])

    def test_simulated_next_hour_is_flagged_and_follows_the_preset(self):
        storm = weather.simulate_detail("storm", now=NOW)["next_hour"]
        self.assertEqual((storm["source"], storm["interpolated"], storm["steps"][0]["start"], storm["steps"][0]["precip_mm"]), ("Simulated", False, "2026-10-21T08:00:00+10:00", 2.2))
        self.assertEqual(storm["rain_from"], "2026-10-21T08:00:00+10:00")
        self.assertIsNone(weather.simulate_detail("clear", now=NOW)["next_hour"]["rain_from"])


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
