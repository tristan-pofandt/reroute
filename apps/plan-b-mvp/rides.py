"""A small shared ride board so disrupted travellers heading the same way can share a car or an Uber.

Posts live on the local server in a SQLite file (data/rides.sqlite3; an older data/rides.json is imported once and kept as a backup).
Everyone using the same server sees the same board. No accounts, contact details or locations beyond rounded start and end points are
stored; posts are deleted 30 minutes after departure. Safety: reports, blocks, an automatic hide after enough reports, bans and the
operator queue (see moderation.py and docs/engineering/ride-board-moderation.md).
"""

from contextlib import contextmanager
from datetime import datetime, timedelta
import hashlib
import hmac
import json
import logging
import os
import re
import secrets
import sqlite3
import threading
from pathlib import Path
import urllib.request

from contentfilter import ContentFilter
from google_api import metres
from limits import RateLimiter

MATCH_START_M = 2000
MATCH_END_M = 2500
MATCH_WINDOW = timedelta(minutes=45)
EXPIRE_AFTER = timedelta(minutes=30)
KINDS = {"car": "Has a car", "uber": "Splitting an Uber"}
REASONS = {"harassment": "Harassment or abuse", "scam": "Scam, spam or advertising", "unsafe": "Unsafe or threatening",
           "sexual": "Sexual or inappropriate", "personal": "Shares personal details", "fake": "Fake or misleading post", "other": "Something else"}
AUTO_FLAG_REPORTS = 3  # distinct reporters that hide a post until an operator has looked at it
LOG_DAYS = 90  # how long the moderation log (the evidence for an appeal) is kept
LIMITS = {"create": (3, 3600), "create-day": (8, 86400), "join": (10, 3600), "report": (10, 3600), "block": (30, 3600)}
POSTER = re.compile(r"^[0-9a-f]{12}$")
log = logging.getLogger("planb.rides")


def deliver_alert(url, payload):
    """POST a small JSON body to the operator's webhook (5 s timeout). Never raises: an alert must not break a report."""
    try:
        if not url.startswith(("https://", "http://")):
            raise ValueError("PLANB_ALERT_WEBHOOK must be an http(s) URL")
        request = urllib.request.Request(url, json.dumps(payload).encode(), {"Content-Type": "application/json", "User-Agent": "reroute-alert"})
        with urllib.request.urlopen(request, timeout=5):  # nosec: the URL is operator configuration
            pass
    except Exception as error:  # a slow or wrong webhook only costs the notification
        log.warning("moderation alert webhook failed: %s", type(error).__name__)


class RideError(ValueError):
    """A ride-board request that should be corrected."""


class RateLimited(RideError):
    def __init__(self, message, wait):
        super().__init__(message)
        self.wait = wait


def _clean(value, field, low, high, content=None):
    if not isinstance(value, str):
        raise RideError(f"Enter {field}.")
    value = " ".join(value.split())
    if not low <= len(value) <= high or any(ord(char) < 32 for char in value):
        raise RideError(f"{field.capitalize()} must be {low}–{high} characters.")
    problem = content.message(value) if content else None
    if problem:
        raise RideError(problem)
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


SCHEMA = """
CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS rides (id TEXT PRIMARY KEY, depart_at TEXT NOT NULL, poster TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'ok', doc TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS reports (ride_id TEXT NOT NULL, reporter TEXT NOT NULL, reason TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', at TEXT NOT NULL, PRIMARY KEY (ride_id, reporter));
CREATE TABLE IF NOT EXISTS blocks (blocker TEXT NOT NULL, poster TEXT NOT NULL, nickname TEXT NOT NULL DEFAULT '', at TEXT NOT NULL, PRIMARY KEY (blocker, poster));
CREATE TABLE IF NOT EXISTS bans (poster TEXT PRIMARY KEY, at TEXT NOT NULL, reason TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS log (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, action TEXT NOT NULL, ride_id TEXT, poster TEXT, detail TEXT NOT NULL DEFAULT '');
"""


