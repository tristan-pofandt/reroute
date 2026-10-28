"""Ride-board safety: reports, blocks, the content filter, rate limits, auto-hide, the operator queue and its token, expiry and the SQLite store."""

from contextlib import closing
from datetime import timedelta
import json
import os
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import patch

from contentfilter import ContentFilter
from live_routes import BRISBANE
from rides import AUTO_FLAG_REPORTS, Board, RateLimited, RideError
from test_rides import NOW, PAYLOAD, TARONGA, UQ
from test_server import make_app

ACK = {**PAYLOAD, "rules_ack": True}
A, B, C, D, E = (format(n, "x") * 12 for n in range(10, 15))  # five distinct poster ids


class SafetyCase(unittest.TestCase):
    def setUp(self):
        self.now = NOW
        self.board = Board(path=None, clock=lambda: self.now, tz=BRISBANE)

    def post(self, actor=A, **overrides):
        return self.board.create({**ACK, **overrides}, actor)

    def listing(self, blocker=None, tokens=()):
        return self.board.matches(TARONGA, UQ, NOW + timedelta(minutes=20), tokens, blocker)


class FilterTests(unittest.TestCase):
    def setUp(self):
        self.filter = ContentFilter()

    def test_ordinary_trip_text_passes(self):
        for text in ("Taringa Station main entrance", "St. Lucia Ferry Terminal", "Stop 12, platform 3", "Heading to the Great Court", "Scunthorpe classy assessment"):
            self.assertIsNone(self.filter.reason(text), text)

    def test_abuse_is_caught_through_disguises(self):
        for text in ("fuck off", "f.u.c.k off", "fuuuck", "sh1t", "you BITCH", "$h!t", "kill yourself", "k y s"):
            self.assertEqual(self.filter.reason(text), "abuse", text)

    def test_contact_details_links_and_scam_hooks_are_caught(self):
        for text in ("call 0412 345 678", "+61 412 345 678", "www.example.com", "https://t.me/x", "bob@example.com", "@bob123", "add me on whatsapp", "DM me", "send bitcoin", "zero four one two three four five six seven"):
            self.assertEqual(self.filter.reason(text), "contact", text)

    def test_the_word_list_can_be_extended_without_code(self):
        with tempfile.TemporaryDirectory() as folder:
            extra = Path(folder) / "extra.txt"
            extra.write_text("[abuse]\nmoonbase\n", encoding="utf-8")
            self.assertEqual(ContentFilter([extra]).reason("meet at the Moonbase"), "abuse")

    def test_board_rejects_filtered_fields(self):
        board = Board(path=None, clock=lambda: NOW, tz=BRISBANE)
        for overrides in ({"note": "text me on 0412 345 678"}, {"nickname": "bitch"}, {"meet_point": "www.scam.com"}, {"origin_label": "fuck you"}):
            with self.subTest(overrides=overrides), self.assertRaises(RideError):
                board.create({**ACK, **overrides}, A)
        with self.assertRaises(RideError):
            board.join("x", "5hit")


class ReportTests(SafetyCase):
    def test_report_needs_a_known_reason_and_a_live_post(self):
        ride = self.post()["ride"]
        with self.assertRaises(RideError):
            self.board.report(ride["id"], "nonsense", "", B)
        with self.assertRaises(RideError):
            self.board.report("nope", "scam", "", B)
        self.assertEqual(self.board.report(ride["id"], "scam", "wants money", B), {"ok": True, "hidden": False})

    def test_you_cannot_report_your_own_post_and_repeats_count_once(self):
        ride = self.post()["ride"]
        with self.assertRaises(RideError):
            self.board.report(ride["id"], "scam", "", A)
        for _ in range(5):
            self.board.report(ride["id"], "scam", "", B)
        self.assertEqual(len(self.board.queue()["items"][0]["reports"]), 1)
        self.assertEqual(self.listing()[0]["id"], ride["id"])

    def test_enough_distinct_reports_hide_the_post_until_it_is_approved(self):
        created = self.post()
        ride = created["ride"]
        reporters = [B, C, D, E][:AUTO_FLAG_REPORTS]
        results = [self.board.report(ride["id"], "harassment", "", who) for who in reporters]
        self.assertEqual([r["hidden"] for r in results], [False] * (AUTO_FLAG_REPORTS - 1) + [True])
        self.assertEqual(self.listing(), [])  # hidden from other people
        (own,) = self.listing(tokens=[created["token"]])  # the poster still sees it, marked under review
        self.assertTrue(own["under_review"])
        with self.assertRaises(RideError):
            self.board.join(ride["id"], "Alex")
        self.board.moderate("approve", ride["id"])
        self.assertEqual(len(self.listing()), 1)
        for who in (B, C, D):
            self.board.report(ride["id"], "other", "", who)
        self.assertEqual(len(self.listing()), 1)  # approved posts are not auto-hidden again

    def test_report_rate_limit(self):
        ride = self.post()["ride"]
        reasons = []
        for _ in range(12):
            try:
                self.board.report(ride["id"], "other", "", B)
            except RateLimited as error:
                reasons.append(error.wait)
        self.assertTrue(reasons)


