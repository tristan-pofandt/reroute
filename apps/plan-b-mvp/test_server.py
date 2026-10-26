"""Smoke tests for the Flask routes using the test client. No key, no network, no background threads."""

import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

os.environ["PLANB_NO_BACKGROUND"] = "1"
os.environ["PLANB_DATA_DIR"] = tempfile.mkdtemp()

import server  # noqa: E402
from gtfs_rt import FeedError, Monitor  # noqa: E402
from live_routes import Services  # noqa: E402
from push import Push  # noqa: E402
from test_live_routes import PAYLOAD, FakeRoutes  # noqa: E402
from test_push_limits import SUBSCRIPTION, FakeSender  # noqa: E402
from test_push_limits import WATCH as DATED_WATCH  # noqa: E402
from test_realtime_v3 import Feeds, alert_entity, trip_entity, vehicle_entity  # noqa: E402
from test_weather_traffic import NOW, forecast  # noqa: E402
import weather as weather_mod  # noqa: E402

WATCH = {**DATED_WATCH, "deadline": None}
JSON = {"Content-Type": "application/json"}
PUBLIC = {"REMOTE_ADDR": "203.0.113.7"}
FUTURE = "2099-01-01T08:00"


def plan_body(**extra):
    from datetime import datetime, timedelta
    from live_routes import BRISBANE
    now = datetime.now(BRISBANE) + timedelta(minutes=30)
    return {**PAYLOAD, "departure": now.strftime("%Y-%m-%dT%H:%M"), "deadline": (now + timedelta(hours=2)).strftime("%Y-%m-%dT%H:%M"),
            "modes": {"transit": False, "drive": True}, "vehicle": {"fuel_price": 2.0}, "parking_cost": 0, **extra}


class FakeStatic:
    def status(self):
        return {"state": "ready", "updated": "2026-10-21T00:00:00+00:00", "routes": 3}


class FakeWeather:
    def __init__(self):
        self.forced = []

    def forecast(self, lat, lng, at=None, now=None, force=False):
        self.forced.append(force)
        return weather_mod.build(forecast(), now=NOW) if not force else weather_mod.simulate("clear")


class FakeTraffic:
    def near_point(self, lat, lng, radius, when, limit=50):
        return [{"id": "1", "type": "crash", "title": "Crash", "road": "Moggill Road", "impact": "", "delay_min": 5, "lat": lat, "lng": lng, "simulated": False,
                 "closure": False}], True

    def events(self):
        return [], True


def make_app(key="test-key", feeds=None, **kwargs):
    monitor = Monitor(fetch=feeds or Feeds(alerts=alert_entity("a1", effect=1, routes=("412-5146",)), vehicles=vehicle_entity("1")), clock=lambda: 1_000_000)
    directory = tempfile.mkdtemp()
    push = Push(directory, monitor, sender=FakeSender(), env={})
    services = kwargs.pop("services", None) or Services(routes=FakeRoutes(), fuel=None, parking=None, climb=None, monitor=monitor)
    app = server.create_app(key=key, data_dir=directory, monitor=monitor, static=FakeStatic(), weather=kwargs.pop("weather", FakeWeather()),
                            traffic=FakeTraffic(), push=push, services=services, **kwargs)
    return app, app.test_client()


