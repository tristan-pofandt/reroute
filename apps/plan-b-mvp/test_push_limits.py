"""Offline checks for push subscriptions, watch expiry and de-duplication (with a fake sender), and the rate limiter."""

import json
from pathlib import Path
import tempfile
import unittest

import limits
from gtfs_rt import FeedError
from push import BRISBANE, Gone, Push, PushError, alert_matches, clean_watch, generate_keys
from datetime import datetime, timedelta

NOW = datetime(2026, 10, 21, 8, 0, tzinfo=BRISBANE).timestamp()
SUBSCRIPTION = {"endpoint": "https://push.example.test/send/abc123456789", "keys": {"p256dh": "p" * 40, "auth": "a" * 16}}
WATCH = {"label": "Bus 412", "lines": ["412"], "route_ids": ["412-5146"], "origin": "Taringa Station", "destination": "UQ St Lucia",
         "destination_place_id": None, "deadline": "2026-10-21T09:00"}


def alert(identifier="a1", route_ids=("412-5146",), lines=("412",), disruptive=True, header="Bus 412 cancelled", effect="No service"):
    return {"id": identifier, "header": header, "effect": effect, "disruptive": disruptive, "lines": list(lines), "route_ids": list(route_ids)}


class FakeMonitor:
    def __init__(self, alerts=(), trips=(), error=None):
        self.alert_list, self.trips, self.error = list(alerts), list(trips), error

    def alerts(self):
        if self.error:
            raise self.error
        return {"alerts": self.alert_list, "fetched_at": "x"}

    def trip_updates(self):
        if self.error:
            raise self.error
        return self.trips


class FakeSender:
    def __init__(self, fail=None):
        self.sent, self.fail = [], fail

    def __call__(self, subscription, payload, private_key, subject):
        if self.fail:
            raise self.fail
        self.sent.append((subscription["endpoint"], json.loads(payload), private_key, subject))


class Setup(unittest.TestCase):
    def make(self, monitor=None, sender=None, env=None):
        self.clock = [NOW]
        self.sender = sender or FakeSender()
        self.directory = Path(tempfile.mkdtemp())
        self.push = Push(self.directory, monitor or FakeMonitor(), sender=self.sender, clock=lambda: self.clock[0], env=env or {})
        return self.push


class WatchValidationTests(unittest.TestCase):
    def test_watch_expires_thirty_minutes_after_the_deadline(self):
        watch, expires = clean_watch(WATCH, NOW)
        self.assertEqual(expires, datetime(2026, 10, 21, 9, 30, tzinfo=BRISBANE).timestamp())
        self.assertEqual(watch["lines"], ["412"])

    def test_watch_without_a_deadline_lasts_three_hours(self):
        _, expires = clean_watch({**WATCH, "deadline": None}, NOW)
        self.assertEqual(expires, NOW + 3 * 3600)

    def test_a_deadline_in_the_past_or_far_future_is_handled(self):
        with self.assertRaises(PushError):
            clean_watch({**WATCH, "deadline": "2026-10-21T07:00"}, NOW)
        _, expires = clean_watch({**WATCH, "deadline": "2026-11-30T09:00"}, NOW)
        self.assertEqual(expires, NOW + 24 * 3600)
        with self.assertRaises(PushError):
            clean_watch({**WATCH, "deadline": "tomorrow"}, NOW)

    def test_watch_needs_a_line_and_valid_fields(self):
        for bad in ({"lines": [], "route_ids": []}, {"lines": "412"}, {"destination_place_id": "bad id"}, {"origin": 5}):
            with self.assertRaises(PushError, msg=str(bad)):
                clean_watch({**WATCH, **bad}, NOW)

    def test_alert_matching_prefers_route_ids_then_line_names(self):
        watch = {"route_ids": ["412-5146"], "lines": ["412"]}
        self.assertTrue(alert_matches(alert(route_ids=("412-5146",), lines=()), watch))
        self.assertTrue(alert_matches(alert(route_ids=(), lines=("412",)), watch))
        self.assertFalse(alert_matches(alert(route_ids=("66-5146",), lines=("66",)), watch))
        self.assertFalse(alert_matches(alert(disruptive=False), watch))
        self.assertTrue(alert_matches(alert(route_ids=(), lines=("IPBR",)), {"route_ids": [], "lines": ["Ipswich/Rosewood"]}))