class BlockTests(SafetyCase):
    def test_blocked_posters_disappear_for_the_blocker_only(self):
        ride = self.post(A)["ride"]
        self.post(B, nickname="Bree")
        self.assertEqual(len(self.listing()), 2)
        self.assertEqual(self.board.block(C, ride_id=ride["id"])["nickname"], "Sam")
        self.assertEqual([r["nickname"] for r in self.listing(blocker=C)], ["Bree"])
        self.assertEqual(len(self.listing(blocker=D)), 2)
        self.assertEqual(self.board.blocks(C), [{"poster": A, "nickname": "Sam"}])
        self.board.unblock(C, A)
        self.assertEqual(len(self.listing(blocker=C)), 2)

    def test_block_validation(self):
        ride = self.post(A)["ride"]
        with self.assertRaises(RideError):
            self.board.block(A, ride_id=ride["id"])  # yourself
        with self.assertRaises(RideError):
            self.board.block(B, poster="not-a-poster")
        with self.assertRaises(RideError):
            self.board.block(B, ride_id="gone")
        with self.assertRaises(RideError):
            self.board.block(None, poster=A)
        self.assertEqual(self.board.block(B, poster=A, nickname="  Sam  ")["nickname"], "Sam")  # re-syncing a local block list


class LimitTests(SafetyCase):
    def test_posting_is_limited_per_poster_not_globally(self):
        for _ in range(3):
            self.post(A)
        with self.assertRaises(RateLimited) as caught:
            self.post(A)
        self.assertGreater(caught.exception.wait, 0)
        self.post(B)  # someone else is unaffected
        self.now += timedelta(hours=1, minutes=1)
        self.post(A, depart_at=(self.now + timedelta(minutes=20)).strftime("%Y-%m-%dT%H:%M"))

    def test_the_rules_must_be_acknowledged_and_bans_stop_posting(self):
        with self.assertRaises(RideError):
            self.board.create(PAYLOAD, A)
        created = self.post(A)
        self.board.moderate("ban", created["ride"]["id"])
        self.assertEqual(self.listing(), [])  # the banned poster's posts go with the ban
        with self.assertRaises(RideError):
            self.post(A)
        with self.assertRaises(RideError):
            self.board.join("x", "Alex", A)
        self.board.moderate("unban", poster=A)
        self.post(A)


class QueueTests(SafetyCase):
    def test_remove_deletes_the_post_and_keeps_a_log_entry(self):
        ride = self.post()["ride"]
        self.board.report(ride["id"], "scam", "spam", B)
        queue = self.board.queue()
        self.assertEqual((queue["items"][0]["id"], queue["items"][0]["reports"][0]["reason"]), (ride["id"], "scam"))
        self.board.moderate("remove", ride["id"])
        self.assertEqual((self.board.queue()["items"], self.listing()), ([], []))
        self.assertEqual(self.board.queue()["log"][0]["action"], "remove")
        with self.assertRaises(RideError):
            self.board.moderate("remove", ride["id"])
        with self.assertRaises(RideError):
            self.board.moderate("explode", ride["id"])

    def test_posts_and_their_reports_expire_after_the_ride(self):
        ride = self.post()["ride"]
        self.board.report(ride["id"], "scam", "", B)
        self.now = NOW + timedelta(hours=1)  # departure was 08:20; posts go 30 minutes later
        self.assertEqual(self.listing(), [])
        self.assertEqual(self.board.queue()["items"], [])
        with self.board._cx() as db:
            self.assertEqual(db.execute("SELECT COUNT(*) FROM reports").fetchone()[0], 0)

    def test_old_log_entries_are_purged(self):
        ride = self.post()["ride"]
        self.board.moderate("remove", ride["id"])
        self.now = NOW + timedelta(days=91)
        self.assertEqual(self.board.queue()["log"], [])