class ReadOnlyRouteTests(unittest.TestCase):
    def setUp(self):
        self.app, self.client = make_app()

    def test_status_reports_v3_fields_and_keeps_the_old_ones(self):
        data = self.client.get("/api/status").get_json()
        for name in ("live_available", "key_source", "now", "departure", "deadline", "fuel_types"):
            self.assertIn(name, data)
        self.assertEqual((data["version"], data["push"], data["public_url"]), ("3", True, None))
        self.assertEqual(data["gtfs_static"], {"state": "ready", "updated": "2026-10-21T00:00:00+00:00", "routes": 3})
        self.assertTrue(data["live_available"])

    def test_status_without_a_key(self):
        _, client = make_app(key=None)
        data = client.get("/api/status").get_json()
        self.assertFalse(data["live_available"])
        self.assertEqual(client.get("/api/autocomplete?q=taringa").status_code, 503)
        self.assertEqual(client.get("/api/fuel").status_code, 503)

    def test_public_config_returns_only_the_separate_browser_key(self):
        with patch.dict(os.environ, {"MAPS_BROWSER_API_KEY": "public-browser-key"}):
            _, client = make_app(key="server-only-key")
        self.assertEqual(client.get("/api/config").get_json(), {"maps_browser_key": "public-browser-key"})
        status = client.get("/api/status").get_json()
        self.assertNotIn("server-only-key", str(status))
        self.assertNotIn("public-browser-key", str(status))

    def test_sharing_the_server_key_with_the_browser_prints_a_start_up_warning(self):
        import contextlib
        import io
        for browser, server_key, expect in (("same-key", "same-key", True), ("browser-only", "same-key", False), ("", "same-key", False), ("same-key", None, False)):
            out = io.StringIO()
            with patch.dict(os.environ, {"MAPS_BROWSER_API_KEY": browser}), contextlib.redirect_stdout(out):
                make_app(key=server_key)
            self.assertEqual("WARNING: MAPS_BROWSER_API_KEY" in out.getvalue(), expect, (browser, server_key))
            self.assertNotIn("same-key", out.getvalue())  # the warning never prints the key itself
        message = server.shared_key_warning("k", "k")
        for phrase in ("exposed", "/api/config", "separate browser key", "Maps JavaScript API", "HTTP referrers"):
            self.assertIn(phrase, message)
        self.assertIsNone(server.shared_key_warning("a", "b"))

    def test_daily_google_caps_default_to_refinement_limits(self):
        with patch.dict(os.environ, {"PLANB_DAILY_GOOGLE_CAP": "", "PLANB_DAILY_AUTOCOMPLETE_CAP": ""}):
            del os.environ["PLANB_DAILY_GOOGLE_CAP"]
            del os.environ["PLANB_DAILY_AUTOCOMPLETE_CAP"]
            app, _ = make_app()
        caps = app.extensions["planb"]["caps"]
        self.assertEqual((caps["plan"].cap, caps["autocomplete"].cap), (50, 500))

    def test_alerts_include_exact_route_ids_and_feed_errors_are_502(self):
        data = self.client.get("/api/alerts").get_json()
        self.assertEqual(data["alerts"][0]["route_ids"], ["412-5146"])
        _, broken = make_app(feeds=Feeds(error=FeedError("Translink Alerts feed could not be reached.")))
        response = broken.get("/api/alerts")
        self.assertEqual((response.status_code, response.get_json()), (502, {"error": "Translink Alerts feed could not be reached."}))

    def test_autocomplete_validation(self):
        self.assertEqual(self.client.get("/api/autocomplete?q=t").status_code, 400)
        self.assertEqual(self.client.get("/api/autocomplete?q=taringa&session=bad session!").status_code, 400)

    def test_fuel_validation(self):
        self.assertEqual(self.client.get("/api/fuel?type=UNICORN").status_code, 400)
        self.assertEqual(self.client.get("/api/fuel?lat=abc").status_code, 400)

    def test_vehicles_endpoint_and_its_limits(self):
        data = self.client.get("/api/vehicles?route_ids=412-5146,66-5146").get_json()
        self.assertEqual([v["route_id"] for v in data["vehicles"]], ["412-5146"])
        self.assertIn("fetched_at", data)
        self.assertEqual(self.client.get("/api/vehicles").status_code, 400)
        self.assertEqual(self.client.get("/api/vehicles?route_ids=" + ",".join(f"r{n}" for n in range(11))).status_code, 400)
        self.assertEqual(self.client.get("/api/vehicles?route_ids=bad%20id").status_code, 400)

    def test_weather_endpoint_live_demo_and_validation(self):
        live = self.client.get("/api/weather?lat=-27.47&lng=153.03").get_json()
        self.assertFalse(live["simulated"])
        rain = self.client.get("/api/weather?lat=-27.47&lng=153.03&demo=rain").get_json()
        self.assertTrue(rain["simulated"] and rain["bad"])
        self.assertEqual(set(rain), {"current", "hours", "bad", "warning", "simulated", "source", "fetched_at"})
        self.assertEqual(self.client.get("/api/weather?lat=51&lng=0").status_code, 400)
        self.assertEqual(self.client.get("/api/weather").status_code, 400)
        self.assertEqual(self.client.get("/api/weather?lat=-27.47&lng=153.03&demo=snow").status_code, 400)

    def test_weather_page_detail_live_and_demo(self):
        class Detailed(FakeWeather):
            def details(self, lat, lng, now=None):
                return weather_mod.detail(forecast(hours=48), now=NOW)

        _, client = make_app(weather=Detailed())
        live = client.get("/api/weather?lat=-27.47&lng=153.03&detail=1").get_json()
        self.assertEqual((len(live["hourly"]), live["simulated"]), (24, False))
        self.assertNotIn("kind", live)
        demo = client.get("/api/weather?lat=-27.47&lng=153.03&detail=1&demo=heat").get_json()
        self.assertEqual((demo["simulated"], len(demo["days"])), (True, 7))
        self.assertEqual((len(demo["next_hour"]["steps"]), demo["next_hour"]["source"], demo["next_hour"]["rain_from"]), (4, "Simulated", None))
        rain = client.get("/api/weather?lat=-27.47&lng=153.03&detail=1&demo=rain").get_json()["next_hour"]
        self.assertEqual((rain["steps"][0]["precip_mm"], rain["max_prob"]), (1.1, 90))
        self.assertIsNotNone(rain["rain_from"])
        self.assertNotIn("hourly", client.get("/api/weather?lat=-27.47&lng=153.03").get_json())

    def test_place_lookup_for_the_map_picker(self):
        calls = []
        original = server.google_api.place_details
        server.google_api.place_details = lambda key, place_id: calls.append(place_id) or (
            {"place_id": place_id, "name": "Great Court", "address": "St Lucia QLD 4067, Australia", "location": [-27.4975, 153.0137]} if place_id != "ChIJmissing00" else None)
        self.addCleanup(setattr, server.google_api, "place_details", original)
        found = self.client.get("/api/place?id=ChIJ1234567890")
        self.assertEqual((found.status_code, found.get_json()["name"]), (200, "Great Court"))
        self.assertEqual(self.client.get("/api/place?id=ChIJmissing00").status_code, 404)
        self.assertEqual(self.client.get("/api/place?id=bad id").status_code, 400)
        self.assertEqual(self.client.get("/api/place").status_code, 400)
        self.assertEqual(calls, ["ChIJ1234567890", "ChIJmissing00"])
        _, keyless = make_app(key=None)
        self.assertEqual(keyless.get("/api/place?id=ChIJ1234567890").status_code, 503)

    def test_place_details_reads_googles_answer_and_asks_for_six_pro_fields(self):
        seen = {}

        def fake_get(url, timeout=15, headers=None):
            seen.update(url=url, headers=headers)
            return {"id": "ChIJabcdefghij", "displayName": {"text": "Great Court"}, "formattedAddress": "St Lucia QLD 4067, Australia",
                    "location": {"latitude": -27.4975, "longitude": 153.0137},
                    "iconMaskBaseUri": "https://maps.gstatic.com/mapfiles/place_api/icons/v2/school_pinlet", "iconBackgroundColor": "#7b9eb0"}

        with patch.object(server.google_api, "_get_json", fake_get):
            found = server.google_api.place_details("k", "ChIJabcdefghij")
        self.assertEqual(found, {"place_id": "ChIJabcdefghij", "name": "Great Court", "address": "St Lucia QLD 4067, Australia", "location": [-27.4975, 153.0137],
                                 "icon": {"mask": "https://maps.gstatic.com/mapfiles/place_api/icons/v2/school_pinlet.svg", "background": "#7B9EB0"}})
        self.assertEqual(seen["headers"]["X-Goog-FieldMask"], "id,displayName,formattedAddress,location,iconMaskBaseUri,iconBackgroundColor")
        self.assertTrue(seen["url"].startswith("https://places.googleapis.com/v1/places/ChIJabcdefghij?"))

    def test_place_icon_is_dropped_unless_it_is_a_google_glyph_and_a_hex_colour(self):
        glyph = "https://maps.gstatic.com/mapfiles/place_api/icons/v2/cafe_pinlet"
        icon = server.google_api._place_icon
        self.assertEqual(icon({"iconMaskBaseUri": glyph, "iconBackgroundColor": "#FF9E67"}), {"mask": f"{glyph}.svg", "background": "#FF9E67"})
        self.assertIsNone(icon({}))
        self.assertIsNone(icon({"iconMaskBaseUri": glyph}))
        self.assertIsNone(icon({"iconMaskBaseUri": "https://example.com/icons/cafe_pinlet", "iconBackgroundColor": "#FF9E67"}))
        self.assertIsNone(icon({"iconMaskBaseUri": "javascript:alert(1)", "iconBackgroundColor": "#FF9E67"}))
        self.assertIsNone(icon({"iconMaskBaseUri": glyph, "iconBackgroundColor": "red;background:url(x)"}))
        self.assertIsNone(icon({"iconMaskBaseUri": f"{glyph}.png", "iconBackgroundColor": "#FF9E67"}))

    def test_place_details_without_icon_fields_still_works(self):
        def fake_get(url, timeout=15, headers=None):
            return {"id": "ChIJabcdefghij", "displayName": {"text": "Somewhere"}, "location": {"latitude": -27.5, "longitude": 153.0}}

        with patch.object(server.google_api, "_get_json", fake_get):
            found = server.google_api.place_details("k", "ChIJnoiconhere")
        self.assertEqual((found["name"], found["icon"]), ("Somewhere", None))

    def test_weather_unavailable_is_a_502_with_a_message(self):
        class Down:
            def forecast(self, *args, **kwargs):
                return None

        _, client = make_app(weather=Down())
        response = client.get("/api/weather?lat=-27.47&lng=153.03")
        self.assertEqual((response.status_code, response.get_json()), (502, {"error": "Weather is unavailable right now."}))

    def test_traffic_endpoint(self):
        data = self.client.get("/api/traffic?lat=-27.47&lng=153.03&radius_km=5").get_json()
        self.assertEqual((data["available"], len(data["events"])), (True, 1))
        self.assertEqual(self.client.get("/api/traffic?lat=-27.47").status_code, 400)
        self.assertEqual(self.client.get("/api/traffic?lat=-27.47&lng=153.03&radius_km=far").status_code, 400)


