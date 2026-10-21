"""Offline checks for static GTFS parsing, the cached index, background-style loading and route/stop matching.

A tiny GTFS feed is built in memory as a zip, so nothing is downloaded.
"""

import io
import json
from pathlib import Path
import tempfile
import time
import unittest
import zipfile

import gtfs_static
from gtfs_static import Static, build_index

ROUTES = """route_id,route_short_name,route_long_name,route_desc,route_type,route_url,route_color,route_text_color
412-5146,412,University of Qld - City Express,,3,,E463A4,1D1D1D
412-4161,412,University of Qld - City Express,,3,,E463A4,1D1D1D
66-5146,66,Somewhere - Elsewhere,,3,,E463A4,1D1D1D
IPBR-5185,IPBR,"Ipswich - Brisbane City",,2,,FFC425,1D1D1D
SPBR-5185,SPBR,"Springfield - Brisbane City",,2,,FFC425,1D1D1D
F1-5204,F1,Northshore Hamilton / UQ St Lucia,,4,,61C5C9,FFFFFF
"""
TRIPS = """route_id,service_id,trip_id,trip_headsign,direction_id,block_id,shape_id
412-5146,s,t412,"UQ Lakes station",0,,
412-4161,s,t412-old,"UQ Lakes station",0,,
66-5146,s,t66,"Elsewhere",0,,
IPBR-5185,s,tip,"Ipswich station",0,,
SPBR-5185,s,tsp,"Springfield Central station",0,,
F1-5204,s,tf1,"UQ St Lucia",0,,
"""
STOPS = """stop_id,stop_code,stop_name,stop_desc,stop_lat,stop_lon,zone_id,stop_url,location_type,parent_station,platform_code
1683, 001683,"Swann Rd near Queens Rd, stop 28",, -27.4975, 153.0137,1,,0,,
1684,001684,"Swann Rd stop 29",, -27.4976, 153.0138,1,,0,,
1951,001951,"Hawken Dr at Hawken Shops",, -27.4980, 153.0000,1,,0,,
777,000777,"Far away",, -28.1000, 153.4000,1,,0,,
600291,600291,"Taringa station, platform 1",, -27.4932, 152.9814,1,,0,place_tarsta,1
600001,600001,"Central station, platform 1",, -27.4659, 153.0258,1,,0,place_cen,1
place_tarsta,,Taringa station,, -27.4933, 152.9818,,,1,,
900,000900,"UQ Lakes ferry",, -27.4980, 153.0230,1,,0,,
901,000901,"Northshore ferry",, -27.4400, 153.0700,1,,0,,
"""
STOP_TIMES = """trip_id,arrival_time,departure_time,stop_id,stop_sequence,pickup_type,drop_off_type
t412,08:00:00,08:00:00,1683,1,0,0
t412,08:10:00,08:10:00,1951,2,0,0
t412-old,08:00:00,08:00:00,1684,1,0,0
t412-old,08:10:00,08:10:00,1951,2,0,0
t66,08:00:00,08:00:00,1683,1,0,0
t66,08:30:00,08:30:00,777,2,0,0
tip,08:00:00,08:00:00,600291,1,0,0
tip,08:20:00,08:20:00,600001,2,0,0
tsp,08:05:00,08:05:00,600291,1,0,0
tsp,08:25:00,08:25:00,600001,2,0,0
tf1,08:00:00,08:00:00,900,1,0,0
tf1,08:20:00,08:20:00,901,2,0,0
"""


def make_zip(**overrides):
    files = {"routes.txt": ROUTES, "trips.txt": TRIPS, "stops.txt": STOPS, "stop_times.txt": STOP_TIMES, **overrides}
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        for name, text in files.items():
            archive.writestr(name, text)
    return buffer.getvalue()


class Opener:
    """Stands in for urlopen: serves the zip bytes and counts downloads."""

    def __init__(self, content=None, error=None):
        self.content, self.error, self.calls = content if content is not None else make_zip(), error, 0

    def __call__(self, url):
        self.calls += 1
        if self.error:
            raise self.error
        return io.BytesIO(self.content)


def ready_static(directory=None, **kwargs):
    static = Static(directory or tempfile.mkdtemp(), opener=Opener(**kwargs))
    static.ensure()
    return static


class BuildIndexTests(unittest.TestCase):
    def test_index_has_routes_stops_and_the_stop_to_route_map(self):
        index = build_index(zipfile.ZipFile(io.BytesIO(make_zip())), built_at=123)
        self.assertEqual(index["built_at"], 123)
        self.assertEqual(index["routes"]["412-5146"], ["412", "University of Qld - City Express", 3, "E463A4", "1D1D1D"])
        self.assertEqual(index["routes"]["IPBR-5185"][2], 2)
        self.assertEqual(index["stops"]["1683"], ["Swann Rd near Queens Rd, stop 28", -27.4975, 153.0137])
        self.assertNotIn("place_tarsta", index["stops"])  # station parents are not boarding points
        served = {index["route_ids"][i] for i in index["stop_routes"]["1683"]}
        self.assertEqual(served, {"412-5146", "66-5146"})
        self.assertEqual(index["headsigns"]["412-5146"], ["UQ Lakes station"])

    def test_index_is_small_enough_to_cache_as_json(self):
        text = json.dumps(build_index(zipfile.ZipFile(io.BytesIO(make_zip()))))
        self.assertLess(len(text), 5000)

    def test_stop_times_with_quoted_fields_still_parse(self):
        quoted = STOP_TIMES + '"t412",08:12:00,08:12:00,"1684",3,0,0\r\n'
        index = build_index(zipfile.ZipFile(io.BytesIO(make_zip(**{"stop_times.txt": quoted}))))
        self.assertIn("412-5146", {index["route_ids"][i] for i in index["stop_routes"]["1684"]})


