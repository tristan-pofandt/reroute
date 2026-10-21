"""A small shared ride board so disrupted travellers heading the same way can share a car or an Uber.

Posts live on the local server (and in data/rides.json so a restart does not lose them).
Everyone using the same server sees the same board. No accounts, contact details or
locations beyond rounded start and end points are stored; posts expire automatically.
"""

from datetime import datetime, timedelta
import json
import secrets
import threading
from pathlib import Path

from google_api import metres

MATCH_START_M = 2000
MATCH_END_M = 2500
MATCH_WINDOW = timedelta(minutes=45)
EXPIRE_AFTER = timedelta(minutes=30)
KINDS = {"car": "Has a car", "uber": "Splitting an Uber"}


class RideError(ValueError):
    """A ride-board request that should be corrected."""


def _clean(value, field, low, high):
    if not isinstance(value, str):
        raise RideError(f"Enter {field}.")
    value = " ".join(value.split())
    if not low <= len(value) <= high or any(ord(char) < 32 for char in value):
        raise RideError(f"{field.capitalize()} must be {low}–{high} characters.")
    return value


def _point(value, field):
    try:
        lat, lng = float(value[0]), float(value[1])
    except (TypeError, ValueError, IndexError, KeyError) as error:
        raise RideError(f"The {field} location is missing.") from error
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        raise RideError(f"The {field} location is invalid.")
    # About 100 m precision is enough to match people without storing exact addresses.
    return [round(lat, 3), round(lng, 3)]