class StaticAndPwaTests(unittest.TestCase):
    def setUp(self):
        self.app, self.client = make_app()

    def test_existing_files_are_served_with_the_right_types(self):
        for path, kind in (("/", "text/html"), ("/index.html", "text/html"), ("/terms", "text/html"), ("/privacy", "text/html"), ("/about", "text/html"),
                           ("/app.js", "text/javascript"), ("/app.css", "text/css"), ("/favicon.svg", "image/svg+xml"),
                           ("/demo.html", "text/html"), ("/demo.js", "text/javascript"), ("/styles.css", "text/css")):
            response = self.client.get(path)
            self.assertEqual(response.status_code, 200, path)
            self.assertTrue(response.headers["Content-Type"].startswith(kind), path)
            if kind.startswith("text"):
                self.assertEqual(response.headers["Content-Type"].count("charset"), 1, path)
            response.close()

    def test_pwa_files_are_404_when_they_are_missing(self):
        with tempfile.TemporaryDirectory() as folder:
            original, server.HERE = server.HERE, Path(folder)  # an app folder without the PWA files
            try:
                for path in ("/manifest.webmanifest", "/sw.js", "/icons/icon-192.png", "/nothing.js"):
                    self.assertEqual(self.client.get(path).status_code, 404, path)
                self.assertEqual(self.client.get("/icons/..%2Fserver.py").status_code, 404)
                self.assertEqual(self.client.get("/icons/notes.txt").status_code, 404)
            finally:
                server.HERE = original

    def test_the_real_pwa_files_are_served(self):
        for path, kind in (("/manifest.webmanifest", "application/manifest+json"), ("/sw.js", "text/javascript"), ("/icons/icon-192.png", "image/png"), ("/icons/icon-512.png", "image/png"),
                           ("/icons/icon-maskable-512.png", "image/png"), ("/icons/apple-touch-icon.png", "image/png")):
            response = self.client.get(path)
            self.assertEqual(response.status_code, 200, path)
            self.assertTrue(response.headers["Content-Type"].startswith(kind), path)
            response.close()

    def test_pwa_files_are_served_with_their_headers_when_present(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "manifest.webmanifest").write_text('{"name": "Reroute"}', encoding="utf-8")
            (root / "sw.js").write_text("self.addEventListener('fetch', () => {});", encoding="utf-8")
            (root / "icons").mkdir()
            (root / "icons" / "icon-192.png").write_bytes(b"\x89PNG\r\n\x1a\n")
            original, server.HERE = server.HERE, root
            try:
                manifest = self.client.get("/manifest.webmanifest")
                worker = self.client.get("/sw.js")
                icon = self.client.get("/icons/icon-192.png")
                self.assertEqual(manifest.headers["Content-Type"], "application/manifest+json")
                self.assertEqual(worker.headers["Service-Worker-Allowed"], "/")
                self.assertEqual(worker.headers["Cache-Control"], "no-cache")
                self.assertEqual((icon.status_code, icon.headers["Content-Type"]), (200, "image/png"))
                for response in (manifest, worker, icon):
                    response.close()
            finally:
                server.HERE = original

    def test_qr_code_is_an_svg_of_the_public_url_or_the_request_url(self):
        default = self.client.get("/qr.svg")
        self.assertEqual(default.headers["Content-Type"], "image/svg+xml; charset=utf-8")
        self.assertIn(b"<svg", default.data)
        explicit = self.client.get("/qr.svg?url=https://planb.example.org")
        self.assertNotEqual(default.data, explicit.data)
        self.assertEqual(self.client.get("/qr.svg?url=javascript:alert(1)").status_code, 400)
        _, configured = make_app(public_url="https://planb.example.org")
        self.assertEqual(configured.get("/qr.svg").data, explicit.data)
        self.assertEqual(configured.get("/api/status").get_json()["public_url"], "https://planb.example.org")


