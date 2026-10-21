"""Offline checks for the hand-written GTFS-Realtime reader, using tiny hand-encoded protobuf messages."""

import unittest

import gtfs_rt
from gtfs_rt import FeedError, Monitor

NOW = 1_000_000


# ── Minimal protobuf encoder (wire types 0 varint and 2 length-delimited) ───────

def varint(number):
    number &= (1 << 64) - 1  # negative numbers use 64-bit two's complement, as in protobuf
    out = bytearray()
    while True:
        byte = number & 0x7F
        number >>= 7
        if number:
            out.append(byte | 0x80)
        else:
            out.append(byte)
            return bytes(out)


def vint(field, value):
    return varint(field << 3) + varint(value)


def ld(field, payload):
    payload = payload.encode("utf-8") if isinstance(payload, str) else payload
    return varint(field << 3 | 2) + varint(len(payload)) + payload


def translated(text, language="en"):
    return ld(1, ld(1, text) + ld(2, language))


def alert_entity(entity_id, header="Service alert", effect=None, cause=None, routes=(), periods=(), description="", url=""):
    alert = b"".join(ld(1, vint(1, start) + vint(2, end)) for start, end in periods)
    alert += b"".join(ld(5, ld(2, route)) for route in routes)
    alert += vint(6, cause) if cause else b""
    alert += vint(7, effect) if effect else b""
    alert += ld(8, translated(url)) if url else b""
    alert += ld(10, translated(header))
    alert += ld(11, translated(description)) if description else b""
    return ld(2, ld(1, entity_id) + ld(5, alert))


def trip_entity(entity_id, route_id, delay=None, cancelled=False, stop_delay=None):
    descriptor = ld(5, route_id) + (vint(4, 3) if cancelled else b"")
    update = ld(1, descriptor)
    if stop_delay is not None:
        update += ld(2, ld(2, vint(1, stop_delay)))  # StopTimeUpdate.arrival.delay
    if delay is not None:
        update += vint(5, delay)
    return ld(2, ld(1, entity_id) + ld(3, update))


FEED_HEADER = ld(1, ld(1, "2.0") + vint(2, 0))


class FakeFeeds:
    """Stands in for the network: returns encoded feeds by name and counts fetches."""

    def __init__(self, alerts=b"", trips=b"", error=None):
        self.feeds = {"Alerts": FEED_HEADER + alerts, "TripUpdates": FEED_HEADER + trips}
        self.error = error
        self.fetches = []

    def __call__(self, name):
        self.fetches.append(name)
        if self.error:
            raise self.error
        return self.feeds[name]


class WireFormatTests(unittest.TestCase):
    def test_fields_decodes_varint_and_length_delimited(self):
        data = vint(1, 300) + ld(2, "hello") + vint(3, 0)
        self.assertEqual(list(gtfs_rt.fields(data)), [(1, 0, 300), (2, 2, b"hello"), (3, 0, 0)])

    def test_fields_decodes_fixed_width_values(self):
        data = varint(4 << 3 | 1) + b"12345678" + varint(5 << 3 | 5) + b"abcd"
        self.assertEqual(list(gtfs_rt.fields(data)), [(4, 1, b"12345678"), (5, 5, b"abcd")])

    def test_fields_rejects_truncated_and_unsupported_data(self):
        with self.assertRaises(FeedError):
            list(gtfs_rt.fields(b"\x08\x80"))  # varint that never ends
        with self.assertRaises(FeedError):
            list(gtfs_rt.fields(varint(1 << 3 | 2) + varint(10) + b"abc"))  # claims 10 bytes, has 3
        with self.assertRaises(FeedError):
            list(gtfs_rt.fields(varint(1 << 3 | 3)))  # start-group wire type

    def test_signed_turns_large_varints_into_negative_numbers(self):
        self.assertEqual(gtfs_rt._signed(120), 120)
        self.assertEqual(gtfs_rt._signed(2 ** 64 - 120), -120)
        decoded = list(gtfs_rt.fields(vint(5, -300)))[0][2]
        self.assertEqual(gtfs_rt._signed(decoded), -300)


