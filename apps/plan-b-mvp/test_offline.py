"""Offline checks for the offline area download: area limits, OpenStreetMap conversion, the timetable extract and the two endpoints.

Everything is fictional and built in memory (a tiny Overpass answer and a tiny GTFS zip), so nothing is downloaded.
"""

from datetime import date
import gzip
import io
import json
import math
import os
from pathlib import Path
import tempfile
import threading
import time
import unittest
import zipfile

os.environ["PLANB_NO_BACKGROUND"] = "1"
os.environ.setdefault("PLANB_DATA_DIR", tempfile.mkdtemp())

import gtfs_static  # noqa: E402
from gtfs_static import Static, build_index, extract_area  # noqa: E402
import offline_area  # noqa: E402
from offline_area import AreaError, Jobs, Pending, clip_runs, parse_bbox, parse_days, simplify  # noqa: E402
import osm  # noqa: E402
from osm import OSM, OverpassBusy, OverpassError, classify, convert, join_rings  # noqa: E402
import server  # noqa: E402
from test_gtfs_static import Opener, make_zip as make_match_zip  # noqa: E402
from test_server import PUBLIC, FakeTraffic, FakeWeather  # noqa: E402

BOX = [-27.50, 153.00, -27.48, 153.03]
CBD = {"south": "-27.50", "west": "152.98", "north": "-27.445", "east": "153.04"}


def query_string(values):
    return "&".join(f"{name}={value}" for name, value in values.items())


# ── A tiny Overpass answer ───────────────────────────────────────────────────

NODES = {1: (-27.49, 153.005), 2: (-27.49, 153.010), 3: (-27.49, 153.015), 4: (-27.49, 153.020), 5: (-27.49, 153.025),
         6: (-27.4850004, 153.0150006), 7: (-27.485, 153.025), 8: (-27.485, 153.028), 9: (-27.483, 153.028), 10: (-27.483, 153.020),
         11: (-27.483, 153.012), 12: (-27.483, 153.006), 13: (-27.486, 153.006), 14: (-27.495, 153.006), 15: (-27.496, 153.008),
         16: (-27.497, 153.006), 17: (-27.488, 153.003), 18: (-27.492, 153.003), 19: (-27.495, 153.003),
         20: (-27.481, 153.010), 21: (-27.475, 153.010), 22: (-27.47, 153.010),
         30: (-27.4995, 153.005), 31: (-27.4995, 153.028), 32: (-27.4993, 153.029),
         40: (-27.485, 152.995), 41: (-27.485, 153.002), 42: (-27.499, 153.002), 43: (-27.499, 152.995),
         44: (-27.499, 153.01), 45: (-27.499, 153.02),
         50: (-27.497, 153.020), 51: (-27.497, 153.023), 52: (-27.494, 153.023), 53: (-27.494, 153.020),
         54: (-27.4950, 153.0100), 55: (-27.4950, 153.0102), 56: (-27.4952, 153.0102), 57: (-27.4952, 153.0100)}
WAYS = {
    101: ([1, 2, 3, 4, 5], {"highway": "residential", "name": "Coronation Drive"}),
    102: ([3, 6], {"highway": "footway", "footway": "sidewalk", "name": "Not a road name"}),
    103: ([5, 7], {"highway": "primary", "oneway": "yes", "name": "High Street"}),
    104: ([7, 8], {"highway": "secondary", "oneway": "-1"}),
    105: ([8, 9], {"highway": "service", "access": "private"}),
    106: ([9, 10], {"highway": "trunk"}),
    107: ([10, 11], {"highway": "trunk", "sidewalk": "both"}),
    108: ([11, 12], {"highway": "motorway", "bridge": "yes"}),
    109: ([12, 13], {"highway": "cycleway"}),
    110: ([13, 14], {"highway": "steps", "tunnel": "yes"}),
    111: ([14, 15, 16, 14], {"highway": "residential", "junction": "roundabout"}),
    112: ([13, 17], {"highway": "footway", "foot": "no", "bicycle": "no"}),
    113: ([17, 18], {"highway": "residential", "motor_vehicle": "no", "name": "Quiet Lane"}),
    114: ([1, 17], {"highway": "construction"}),
    115: ([18, 19], {"route": "ferry", "name": "CityCat"}),
    116: ([20, 21, 22], {"highway": "residential", "name": "Edge Road"}),
    117: ([2, 20], {"highway": "service", "service": "driveway"}),
    120: ([30, 31], {"railway": "rail", "name": "Ipswich line"}),
    121: ([31, 32], {"railway": "rail", "service": "siding"}),
    130: ([40, 41, 42], {}),
    131: ([42, 43, 40], {}),
    132: ([44, 45], {"waterway": "river", "name": "Brisbane River"}),
    140: ([50, 51, 52, 53, 50], {"leisure": "park", "name": "Big Park"}),
    141: ([54, 55, 56, 57, 54], {"leisure": "park", "name": "Pocket Park"}),
}
TAGGED = [
    {"type": "node", "id": 200, "lat": -27.486, "lon": 153.012, "tags": {"place": "suburb", "name": "Toowong"}},
    {"type": "node", "id": 201, "lat": -27.487, "lon": 153.013, "tags": {"place": "hamlet", "name": "Tiny"}},
    {"type": "node", "id": 202, "lat": -27.40, "lon": 153.013, "tags": {"place": "suburb", "name": "Far Away"}},
    {"type": "node", "id": 210, "lat": -27.4855, "lon": 153.0105, "tags": {"railway": "station", "public_transport": "station", "name": "Toowong"}},
    {"type": "node", "id": 211, "lat": -27.4980, "lon": 153.0200, "tags": {"amenity": "ferry_terminal", "public_transport": "station", "name": "Regatta"}},
    {"type": "way", "id": 212, "center": {"lat": -27.4830, "lon": 153.0250}, "tags": {"amenity": "hospital", "name": "Example Hospital"}},
    {"type": "node", "id": 213, "lat": -27.4850, "lon": 153.0200, "tags": {"amenity": "cafe", "name": "A Cafe"}},
    {"type": "node", "id": 214, "lat": -27.4860, "lon": 153.0210, "tags": {"tourism": "attraction", "name": "A Plaque"}},
    {"type": "node", "id": 215, "lat": -27.4870, "lon": 153.0220, "tags": {"tourism": "attraction", "name": "The Wheel", "wikidata": "Q1"}},
    {"type": "way", "id": 216, "center": {"lat": -27.4858, "lon": 153.0108}, "tags": {"railway": "station", "name": "Toowong"}},
]