class Board:
    def __init__(self, path=None, clock=None, tz=None):
        self._path = Path(path) if path else None
        self._clock = clock
        self._tz = tz
        self._lock = threading.Lock()
        self._rides = {}
        if self._path and self._path.exists():
            try:
                self._rides = json.loads(self._path.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                self._rides = {}

    def _now(self):
        return self._clock() if self._clock else datetime.now(self._tz)

    def _save(self):
        if not self._path:
            return
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._path.write_text(json.dumps(self._rides), encoding="utf-8")

    def _expire(self):
        now = self._now()
        stale = [ride_id for ride_id, ride in self._rides.items()
                 if datetime.fromisoformat(ride["depart_at"]) + EXPIRE_AFTER < now]
        for ride_id in stale:
            del self._rides[ride_id]

    @staticmethod
    def _public(ride, token=None):
        riders = [rider["nickname"] for rider in ride["riders"]]
        mine = token and (token == ride["owner_token"] or any(token == rider["token"] for rider in ride["riders"]))
        return {
            "id": ride["id"], "kind": ride["kind"], "kind_label": KINDS[ride["kind"]],
            "nickname": ride["nickname"], "origin_label": ride["origin_label"],
            "destination_label": ride["destination_label"], "origin": ride["origin"],
            "destination": ride["destination"], "depart_at": ride["depart_at"],
            "meet_point": ride["meet_point"], "note": ride["note"],
            "seats_total": ride["seats"], "seats_left": ride["seats"] - len(riders),
            "riders": riders, "group_size": len(riders) + 1,
            "trip_cost": ride["trip_cost"],
            "per_person": round(ride["trip_cost"] / (len(riders) + 1), 2) if ride["trip_cost"] else None,
            "is_owner": bool(token and token == ride["owner_token"]), "is_member": bool(mine),
        }

    def create(self, payload):
        if not isinstance(payload, dict):
            raise RideError("Send the ride as JSON.")
        kind = payload.get("kind")
        if kind not in KINDS:
            raise RideError("Choose whether you have a car or want to split an Uber.")
        try:
            seats = int(payload.get("seats"))
        except (TypeError, ValueError) as error:
            raise RideError("Enter how many seats are free.") from error
        if not 1 <= seats <= 6:
            raise RideError("Offer between 1 and 6 seats.")
        try:
            depart_at = datetime.fromisoformat(payload.get("depart_at", ""))
        except (TypeError, ValueError) as error:
            raise RideError("Enter a departure time.") from error
        if depart_at.tzinfo is None:
            depart_at = depart_at.replace(tzinfo=self._tz)
        now = self._now()
        try:
            in_window = now - timedelta(minutes=5) <= depart_at <= now + timedelta(hours=12)
        except TypeError as error:
            raise RideError("Enter a departure time with a time zone.") from error
        if not in_window:
            raise RideError("Shared rides must leave within the next 12 hours.")
        cost = payload.get("trip_cost")
        if cost in (None, ""):
            cost = None
        else:
            try:
                cost = round(float(cost), 2)
            except (TypeError, ValueError) as error:
                raise RideError("Enter the trip cost as a number, or leave it blank.") from error
            if not 0 <= cost <= 500:
                raise RideError("Trip cost must be between $0 and $500.")
        note = payload.get("note") or ""
        ride = {
            "id": secrets.token_hex(4),
            "owner_token": secrets.token_urlsafe(16),
            "kind": kind, "seats": seats,
            "nickname": _clean(payload.get("nickname"), "a first name or nickname", 2, 24),
            "origin_label": _clean(payload.get("origin_label"), "a starting area", 3, 80),
            "destination_label": _clean(payload.get("destination_label"), "a destination", 3, 80),
            "origin": _point(payload.get("origin"), "starting"),
            "destination": _point(payload.get("destination"), "destination"),
            "depart_at": depart_at.isoformat(),
            "meet_point": _clean(payload.get("meet_point"), "a public meeting point", 3, 80),
            "note": _clean(note, "the note", 0, 140) if note else "",
            "trip_cost": cost, "riders": [],
        }
        with self._lock:
            self._expire()
            if len(self._rides) >= 500:
                raise RideError("The ride board is full. Try again later.")
            self._rides[ride["id"]] = ride
            self._save()
        return {"ride": self._public(ride, ride["owner_token"]), "token": ride["owner_token"]}

    def matches(self, origin, destination, when, tokens=()):
        origin, destination = _point(origin, "starting"), _point(destination, "destination")
        with self._lock:
            self._expire()
            found = []
            for ride in self._rides.values():
                start_gap = metres(origin, ride["origin"])
                end_gap = metres(destination, ride["destination"])
                time_gap = abs(datetime.fromisoformat(ride["depart_at"]) - when)
                member = any(token in (ride["owner_token"], *(rider["token"] for rider in ride["riders"])) for token in tokens)
                if member or (start_gap <= MATCH_START_M and end_gap <= MATCH_END_M and time_gap <= MATCH_WINDOW):
                    public = self._public(ride, next((token for token in tokens if token in (ride["owner_token"], *(r["token"] for r in ride["riders"]))), None))
                    public["start_gap_m"] = round(start_gap)
                    public["end_gap_m"] = round(end_gap)
                    found.append(public)
        found.sort(key=lambda ride: (not ride["is_member"], ride["seats_left"] <= 0, ride["depart_at"]))
        return found

    def mine(self, tokens):
        with self._lock:
            self._expire()
            return [self._public(ride, token) for ride in self._rides.values() for token in tokens
                    if token == ride["owner_token"] or any(token == rider["token"] for rider in ride["riders"])]

    def join(self, ride_id, nickname):
        nickname = _clean(nickname, "a first name or nickname", 2, 24)
        with self._lock:
            self._expire()
            ride = self._rides.get(ride_id)
            if not ride:
                raise RideError("That shared ride has finished or been cancelled.")
            if len(ride["riders"]) >= ride["seats"]:
                raise RideError("That ride is already full.")
            token = secrets.token_urlsafe(16)
            ride["riders"].append({"nickname": nickname, "token": token})
            self._save()
            return {"ride": self._public(ride, token), "token": token}

    def leave(self, ride_id, token):
        with self._lock:
            ride = self._rides.get(ride_id)
            if not ride:
                return {"ok": True}
            if token == ride["owner_token"]:
                del self._rides[ride_id]
            else:
                ride["riders"] = [rider for rider in ride["riders"] if rider["token"] != token]
            self._save()
        return {"ok": True}