class AlertDecodingTests(unittest.TestCase):
    def test_decode_alerts_reads_text_effect_routes_and_periods(self):
        feed = FEED_HEADER + alert_entity(
            "a1", header="Buses diverted", description="Roadworks at Toowong", effect=4, cause=10,
            routes=("412-4161", "444-4161"), periods=((900_000, 1_100_000),), url="https://example.test/alert")
        (alert,) = gtfs_rt.decode_alerts(feed)
        self.assertEqual(alert["id"], "a1")
        self.assertEqual(alert["header"], "Buses diverted")
        self.assertEqual(alert["description"], "Roadworks at Toowong")
        self.assertEqual(alert["url"], "https://example.test/alert")
        self.assertEqual((alert["effect"], alert["cause"]), (4, 10))
        self.assertEqual(alert["routes"], {"412-4161", "444-4161"})
        self.assertEqual(alert["periods"], [{"start": 900_000, "end": 1_100_000}])

    def test_translated_text_prefers_english_otherwise_first(self):
        both = translated("Bonjour", "fr") + translated("Hello", "en-AU")
        self.assertEqual(gtfs_rt._text(both), "Hello")
        self.assertEqual(gtfs_rt._text(translated("Bonjour", "fr")), "Bonjour")
        self.assertEqual(gtfs_rt._text(b""), "")

    def test_entities_without_an_alert_are_skipped(self):
        feed = FEED_HEADER + ld(2, ld(1, "empty")) + alert_entity("a2", header="Real alert")
        self.assertEqual([alert["id"] for alert in gtfs_rt.decode_alerts(feed)], ["a2"])


class TripDelayDecodingTests(unittest.TestCase):
    def test_decode_trip_delays_reads_trip_level_and_stop_level_delays(self):
        feed = (FEED_HEADER + trip_entity("t1", "412-4161", delay=180) + trip_entity("t2", "412-4161", stop_delay=-60)
                + trip_entity("t3", "412-4161", cancelled=True, delay=999) + trip_entity("t4", "444-4161"))
        routes = gtfs_rt.decode_trip_delays(feed)
        self.assertEqual(routes["412-4161"], {"delays": [180, -60], "cancelled": 1, "trips": 3})
        self.assertEqual(routes["444-4161"], {"delays": [], "cancelled": 0, "trips": 1})

    def test_trips_without_a_route_id_are_ignored(self):
        feed = FEED_HEADER + ld(2, ld(1, "t") + ld(3, vint(5, 60)))
        self.assertEqual(gtfs_rt.decode_trip_delays(feed), {})


class MatchingTests(unittest.TestCase):
    def test_route_key_is_the_public_line_name(self):
        self.assertEqual(gtfs_rt.route_key("412-4161"), "412")
        self.assertEqual(gtfs_rt.route_key(" ipbr-4512 "), "IPBR")
        self.assertEqual(gtfs_rt.route_key("P102"), "P102")

    def test_line_keys_include_the_last_word(self):
        self.assertEqual(gtfs_rt.line_keys("bcc 412"), {"BCC 412", "412"})
        self.assertEqual(gtfs_rt.line_keys(None), set())

    def test_train_codes_come_from_keywords_in_the_line_name(self):
        self.assertEqual(gtfs_rt.train_codes("Ipswich/Rosewood Line"), {"IP", "RW"})
        self.assertEqual(gtfs_rt.train_codes("Varsity Lakes line"), {"VL"})
        self.assertEqual(gtfs_rt.train_codes("412"), set())

    def test_train_key_matches_either_station_group_code(self):
        self.assertTrue(gtfs_rt.train_key_matches("IPBR", {"IP"}))
        self.assertTrue(gtfs_rt.train_key_matches("BRIP", {"IP"}))
        self.assertFalse(gtfs_rt.train_key_matches("IPBR", {"SP"}))
        self.assertFalse(gtfs_rt.train_key_matches("412", {"IP"}))
        self.assertFalse(gtfs_rt.train_key_matches("IPBR", set()))