class StoreTests(unittest.TestCase):
    def test_old_json_file_is_imported_once_and_kept(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "rides.json"
            old_ride = {"id": "abcd1234", "owner_token": "tok", "kind": "car", "seats": 2, "nickname": "Old", "origin_label": "Taringa", "destination_label": "UQ",
                        "origin": TARONGA, "destination": UQ, "depart_at": "2026-10-20T08:20:00+10:00", "meet_point": "Station", "note": "", "trip_cost": None, "riders": []}
            path.write_text(json.dumps({"abcd1234": old_ride}), encoding="utf-8")
            board = Board(path, lambda: NOW, BRISBANE)
            self.assertEqual([r["nickname"] for r in board.mine(["tok"])], ["Old"])
            board.leave("abcd1234", "tok")
            self.assertEqual(Board(path, lambda: NOW, BRISBANE).mine(["tok"]), [])  # not imported a second time
            self.assertTrue(path.exists())  # the backup stays

    def test_poster_ids_are_stable_and_distinct(self):
        board = Board(None, lambda: NOW, BRISBANE)
        self.assertEqual(board.poster_id("device", "x" * 20), board.poster_id("device", "x" * 20))
        self.assertNotEqual(board.poster_id("device", "x" * 20), board.poster_id("account", "x" * 20))
        self.assertRegex(board.poster_id("device", "y" * 20), r"^[0-9a-f]{12}$")

    def test_a_file_database_is_writable_by_two_connections_at_once(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "rides.json"
            one, two = Board(path, lambda: NOW, BRISBANE), Board(path, lambda: NOW, BRISBANE)
            one.create(PAYLOAD)
            two.create(PAYLOAD)
            self.assertEqual(len(one.matches(TARONGA, UQ, NOW + timedelta(minutes=20))), 2)
            with closing(sqlite3.connect(path.with_suffix(".sqlite3"))) as db:
                self.assertEqual(db.execute("PRAGMA integrity_check").fetchone()[0], "ok")


class RouteTests(unittest.TestCase):
    def setUp(self):
        self.board = Board(None, lambda: NOW, BRISBANE)
        self.app, self.client = make_app(board=self.board)

    def call(self, path, body, device="d" * 24):
        return self.client.post(path, json=body, headers={"X-Reroute-Device": device})

    def test_report_block_and_the_rules_check_over_http(self):
        body = {**ACK, "nickname": "Sam"}
        self.assertEqual(self.call("/api/rides", {**body, "rules_ack": False}).status_code, 400)
        created = self.call("/api/rides", body, "a" * 24)
        self.assertEqual(created.status_code, 200)
        ride_id = created.get_json()["ride"]["id"]
        self.assertEqual(self.call("/api/rides/report", {"id": ride_id, "reason": "scam"}, "b" * 24).status_code, 200)
        self.assertEqual(self.call("/api/rides/report", {"id": ride_id, "reason": "bogus"}, "b" * 24).status_code, 400)
        blocked = self.call("/api/rides/block", {"id": ride_id}, "b" * 24).get_json()
        self.assertEqual(blocked["nickname"], "Sam")
        listing = self.client.get("/api/rides/blocks", headers={"X-Reroute-Device": "b" * 24}).get_json()
        self.assertEqual([entry["poster"] for entry in listing["blocked"]], [blocked["poster"]])
        self.assertEqual(self.client.get("/api/rides/blocks", headers={"X-Reroute-Device": "c" * 24}).get_json(), {"blocked": []})
        self.assertEqual(self.call("/api/rides/unblock", {"poster": blocked["poster"]}, "b" * 24).status_code, 200)

    def test_posting_too_often_is_a_429_with_retry_after(self):
        codes = [self.call("/api/rides", ACK, "a" * 24) for _ in range(4)]
        self.assertEqual([c.status_code for c in codes], [200, 200, 200, 429])
        self.assertTrue(codes[-1].headers["Retry-After"])

    def test_blocked_rides_are_removed_from_a_plan_answer(self):
        board = self.board
        ride = board.create(ACK, board.poster_id("device", "a" * 24))["ride"]
        board.block(board.poster_id("device", "b" * 24), ride_id=ride["id"])
        self.assertEqual(len(board.matches(TARONGA, UQ, NOW + timedelta(minutes=20), (), board.poster_id("device", "b" * 24))), 0)
        self.assertEqual(len(board.matches(TARONGA, UQ, NOW + timedelta(minutes=20), (), board.poster_id("device", "c" * 24))), 1)


class AdminTests(unittest.TestCase):
    TOKEN = "t" * 40

    def setUp(self):
        self.board = Board(None, lambda: NOW, BRISBANE)
        self.app, self.client = make_app(board=self.board)
        self.ride = self.board.create(ACK, A)["ride"]
        self.board.report(self.ride["id"], "scam", "<script>x</script>", B)

    def with_token(self):
        return patch.dict(os.environ, {"PLANB_ADMIN_TOKEN": self.TOKEN})

    def bearer(self):
        return {"Authorization": f"Bearer {self.TOKEN}"}

    def test_disabled_without_a_token(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("PLANB_ADMIN_TOKEN", None)
            self.assertEqual(self.client.get("/admin/moderation").status_code, 404)
            self.assertEqual(self.client.post("/admin/moderation/action", json={"action": "remove", "id": self.ride["id"]}).status_code, 404)

    def test_requires_the_token_and_throttles_guessing(self):
        with self.with_token():
            self.assertEqual(self.client.get("/admin/moderation").status_code, 401)  # the sign-in form
            self.assertEqual(self.client.get("/admin/moderation", headers={"Authorization": "Bearer wrong"}).status_code, 401)
            self.assertEqual(self.client.post("/admin/moderation/action", json={"action": "remove", "id": self.ride["id"]}).status_code, 401)
            self.assertEqual(self.client.post("/admin/moderation/login", data={"token": "wrong"}).status_code, 401)
            self.assertEqual(len(self.board.queue()["items"]), 1)  # nothing was removed

    def test_json_queue_and_actions_with_the_bearer_token(self):
        with self.with_token():
            queue = self.client.get("/admin/moderation", headers=self.bearer()).get_json()
            self.assertEqual(queue["items"][0]["id"], self.ride["id"])
            self.assertEqual(queue["items"][0]["reports"][0]["reason"], "scam")
            done = self.client.post("/admin/moderation/action", json={"action": "ban", "id": self.ride["id"]}, headers=self.bearer())
            self.assertEqual(done.status_code, 200)
            self.assertEqual([ban["poster"] for ban in self.board.queue()["bans"]], [A])
            self.assertEqual(self.client.post("/admin/moderation/action", json={"action": "remove", "id": "gone"}, headers=self.bearer()).status_code, 400)

    def test_html_queue_after_login_escapes_text_and_sets_a_strict_cookie(self):
        with self.with_token():
            login = self.client.post("/admin/moderation/login", data={"token": self.TOKEN})
            self.assertEqual(login.status_code, 303)
            cookie = login.headers["Set-Cookie"]
            self.assertTrue("HttpOnly" in cookie and "SameSite=Strict" in cookie)
            page = self.client.get("/admin/moderation")
            self.assertEqual(page.status_code, 200)
            html = page.get_data(as_text=True)
            self.assertIn("&lt;script&gt;x&lt;/script&gt;", html)
            self.assertNotIn("<script>x", html)
            self.assertIn("default-src 'none'", page.headers["Content-Security-Policy"])
            removed = self.client.post("/admin/moderation/action", data={"action": "remove", "id": self.ride["id"]})
            self.assertEqual(removed.status_code, 303)
            self.assertEqual(self.board.queue()["items"], [])

    def test_cross_site_form_posts_are_refused(self):
        with self.with_token():
            self.client.post("/admin/moderation/login", data={"token": self.TOKEN})
            forged = self.client.post("/admin/moderation/action", data={"action": "remove", "id": self.ride["id"]}, headers={"Origin": "https://evil.example"})
            self.assertEqual(forged.status_code, 401)
            self.assertEqual(len(self.board.queue()["items"]), 1)


if __name__ == "__main__":
    unittest.main()
