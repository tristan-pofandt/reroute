"""Offline checks for vehicle positions, full trip updates, trip matching and the per-step realtime status.

Protobuf messages are built by hand, including the fixed32 floats (wire type 5) used for positions.
"""

import struct
import unittest

import gtfs_rt
from gtfs_rt import FeedError, Monitor, delay_status, find_trip, realtime_object
from test_gtfs_rt import FEED_HEADER, alert_entity, ld, varint, vint

NOW = 1_000_000


def f32(field, value):
    return varint(field << 3 | 5) + struct.pack("<f", value)


def vehicle_entity(entity_id, trip_id="t1", route_id="412-5146", lat=-27.4975, lng=153.0137, bearing=None, sequence=None, stop_id="", stamp=None, label="B12"):
    position = f32(1, lat) + f32(2, lng) + (f32(3, bearing) if bearing is not None else b"")
    message = ld(1, ld(1, trip_id) + ld(5, route_id)) + ld(2, position)
    message += vint(3, sequence) if sequence is not None else b""
    message += vint(5, stamp) if stamp else b""
    message += ld(7, stop_id) if stop_id else b""
    message += ld(8, ld(1, "veh-" + entity_id) + ld(2, label))
    return ld(2, ld(1, entity_id) + ld(4, message))


def stop_update(sequence, stop_id, delay, time_):
    event = vint(1, delay) + vint(2, time_)
    return ld(2, vint(1, sequence) + ld(2, event) + ld(3, event) + ld(4, stop_id))


def trip_entity(entity_id, trip_id, route_id, stops=(), delay=None, cancelled=False, start_time="08:23:00", start_date="20261020"):
    descriptor = ld(1, trip_id) + ld(2, start_time) + ld(3, start_date) + (vint(4, 3) if cancelled else b"") + ld(5, route_id)
    update = ld(1, descriptor) + b"".join(stops) + (vint(5, delay) if delay is not None else b"")
    return ld(2, ld(1, entity_id) + ld(3, update))


class Feeds:
    def __init__(self, alerts=b"", trips=b"", vehicles=b"", error=None):
        self.feeds = {"Alerts": FEED_HEADER + alerts, "TripUpdates": FEED_HEADER + trips, "VehiclePositions": FEED_HEADER + vehicles}
        self.error, self.fetches = error, []

    def __call__(self, name):
        self.fetches.append(name)
        if self.error:
            raise self.error
        return self.feeds[name]


class VehiclePositionTests(unittest.TestCase):
    def test_fixed32_floats_decode_to_position_and_bearing(self):
        feed = FEED_HEADER + vehicle_entity("1", lat=-27.5, lng=153.25, bearing=181.4, sequence=7, stop_id="1683", stamp=999)
        (vehicle,) = gtfs_rt.decode_vehicle_positions(feed)
        self.assertAlmostEqual(vehicle["lat"], -27.5, places=5)
        self.assertAlmostEqual(vehicle["lng"], 153.25, places=5)
        self.assertEqual(vehicle["bearing"], 181)
        self.assertEqual((vehicle["trip_id"], vehicle["route_id"], vehicle["label"], vehicle["stop_id"]), ("t1", "412-5146", "B12", "1683"))
        self.assertEqual((vehicle["stop_sequence"], vehicle["timestamp"]), (7, 999))

    def test_missing_bearing_is_none_and_unusable_positions_are_skipped(self):
        broken = ld(2, ld(1, "x") + ld(4, ld(1, ld(1, "t")) + ld(2, f32(1, 500.0) + f32(2, 153.0))))
        no_position = ld(2, ld(1, "y") + ld(4, ld(1, ld(1, "t"))))
        feed = FEED_HEADER + broken + no_position + vehicle_entity("ok")
        (vehicle,) = gtfs_rt.decode_vehicle_positions(feed)
        self.assertIsNone(vehicle["bearing"])

    def test_monitor_caches_vehicle_positions_for_fifteen_seconds_and_filters_by_route(self):
        feeds = Feeds(vehicles=vehicle_entity("1", route_id="412-5146") + vehicle_entity("2", trip_id="t2", route_id="66-5146"))
        clock = [NOW]
        monitor = Monitor(fetch=feeds, clock=lambda: clock[0])
        found, fetched = monitor.vehicles(["412-5146"])
        self.assertEqual([v["trip_id"] for v in found], ["t1"])
        self.assertEqual(set(found[0]), {"trip_id", "route_id", "lat", "lng", "bearing", "label", "updated"})
        self.assertTrue(fetched.endswith("+00:00"))
        clock[0] += 14
        monitor.vehicles()
        self.assertEqual(feeds.fetches, ["VehiclePositions"])
        clock[0] += 2
        self.assertEqual(len(monitor.vehicles()[0]), 2)
        self.assertEqual(feeds.fetches, ["VehiclePositions", "VehiclePositions"])

    def test_vehicle_limit(self):
        feeds = Feeds(vehicles=b"".join(vehicle_entity(str(n), trip_id=f"t{n}") for n in range(5)))
        self.assertEqual(len(Monitor(fetch=feeds, clock=lambda: NOW).vehicles(limit=3)[0]), 3)