class TunnelQrTests(unittest.TestCase):
    def test_qr_uses_https_when_a_local_tunnel_terminates_tls(self):
        _, client = make_app()
        tunnel = client.get("/qr.svg", base_url="http://abc.trycloudflare.com", headers={"X-Forwarded-Proto": "https"})
        explicit = client.get("/qr.svg?url=https://abc.trycloudflare.com/")
        plain = client.get("/qr.svg", base_url="http://abc.trycloudflare.com")
        self.assertEqual(tunnel.data, explicit.data)
        self.assertNotEqual(plain.data, explicit.data)
        remote = client.get("/qr.svg", base_url="http://abc.trycloudflare.com", headers={"X-Forwarded-Proto": "https"}, environ_overrides=PUBLIC)
        self.assertEqual(remote.data, plain.data)  # an internet client cannot choose the scheme


class PostRouteTests(unittest.TestCase):
    def setUp(self):
        self.app, self.client = make_app()

    def post(self, path, body, headers=None, **kwargs):
        return self.client.post(path, json=body, headers=headers, **kwargs)

    def test_plan_returns_v3_fields(self):
        data = self.post("/api/plan", plan_body()).get_json()
        self.assertEqual([o["id"] for o in data["options"]], ["drive-0"])
        self.assertFalse(data["demo"])
        self.assertIn("weather", data)
        self.assertIn("nav", data["options"][0])
        self.assertNotIn("api_cost", data)

    def test_plan_with_demo_returns_api_cost(self):
        data = self.post("/api/plan", plan_body(demo={"weather": "rain", "traffic": "crash"})).get_json()
        self.assertTrue(data["demo"])
        self.assertEqual(data["weather"]["simulated"], True)
        self.assertEqual(set(data["api_cost"]), {"items", "total_usd", "note"})

    def test_plan_input_errors_are_400_and_missing_key_is_502(self):
        response = self.post("/api/plan", plan_body(destination="  taringa station, brisbane qld "))
        self.assertEqual(response.status_code, 400)
        self.assertIn("different", response.get_json()["error"])
        _, keyless = make_app(key=None)
        failure = keyless.post("/api/plan", json=plan_body())
        self.assertEqual(failure.status_code, 502)
        self.assertIn("MAPS_API_KEY", failure.get_json()["error"])

    def test_request_checks_match_the_old_server(self):
        self.assertEqual(self.client.post("/api/plan", data="{}", headers={"Content-Type": "text/plain"}).status_code, 415)
        self.assertEqual(self.client.post("/api/plan", data="", headers=JSON).status_code, 413)
        self.assertEqual(self.client.post("/api/plan", data="x" * 9000, headers=JSON).status_code, 413)
        self.assertEqual(self.client.post("/api/plan", data="{not json", headers=JSON).status_code, 400)
        self.assertEqual(self.client.post("/api/plan", data="[]", headers=JSON).status_code, 400)
        self.assertEqual(self.post("/api/nope", {}).status_code, 404)

    def test_origin_check_compares_the_host_only(self):
        body = plan_body()
        self.assertEqual(self.post("/api/plan", body, headers={"Origin": "http://localhost"}).status_code, 200)
        self.assertEqual(self.post("/api/plan", body, headers={"Origin": "https://localhost"}).status_code, 200)  # https behind a proxy
        self.assertEqual(self.post("/api/plan", body, headers={"Origin": "http://evil.example"}).status_code, 403)
        self.assertEqual(self.post("/api/plan", body, headers={"Origin": "null"}).status_code, 403)
        self.assertEqual(self.post("/api/plan", body, headers={"Origin": "https://localhost.evil.example"}).status_code, 403)
        self.assertEqual(self.post("/api/plan", body, base_url="https://planb.example.org", headers={"Origin": "https://planb.example.org"}).status_code, 200)

    def test_origin_check_also_accepts_the_configured_public_url_and_forwarded_host(self):
        _, client = make_app(public_url="https://planb.example.org")
        body = plan_body()
        self.assertEqual(client.post("/api/plan", json=body, headers={"Origin": "https://planb.example.org"}).status_code, 200)
        forwarded = client.post("/api/plan", json=body, headers={"Origin": "https://abc.trycloudflare.com", "X-Forwarded-Host": "abc.trycloudflare.com"})
        self.assertEqual(forwarded.status_code, 200)
        public = client.post("/api/plan", json=body, headers={"Origin": "https://abc.trycloudflare.com", "X-Forwarded-Host": "abc.trycloudflare.com"}, environ_overrides=PUBLIC)
        self.assertEqual(public.status_code, 403)  # a direct internet client cannot vouch for its own host

    def test_ride_board_routes_still_work(self):
        body = {"kind": "car", "origin": "Taringa Station", "destination": "UQ St Lucia", "start": [-27.4975, 153.0137], "end": [-27.498, 153.01],
                "departure": "2099-01-01T08:00", "seats": 2, "nickname": "Sam"}
        created = self.post("/api/rides", body)
        self.assertIn(created.status_code, (200, 400))
        mine = self.post("/api/rides/mine", {"tokens": []})
        self.assertEqual(mine.get_json(), {"rides": []})
        self.assertEqual(self.post("/api/rides/join", {"id": "nope", "nickname": "Sam"}).status_code, 400)

    def test_live_endpoint(self):
        query = {"route_ids": ["412-5146"], "stop_ids": [], "names": ["412"], "category": "bus", "line": "412", "sim": True}
        data = self.post("/api/live", {"queries": [query, query], "demo": {"disrupted": "bus", "late_min": 5}}).get_json()
        self.assertEqual(len(data["results"]), 2)
        self.assertTrue(data["results"][0]["simulated"])
        self.assertIn("a1", data["results"][0]["alerts"])
        self.assertEqual(self.post("/api/live", {"queries": []}).status_code, 400)
        self.assertEqual(self.post("/api/live", {"queries": [query] * 9}).status_code, 400)

    def test_sync_refreshes_feeds_and_optionally_weather(self):
        weather = FakeWeather()
        _, client = make_app(weather=weather)
        data = client.post("/api/sync", json={}).get_json()
        self.assertEqual((data["status"], data["alerts"], data["disruptive"], data["vehicles"], data["weather"]), ("success", 1, 1, 1, None))
        self.assertIn("1 alerts", data["message"])
        self.assertIn("fetched_at", data)
        with_weather = client.post("/api/sync", json={"lat": -27.47, "lng": 153.03}).get_json()
        self.assertTrue(with_weather["weather"]["simulated"])
        self.assertEqual(weather.forced, [True])
        self.assertEqual(client.post("/api/sync").get_json()["status"], "success")  # no body at all
        invalid = client.post("/api/sync", json={"lat": 10, "lng": 10})
        self.assertEqual((invalid.status_code, invalid.get_json()["status"]), (400, "error"))

    def test_sync_failure_is_an_error_status(self):
        _, client = make_app(feeds=Feeds(error=FeedError("Translink Alerts feed could not be reached.")))
        response = client.post("/api/sync", json={})
        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.get_json()["status"], "error")
        self.assertIn("could not be reached", response.get_json()["message"])


