"""Offline checks for route requests and truthful limit evaluation."""

from datetime import datetime, timedelta
import unittest

from live_routes import BRISBANE, InputError, RoutesError, plan, request_body, validate


NOW = datetime(2026, 10, 20, 8, 0, tzinfo=BRISBANE)
PAYLOAD = {
    "origin": "Taringa Station, Brisbane QLD",
    "destination": "The University of Queensland, St Lucia QLD",
    "departure": "2026-10-20T08:20",
    "deadline": "2026-10-20T09:00",
    "budget": "5", "walking": "10",
    "modes": {"transit": True, "drive": False},
}

TRANSIT = {
    "duration": "2040s",
    "legs": [{"steps": [
        {"travelMode": "WALK", "staticDuration": "360s", "navigationInstruction": {"instructions": "Walk to Stop B"}},
        {"travelMode": "TRANSIT", "staticDuration": "1320s", "transitDetails": {"transitLine": {"nameShort": "412"}, "stopDetails": {"departureStop": {"name": "Stop B"}, "arrivalStop": {"name": "UQ"}, "departureTime": "2026-10-19T22:30:00Z"}}},
        {"travelMode": "WALK", "staticDuration": "120s", "navigationInstruction": {"instructions": "Walk to the entrance"}},
    ]}],
}


class LiveRoutesTests(unittest.TestCase):
    def test_transit_without_fare_is_not_marked_within_budget(self):
        calls = []

        def fetch(key, body, mask):
            calls.append((key, body, mask))
            return [TRANSIT]

        result = plan(PAYLOAD, "test-key", fetch, NOW)
        route = result["options"][0]
        self.assertEqual(route["arrival"], "2026-10-20T08:54:00+10:00")
        self.assertEqual(route["walking_minutes"], 8)
        self.assertEqual(route["other_minutes"], 4)
        self.assertIn("board at 8:30 am", route["steps"][1]["title"])
        self.assertIsNone(route["fare"])
        self.assertFalse(route["fits"])
        self.assertIn("Fare unavailable; budget fit unknown", route["reasons"])
        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0][1]["origin"]["address"], PAYLOAD["origin"])
        self.assertEqual(calls[0][1]["travelMode"], "TRANSIT")

    def test_known_aud_fare_and_deadline(self):
        route = {**TRANSIT, "travelAdvisory": {"transitFare": {"currencyCode": "AUD", "units": "4", "nanos": 500000000}}}
        result = plan(PAYLOAD, "test-key", lambda *_: [route], NOW)["options"][0]
        self.assertTrue(result["fits"])
        self.assertEqual(result["fare"], 4.5)
        late = {**PAYLOAD, "deadline": "2026-10-20T08:40"}
        result = plan(late, "test-key", lambda *_: [route], NOW)["options"][0]
        self.assertFalse(result["fits"])
        self.assertIn("Arrives after your deadline", result["reasons"])

    def test_drive_has_real_time_but_unknown_cost(self):
        payload = {**PAYLOAD, "modes": {"transit": False, "drive": True}}
        result = plan(payload, "test-key", lambda *_: [{"duration": "1200s"}], NOW)["options"][0]
        self.assertEqual(result["arrival"], "2026-10-20T08:40:00+10:00")
        self.assertFalse(result["fits"])
        self.assertIn("Fuel, parking and other driving costs unknown", result["reasons"])

    def test_invalid_journey_stops_before_fetch(self):
        for payload in (
            {**PAYLOAD, "origin": "Taringa", "destination": "Taringa"},
            {**PAYLOAD, "deadline": "2026-10-20T08:00"},
            {**PAYLOAD, "modes": {"transit": False, "drive": False}},
            {**PAYLOAD, "departure": (NOW - timedelta(days=1)).strftime("%Y-%m-%dT%H:%M")},
        ):
            with self.subTest(payload=payload), self.assertRaises(InputError):
                validate(payload, NOW)

    def test_request_uses_departure_not_a_simulated_deadline_offset(self):
        journey = validate(PAYLOAD, NOW)
        body = request_body(journey, "transit")
        self.assertEqual(body["departureTime"], "2026-10-20T08:20:00+10:00")
        self.assertEqual(body["destination"]["address"], PAYLOAD["destination"])

    def test_one_failed_mode_does_not_hide_the_other(self):
        payload = {**PAYLOAD, "modes": {"transit": True, "drive": True}}

        def fetch(key, body, mask):
            if body["travelMode"] == "TRANSIT":
                raise RoutesError("service unavailable")
            return [{"duration": "1200s"}]

        result = plan(payload, "test-key", fetch, NOW)
        self.assertEqual(len(result["options"]), 1)
        self.assertEqual(result["options"][0]["mode"], "drive")
        self.assertEqual(result["errors"], ["Transit: service unavailable"])


if __name__ == "__main__":
    unittest.main()