def overpass_answer():
    elements = [{"type": "way", "id": way_id, "nodes": nodes, "tags": tags} for way_id, (nodes, tags) in WAYS.items()]
    elements.append({"type": "relation", "id": 300, "tags": {"type": "multipolygon", "natural": "water", "name": "Lake"},
                     "members": [{"type": "way", "ref": 130, "role": "outer"}, {"type": "way", "ref": 131, "role": "outer"}]})
    elements += [{"type": "node", "id": node, "lat": lat, "lon": lng} for node, (lat, lng) in NODES.items()]
    return {"version": 0.6, "elements": elements + TAGGED}


def by_id(result, way_id):
    return [way for way in result["ways"] if way["id"] == way_id]


def pairs(flat_list):
    return list(zip(flat_list[::2], flat_list[1::2]))


class AreaLimitTests(unittest.TestCase):
    def test_a_valid_box_is_rounded_and_the_limits_are_published(self):
        self.assertEqual(parse_bbox(CBD), [-27.5, 152.98, -27.445, 153.04])
        self.assertEqual(parse_bbox({"south": "-27.500004", "west": "152.98", "north": "-27.445", "east": "153.04"})[0], -27.5)
        self.assertEqual(offline_area.limits(), {"max_side_km": 8, "max_area_km2": 40, "min_side_km": 0.5, "max_days": 7, "default_days": 3,
                                                 "region": [-28.4, 151.9, -26.0, 153.6]})

    def test_bad_boxes_are_refused_with_plain_messages(self):
        cases = {"missing": ({"south": "-27.5"}, "south, west, north and east"),
                 "text": ({**CBD, "west": "abc"}, "decimal degrees"),
                 "nan": ({**CBD, "west": "nan"}, "decimal degrees"),
                 "upside down": ({**CBD, "south": "-27.44", "north": "-27.5"}, "south edge"),
                 "back to front": ({**CBD, "west": "153.04", "east": "152.98"}, "west edge"),
                 "outside SEQ": ({"south": "-33.9", "west": "151.1", "north": "-33.85", "east": "151.15"}, "South East Queensland"),
                 "too tall": ({"south": "-27.6", "west": "153.0", "north": "-27.5", "east": "153.03"}, "at most 8 km"),
                 "too big": ({"south": "-27.53", "west": "152.97", "north": "-27.465", "east": "153.04"}, "at most 40 km²"),
                 "too small": ({"south": "-27.5", "west": "153.0", "north": "-27.498", "east": "153.03"}, "at least 0.5 km")}
        for name, (args, phrase) in cases.items():
            with self.assertRaises(AreaError, msg=name) as caught:
                parse_bbox(args)
            self.assertIn(phrase, str(caught.exception), name)

    def test_days_default_to_three_and_stay_between_one_and_seven(self):
        self.assertEqual((parse_days(None), parse_days(""), parse_days("1"), parse_days("7")), (3, 3, 1, 7))
        for bad in ("0", "8", "x", "2.5"):
            with self.assertRaises(AreaError):
                parse_days(bad)


class GeometryTests(unittest.TestCase):
    def test_simplify_drops_straight_points_but_keeps_ends_and_junctions(self):
        line = [(-27.49, 153.000 + step * 0.001) for step in range(6)]
        self.assertEqual(simplify(line, 4), [0, 5])
        self.assertEqual(simplify(line, 4, keep=[2]), [0, 2, 5])
        bent = line[:3] + [(-27.489, 153.003)] + line[4:]
        self.assertIn(3, simplify(bent, 4))  # about 110 m off the line

    def test_simplify_handles_long_lines_without_recursion(self):
        line = [(-27.49 + (index % 2) * 0.0001, 153.0 + index * 0.0001) for index in range(3000)]
        self.assertGreater(len(simplify(line, 4)), 2900)  # 11 m zigzags stay, far deeper than Python's recursion limit would allow

    def test_clip_runs_keep_one_point_beyond_each_edge(self):
        line = [(-27.47, 153.01), (-27.49, 153.01), (-27.49, 153.02), (-27.51, 153.02), (-27.52, 153.02), (-27.49, 153.025)]
        self.assertEqual(clip_runs(line, BOX), [(0, 4), (4, 6)])
        self.assertEqual(clip_runs([(-27.40, 153.0), (-27.41, 153.0)], BOX), [])

    def test_ring_joining_and_clipping(self):
        rings, loose = join_rings([[1, 2, 3], [3, 4, 1], [7, 8]])
        self.assertEqual((len(rings), loose), (1, [[7, 8]]))
        self.assertEqual(rings[0][0], rings[0][-1])
        clipped = osm.clip_ring([(-27.485, 152.995), (-27.485, 153.002), (-27.499, 153.002), (-27.499, 152.995), (-27.485, 152.995)], BOX)
        self.assertTrue(all(lng >= 153.0 - 1e-9 for _, lng in clipped))
        self.assertEqual(len(clipped), 4)


class JobsTests(unittest.TestCase):
    def test_a_slow_job_answers_503_style_pending_then_the_retry_gets_the_result(self):
        jobs, gate = Jobs("test", wait=0.05), threading.Event()
        with self.assertRaises(Pending):
            jobs.run("a", lambda: gate.wait(5) and "done")
        with self.assertRaises(Pending) as busy:
            jobs.run("b", lambda: "other")
        self.assertIn("Another offline download", str(busy.exception))
        gate.set()
        jobs.wait = 5
        self.assertEqual(jobs.run("a", lambda: "not run again"), "done")
        self.assertEqual(jobs.run("b", lambda: "other"), "other")

    def test_a_failed_job_hands_its_error_to_the_request_and_can_run_again(self):
        jobs = Jobs("test", wait=5)
        with self.assertRaises(OverpassError):
            jobs.run("a", lambda: (_ for _ in ()).throw(OverpassError("down")))
        self.assertEqual(jobs.run("a", lambda: "fine"), "fine")