class TripUpdateTests(unittest.TestCase):
    def test_full_decode_keeps_stop_times_delay_and_cancellation(self):
        feed = FEED_HEADER + trip_entity("1", "t1", "412-5146", [stop_update(5, "1683", 120, 5000), stop_update(6, "1684", 150, 5300)], delay=100) \
            + trip_entity("2", "t2", "412-5146", cancelled=True)
        first, second = gtfs_rt.decode_trip_updates(feed)
        self.assertEqual((first["trip_id"], first["route_id"], first["start_time"], first["start_date"]), ("t1", "412-5146", "08:23:00", "20261020"))
        self.assertEqual(first["delay"], 100)
        self.assertEqual([(s["sequence"], s["stop_id"], s["dep_delay"], s["dep_time"]) for s in first["stops"]], [(5, "1683", 120, 5000), (6, "1684", 150, 5300)])
        self.assertTrue(second["cancelled"])

    def test_trip_delay_falls_back_to_the_first_stop_update(self):
        (trip,) = gtfs_rt.decode_trip_updates(FEED_HEADER + trip_entity("1", "t1", "r", [stop_update(1, "a", -45, 100)]))
        self.assertEqual(trip["delay"], -45)

    def test_find_trip_by_id_or_by_scheduled_time_at_a_nearby_stop(self):
        trips = gtfs_rt.decode_trip_updates(FEED_HEADER
            + trip_entity("1", "early", "412-5146", [stop_update(5, "1683", 120, 10_120)])
            + trip_entity("2", "later", "412-5146", [stop_update(5, "1683", 0, 10_600)])
            + trip_entity("3", "other-route", "66-5146", [stop_update(5, "1683", 0, 10_000)]))
        self.assertEqual(find_trip(trips, trip_id="later")["trip_id"], "later")
        # Scheduled time is the predicted time minus the delay: 10120 - 120 = 10000.
        self.assertEqual(find_trip(trips, None, ["412-5146"], ["1683", "9999"], 10_030)["trip_id"], "early")
        self.assertEqual(find_trip(trips, None, ["412-5146"], ["1683"], 10_590)["trip_id"], "later")
        self.assertIsNone(find_trip(trips, None, ["412-5146"], ["1683"], 12_000))
        self.assertIsNone(find_trip(trips, None, ["412-5146"], ["somewhere-else"], 10_000))
        self.assertIsNone(find_trip(trips, None, [], ["1683"], 10_000))


class DelayLabelTests(unittest.TestCase):
    def test_delay_status_thresholds(self):
        self.assertEqual(delay_status(None), ("unknown", None))
        self.assertEqual(delay_status(0), ("on_time", 0))
        self.assertEqual(delay_status(59), ("on_time", 0))
        self.assertEqual(delay_status(60), ("late", 1))
        self.assertEqual(delay_status(200), ("late", 3))
        self.assertEqual(delay_status(-130), ("early", -2))

    def test_realtime_object_labels(self):
        self.assertEqual(realtime_object("late", 3)["label"], "3 min late")
        self.assertEqual(realtime_object("early", -2)["label"], "2 min early")
        self.assertEqual(realtime_object("on_time", 0)["label"], "On time")
        self.assertEqual(realtime_object("cancelled")["label"], "Cancelled")
        unknown = realtime_object()
        self.assertEqual((unknown["status"], unknown["label"], unknown["vehicle"], unknown["alerts"], unknown["simulated"]),
                         ("unknown", "No live data", None, [], False))