class PushRouteTests(unittest.TestCase):
    def setUp(self):
        self.app, self.client = make_app()

    def test_public_key_subscribe_test_and_unsubscribe(self):
        key = self.client.get("/api/push/key").get_json()["publicKey"]
        self.assertEqual(len(key), 87)
        subscribed = self.client.post("/api/push/subscribe", json={"subscription": SUBSCRIPTION, "watch": WATCH})
        self.assertEqual(subscribed.status_code, 200)
        identifier = subscribed.get_json()["id"]
        self.assertEqual(len(identifier), 16)
        sent = self.client.post("/api/push/test", json={"endpoint": SUBSCRIPTION["endpoint"], "delay_s": 0})
        self.assertEqual((sent.status_code, sent.get_json()["ok"]), (200, True))
        gone = self.client.post("/api/push/unsubscribe", json={"endpoint": SUBSCRIPTION["endpoint"]})
        self.assertEqual(gone.get_json(), {"removed": True})
        again = self.client.post("/api/push/test", json={"endpoint": SUBSCRIPTION["endpoint"], "delay_s": 0})
        self.assertEqual(again.status_code, 404)

    def test_bad_subscriptions_and_delays_are_400(self):
        self.assertEqual(self.client.post("/api/push/subscribe", json={"subscription": {}, "watch": WATCH}).status_code, 400)
        self.assertEqual(self.client.post("/api/push/subscribe", json={"subscription": SUBSCRIPTION, "watch": {"lines": []}}).status_code, 400)
        self.client.post("/api/push/subscribe", json={"subscription": SUBSCRIPTION, "watch": WATCH})
        self.assertEqual(self.client.post("/api/push/test", json={"endpoint": SUBSCRIPTION["endpoint"], "delay_s": 600}).status_code, 400)

    def test_push_is_503_when_unavailable(self):
        app, client = make_app()
        app.extensions["planb"]["push"].public_key = None
        self.assertEqual(client.get("/api/push/key").status_code, 503)
        self.assertEqual(client.post("/api/push/subscribe", json={"subscription": SUBSCRIPTION, "watch": WATCH}).status_code, 503)
        self.assertFalse(client.get("/api/status").get_json()["push"])