class ClassifyTests(unittest.TestCase):
    def test_classes_and_access_defaults(self):
        self.assertEqual(classify({"highway": "residential", "name": "A St"}), ("residential", 4 | 8 | 16, "A St"))
        self.assertEqual(classify({"highway": "unclassified"})[0], "residential")
        self.assertEqual(classify({"highway": "living_street"})[0], "living")
        self.assertEqual(classify({"highway": "motorway_link"})[:2], ("motorway", 16))  # links are not implied one-way
        self.assertEqual(classify({"highway": "trunk"})[1], 16)
        self.assertEqual(classify({"highway": "trunk", "foot": "yes"})[1], 4 | 16)
        self.assertEqual(classify({"highway": "footway"})[1], 4 | 8)  # Queensland allows riding on footpaths
        self.assertEqual(classify({"highway": "steps"})[1], 4)
        self.assertEqual(classify({"highway": "cycleway"})[1], 4 | 8)
        self.assertEqual(classify({"highway": "cycleway", "foot": "no"})[1], 8)
        self.assertEqual(classify({"highway": "track"})[1], 4 | 8)
        self.assertEqual(classify({"highway": "primary", "bicycle": "use_sidepath"})[1], 4 | 16)
        self.assertEqual(classify({"highway": "residential", "access": "private", "foot": "yes"})[1], 4)
        # access=yes opens a path to people, never to cars: only road classes can be driven.
        self.assertEqual(classify({"highway": "steps", "access": "yes"})[1], 4)
        self.assertEqual(classify({"highway": "footway", "access": "yes", "motor_vehicle": "yes"})[1] & 16, 0)

    def test_one_way_rules(self):
        self.assertEqual(classify({"highway": "primary", "oneway": "yes"})[1] & 3, 1)
        self.assertEqual(classify({"highway": "primary", "oneway": "-1"})[1] & 3, 2)
        self.assertEqual(classify({"highway": "motorway"})[1] & 3, 1)
        self.assertEqual(classify({"highway": "motorway", "oneway": "no"})[1] & 3, 0)
        self.assertEqual(classify({"highway": "residential", "junction": "roundabout"})[1], 4 | 8 | 16 | 1 | 128)
        self.assertEqual(classify({"highway": "residential", "oneway": "reversible"})[1], 4 | 8)
        self.assertEqual(classify({"highway": "footway", "oneway": "yes"})[1], 4 | 8)  # the car one-way flag only applies to driving

    def test_left_out_ways(self):
        for tags in ({"highway": "service", "access": "private"}, {"highway": "service", "service": "driveway"}, {"highway": "construction"},
                     {"highway": "footway", "foot": "no", "bicycle": "no"}, {"highway": "motorway", "access": "no"}, {"building": "yes"},
                     {"highway": "residential", "area": "yes"}):
            self.assertIsNone(classify(tags), tags)


class ConvertTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.result = convert(overpass_answer(), BOX)

    def test_header_and_attribution(self):
        result = self.result
        self.assertEqual((result["attribution"], result["licence"], result["bbox"]), ("© OpenStreetMap contributors", "ODbL 1.0", BOX))
        self.assertIn("Overpass", result["source"])
        self.assertIn("fetched_at", result)

    def test_roads_keep_names_and_flags(self):
        coronation = by_id(self.result, 101)[0]
        self.assertEqual((coronation["c"], coronation["n"], coronation["f"]), ("residential", "Coronation Drive", 28))
        sidewalk = by_id(self.result, 102)[0]
        self.assertEqual((sidewalk["c"], sidewalk["n"], sidewalk["f"]), ("footway", None, 12))
        self.assertEqual(by_id(self.result, 103)[0]["f"], 4 | 8 | 16 | 1)
        self.assertEqual(by_id(self.result, 104)[0]["f"], 4 | 8 | 16 | 2)
        self.assertEqual(by_id(self.result, 106)[0]["f"], 16)
        self.assertEqual(by_id(self.result, 107)[0]["f"], 4 | 16)
        self.assertEqual(by_id(self.result, 108)[0]["f"], 16 | 1 | 32)
        self.assertEqual(by_id(self.result, 110)[0]["f"], 4 | 64)
        self.assertEqual(by_id(self.result, 111)[0]["f"], 28 | 1 | 128)
        self.assertEqual(by_id(self.result, 113)[0]["f"], 12)
        ferry = by_id(self.result, 115)[0]
        self.assertEqual((ferry["c"], ferry["f"], ferry["n"]), ("ferry", 0, "CityCat"))
        for way_id in (105, 112, 114, 117, 120, 130, 140):
            self.assertEqual(by_id(self.result, way_id), [], way_id)

    def test_simplification_keeps_junctions_and_ends(self):
        coronation = by_id(self.result, 101)[0]
        self.assertEqual(pairs(coronation["p"]), [(-27.49, 153.005), (-27.49, 153.015), (-27.49, 153.025)])  # nodes 2 and 4 are straight
        self.assertEqual(coronation["j"], [0, 1, 2])  # node 3 is shared with the footpath; the ends are always marked
        roundabout = by_id(self.result, 111)[0]
        self.assertEqual((len(roundabout["p"]) // 2, roundabout["j"]), (4, [0, 3]))
        self.assertEqual(pairs(by_id(self.result, 102)[0]["p"])[1], (-27.485, 153.015))  # rounded to 5 decimals
        shared = {point for way in self.result["ways"] for index, point in enumerate(pairs(way["p"])) if index in way["j"]}
        self.assertIn((-27.49, 153.015), shared)

    def test_ways_are_clipped_to_the_box_with_one_point_beyond(self):
        edge = by_id(self.result, 116)
        self.assertEqual(len(edge), 1)
        self.assertEqual(pairs(edge[0]["p"]), [(-27.481, 153.01), (-27.475, 153.01)])
        self.assertEqual(edge[0]["j"], [0, 1])

    def test_rail_water_and_green(self):
        self.assertEqual(self.result["rail"], [{"n": "Ipswich line", "k": "rail", "p": [-27.4995, 153.005, -27.4995, 153.028]}])
        water = {(item["k"], item["closed"]): item for item in self.result["water"]}
        self.assertEqual(set(water), {("water", True), ("river", False)})
        lake = pairs(water[("water", True)]["p"])
        self.assertTrue(all(lng >= 153.0 for _, lng in lake))  # the part west of the box is cut off
        self.assertEqual(len(self.result["green"]), 1)  # the 20 m pocket park is too small

    def test_places_and_significant_pois_only(self):
        self.assertEqual(self.result["places"], [{"n": "Toowong", "k": "suburb", "lat": -27.486, "lng": 153.012}])
        pois = sorted((poi["k"], poi["n"]) for poi in self.result["pois"])
        self.assertEqual(pois, [("attraction", "The Wheel"), ("ferry", "Regatta"), ("hospital", "Example Hospital"), ("park", "Big Park"),
                                ("station", "Toowong")])

    def test_size_is_small_and_json_safe(self):
        text = json.dumps(self.result, separators=(",", ":"), ensure_ascii=False)
        self.assertLess(len(text), 4000)
        self.assertEqual(json.loads(text), self.result)


class FetchTests(unittest.TestCase):
    def test_query_names_the_box_once_per_statement_and_asks_for_json(self):
        text = osm.query(BOX)
        self.assertTrue(text.startswith("[out:json][timeout:"))
        self.assertIn("(-27.5,153.0,-27.48,153.03)", text)
        self.assertIn('way["route"="ferry"]', text)
        self.assertIn("out skel qt;", text)

    def test_fallback_instance_is_used_when_the_main_one_fails_and_the_result_is_cached(self):
        calls = []

        def fetch(url, text):
            calls.append(url)
            if "main" in url:
                raise osm.URLError("504 Gateway Timeout: the server is at capacity")
            return overpass_answer()

        source = OSM(tempfile.mkdtemp(), fetch=fetch, urls=("https://main.example/api", "https://fallback.example/api"))
        first = json.loads(source.area_json(BOX))
        self.assertEqual(calls, ["https://main.example/api", "https://fallback.example/api"])
        self.assertEqual(first["places"][0]["n"], "Toowong")
        self.assertEqual(source.area_json(BOX), source.area_json(BOX))
        self.assertEqual(len(calls), 2)  # the disk cache answered

    def test_runtime_error_remarks_and_failures_become_an_overpass_error(self):
        answers = [{"elements": [], "remark": "runtime error: Query timed out"}, OSError("unreachable")]

        def fetch(url, text):
            answer = answers.pop(0)
            if isinstance(answer, Exception):
                raise answer
            return answer

        source = OSM(tempfile.mkdtemp(), fetch=fetch, urls=("a", "b"))
        with self.assertRaises(OverpassError) as caught:
            source.area_json(BOX)
        self.assertIn("could not be downloaded", str(caught.exception))
        self.assertEqual(answers, [])  # both instances were tried

    def test_a_day_old_cache_is_refreshed(self):
        now = [time.time()]
        calls = []
        directory = tempfile.mkdtemp()
        source = OSM(directory, fetch=lambda url, text: calls.append(url) or overpass_answer(), clock=lambda: now[0], urls=("a",))
        source.area_json(BOX)
        source.area_json(BOX)
        now[0] += 2 * 86400
        source.area_json(BOX)
        self.assertEqual(len(calls), 2)
        self.assertEqual(len(list(Path(directory).glob("osm_*.json"))), 1)

    def test_the_daily_cap_on_overpass_fetches(self):
        source = OSM(tempfile.mkdtemp(), fetch=lambda url, text: overpass_answer(), urls=("a",), daily_cap=1)
        source.area_json(BOX)
        source.area_json(BOX)  # a cached answer does not count
        with self.assertRaises(OverpassBusy):
            source.area_json([-27.50, 153.00, -27.48, 153.02])


# ── A tiny GTFS feed with a calendar ─────────────────────────────────────────

ROUTES = """route_id,route_short_name,route_long_name,route_desc,route_type,route_url,route_color,route_text_color
R1,412,City Express,,3,,e463a4,1D1D1D
R2,F1,CityCat,,4,,,
R3,99,Old line,,3,,,
"""
TRIPS = """route_id,service_id,trip_id,trip_headsign,direction_id,block_id,shape_id
R1,WK,t1,"UQ Lakes",0,,S1
R1,WK,t1-copy,"UQ Lakes",0,,S1
R1,WK,t2,"UQ Lakes",0,,S1
R2,SAT,t3,"Saturday only",0,,
R2,EXTRA,t4,"Leaves the box",0,,
R3,OLD,t5,"Expired",0,,
R2,EXTRA,t6,"Riverside",0,,
"""
STOPS = """stop_id,stop_code,stop_name,stop_desc,stop_lat,stop_lon,zone_id,stop_url,location_type,parent_station,platform_code
A,,"Stop A",, -27.4900, 153.0100,1,,0,,
B,,"Stop B",, -27.4850, 153.0200,1,,0,,
C,,"Stop C",, -27.4950, 153.0250,1,,0,P,
X,,"Outside",, -27.4000, 153.1000,1,,0,,
P,,"Station",, -27.4950, 153.0250,,,1,,
"""
STOP_TIMES = """trip_id,arrival_time,departure_time,stop_id,stop_sequence,pickup_type,drop_off_type
t1,08:00:00,08:00:00,A,1,0,0
t1,08:10:00,08:10:00,X,2,0,0
t1,08:20:00,08:20:00,B,3,0,0
t1,08:30:00,08:31:00,C,4,0,0
t1-copy,08:00:00,08:00:00,A,1,0,0
t1-copy,08:10:00,08:10:00,X,2,0,0
t1-copy,08:20:00,08:20:00,B,3,0,0
t1-copy,08:30:00,08:31:00,C,4,0,0
t2,25:10:00,25:10:00,A,1,0,0
t2,25:20:00,25:20:00,B,2,0,0
t3,09:00:00,09:00:00,A,1,0,0
t3,09:10:00,09:10:00,B,2,0,0
t4,09:00:00,09:00:00,A,1,0,0
t4,09:20:00,09:20:00,X,2,0,0
t5,09:00:00,09:00:00,A,1,0,0
t5,09:10:00,09:10:00,B,2,0,0
"t6","09:05:00","09:05:00","C",2,0,0
t6,09:00:00,09:00:00,B,1,0,0\r
"""
CALENDAR = """service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date
WK,1,1,1,1,1,0,0,20261001,20261231
SAT,0,0,0,0,0,1,0,20261001,20261231
OLD,1,1,1,1,1,1,1,20250101,20250131
"""
CALENDAR_DATES = """service_id,date,exception_type
WK,20261027,2
EXTRA,20261027,1
"""
SHAPES = """shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence
S1,-27.4900,153.0150,3
S1,-27.4700,153.0100,1
S1,-27.4900,153.0100,2
S1,-27.4900,153.0200,4
S1,-27.5100,153.0200,5
S1,-27.5200,153.0200,6
OTHER,-27.4900,153.0100,1
OTHER,-27.4800,153.0100,2
"""
MONDAY = date(2026, 10, 26)


def make_feed(**overrides):
    files = {"routes.txt": ROUTES, "trips.txt": TRIPS, "stops.txt": STOPS, "stop_times.txt": STOP_TIMES, "calendar.txt": CALENDAR,
             "calendar_dates.txt": CALENDAR_DATES, "shapes.txt": SHAPES, **overrides}
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        for name, text in files.items():
            if text is not None:
                archive.writestr(name, text)
    return buffer.getvalue()


def extract(feed=None, days=3):
    with zipfile.ZipFile(io.BytesIO(feed or make_feed())) as archive:
        return extract_area(archive, BOX, [date.fromordinal(MONDAY.toordinal() + offset) for offset in range(days)], built_at=0)


class AreaTimetableTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.result = extract()

    def test_header_routes_and_stops(self):
        result = self.result
        self.assertEqual((result["source"], result["attribution"], result["timezone"]), ("Translink SEQ static GTFS", "Translink (CC BY 4.0)", "Australia/Brisbane"))
        self.assertEqual(result["feed_built_at"], "1970-01-01T00:00:00+00:00")
        self.assertEqual(result["days"], ["2026-10-26", "2026-10-27", "2026-10-28"])
        self.assertEqual(result["routes"], [["412", "City Express", 3, "#E463A4", "#1D1D1D"], ["F1", "CityCat", 4, None, None]])
        self.assertEqual(result["stops"], [["A", "Stop A", -27.49, 153.01], ["B", "Stop B", -27.485, 153.02], ["C", "Stop C", -27.495, 153.025]])

    def test_calendar_exceptions_decide_the_services_of_each_day(self):
        self.assertEqual(self.result["service_ids"], ["EXTRA", "WK"])
        self.assertEqual(self.result["services"], {"2026-10-26": [1], "2026-10-27": [0], "2026-10-28": [1]})

    def test_only_in_box_calls_of_running_trips_are_kept_once(self):
        self.assertEqual(self.result["trips"], [
            [0, 1, "UQ Lakes", [0, 28800, 28800, 1, 30000, 30000, 2, 30600, 30660]],  # t1 leaves the box at X and comes back; its copy is dropped
            [0, 1, "UQ Lakes", [0, 90600, 90600, 1, 91200, 91200]],  # times after midnight stay above 24 hours
            [1, 0, "Riverside", [1, 32400, 32400, 2, 32700, 32700]],  # quoted lines and out-of-order sequences are handled
        ])

    def test_shapes_are_clipped_to_the_box_with_one_point_beyond(self):
        self.assertEqual(list(self.result["shapes"]), ["0"])
        points = pairs(self.result["shapes"]["0"])
        self.assertEqual(points[0], (-27.47, 153.01))
        self.assertEqual(points[-1], (-27.51, 153.02))
        self.assertNotIn((-27.52, 153.02), points)
        self.assertNotIn((-27.49, 153.015), points)  # a straight-line point is simplified away

    def test_a_single_day_and_a_feed_without_calendar_or_shapes(self):
        monday = extract(days=1)
        self.assertEqual([trip[2] for trip in monday["trips"]], ["UQ Lakes", "UQ Lakes"])  # the extra service runs on Tuesday only
        self.assertEqual((monday["service_ids"], monday["services"]), (["WK"], {"2026-10-26": [0]}))
        bare = extract(make_feed(**{"calendar.txt": None, "calendar_dates.txt": None, "shapes.txt": None}))
        self.assertEqual((bare["trips"], bare["shapes"], bare["routes"]), ([], {}, []))


class StaticOfflineTests(unittest.TestCase):
    def test_the_zip_is_kept_and_matching_still_works(self):
        directory = Path(tempfile.mkdtemp())
        static = Static(directory, opener=Opener(content=make_feed()))
        self.assertEqual(static.offline_status(), "loading")
        static.ensure()
        self.assertTrue((directory / "SEQ_GTFS.zip").is_file())
        self.assertFalse((directory / "SEQ_GTFS.zip.part").exists())
        self.assertEqual(static.offline_status(), "ready")
        self.assertEqual(static.stops_near([-27.49, 153.01]), ["A"])
        matching = Static(tempfile.mkdtemp(), opener=Opener(content=make_match_zip()))
        matching.ensure()
        self.assertEqual(matching.offline_status(), "ready")
        self.assertEqual(matching.match_transit("412", "", "bus", None, [-27.4975, 153.0137], None)["route_ids"], ["412-4161", "412-5146"])

    def test_an_older_install_with_only_the_index_fetches_the_zip(self):
        directory = Path(tempfile.mkdtemp())
        index = build_index(zipfile.ZipFile(io.BytesIO(make_feed())), time.time() - 3600)
        (directory / "index.json").write_text(json.dumps(index), encoding="utf-8")
        failing = Static(directory, opener=Opener(error=OSError("offline")))
        with self.assertRaises(OSError):
            failing.ensure()
        self.assertEqual((failing.status()["state"], failing.offline_status()), ("ready", "loading"))  # the index still matches
        original = gtfs_static.time.sleep
        gtfs_static.time.sleep = lambda seconds: (_ for _ in ()).throw(KeyboardInterrupt())
        try:
            with self.assertRaises(KeyboardInterrupt):
                failing._run()
        finally:
            gtfs_static.time.sleep = original
        self.assertEqual((failing.status()["state"], failing.offline_status()), ("ready", "unavailable"))
        opener = Opener(content=make_feed())
        static = Static(directory, opener=opener)
        static.ensure()
        self.assertEqual((opener.calls, static.offline_status()), (1, "ready"))
        restarted = Static(directory, opener=Opener(error=OSError("must not be called")))
        restarted.ensure()
        self.assertEqual(restarted.offline_status(), "ready")

    def test_extracts_are_cached_until_a_new_feed_arrives(self):
        static = Static(tempfile.mkdtemp(), opener=Opener(content=make_feed()))
        with self.assertRaises(gtfs_static.NotReady):
            static.area_timetable_json(BOX, 3, MONDAY)
        static.ensure()
        first = static.area_timetable_json(BOX, 3, MONDAY)
        self.assertIs(static.area_timetable_json(BOX, 3, MONDAY), first)
        self.assertEqual(json.loads(first)["services"], {"2026-10-26": [1], "2026-10-27": [0], "2026-10-28": [1]})
        self.assertEqual(static.area_timetable(BOX, 3, MONDAY)["trips"], json.loads(first)["trips"])
        static._clock = lambda: time.time() + 8 * 86400
        static.ensure()  # a weekly refresh replaces the zip and forgets old extracts
        self.assertEqual(len(static._extracts), 0)


# ── Endpoints ────────────────────────────────────────────────────────────────


class FakeOSM:
    def __init__(self, error=None, gate=None):
        self.error, self.gate, self.calls = error, gate, []

    def cached(self, bbox):
        return None

    def area_json(self, bbox):
        self.calls.append(bbox)
        if self.gate:
            self.gate.wait(5)
        if self.error:
            raise self.error
        return json.dumps(convert(overpass_answer(), bbox)).encode("utf-8")


def offline_app(static=None, osm_source=None, wait=5, key="test-key"):
    from gtfs_rt import Monitor
    from live_routes import Services
    from push import Push
    from test_live_routes import FakeRoutes
    from test_push_limits import FakeSender
    from test_realtime_v3 import Feeds
    monitor = Monitor(fetch=Feeds(), clock=lambda: 1_000_000)
    directory = tempfile.mkdtemp()
    if static is None:
        static = Static(directory + "/gtfs", opener=Opener(content=make_feed()))
        static.ensure()
    app = server.create_app(key=key, data_dir=directory, monitor=monitor, static=static, weather=FakeWeather(), traffic=FakeTraffic(),
                            push=Push(directory, monitor, sender=FakeSender(), env={}),
                            services=Services(routes=FakeRoutes(), fuel=None, parking=None, climb=None, monitor=monitor),
                            osm=osm_source or FakeOSM(), offline_wait=wait)
    return app.test_client()


SMALL = query_string({"south": BOX[0], "west": BOX[1], "north": BOX[2], "east": BOX[3]})


class OfflineEndpointTests(unittest.TestCase):
    def test_status_publishes_the_limits_and_the_timetable_state(self):
        data = offline_app().get("/api/status").get_json()
        self.assertEqual(data["offline_limits"], offline_area.limits())
        self.assertEqual(data["offline_transit"], "ready")
        loading = offline_app(static=Static(tempfile.mkdtemp(), opener=Opener())).get("/api/status").get_json()
        self.assertEqual(loading["offline_transit"], "loading")

    def test_map_and_transit_return_the_contract_shapes(self):
        client = offline_app()
        response = client.get("/api/offline/map?" + SMALL)
        self.assertEqual((response.status_code, response.headers["Cache-Control"]), (200, "no-store"))
        data = response.get_json()
        for name in ("source", "attribution", "licence", "fetched_at", "bbox", "ways", "rail", "water", "green", "places", "pois"):
            self.assertIn(name, data)
        self.assertEqual(set(data["ways"][0]), {"c", "n", "f", "p", "j", "id"})
        transit = client.get("/api/offline/transit?" + SMALL + "&days=2")
        self.assertEqual(transit.status_code, 200)
        body = transit.get_json()
        for name in ("source", "attribution", "feed_built_at", "generated_at", "timezone", "days", "routes", "stops", "services", "service_ids", "trips", "shapes"):
            self.assertIn(name, body)
        self.assertEqual(len(body["days"]), 2)
        self.assertEqual(transit.headers["Cache-Control"], "no-store")

    def test_large_answers_are_gzipped_when_the_browser_accepts_it(self):
        response = offline_app().get("/api/offline/map?" + SMALL, headers={"Accept-Encoding": "gzip, deflate"})
        self.assertEqual(response.headers["Content-Encoding"], "gzip")
        self.assertIn("ways", json.loads(gzip.decompress(response.data)))

    def test_bad_areas_and_days_are_400(self):
        client = offline_app()
        for path in ("/api/offline/map", "/api/offline/map?" + query_string({**CBD, "south": "-26.0"}),
                     "/api/offline/map?" + query_string({"south": "-27.6", "west": "152.9", "north": "-27.4", "east": "153.1"}),
                     "/api/offline/transit?" + SMALL + "&days=9", "/api/offline/transit?" + SMALL + "&days=x"):
            response = client.get(path)
            self.assertEqual(response.status_code, 400, path)
            self.assertIn("error", response.get_json())

    def test_each_device_is_limited_per_hour_even_without_a_google_key(self):
        saved = os.environ.get("PLANB_OFFLINE_LIMIT_PER_HOUR")
        os.environ["PLANB_OFFLINE_LIMIT_PER_HOUR"] = "2"
        self.addCleanup(lambda: os.environ.pop("PLANB_OFFLINE_LIMIT_PER_HOUR") if saved is None else os.environ.__setitem__("PLANB_OFFLINE_LIMIT_PER_HOUR", saved))
        client = offline_app(key=None)
        codes = [client.get("/api/offline/map?" + SMALL, environ_overrides=PUBLIC).status_code for _ in range(3)]
        self.assertEqual(codes, [200, 200, 429])
        limited = client.get("/api/offline/map?" + SMALL, environ_overrides=PUBLIC)
        self.assertIn("Retry-After", limited.headers)
        self.assertIn("Too many offline downloads", limited.get_json()["error"])
        self.assertEqual(client.get("/api/offline/transit?" + SMALL, environ_overrides=PUBLIC).status_code, 200)  # a separate allowance
        self.assertEqual(client.get("/api/offline/map?" + SMALL).status_code, 200)  # the developer's own machine

    def test_default_limit_is_six_an_hour(self):
        saved = os.environ.pop("PLANB_OFFLINE_LIMIT_PER_HOUR", None)
        self.addCleanup(lambda: saved is not None and os.environ.__setitem__("PLANB_OFFLINE_LIMIT_PER_HOUR", saved))
        client = offline_app()
        codes = [client.get("/api/offline/map?" + SMALL, environ_overrides=PUBLIC).status_code for _ in range(7)]
        self.assertEqual(codes, [200] * 6 + [429])

    def test_timetable_not_ready_is_503(self):
        client = offline_app(static=Static(tempfile.mkdtemp(), opener=Opener()))
        response = client.get("/api/offline/transit?" + SMALL)
        self.assertEqual(response.status_code, 503)
        self.assertIn("few minutes", response.get_json()["error"])

    def test_overpass_failure_is_502_and_the_daily_cap_is_429(self):
        response = offline_app(osm_source=FakeOSM(error=OverpassError("OpenStreetMap map data could not be downloaded right now."))).get("/api/offline/map?" + SMALL)
        self.assertEqual((response.status_code, response.get_json()), (502, {"error": "OpenStreetMap map data could not be downloaded right now."}))
        busy = offline_app(osm_source=FakeOSM(error=OverpassBusy("Reroute has reached its daily limit of offline map downloads."))).get("/api/offline/map?" + SMALL)
        self.assertEqual(busy.status_code, 429)

    def test_a_slow_extract_is_503_then_the_retry_is_answered(self):
        gate = threading.Event()
        source = FakeOSM(gate=gate)
        client = offline_app(osm_source=source, wait=0.05)
        first = client.get("/api/offline/map?" + SMALL)
        self.assertEqual((first.status_code, first.headers["Retry-After"]), (503, "60"))
        self.assertIn("Try again in a minute", first.get_json()["error"])
        gate.set()
        for _ in range(100):
            retry = client.get("/api/offline/map?" + SMALL)
            if retry.status_code == 200:
                break
            time.sleep(0.02)
        self.assertEqual(retry.status_code, 200)
        self.assertEqual(len(source.calls), 1)  # the retry used the job that was already running

    def test_a_cached_area_is_answered_while_another_area_is_being_fetched(self):
        gate = threading.Event()
        gate.set()
        source = OSM(tempfile.mkdtemp(), fetch=lambda url, text: gate.wait(5) and overpass_answer(), urls=("a",))
        client = offline_app(osm_source=source, wait=0.05)
        self.assertEqual(client.get("/api/offline/map?" + SMALL).status_code, 200)
        gate.clear()
        other = query_string({"south": BOX[0], "west": BOX[1], "north": BOX[2], "east": 153.02})
        self.assertEqual(client.get("/api/offline/map?" + other).status_code, 503)
        self.assertEqual(client.get("/api/offline/map?" + SMALL).status_code, 200)
        gate.set()

    def test_a_failed_timetable_download_says_so(self):
        static = Static(tempfile.mkdtemp(), opener=Opener())
        static.state = "error"
        response = offline_app(static=static).get("/api/offline/transit?" + SMALL)
        self.assertEqual(response.status_code, 503)
        self.assertIn("could not be downloaded", response.get_json()["error"])

    def test_offline_js_is_registered_as_a_script(self):
        self.assertEqual(server.FILES["/offline.js"], ("offline.js", "text/javascript; charset=utf-8"))
        if (server.HERE / "offline.js").is_file():
            response = offline_app().get("/offline.js")
            self.assertEqual((response.status_code, response.headers["Content-Type"]), (200, "text/javascript; charset=utf-8"))
            response.close()


# ── Review fixes: fair limits, bounded waiting, matching area maths, JSON errors, after-midnight trips ──


def wait_for(condition, seconds=5):
    deadline = time.time() + seconds
    while not condition():
        if time.time() > deadline:
            raise AssertionError("timed out waiting")
        time.sleep(0.01)


def with_limit(test, value):
    saved = os.environ.get("PLANB_OFFLINE_LIMIT_PER_HOUR")
    os.environ["PLANB_OFFLINE_LIMIT_PER_HOUR"] = str(value)
    test.addCleanup(lambda: os.environ.pop("PLANB_OFFLINE_LIMIT_PER_HOUR") if saved is None else os.environ.__setitem__("PLANB_OFFLINE_LIMIT_PER_HOUR", saved))


class AreaMathsTests(unittest.TestCase):
    def app_box(self, width_km, height_km, south=-27.5, west=152.98):
        """A box the way app.js measures it (6371 km radius, width along the south edge), rounded to 5 decimals like offline.js."""
        per_km = 180 / (math.pi * 6371.0)
        north = south + height_km * per_km
        east = west + width_km * per_km / math.cos(math.radians(south))
        return {"south": f"{south:.5f}", "west": f"{west:.5f}", "north": f"{north:.5f}", "east": f"{east:.5f}"}

    def test_a_box_the_app_shows_at_exactly_the_limits_is_accepted(self):
        for width, height in ((8, 5), (5, 8), (8, 5.0), (6.3246, 6.3246), (0.5, 0.5)):
            parse_bbox(self.app_box(width, height))  # 40 km², 8 km sides and 0.5 km sides must all pass

    def test_boxes_clearly_over_the_limits_are_still_refused(self):
        for width, height in ((8.2, 4), (4, 8.2), (6.5, 6.5), (0.48, 2)):
            with self.assertRaises(AreaError, msg=(width, height)):
                parse_bbox(self.app_box(width, height))

    def test_rounding_never_makes_the_box_bigger(self):
        raw = {"south": "-27.500049", "west": "152.980049", "north": "-27.445049", "east": "153.040049"}
        box = parse_bbox(raw)
        self.assertEqual(box, [-27.5, 152.9801, -27.4451, 153.04])
        values = [float(raw[name]) for name in ("south", "west", "north", "east")]
        self.assertTrue(box[0] >= values[0] and box[1] >= values[1] and box[2] <= values[2] and box[3] <= values[3])
        self.assertEqual(parse_bbox(CBD), [-27.5, 152.98, -27.445, 153.04])  # values already on the 4-decimal grid stay as they are


class BoundedWaitingTests(unittest.TestCase):
    def test_one_waiter_per_job_and_two_across_the_server(self):
        gate, waiting = threading.Event(), threading.BoundedSemaphore(2)
        first, second, third = (Jobs(name, wait=5, waiting=waiting) for name in ("a", "b", "c"))
        results = []
        threads = [threading.Thread(target=lambda jobs=jobs: results.append(jobs.run("k", lambda: gate.wait(5) and "done"))) for jobs in (first, second)]
        for thread in threads:
            thread.start()
        wait_for(lambda: all(jobs._jobs.get("k", {}).get("waiters") == 1 for jobs in (first, second)))
        start = time.time()
        with self.assertRaises(Pending):
            first.run("k", lambda: "not started")  # the job already has its one waiter
        with self.assertRaises(Pending):
            third.run("k", lambda: gate.wait(5) and "third")  # its job starts, but both server-wide waiting places are taken
        self.assertLess(time.time() - start, 1)
        self.assertIn("k", third._jobs)
        gate.set()
        for thread in threads:
            thread.join(5)
        self.assertEqual(results, ["done", "done"])
        self.assertEqual(third.run("k", lambda: "not run again"), "third")

    def test_a_second_request_for_a_slow_area_gets_an_immediate_503(self):
        gate = threading.Event()
        client = offline_app(osm_source=FakeOSM(gate=gate), wait=5)
        jobs = client.application.extensions["planb"]["jobs"]["map"]
        answers = []
        waiter = threading.Thread(target=lambda: answers.append(client.application.test_client().get("/api/offline/map?" + SMALL).status_code))
        waiter.start()
        wait_for(lambda: any(job["waiters"] == 1 for job in jobs._jobs.values()))
        start = time.time()
        second = client.get("/api/offline/map?" + SMALL)
        self.assertLess(time.time() - start, 1)
        self.assertEqual((second.status_code, second.headers["Retry-After"]), (503, "60"))
        gate.set()
        waiter.join(5)
        self.assertEqual(answers, [200])


class FairLimitTests(unittest.TestCase):
    def test_only_new_map_extracts_count_towards_the_hourly_limit(self):
        with_limit(self, 2)
        gate = threading.Event()
        source = OSM(tempfile.mkdtemp(), fetch=lambda url, text: gate.wait(5) and overpass_answer(), urls=("a",))
        client = offline_app(osm_source=source, wait=0.05, key=None)
        codes = [client.get("/api/offline/map?" + SMALL, environ_overrides=PUBLIC).status_code for _ in range(4)]
        self.assertEqual(codes, [503] * 4)  # one new extract, then three "still preparing" retries that are not counted
        gate.set()
        wait_for(lambda: client.get("/api/offline/map?" + SMALL, environ_overrides=PUBLIC).status_code == 200)
        self.assertEqual([client.get("/api/offline/map?" + SMALL, environ_overrides=PUBLIC).status_code for _ in range(3)], [200] * 3)  # cache hits
        client.application.extensions["planb"]["jobs"]["map"].wait = 5
        other = query_string({"south": BOX[0], "west": BOX[1], "north": BOX[2], "east": 153.02})
        self.assertEqual(client.get("/api/offline/map?" + other, environ_overrides=PUBLIC).status_code, 200)  # the second new extract
        third = query_string({"south": BOX[0], "west": BOX[1], "north": BOX[2], "east": 153.025})
        limited = client.get("/api/offline/map?" + third, environ_overrides=PUBLIC)
        self.assertEqual(limited.status_code, 429)
        self.assertIn("Retry-After", limited.headers)

    def test_a_cached_timetable_is_not_counted(self):
        with_limit(self, 1)
        client = offline_app()
        codes = [client.get("/api/offline/transit?" + SMALL, environ_overrides=PUBLIC).status_code for _ in range(3)]
        self.assertEqual(codes, [200, 200, 200])
        self.assertEqual(client.get("/api/offline/transit?" + SMALL + "&days=2", environ_overrides=PUBLIC).status_code, 429)


class BrokenExtractTests(unittest.TestCase):
    def test_an_unexpected_map_error_is_a_json_500_and_is_logged(self):
        client = offline_app(osm_source=FakeOSM(error=ValueError("bad data")))
        with self.assertLogs("server", "ERROR") as logs:
            response = client.get("/api/offline/map?" + SMALL)
        self.assertEqual((response.status_code, response.get_json()), (500, {"error": "The offline data could not be prepared. Try again later."}))
        self.assertIn("ValueError: bad data", "\n".join(logs.output))

    def test_an_unexpected_timetable_error_is_a_json_500(self):
        class Broken(Static):
            def area_timetable_json(self, bbox, days, today):
                raise ValueError("bad GTFS row")

        static = Broken(tempfile.mkdtemp(), opener=Opener(content=make_feed()))
        static.ensure()
        with self.assertLogs("server", "ERROR"):
            response = offline_app(static=static).get("/api/offline/transit?" + SMALL)
        self.assertEqual((response.status_code, response.headers["Content-Type"]), (500, "application/json"))
        self.assertEqual(response.get_json(), {"error": "The offline data could not be prepared. Try again later."})


class AfterMidnightTests(unittest.TestCase):
    LATE_FEED = {"calendar.txt": CALENDAR + "SUN,0,0,0,0,0,0,1,20261001,20261231\n",
                 "trips.txt": TRIPS + "R1,SUN,t7,Late bus,0,,\nR1,SUN,t8,Sunday daytime,0,,\n",
                 "stop_times.txt": STOP_TIMES + "t7,24:30:00,24:30:00,A,1,0,0\nt7,24:40:00,24:41:00,B,2,0,0\nt8,10:00:00,10:00:00,A,1,0,0\nt8,10:10:00,10:10:00,B,2,0,0\n"}

    def test_the_previous_days_trips_after_midnight_are_added_to_services_only(self):
        result = extract(make_feed(**self.LATE_FEED))
        self.assertEqual(result["days"], ["2026-10-26", "2026-10-27", "2026-10-28"])  # still the days that were asked for
        self.assertEqual(result["service_ids"], ["EXTRA", "SUN", "WK"])
        self.assertEqual(result["services"], {"2026-10-25": [1], "2026-10-26": [2], "2026-10-27": [0], "2026-10-28": [2]})
        late = [trip for trip in result["trips"] if trip[1] == 1]
        self.assertEqual(late, [[0, 1, "Late bus", [0, 88200, 88200, 1, 88800, 88860]]])  # 00:30 and 00:40 on Monday morning
        self.assertNotIn("Sunday daytime", [trip[2] for trip in result["trips"]])

    def test_a_service_running_on_both_days_lists_the_previous_day_too(self):
        tuesday = date(2026, 10, 27)
        with zipfile.ZipFile(io.BytesIO(make_feed())) as archive:
            result = extract_area(archive, BOX, [tuesday], built_at=0)
        self.assertEqual(result["services"]["2026-10-26"], [result["service_ids"].index("WK")])  # Monday's 25:10 trip runs early on Tuesday
        self.assertEqual(result["days"], ["2026-10-27"])
        self.assertIn([0, 90600, 90600, 1, 91200, 91200], [trip[3] for trip in result["trips"]])

    def test_no_previous_day_entry_when_nothing_runs_past_midnight(self):
        self.assertNotIn("2026-10-25", extract()["services"])


if __name__ == "__main__":
    unittest.main()