class StepStatusTests(unittest.TestCase):
    QUERY = {"route_ids": ["412-5146"], "stop_ids": ["1683"], "scheduled": NOW + 600, "names": ["412"], "trip_id": None}

    def monitor(self, **feeds):
        return Monitor(fetch=Feeds(**feeds), clock=lambda: NOW)

    def test_exact_trip_gives_delay_vehicle_stops_away_and_exact_route_alerts(self):
        feeds = dict(
            alerts=alert_entity("hit", effect=3, routes=("412-5146",)) + alert_entity("miss", effect=3, routes=("412-9999",)),
            trips=trip_entity("1", "t1", "412-5146", [stop_update(5, "1683", 180, NOW + 780)]),
            vehicles=vehicle_entity("v", trip_id="t1", sequence=3, stamp=NOW - 5, bearing=90.0))
        status = self.monitor(**feeds).step_status(self.QUERY)
        realtime = status["realtime"]
        self.assertEqual((realtime["status"], realtime["delay_min"], realtime["label"]), ("late", 3, "3 min late"))
        self.assertEqual(realtime["alerts"], ["hit"])
        self.assertEqual(realtime["trip_id"], "t1")
        self.assertEqual(realtime["vehicle"]["stops_away"], 2)
        self.assertEqual(realtime["vehicle"]["bearing"], 90)
        self.assertEqual(sorted(realtime["vehicle"]), ["bearing", "label", "lat", "lng", "stops_away", "updated"])
        self.assertEqual([a["id"] for a in status["alerts"]], ["hit"])
        self.assertEqual((status["delay"], status["checked"], status["error"]), (3, True, None))

    def test_vehicle_that_has_passed_the_stop_has_no_stops_away(self):
        feeds = dict(trips=trip_entity("1", "t1", "412-5146", [stop_update(5, "1683", 0, NOW + 600)]), vehicles=vehicle_entity("v", trip_id="t1", sequence=9))
        self.assertIsNone(self.monitor(**feeds).step_status(self.QUERY)["realtime"]["vehicle"]["stops_away"])

    def test_cancelled_trip_and_skipped_stop(self):
        cancelled = self.monitor(trips=trip_entity("1", "t1", "412-5146", [stop_update(5, "1683", 0, NOW + 600)], cancelled=True))
        self.assertEqual(cancelled.step_status(self.QUERY)["realtime"]["status"], "cancelled")
        self.assertEqual(cancelled.step_status(self.QUERY)["realtime"]["label"], "Cancelled")

    def test_trip_id_in_the_query_skips_time_matching(self):
        feeds = dict(trips=trip_entity("1", "t9", "412-5146", [stop_update(5, "1683", 0, NOW + 5000)]))
        query = {**self.QUERY, "trip_id": "t9", "scheduled": None}
        self.assertEqual(self.monitor(**feeds).step_status(query)["realtime"]["status"], "on_time")

    def test_route_level_fallback_only_reports_a_late_median(self):
        late = self.monitor(trips=trip_entity("1", "other", "412-5146", [stop_update(1, "5555", 300, NOW)]) + trip_entity("2", "other2", "412-5146", delay=420))
        realtime = late.step_status(self.QUERY)["realtime"]
        self.assertEqual((realtime["status"], realtime["delay_min"]), ("late", 6))
        early = self.monitor(trips=trip_entity("1", "other", "412-5146", delay=-300))
        self.assertEqual(early.step_status(self.QUERY)["realtime"]["status"], "unknown")
        far_future = {**self.QUERY, "scheduled": NOW + 7200}
        self.assertEqual(late.step_status(far_future)["realtime"]["status"], "unknown")

    def test_without_route_ids_the_keyword_matcher_is_used(self):
        feeds = dict(alerts=alert_entity("kw", effect=1, routes=("412-4161",)), trips=trip_entity("1", "t", "412-4161", delay=300))
        status = self.monitor(**feeds).step_status({"route_ids": [], "names": ["BCC 412"]})
        self.assertEqual([a["id"] for a in status["alerts"]], ["kw"])
        self.assertEqual((status["realtime"]["status"], status["realtime"]["delay_min"], status["realtime"]["alerts"]), ("late", 5, ["kw"]))

    def test_feed_failure_gives_no_live_data_and_never_raises(self):
        status = self.monitor(error=FeedError("down")).step_status(self.QUERY)
        self.assertEqual(status["realtime"]["label"], "No live data")
        self.assertFalse(status["checked"])
        self.assertEqual(status["error"], "down")

    def test_refresh_redownloads_old_feeds_but_not_fresh_ones(self):
        feeds = Feeds(alerts=alert_entity("a", effect=1), vehicles=vehicle_entity("1"))
        clock = [NOW]
        monitor = Monitor(fetch=feeds, clock=lambda: clock[0])
        found, count, _ = monitor.refresh()
        self.assertEqual((len(found["alerts"]), count), (1, 1))
        fetches = len(feeds.fetches)
        monitor.refresh()
        self.assertEqual(len(feeds.fetches), fetches)
        clock[0] += 6
        monitor.refresh()
        self.assertGreater(len(feeds.fetches), fetches)

    def test_alerts_expose_exact_route_ids(self):
        monitor = self.monitor(alerts=alert_entity("a", effect=1, routes=("412-5146", "66-5146")))
        self.assertEqual(monitor.alerts()["alerts"][0]["route_ids"], ["412-5146", "66-5146"])


if __name__ == "__main__":
    unittest.main()