class SubscriptionTests(Setup):
    def test_subscribe_stores_the_watch_and_replaces_one_for_the_same_endpoint(self):
        push = self.make()
        first = push.subscribe(SUBSCRIPTION, WATCH)
        second = push.subscribe(SUBSCRIPTION, {**WATCH, "label": "Bus 66", "lines": ["66"], "route_ids": []})
        self.assertEqual(first, second)
        stored = json.loads((self.directory / "push.json").read_text(encoding="utf-8"))
        self.assertEqual(list(stored), [first])
        self.assertEqual(stored[first]["watch"]["label"], "Bus 66")
        self.assertEqual(Push(self.directory, FakeMonitor(), sender=self.sender, env={}).identifier(SUBSCRIPTION["endpoint"]), first)

    def test_invalid_subscriptions_are_rejected(self):
        push = self.make()
        for bad in (None, {"endpoint": "http://insecure.example/x", "keys": SUBSCRIPTION["keys"]}, {"endpoint": SUBSCRIPTION["endpoint"]},
                    {"endpoint": SUBSCRIPTION["endpoint"], "keys": {"p256dh": "short", "auth": "a" * 16}}):
            with self.assertRaises(PushError):
                push.subscribe(bad, WATCH)

    def test_unsubscribe_removes_the_subscription(self):
        push = self.make()
        push.subscribe(SUBSCRIPTION, WATCH)
        self.assertTrue(push.unsubscribe(SUBSCRIPTION["endpoint"]))
        self.assertFalse(push.unsubscribe(SUBSCRIPTION["endpoint"]))
        self.assertEqual(json.loads((self.directory / "push.json").read_text(encoding="utf-8")), {})


class MonitorTests(Setup):
    def test_one_push_per_new_disruptive_alert_and_never_a_repeat(self):
        monitor = FakeMonitor([alert("a1")])
        push = self.make(monitor)
        identifier = push.subscribe(SUBSCRIPTION, WATCH)
        self.assertEqual(push.check_once(), 1)
        self.assertEqual(push.check_once(), 0)
        monitor.alert_list.append(alert("a2", header="Bus 412 diverted", effect="Detour"))
        self.assertEqual(push.check_once(), 1)
        self.assertEqual(len(self.sender.sent), 2)
        endpoint, payload, private_key, subject = self.sender.sent[0]
        self.assertEqual(endpoint, SUBSCRIPTION["endpoint"])
        self.assertEqual(set(payload), {"title", "body", "url", "tag", "simulated"})
        self.assertEqual(payload["url"], f"/?alternatives={identifier}")
        self.assertFalse(payload["simulated"])
        self.assertIn("Bus 412 cancelled", payload["body"])
        self.assertEqual(subject, "mailto:planb-demo@example.invalid")

    def test_unrelated_and_non_disruptive_alerts_send_nothing(self):
        push = self.make(FakeMonitor([alert("x", route_ids=("66-5146",), lines=("66",)), alert("y", disruptive=False)]))
        push.subscribe(SUBSCRIPTION, WATCH)
        self.assertEqual(push.check_once(), 0)

    def test_expired_watches_are_dropped_and_not_notified(self):
        push = self.make(FakeMonitor([alert("a1")]))
        push.subscribe(SUBSCRIPTION, WATCH)
        self.clock[0] = datetime(2026, 10, 21, 9, 31, tzinfo=BRISBANE).timestamp()
        self.assertEqual(push.check_once(), 0)
        self.assertEqual(self.sender.sent, [])
        self.assertEqual(json.loads((self.directory / "push.json").read_text(encoding="utf-8")), {})

    def test_still_active_just_before_expiry(self):
        push = self.make(FakeMonitor([alert("a1")]))
        push.subscribe(SUBSCRIPTION, WATCH)
        self.clock[0] = datetime(2026, 10, 21, 9, 29, tzinfo=BRISBANE).timestamp()
        self.assertEqual(push.check_once(), 1)

    def test_a_gone_subscription_is_removed(self):
        push = self.make(FakeMonitor([alert("a1")]), sender=FakeSender(fail=Gone()))
        push.subscribe(SUBSCRIPTION, WATCH)
        self.assertEqual(push.check_once(), 0)
        self.assertEqual(json.loads((self.directory / "push.json").read_text(encoding="utf-8")), {})

    def test_a_failed_send_is_retried_on_the_next_pass(self):
        sender = FakeSender(fail=RuntimeError("push service down"))
        push = self.make(FakeMonitor([alert("a1")]), sender=sender)
        push.subscribe(SUBSCRIPTION, WATCH)
        self.assertEqual(push.check_once(), 0)
        sender.fail = None
        self.assertEqual(push.check_once(), 1)

    def test_feed_errors_do_not_stop_the_monitor(self):
        push = self.make(FakeMonitor(error=FeedError("down")))
        push.subscribe(SUBSCRIPTION, WATCH)
        self.assertEqual(push.check_once(), 0)

    def test_a_cancelled_trip_about_to_leave_triggers_one_push(self):
        trip = {"trip_id": "t1", "route_id": "412-5146", "cancelled": True, "start_date": "20261021", "start_time": "08:20:00"}
        later = {**trip, "trip_id": "t2", "start_time": "11:20:00"}
        other = {**trip, "trip_id": "t3", "route_id": "66-5146"}
        push = self.make(FakeMonitor(trips=[trip, later, other]))
        push.subscribe(SUBSCRIPTION, WATCH)
        self.assertEqual(push.check_once(), 1)
        self.assertEqual(push.check_once(), 0)
        self.assertIn("8:20 am", self.sender.sent[0][1]["body"])

    def test_test_push_is_flagged_simulated_and_needs_a_subscription(self):
        push = self.make()
        with self.assertRaises(PushError) as caught:
            push.test(SUBSCRIPTION["endpoint"], 0)
        self.assertEqual(caught.exception.status, 404)
        push.subscribe(SUBSCRIPTION, WATCH)
        push.test(SUBSCRIPTION["endpoint"], 0)
        payload = self.sender.sent[0][1]
        self.assertTrue(payload["simulated"])
        self.assertEqual(payload["tag"], "planb-test")
        for bad in (-1, 61, "soon"):
            with self.assertRaises(PushError):
                push.test(SUBSCRIPTION["endpoint"], bad)

    def test_delayed_test_push_is_sent_later(self):
        push = self.make()
        push.subscribe(SUBSCRIPTION, WATCH)
        self.assertEqual(push.test(SUBSCRIPTION["endpoint"], 10), {"sent_in_s": 10.0})
        self.assertEqual(self.sender.sent, [])  # a timer will send it; nothing is sent synchronously


