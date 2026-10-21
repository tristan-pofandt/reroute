"""Offline checks for the shared ride board: validation, matching, joining, leaving, expiry and persistence."""

from datetime import datetime, timedelta
from pathlib import Path
import tempfile
import unittest

from live_routes import BRISBANE
from rides import Board, RideError

NOW = datetime(2026, 10, 20, 8, 0, tzinfo=BRISBANE)
TARONGA = [-27.49812, 153.01234]
UQ = [-27.49781, 153.01372]

PAYLOAD = {
    "kind": "car", "seats": 3, "nickname": "Sam",
    "origin_label": "Taringa", "destination_label": "UQ St Lucia",
    "origin": TARONGA, "destination": UQ,
    "depart_at": "2026-10-20T08:20", "meet_point": "Taringa Station entrance",
    "note": "", "trip_cost": 20,
}


class BoardTestCase(unittest.TestCase):
    def setUp(self):
        self.now = NOW
        self.board = Board(path=None, clock=lambda: self.now, tz=BRISBANE)

    def create(self, **overrides):
        return self.board.create({**PAYLOAD, **overrides})

    def match(self, origin=TARONGA, destination=UQ, when=None, tokens=()):
        return self.board.matches(origin, destination, when or NOW + timedelta(minutes=20), tokens)


class CreateTests(BoardTestCase):
    def test_create_returns_public_ride_and_owner_token(self):
        created = self.create()
        ride = created["ride"]
        self.assertTrue(created["token"])
        self.assertTrue(ride["is_owner"] and ride["is_member"])
        self.assertEqual((ride["seats_total"], ride["seats_left"], ride["group_size"]), (3, 3, 1))
        self.assertEqual(ride["kind_label"], "Has a car")
        self.assertEqual(ride["depart_at"], "2026-10-20T08:20:00+10:00")
        self.assertNotIn("owner_token", ride)

    def test_locations_are_rounded_to_three_decimal_places(self):
        ride = self.create()["ride"]
        self.assertEqual(ride["origin"], [-27.498, 153.012])
        self.assertEqual(ride["destination"], [-27.498, 153.014])

    def test_invalid_input_is_rejected(self):
        bad = [
            {"kind": "bus"}, {"seats": 0}, {"seats": 7}, {"seats": "many"}, {"nickname": "A"}, {"nickname": 42},
            {"origin_label": "ab"}, {"meet_point": ""}, {"note": "x" * 141},
            {"origin": None}, {"destination": [95, 0]}, {"origin": [0, 181]},
            {"trip_cost": -1}, {"trip_cost": 501}, {"trip_cost": "free"}, {"depart_at": "soon"}, {"depart_at": None},
        ]
        for overrides in bad:
            with self.subTest(overrides=overrides), self.assertRaises(RideError):
                self.create(**overrides)
        with self.assertRaises(RideError):
            self.board.create("not a dict")

    def test_departure_must_be_within_the_time_window(self):
        with self.assertRaises(RideError):
            self.create(depart_at="2026-10-20T07:50")  # more than 5 minutes ago
        with self.assertRaises(RideError):
            self.create(depart_at="2026-10-20T20:30")  # more than 12 hours ahead
        self.create(depart_at="2026-10-20T07:56")  # within the 5 minute grace
        self.create(depart_at="2026-10-20T19:59")

    def test_cost_is_optional(self):
        self.assertIsNone(self.create(trip_cost="")["ride"]["trip_cost"])
        self.assertIsNone(self.create(trip_cost=None)["ride"]["per_person"])


class MatchingTests(BoardTestCase):
    def test_nearby_ride_at_a_similar_time_matches(self):
        self.create()
        (found,) = self.match(origin=[-27.508, 153.012])  # about 1.1 km from the ride start
        self.assertTrue(0 < found["start_gap_m"] <= 2000)
        self.assertFalse(found["is_member"])

    def test_far_start_far_end_or_different_time_do_not_match(self):
        self.create()
        self.assertEqual(self.match(origin=[-27.528, 153.012]), [])  # about 3.3 km away
        self.assertEqual(self.match(destination=[-27.4975, 153.0137 + 0.03]), [])  # about 3 km past the end limit
        self.assertEqual(self.match(when=NOW + timedelta(minutes=70)), [])  # 50 minutes after departure

    def test_members_always_see_their_ride(self):
        created = self.create()
        rider = self.board.join(created["ride"]["id"], "Alex")
        far = {"origin": [-27.9, 153.4], "destination": [-28.0, 153.4], "when": NOW + timedelta(hours=5)}
        self.assertEqual(self.match(**far), [])
        for token in (created["token"], rider["token"]):
            (found,) = self.match(**far, tokens=[token])
            self.assertTrue(found["is_member"])

    def test_members_are_listed_before_other_rides(self):
        self.create(nickname="Other")
        mine = self.create(nickname="Mine", depart_at="2026-10-20T08:40")
        found = self.match(tokens=[mine["token"]])
        self.assertEqual([ride["nickname"] for ride in found], ["Mine", "Other"])

    def test_mine_lists_only_the_rides_for_the_given_tokens(self):
        first, second = self.create(nickname="First"), self.create(nickname="Second")
        self.assertEqual([ride["nickname"] for ride in self.board.mine([first["token"]])], ["First"])
        self.assertEqual(self.board.mine(["unknown"]), [])
        self.assertEqual(len(self.board.mine([first["token"], second["token"]])), 2)