class LoadingTests(unittest.TestCase):
    def test_state_is_loading_before_the_download_and_matching_returns_none(self):
        static = Static(tempfile.mkdtemp(), opener=Opener())
        self.assertEqual(static.status(), {"state": "loading", "updated": None, "routes": 0})
        self.assertIsNone(static.match_transit("412", "", "bus", None, [-27.4975, 153.0137], None))
        self.assertEqual(static.stops_near([-27.4975, 153.0137]), [])

    def test_ensure_downloads_builds_and_caches_the_index(self):
        directory = Path(tempfile.mkdtemp())
        opener = Opener()
        static = Static(directory, opener=opener)
        static.ensure()
        self.assertEqual(static.status()["state"], "ready")
        self.assertEqual(static.status()["routes"], 6)
        self.assertTrue((directory / "index.json").exists())
        self.assertFalse((directory / "SEQ_GTFS.zip.part").exists())
        self.assertEqual(opener.calls, 1)

    def test_a_fresh_cached_index_is_loaded_without_downloading(self):
        directory = tempfile.mkdtemp()
        ready_static(directory)
        opener = Opener(error=OSError("must not be called"))
        restarted = Static(directory, opener=opener)
        restarted.ensure()
        self.assertEqual((restarted.status()["state"], opener.calls), ("ready", 0))

    def test_an_index_older_than_seven_days_is_rebuilt(self):
        directory = tempfile.mkdtemp()
        old = ready_static(directory)
        later = Static(directory, opener=Opener(), clock=lambda: time.time() + 8 * 86400)
        later.ensure()
        self.assertEqual(later._open.calls, 1)
        self.assertGreater(later.data["built_at"], old.data["built_at"] + 7 * 86400)

    def test_failed_refresh_keeps_serving_the_stale_index(self):
        directory = tempfile.mkdtemp()
        ready_static(directory)
        stale = Static(directory, opener=Opener(error=OSError("offline")), clock=lambda: time.time() + 8 * 86400)
        with self.assertRaises(OSError):
            stale.ensure()
        self.assertEqual(stale.status()["state"], "ready")

    def test_failed_first_download_is_an_error_and_corrupt_cache_is_ignored(self):
        directory = Path(tempfile.mkdtemp())
        (directory / "index.json").write_text("{not json", encoding="utf-8")
        static = Static(directory, opener=Opener(error=OSError("offline")))
        with self.assertRaises(OSError):
            static.ensure()
        self.assertFalse(static.ready())

    def test_background_loop_records_an_error_state(self):
        static = Static(tempfile.mkdtemp(), opener=Opener(error=OSError("offline")))
        original = gtfs_static.time.sleep
        gtfs_static.time.sleep = lambda seconds: (_ for _ in ()).throw(KeyboardInterrupt())
        try:
            with self.assertRaises(KeyboardInterrupt):
                static._run()
        finally:
            gtfs_static.time.sleep = original
        self.assertEqual(static.status()["state"], "error")


class MatchingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.static = ready_static()

    def test_stops_near_a_point_are_nearest_first_within_150_m(self):
        self.assertEqual(self.static.stops_near([-27.4975, 153.0137]), ["1683", "1684"])
        self.assertEqual(self.static.stops_near([-27.4975, 153.0137], 5), ["1683"])
        self.assertEqual(self.static.stops_near([-27.0, 153.0]), [])

    def test_bus_matches_by_number_and_the_stops_both_ends_serve(self):
        match = self.static.match_transit("412", "University of Qld - City Express", "bus", "UQ Lakes station", [-27.4975, 153.0137], [-27.4980, 153.0000])
        self.assertEqual(match["route_ids"], ["412-4161", "412-5146"])
        self.assertEqual(match["stop_id"], "1683")
        self.assertEqual(match["dep_stop_ids"], ["1683", "1684"])
        self.assertEqual(match["arr_stop_ids"], ["1951"])
        self.assertEqual(match["colour"], "#E463A4")

    def test_route_must_serve_a_stop_near_the_boarding_point(self):
        self.assertIsNone(self.static.match_transit("66", "", "bus", None, [-27.4980, 153.0000], None))

    def test_unplaceable_numbered_line_returns_none_so_keywords_take_over(self):
        self.assertIsNone(self.static.match_transit("999", "", "bus", None, [-27.4975, 153.0137], None))

    def test_train_matches_by_station_group_codes_in_the_line_name(self):
        both = self.static.match_transit("", "", "rail", None, [-27.4932, 152.9814], [-27.4659, 153.0258])
        self.assertEqual(both["route_ids"], ["IPBR-5185", "SPBR-5185"])
        ipswich = self.static.match_transit("", "Ipswich/Rosewood", "rail", None, [-27.4932, 152.9814], [-27.4659, 153.0258])
        self.assertEqual(ipswich["route_ids"], ["IPBR-5185"])
        by_short = self.static.match_transit("SPBR", "", "rail", None, [-27.4932, 152.9814], [-27.4659, 153.0258])
        self.assertEqual(by_short["route_ids"], ["SPBR-5185"])
        self.assertEqual(by_short["colour"], "#FFC425")

    def test_headsign_narrows_several_train_lines(self):
        match = self.static.match_transit("", "", "rail", "Springfield Central", [-27.4932, 152.9814], [-27.4659, 153.0258])
        self.assertEqual(match["route_ids"], ["SPBR-5185"])

    def test_ferry_matches_by_name_and_vehicle_type(self):
        match = self.static.match_transit("F1", "", "ferry", None, [-27.4980, 153.0230], [-27.4400, 153.0700])
        self.assertEqual((match["route_ids"], match["colour"]), (["F1-5204"], "#61C5C9"))


if __name__ == "__main__":
    unittest.main()