class KeyTests(Setup):
    def test_keys_are_generated_once_and_reused(self):
        first = self.make()
        self.assertTrue(first.ready())
        self.assertTrue((self.directory / "vapid.json").exists())
        again = Push(self.directory, FakeMonitor(), sender=FakeSender(), env={})
        self.assertEqual((again.public_key, again.private_key), (first.public_key, first.private_key))
        self.assertEqual(len(first.public_key), 87)  # 65 bytes of uncompressed P-256 point as unpadded base64url

    def test_environment_keys_take_priority_and_subject_is_configurable(self):
        push = self.make(env={"VAPID_PRIVATE_KEY": "private-from-env", "VAPID_PUBLIC_KEY": "public-from-env", "VAPID_SUBJECT": "mailto:ops@example.org"})
        self.assertEqual((push.public_key, push.private_key, push.subject), ("public-from-env", "private-from-env", "mailto:ops@example.org"))
        self.assertFalse((self.directory / "vapid.json").exists())

    def test_generate_keys_returns_base64url_pair(self):
        private, public = generate_keys()
        self.assertEqual(len(private), 43)
        self.assertNotIn("=", public)

    def test_subscribing_is_refused_when_push_is_unavailable(self):
        push = self.make()
        push.public_key = None
        with self.assertRaises(PushError) as caught:
            push.subscribe(SUBSCRIPTION, WATCH)
        self.assertEqual(caught.exception.status, 503)


class RateLimiterTests(unittest.TestCase):
    def test_sliding_window_per_client_and_bucket(self):
        clock = [0.0]
        limiter = limits.RateLimiter(lambda: clock[0])
        self.assertEqual([limiter.allow("plan", "1.2.3.4", 3)[0] for _ in range(4)], [True, True, True, False])
        allowed, wait = limiter.allow("plan", "1.2.3.4", 3)
        self.assertEqual((allowed, wait), (False, 3601))
        self.assertTrue(limiter.allow("plan", "5.6.7.8", 3)[0])
        self.assertTrue(limiter.allow("fuel", "1.2.3.4", 3)[0])
        clock[0] = 1800
        self.assertFalse(limiter.allow("plan", "1.2.3.4", 3)[0])
        clock[0] = 3601
        self.assertTrue(limiter.allow("plan", "1.2.3.4", 3)[0])

    def test_a_limit_of_zero_disables_the_check(self):
        limiter = limits.RateLimiter(lambda: 0)
        self.assertTrue(all(limiter.allow("plan", "x", 0)[0] for _ in range(100)))

    def test_daily_cap_resets_at_brisbane_midnight(self):
        clock = [datetime(2026, 10, 21, 22, 0, tzinfo=BRISBANE).timestamp()]
        cap = limits.DailyCap(2, lambda: clock[0])
        self.assertEqual([cap.take() for _ in range(3)], [True, True, False])
        clock[0] += 3 * 3600
        self.assertTrue(cap.take())
        self.assertTrue(limits.DailyCap(0).take())

    def test_loopback_detection(self):
        self.assertTrue(limits.is_loopback("127.0.0.1"))
        self.assertTrue(limits.is_loopback("::1"))
        self.assertFalse(limits.is_loopback("203.0.113.5"))
        self.assertFalse(limits.is_loopback(None))


if __name__ == "__main__":
    unittest.main()