class AbuseProtectionTests(unittest.TestCase):
    def with_env(self, **values):
        saved = {name: os.environ.get(name) for name in values}
        os.environ.update({name: str(value) for name, value in values.items()})
        self.addCleanup(lambda: [os.environ.pop(name, None) if old is None else os.environ.__setitem__(name, old) for name, old in saved.items()])

    def test_per_ip_limit_applies_to_public_clients_but_not_to_the_developer_machine(self):
        self.with_env(PLANB_PLAN_LIMIT_PER_HOUR=2, PLANB_DAILY_GOOGLE_CAP=100)
        _, client = make_app()
        body = plan_body()
        codes = [client.post("/api/plan", json=body, environ_overrides=PUBLIC).status_code for _ in range(3)]
        self.assertEqual(codes, [200, 200, 429])
        limited = client.post("/api/plan", json=body, environ_overrides=PUBLIC)
        self.assertIn("Retry-After", limited.headers)
        self.assertIn("Too many requests", limited.get_json()["error"])
        self.assertEqual(client.post("/api/plan", json=body, environ_overrides={"REMOTE_ADDR": "203.0.113.8"}).status_code, 200)
        self.assertTrue(all(client.post("/api/plan", json=body).status_code == 200 for _ in range(5)))  # local machine, no proxy

    def test_a_local_proxy_such_as_a_tunnel_is_limited_by_the_forwarded_address(self):
        self.with_env(PLANB_PLAN_LIMIT_PER_HOUR=1, PLANB_DAILY_GOOGLE_CAP=100)
        _, client = make_app()
        body = plan_body()
        first = {"CF-Connecting-IP": "198.51.100.4"}
        self.assertEqual(client.post("/api/plan", json=body, headers=first).status_code, 200)
        self.assertEqual(client.post("/api/plan", json=body, headers=first).status_code, 429)
        self.assertEqual(client.post("/api/plan", json=body, headers={"X-Forwarded-For": "198.51.100.5, 10.0.0.1"}).status_code, 200)

    def test_daily_cap_is_shared_by_every_client_including_the_developer(self):
        self.with_env(PLANB_PLAN_LIMIT_PER_HOUR=100, PLANB_DAILY_GOOGLE_CAP=2)
        _, client = make_app()
        body = plan_body()
        codes = [client.post("/api/plan", json=body, environ_overrides={"REMOTE_ADDR": f"203.0.113.{n}"}).status_code for n in range(3)]
        self.assertEqual(codes, [200, 200, 429])
        capped = client.post("/api/plan", json=body)
        self.assertEqual(capped.status_code, 429)
        self.assertIn("daily limit", capped.get_json()["error"])

    def test_daily_autocomplete_cap_says_address_suggestions_not_live_searches(self):
        self.with_env(PLANB_AUTOCOMPLETE_LIMIT_PER_HOUR=100, PLANB_DAILY_AUTOCOMPLETE_CAP=1)
        original = server.google_api.autocomplete
        server.google_api.autocomplete = lambda *args: []
        try:
            _, client = make_app()
            codes = [client.get("/api/autocomplete?q=taringa", environ_overrides=PUBLIC) for _ in range(2)]
        finally:
            server.google_api.autocomplete = original
        self.assertEqual([c.status_code for c in codes], [200, 429])
        self.assertIn("address suggestions", codes[1].get_json()["error"])
        self.assertNotIn("live searches", codes[1].get_json()["error"])

    def test_place_lookups_share_the_daily_address_cap(self):
        self.with_env(PLANB_DAILY_AUTOCOMPLETE_CAP=1)
        original = server.google_api.place_details
        server.google_api.place_details = lambda *args: {"place_id": "x", "name": "Somewhere", "address": "", "location": None}
        self.addCleanup(setattr, server.google_api, "place_details", original)
        _, client = make_app()
        codes = [client.get("/api/place?id=ChIJ1234567890", environ_overrides=PUBLIC).status_code for _ in range(2)]
        self.assertEqual(codes, [200, 429])

    def test_autocomplete_and_fuel_are_limited_per_ip(self):
        self.with_env(PLANB_AUTOCOMPLETE_LIMIT_PER_HOUR=1, PLANB_FUEL_LIMIT_PER_HOUR=1)
        original = (server.google_api.autocomplete, server.google_api.fuel_price)
        server.google_api.autocomplete = lambda *args: []
        server.google_api.fuel_price = lambda *args: None
        self.addCleanup(lambda: [setattr(server.google_api, name, value) for name, value in zip(("autocomplete", "fuel_price"), original)])
        _, client = make_app()
        codes = [client.get("/api/autocomplete?q=taringa", environ_overrides=PUBLIC).status_code for _ in range(2)]
        self.assertEqual(codes, [200, 429])
        codes = [client.get("/api/fuel", environ_overrides=PUBLIC).status_code for _ in range(2)]
        self.assertEqual(codes, [200, 429])

    def test_requests_without_a_key_are_never_counted(self):
        self.with_env(PLANB_PLAN_LIMIT_PER_HOUR=1, PLANB_DAILY_GOOGLE_CAP=1)
        _, client = make_app(key=None)
        self.assertEqual([client.post("/api/plan", json=plan_body(), environ_overrides=PUBLIC).status_code for _ in range(3)], [502, 502, 502])


class ModuleTests(unittest.TestCase):
    def test_importing_the_module_started_no_background_threads(self):
        import threading
        names = {thread.name for thread in threading.enumerate()}
        self.assertFalse({"gtfs-static", "push-monitor", "feed-warmup"} & names)

    def test_trip_updates_route_a_vehicle_to_its_trip(self):
        feeds = Feeds(trips=trip_entity("1", "t1", "412-5146"), vehicles=vehicle_entity("1", trip_id="t1"))
        _, client = make_app(feeds=feeds)
        self.assertEqual(client.get("/api/vehicles?route_ids=412-5146").get_json()["vehicles"][0]["trip_id"], "t1")


if __name__ == "__main__":
    unittest.main()