class Board:
    def __init__(self, path=None, clock=None, tz=None, content=None):
        """`path` is the old rides.json location (or None for memory only); the database sits next to it as rides.sqlite3."""
        self._path = Path(path) if path else None
        self._clock = clock
        self._tz = tz
        self.content = content or ContentFilter()
        self._lock = threading.RLock()
        self.last_alert = None  # the thread delivering the newest auto-hide webhook (tests join it)
        self._limits = RateLimiter(lambda: self._now().timestamp())
        if self._path:
            self._path.parent.mkdir(parents=True, exist_ok=True)
        self._file = str(self._path.with_suffix(".sqlite3")) if self._path else None
        self._shared = None if self._file else self._connect()  # an in-memory database only lives as long as its connection
        with self._cx() as db:
            if self._file:
                db.execute("PRAGMA journal_mode = WAL")
            db.executescript(SCHEMA)
        self._migrate_json()

    def _connect(self):
        db = sqlite3.connect(self._file or ":memory:", check_same_thread=False, isolation_level=None)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA busy_timeout = 5000")
        return db

    @contextmanager
    def _cx(self):
        """A connection for one operation (closed afterwards, so the file is never held open between requests)."""
        if self._shared:
            yield self._shared
            return
        db = self._connect()
        try:
            yield db
        finally:
            db.close()

    def _now(self):
        return self._clock() if self._clock else datetime.now(self._tz)

    @contextmanager
    def _tx(self):
        """One write transaction, safe across threads and across processes sharing the file."""
        with self._lock, self._cx() as db:
            db.execute("BEGIN IMMEDIATE")
            try:
                yield db
            except BaseException:
                db.execute("ROLLBACK")
                raise
            db.execute("COMMIT")

    def _migrate_json(self):
        """One-time import of the old flat file. The file is left in place as a backup."""
        if not self._path or not self._path.exists():
            return
        with self._tx() as db:
            if db.execute("SELECT 1 FROM meta WHERE k = 'rides_json_imported'").fetchone():
                return
            try:
                old = json.loads(self._path.read_text(encoding="utf-8"))
                for ride in old.values():
                    self._insert(db, ride)
            except (OSError, ValueError, AttributeError, KeyError, TypeError):
                pass  # an unreadable or corrupt file imports nothing (and is not retried)
            db.execute("INSERT INTO meta VALUES ('rides_json_imported', ?)", (self._now().isoformat(),))

    # ── Storage helpers ────────────────────────────────────────────────────

    def poster_id(self, kind, value):
        """A stable pseudonymous id (12 hex characters) for an account, a device or an address. Salted per server, so it reveals nothing elsewhere."""
        with self._tx() as db:
            db.execute("INSERT OR IGNORE INTO meta VALUES ('salt', ?)", (secrets.token_hex(16),))
            row = db.execute("SELECT v FROM meta WHERE k = 'salt'").fetchone()
        return hmac.new(row["v"].encode(), f"{kind}:{value}".encode(), hashlib.sha256).hexdigest()[:12]

    @staticmethod
    def _insert(db, ride):
        db.execute("INSERT OR REPLACE INTO rides VALUES (?, ?, ?, ?, ?)",
                   (ride["id"], ride["depart_at"], ride.get("poster", ""), ride.get("status", "ok"), json.dumps(ride)))

    @staticmethod
    def _ride(row):
        ride = json.loads(row["doc"])
        ride["poster"], ride["status"] = row["poster"], row["status"]
        return ride

    def _all(self, db):
        return {row["id"]: self._ride(row) for row in db.execute("SELECT * FROM rides")}

    def _save(self, db, ride):
        doc = {key: value for key, value in ride.items() if key not in ("poster", "status")}
        db.execute("UPDATE rides SET doc = ?, status = ? WHERE id = ?", (json.dumps(doc), ride["status"], ride["id"]))

    def _expire(self, db):
        now = self._now()
        stale = [row["id"] for row in db.execute("SELECT id, depart_at FROM rides")
                 if datetime.fromisoformat(row["depart_at"]) + EXPIRE_AFTER < now]
        for ride_id in stale:
            db.execute("DELETE FROM rides WHERE id = ?", (ride_id,))
        db.execute("DELETE FROM reports WHERE ride_id NOT IN (SELECT id FROM rides)")
        db.execute("DELETE FROM log WHERE at < ?", ((now - timedelta(days=LOG_DAYS)).isoformat(),))

    def _log(self, db, action, ride=None, poster=None, detail=""):
        db.execute("INSERT INTO log (at, action, ride_id, poster, detail) VALUES (?, ?, ?, ?, ?)",
                   (self._now().isoformat(), action, ride["id"] if ride else None, poster or (ride or {}).get("poster", ""), detail[:600]))

    def _allow(self, bucket, actor):
        if actor is None:
            return
        limit, window = LIMITS[bucket]
        allowed, wait = self._limits.allow(bucket, actor, limit, window)
        if not allowed:
            raise RateLimited(f"You're doing that too often. Try again in about {max(1, wait // 60)} minute(s).", wait)

    def _banned(self, db, actor):
        if actor and db.execute("SELECT 1 FROM bans WHERE poster = ?", (actor,)).fetchone():
            raise RideError("This device or account can't use the ride board. See the Community Guidelines to appeal.")

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
            "poster": ride.get("poster", ""), "under_review": ride.get("status") == "flagged",
        }

    # ── Posts ──────────────────────────────────────────────────────────────

    def create(self, payload, actor=None):
        """`actor` is the poster id of whoever is posting (None skips the rate limit and the rules check, for internal callers)."""
        if not isinstance(payload, dict):
            raise RideError("Send the ride as JSON.")
        if actor is not None and payload.get("rules_ack") is not True:
            raise RideError("Please read and accept the community rules before posting.")
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
        text = self.content
        ride = {
            "id": secrets.token_hex(4),
            "owner_token": secrets.token_urlsafe(16),
            "kind": kind, "seats": seats,
            "nickname": _clean(payload.get("nickname"), "a first name or nickname", 2, 24, text),
            "origin_label": _clean(payload.get("origin_label"), "a starting area", 3, 80, text),
            "destination_label": _clean(payload.get("destination_label"), "a destination", 3, 80, text),
            "origin": _point(payload.get("origin"), "starting"),
            "destination": _point(payload.get("destination"), "destination"),
            "depart_at": depart_at.isoformat(),
            "meet_point": _clean(payload.get("meet_point"), "a public meeting point", 3, 80, text),
            "note": _clean(note, "the note", 0, 140, text) if note else "",
            "trip_cost": cost, "riders": [], "poster": actor or "", "status": "ok",
        }
        with self._tx() as db:
            self._banned(db, actor)
            self._allow("create", actor)
            self._allow("create-day", actor)
            self._expire(db)
            if db.execute("SELECT COUNT(*) FROM rides").fetchone()[0] >= 500:
                raise RideError("The ride board is full. Try again later.")
            self._insert(db, ride)
        return {"ride": self._public(ride, ride["owner_token"]), "token": ride["owner_token"]}

    @staticmethod
    def _blocked(db, blocker):
        if not blocker:
            return set()
        return {row["poster"] for row in db.execute("SELECT poster FROM blocks WHERE blocker = ?", (blocker,))}

    def matches(self, origin, destination, when, tokens=(), blocker=None):
        origin, destination = _point(origin, "starting"), _point(destination, "destination")
        with self._tx() as db:
            self._expire(db)
            blocked = self._blocked(db, blocker)
            found = []
            for ride in self._all(db).values():
                start_gap = metres(origin, ride["origin"])
                end_gap = metres(destination, ride["destination"])
                time_gap = abs(datetime.fromisoformat(ride["depart_at"]) - when)
                member = any(token in (ride["owner_token"], *(rider["token"] for rider in ride["riders"])) for token in tokens)
                visible = ride["status"] != "flagged" and ride["poster"] not in blocked
                if member or (visible and start_gap <= MATCH_START_M and end_gap <= MATCH_END_M and time_gap <= MATCH_WINDOW):
                    public = self._public(ride, next((token for token in tokens if token in (ride["owner_token"], *(r["token"] for r in ride["riders"]))), None))
                    public["start_gap_m"] = round(start_gap)
                    public["end_gap_m"] = round(end_gap)
                    found.append(public)
        found.sort(key=lambda ride: (not ride["is_member"], ride["seats_left"] <= 0, ride["depart_at"]))
        return found

    def mine(self, tokens):
        with self._tx() as db:
            self._expire(db)
            return [self._public(ride, token) for ride in self._all(db).values() for token in tokens
                    if token == ride["owner_token"] or any(token == rider["token"] for rider in ride["riders"])]

    def join(self, ride_id, nickname, actor=None):
        nickname = _clean(nickname, "a first name or nickname", 2, 24, self.content)
        with self._tx() as db:
            self._banned(db, actor)
            self._allow("join", actor)
            self._expire(db)
            row = db.execute("SELECT * FROM rides WHERE id = ?", (ride_id,)).fetchone()
            ride = self._ride(row) if row else None
            if not ride or ride["status"] == "flagged":
                raise RideError("That shared ride has finished or been cancelled.")
            if len(ride["riders"]) >= ride["seats"]:
                raise RideError("That ride is already full.")
            token = secrets.token_urlsafe(16)
            ride["riders"].append({"nickname": nickname, "token": token})
            self._save(db, ride)
            return {"ride": self._public(ride, token), "token": token}

    def leave(self, ride_id, token):
        with self._tx() as db:
            row = db.execute("SELECT * FROM rides WHERE id = ?", (ride_id,)).fetchone()
            if not row:
                return {"ok": True}
            ride = self._ride(row)
            if token == ride["owner_token"]:
                db.execute("DELETE FROM rides WHERE id = ?", (ride_id,))
            else:
                ride["riders"] = [rider for rider in ride["riders"] if rider["token"] != token]
                self._save(db, ride)
        return {"ok": True}

    # ── Safety: reports, blocks and the operator queue ─────────────────────

    def report(self, ride_id, reason, note, reporter):
        """Record one report per reporter per post. Enough distinct reporters hide the post until an operator reviews it."""
        if reason not in REASONS:
            raise RideError("Choose a reason for the report.")
        note = " ".join(str(note or "").split())[:300]
        with self._tx() as db:
            self._allow("report", reporter)
            self._expire(db)
            row = db.execute("SELECT * FROM rides WHERE id = ?", (str(ride_id),)).fetchone()
            if not row:
                raise RideError("That post has already finished or been removed.")
            ride = self._ride(row)
            if reporter and reporter == ride["poster"]:
                raise RideError("That's your own post. Cancel it instead.")
            db.execute("INSERT OR REPLACE INTO reports VALUES (?, ?, ?, ?, ?)", (ride["id"], reporter or "", reason, note, self._now().isoformat()))
            count = db.execute("SELECT COUNT(*) FROM reports WHERE ride_id = ?", (ride["id"],)).fetchone()[0]
            flagged = ride["status"] == "ok" and count >= AUTO_FLAG_REPORTS
            if flagged:
                ride["status"] = "flagged"
                self._save(db, ride)
                self._log(db, "auto-hide", ride, detail=f"{count} reports")
                reasons = dict(db.execute("SELECT reason, COUNT(*) FROM reports WHERE ride_id = ? GROUP BY reason", (ride["id"],)).fetchall())
        if flagged:
            self._alert(ride["id"], count, reasons)
        return {"ok": True, "hidden": flagged}

    def _alert(self, ride_id, count, reasons):
        """Tell the operator a post just hid itself: a WARNING in the log and, if PLANB_ALERT_WEBHOOK is set, a small JSON POST (post id and reasons only)."""
        summary = ", ".join(f"{reason} x{n}" for reason, n in sorted(reasons.items()))
        log.warning("ride board post %s auto-hidden after %d reports (%s); review it at /admin/moderation", ride_id, count, summary)
        url = os.environ.get("PLANB_ALERT_WEBHOOK", "").strip()
        if url:
            text = f"Reroute: ride board post {ride_id} was hidden after {count} reports ({summary}). Review it in the moderation queue (/admin/moderation)."
            # "text" is read by Slack, "content" by Discord; ntfy shows the body as the message.
            payload = {"text": text, "content": text, "post_id": ride_id, "reports": count, "reasons": reasons}
            self.last_alert = threading.Thread(target=deliver_alert, args=(url, payload), daemon=True)
            self.last_alert.start()

    def block(self, blocker, ride_id=None, poster=None, nickname=""):
        """Hide a poster's posts from this blocker (an account when signed in, else a device). Give a ride id, or a poster id seen before."""
        if not blocker:
            raise RideError("Couldn't tell who is blocking.")
        with self._tx() as db:
            self._allow("block", blocker)
            if ride_id is not None:
                row = db.execute("SELECT poster, doc FROM rides WHERE id = ?", (str(ride_id),)).fetchone()
                if not row:
                    raise RideError("That post has already finished or been removed.")
                poster, nickname = row["poster"], json.loads(row["doc"])["nickname"]
            if not isinstance(poster, str) or not POSTER.match(poster):
                raise RideError("That poster can't be blocked.")
            if poster == blocker:
                raise RideError("You can't block yourself.")
            if db.execute("SELECT COUNT(*) FROM blocks WHERE blocker = ?", (blocker,)).fetchone()[0] >= 200:
                raise RideError("Your block list is full.")
            nickname = " ".join(str(nickname or "").split())[:24]
            db.execute("INSERT OR REPLACE INTO blocks VALUES (?, ?, ?, ?)", (blocker, poster, nickname, self._now().isoformat()))
        return {"poster": poster, "nickname": nickname}

    def unblock(self, blocker, poster):
        with self._tx() as db:
            db.execute("DELETE FROM blocks WHERE blocker = ? AND poster = ?", (blocker or "", str(poster)))
        return {"ok": True}

    def blocks(self, blocker):
        with self._cx() as db:
            rows = db.execute("SELECT poster, nickname FROM blocks WHERE blocker = ? ORDER BY at", (blocker or "",)).fetchall()
        return [{"poster": row["poster"], "nickname": row["nickname"]} for row in rows]

    def queue(self):
        """Posts with reports (hidden ones first), the bans and the recent log, for the operator."""
        with self._tx() as db:
            self._expire(db)
            items = []
            for ride in self._all(db).values():
                reports = [dict(row) for row in db.execute("SELECT reporter, reason, note, at FROM reports WHERE ride_id = ? ORDER BY at", (ride["id"],))]
                if reports or ride["status"] == "flagged":
                    items.append({"id": ride["id"], "poster": ride["poster"], "status": ride["status"], "kind": ride["kind"], "nickname": ride["nickname"],
                                  "origin_label": ride["origin_label"], "destination_label": ride["destination_label"], "meet_point": ride["meet_point"],
                                  "note": ride["note"], "depart_at": ride["depart_at"], "reports": [{**r, "reporter": r["reporter"][:6]} for r in reports]})
            items.sort(key=lambda item: (item["status"] != "flagged", -len(item["reports"])))
            return {"items": items, "bans": [dict(row) for row in db.execute("SELECT poster, at, reason FROM bans ORDER BY at DESC")],
                    "log": [dict(row) for row in db.execute("SELECT at, action, ride_id, poster, detail FROM log ORDER BY id DESC LIMIT 50")],
                    "reasons": REASONS}

    def moderate(self, action, ride_id=None, poster=None):
        """approve (keep it up, stop auto-hiding), remove (delete the post), ban (remove the poster's posts and stop new ones) or unban."""
        with self._tx() as db:
            row = db.execute("SELECT * FROM rides WHERE id = ?", (str(ride_id),)).fetchone() if ride_id else None
            ride = self._ride(row) if row else None
            if action not in ("approve", "remove", "ban", "unban"):
                raise RideError("Unknown action.")
            if action in ("approve", "remove") and not ride:
                raise RideError("That post is already gone.")
            if action == "approve":
                ride["status"] = "approved"
                self._save(db, ride)
                db.execute("DELETE FROM reports WHERE ride_id = ?", (ride["id"],))
                self._log(db, "approve", ride)
            elif action == "remove":
                self._log(db, "remove", ride, detail=f"{ride['nickname']}: {ride['meet_point']} / {ride['note']}")
                db.execute("DELETE FROM rides WHERE id = ?", (ride["id"],))
            else:
                poster = poster or (ride or {}).get("poster")
                if not isinstance(poster, str) or not POSTER.match(poster):
                    raise RideError("That post has no poster to ban (it predates posters).")
                if action == "ban":
                    db.execute("INSERT OR REPLACE INTO bans VALUES (?, ?, ?)", (poster, self._now().isoformat(), "operator"))
                    db.execute("DELETE FROM rides WHERE poster = ?", (poster,))
                    self._log(db, "ban", None, poster)
                else:
                    db.execute("DELETE FROM bans WHERE poster = ?", (poster,))
                    self._log(db, "unban", None, poster)
            db.execute("DELETE FROM reports WHERE ride_id NOT IN (SELECT id FROM rides)")
        return {"ok": True}