class JoinAndLeaveTests(BoardTestCase):
    def test_join_uses_a_seat_and_shows_the_rider(self):
        created = self.create(seats=2)
        joined = self.board.join(created["ride"]["id"], "  Alex ")
        self.assertEqual(joined["ride"]["seats_left"], 1)
        self.assertEqual(joined["ride"]["riders"], ["Alex"])
        self.assertTrue(joined["ride"]["is_member"])
        self.assertFalse(joined["ride"]["is_owner"])

    def test_join_is_rejected_when_the_ride_is_full(self):
        ride_id = self.create(seats=1)["ride"]["id"]
        self.board.join(ride_id, "Alex")
        with self.assertRaises(RideError):
            self.board.join(ride_id, "Bree")

    def test_join_rejects_unknown_rides_and_bad_nicknames(self):
        ride_id = self.create()["ride"]["id"]
        with self.assertRaises(RideError):
            self.board.join("nope", "Alex")
        with self.assertRaises(RideError):
            self.board.join(ride_id, "A")

    def test_owner_leaving_deletes_the_ride(self):
        created = self.create()
        self.assertEqual(self.board.leave(created["ride"]["id"], created["token"]), {"ok": True})
        self.assertEqual(self.board.mine([created["token"]]), [])
        self.assertEqual(self.match(), [])

    def test_rider_leaving_removes_only_that_rider(self):
        created = self.create()
        ride_id = created["ride"]["id"]
        alex, bree = self.board.join(ride_id, "Alex"), self.board.join(ride_id, "Bree")
        self.board.leave(ride_id, alex["token"])
        (ride,) = self.board.mine([created["token"]])
        self.assertEqual(ride["riders"], ["Bree"])
        self.assertEqual(self.board.mine([alex["token"]]), [])
        self.assertEqual(len(self.board.mine([bree["token"]])), 1)

    def test_leaving_an_unknown_ride_or_with_an_unknown_token_changes_nothing(self):
        created = self.create()
        self.assertEqual(self.board.leave("nope", "x"), {"ok": True})
        self.board.leave(created["ride"]["id"], "not-a-token")
        self.assertEqual(len(self.board.mine([created["token"]])), 1)

    def test_per_person_cost_is_split_across_driver_and_riders(self):
        created = self.create(seats=3, trip_cost=30)
        self.assertEqual(created["ride"]["per_person"], 30.0)
        self.board.join(created["ride"]["id"], "Alex")
        joined = self.board.join(created["ride"]["id"], "Bree")
        self.assertEqual(joined["ride"]["group_size"], 3)
        self.assertEqual(joined["ride"]["per_person"], 10.0)


class ExpiryTests(BoardTestCase):
    def test_ride_expires_thirty_minutes_after_departure(self):
        created = self.create()  # departs 8:20
        self.now = datetime(2026, 10, 20, 8, 50, tzinfo=BRISBANE)
        self.assertEqual(len(self.board.mine([created["token"]])), 1)
        self.now = datetime(2026, 10, 20, 8, 51, tzinfo=BRISBANE)
        self.assertEqual(self.board.mine([created["token"]]), [])

    def test_expired_rides_cannot_be_joined(self):
        ride_id = self.create()["ride"]["id"]
        self.now = datetime(2026, 10, 20, 9, 30, tzinfo=BRISBANE)
        with self.assertRaises(RideError):
            self.board.join(ride_id, "Alex")


class PersistenceTests(unittest.TestCase):
    def test_rides_survive_a_restart(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "data" / "rides.json"
            first = Board(path=path, clock=lambda: NOW, tz=BRISBANE)
            created = first.create(PAYLOAD)
            joined = first.join(created["ride"]["id"], "Alex")
            self.assertTrue(path.exists())
            second = Board(path=path, clock=lambda: NOW, tz=BRISBANE)
            (ride,) = second.mine([created["token"]])
            self.assertEqual(ride["id"], created["ride"]["id"])
            self.assertEqual(ride["riders"], ["Alex"])
            self.assertEqual(len(second.mine([joined["token"]])), 1)

    def test_corrupt_file_starts_an_empty_board(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "rides.json"
            path.write_text("{not json", encoding="utf-8")
            board = Board(path=path, clock=lambda: NOW, tz=BRISBANE)
            self.assertEqual(board.matches(TARONGA, UQ, NOW, ["x"]), [])
            board.create(PAYLOAD)  # and it can be written again
            self.assertEqual(len(Board(path=path, clock=lambda: NOW, tz=BRISBANE).matches(TARONGA, UQ, NOW + timedelta(minutes=20))), 1)


if __name__ == "__main__":
    unittest.main()