class MonitorTests(unittest.TestCase):
    def monitor(self, feeds):
        self.now = NOW
        return Monitor(fetch=feeds, clock=lambda: self.now)

    def test_feed_is_cached_for_sixty_seconds(self):
        feeds = FakeFeeds(alerts=alert_entity("a1"))
        monitor = self.monitor(feeds)
        monitor.alerts()
        self.now += 59
        monitor.alerts()
        self.assertEqual(feeds.fetches, ["Alerts"])
        self.now += 2
        monitor.alerts()
        self.assertEqual(feeds.fetches, ["Alerts", "Alerts"])

    def test_inactive_alerts_are_filtered_out(self):
        feeds = FakeFeeds(alerts=(
            alert_entity("current", effect=1, periods=((NOW - 100, NOW + 100),))
            + alert_entity("expired", effect=1, periods=((NOW - 500, NOW - 100),))
            + alert_entity("future", effect=1, periods=((NOW + 100, NOW + 500),))
            + alert_entity("open-ended", effect=10, periods=((NOW - 100, 0),))
            + alert_entity("no-period", header="")))
        result = self.monitor(feeds).alerts()
        by_id = {alert["id"]: alert for alert in result["alerts"]}
        self.assertEqual(set(by_id), {"current", "open-ended", "no-period"})
        self.assertTrue(by_id["current"]["disruptive"])
        self.assertEqual(by_id["current"]["effect"], "No service")
        self.assertFalse(by_id["open-ended"]["disruptive"])
        self.assertEqual(by_id["no-period"]["header"], "Service alert")

    def test_alert_lines_use_public_route_names(self):
        feeds = FakeFeeds(alerts=alert_entity("a1", effect=3, cause=9, routes=("412-4161", "412-4162")))
        (alert,) = self.monitor(feeds).alerts()["alerts"]
        self.assertEqual(alert["lines"], ["412"])
        self.assertEqual(alert["cause"], "Maintenance")

    def test_delays_report_median_minutes_and_cancellations(self):
        feeds = FakeFeeds(trips=trip_entity("1", "412-4161", delay=120) + trip_entity("2", "412-4162", delay=300)
                          + trip_entity("3", "412-4161", delay=600) + trip_entity("4", "412-4161", cancelled=True))
        summary, _ = self.monitor(feeds).delays()
        self.assertEqual(summary["412"], {"median_delay_min": 5, "cancelled": 1, "trips": 4})

    def test_status_for_lines_matches_bus_numbers(self):
        feeds = FakeFeeds(
            alerts=alert_entity("hit", effect=1, routes=("412-4161",)) + alert_entity("miss", effect=1, routes=("66-4161",)),
            trips=trip_entity("1", "412-4161", delay=300) + trip_entity("2", "66-4161", delay=900))
        status = self.monitor(feeds).status_for_lines(["BCC 412"])
        self.assertTrue(status["checked"])
        self.assertIsNone(status["error"])
        self.assertEqual([alert["id"] for alert in status["alerts"]], ["hit"])
        self.assertEqual(status["delay"], 5)

    def test_status_for_lines_matches_train_lines_by_station_codes(self):
        feeds = FakeFeeds(alerts=alert_entity("rail", effect=2, routes=("BRIP-4512",)), trips=trip_entity("1", "IPBR-4512", delay=240))
        status = self.monitor(feeds).status_for_lines(["Ipswich/Rosewood Line"])
        self.assertEqual([alert["id"] for alert in status["alerts"]], ["rail"])
        self.assertEqual(status["delay"], 4)

    def test_unrelated_line_has_no_alerts_or_delay(self):
        feeds = FakeFeeds(alerts=alert_entity("a", effect=1, routes=("66-4161",)), trips=trip_entity("1", "66-4161", delay=600))
        status = self.monitor(feeds).status_for_lines(["412"])
        self.assertEqual((status["alerts"], status["delay"], status["checked"]), ([], None, True))

    def test_status_for_lines_never_raises_when_the_feed_fails(self):
        feeds = FakeFeeds(error=FeedError("Translink Alerts feed could not be reached."))
        status = self.monitor(feeds).status_for_lines(["412"])
        self.assertFalse(status["checked"])
        self.assertEqual(status["error"], "Translink Alerts feed could not be reached.")
        self.assertEqual(status["alerts"], [])

    def test_status_for_lines_without_names_does_not_fetch(self):
        feeds = FakeFeeds()
        status = self.monitor(feeds).status_for_lines(["", None])
        self.assertFalse(status["checked"])
        self.assertEqual(feeds.fetches, [])


if __name__ == "__main__":
    unittest.main()
