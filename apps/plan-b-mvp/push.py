"""Web Push for the installed PWA: VAPID keys, subscriptions and a background monitor.

A traveller who starts a trip watch in the app subscribes the browser with the watched lines and GTFS route_ids.
A daemon thread checks every minute whether a disruptive Translink alert (or a cancelled trip about to leave) hits
a watched route and sends one push per new problem. Watches expire 30 minutes after the traveller's deadline,
or after 3 hours when there is no deadline. Only the push endpoint, its keys and the watch are stored, in
data/push.json (git-ignored). Nothing here contacts anyone except the push service the browser chose.
"""

import base64
from datetime import datetime, timedelta, timezone
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import threading
import time
from urllib.parse import urlsplit

from gtfs_rt import FeedError, line_keys, train_codes, train_key_matches
import push_native

CHECK_EVERY = 60
WATCH_AFTER_DEADLINE = timedelta(minutes=30)
WATCH_DEFAULT = timedelta(hours=3)
WATCH_MAX = timedelta(hours=24)
MAX_SUBSCRIPTIONS = 5000
SENT_KEEP = 100
DEFAULT_SUBJECT = "mailto:planb-demo@example.invalid"
PLACE_ID = re.compile(r"^[A-Za-z0-9_-]{10,400}$")
BRISBANE = timezone(timedelta(hours=10), "AEST")


class PushError(ValueError):
    """A push request that should be corrected."""

    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


class Gone(Exception):
    """The push service says this subscription no longer exists."""


def _b64(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def generate_keys():
    """A new VAPID key pair as (private, public) base64url strings."""
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import ec
    key = ec.generate_private_key(ec.SECP256R1())
    private = key.private_numbers().private_value.to_bytes(32, "big")
    public = key.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
    return _b64(private), _b64(public)


def default_sender(subscription, payload, private_key, subject):
    from pywebpush import WebPushException, webpush
    try:
        webpush(subscription_info=subscription, data=payload, vapid_private_key=private_key, vapid_claims={"sub": subject}, ttl=600, timeout=10)
    except WebPushException as error:
        if getattr(error.response, "status_code", None) in (404, 410):
            raise Gone() from error
        raise


def _text(value, field, high, low=0):
    if value is None:
        value = ""
    if not isinstance(value, str) or not low <= len(value.strip()) <= high or any(ord(char) < 32 for char in value):
        raise PushError(f"{field.capitalize()} is not valid.")
    return value.strip()


def _list(value, field, count, high):
    if value in (None, ""):
        return []
    if not isinstance(value, list) or len(value) > count:
        raise PushError(f"{field.capitalize()} is not valid.")
    return [_text(item, field, high, 1) for item in value]


def clean_subscription(value):
    if not isinstance(value, dict):
        raise PushError("The browser did not send a push subscription.")
    endpoint = _text(value.get("endpoint"), "endpoint", 900, 12)
    parts = urlsplit(endpoint)
    if parts.scheme != "https" or not parts.netloc:
        raise PushError("The push endpoint must be an https address.")
    keys = value.get("keys") or {}
    if not isinstance(keys, dict):
        raise PushError("The push keys are not valid.")
    return {"endpoint": endpoint, "keys": {"p256dh": _text(keys.get("p256dh"), "p256dh key", 200, 20), "auth": _text(keys.get("auth"), "auth key", 100, 8)}}


def clean_watch(value, now):
    """Validated watch plus its expiry (epoch seconds)."""
    if not isinstance(value, dict):
        raise PushError("Describe the trip to watch.")
    deadline = value.get("deadline")
    expires = now + WATCH_DEFAULT.total_seconds()
    if deadline not in (None, ""):
        try:
            stamp = datetime.fromisoformat(str(deadline))
        except ValueError as error:
            raise PushError("The deadline is not a valid time.") from error
        if stamp.tzinfo is None:
            stamp = stamp.replace(tzinfo=BRISBANE)
        expires = stamp.timestamp() + WATCH_AFTER_DEADLINE.total_seconds()
        if expires <= now:
            raise PushError("That deadline has already passed.")
    expires = min(expires, now + WATCH_MAX.total_seconds())
    place = value.get("destination_place_id")
    if place not in (None, "") and not (isinstance(place, str) and PLACE_ID.match(place)):
        raise PushError("That destination place is not valid.")
    watch = {"label": _text(value.get("label"), "label", 80), "lines": _list(value.get("lines"), "lines", 10, 30),
             "route_ids": _list(value.get("route_ids"), "route ids", 80, 40), "origin": _text(value.get("origin"), "origin", 200),
             "destination": _text(value.get("destination"), "destination", 200), "destination_place_id": place or None,
             "deadline": str(deadline) if deadline else None}
    if not watch["lines"] and not watch["route_ids"]:
        raise PushError("Choose a trip with at least one public transport line to watch.")
    return watch, expires


def alert_matches(alert, watch):
    """True when a disruptive alert touches a watched route (exact route_id first, then line name)."""
    if not alert["disruptive"]:
        return False
    if watch["route_ids"] and set(watch["route_ids"]) & set(alert.get("route_ids", ())):
        return True
    keys, codes = set(), set()
    for name in watch["lines"]:
        keys |= line_keys(name)
        codes |= train_codes(name)
    return bool(keys & set(alert["lines"])) or any(train_key_matches(line, codes) for line in alert["lines"])


def _start(trip):
    """Local departure of a trip update from its start_date and start_time, or None."""
    try:
        day = datetime.strptime(trip["start_date"], "%Y%m%d").replace(tzinfo=BRISBANE)
        hours, minutes, seconds = (int(part) for part in trip["start_time"].split(":"))
    except (ValueError, KeyError):
        return None
    return day + timedelta(hours=hours, minutes=minutes, seconds=seconds)


class Push:
    def __init__(self, directory, monitor, sender=None, clock=time.time, env=None, native=None):
        env = os.environ if env is None else env
        self.native = native or push_native.FcmSender.from_env(env)
        self.directory = Path(directory)
        self.monitor = monitor
        self._sender = sender or default_sender
        self._clock = clock
        self.subject = env.get("VAPID_SUBJECT") or DEFAULT_SUBJECT
        self._lock = threading.RLock()
        self._thread = None
        self.available = sender is not None or importlib.util.find_spec("pywebpush") is not None
        self.private_key = self.public_key = None
        self._load_keys(env)
        self._subscriptions = self._read()

    # ── Keys and storage ────────────────────────────────────────────────────

    def _load_keys(self, env):
        private, public = env.get("VAPID_PRIVATE_KEY", "").strip(), env.get("VAPID_PUBLIC_KEY", "").strip()
        if private and public:
            self.private_key, self.public_key = private, public
            return
        path = self.directory / "vapid.json"
        try:
            stored = json.loads(path.read_text(encoding="utf-8"))
            self.private_key, self.public_key = stored["private"], stored["public"]
            return
        except (OSError, ValueError, KeyError):
            pass
        try:
            private, public = generate_keys()
            self.directory.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps({"private": private, "public": public}), encoding="utf-8")
            self.private_key, self.public_key = private, public
        except (ImportError, OSError):
            self.private_key = self.public_key = None

    def ready(self):
        return bool(self.available and self.private_key and self.public_key)

    def native_ready(self):
        return self.native is not None

    def _read(self):
        try:
            return json.loads((self.directory / "push.json").read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return {}

    def _write(self):
        try:
            self.directory.mkdir(parents=True, exist_ok=True)
            temporary = self.directory / "push.json.tmp"
            temporary.write_text(json.dumps(self._subscriptions), encoding="utf-8")
            temporary.replace(self.directory / "push.json")
        except OSError:
            pass

    @staticmethod
    def identifier(endpoint):
        return hashlib.sha256(endpoint.encode("utf-8")).hexdigest()[:16]

    # ── Requests ────────────────────────────────────────────────────────────

    def subscribe(self, subscription, watch):
        if not self.ready():
            raise PushError("Push notifications are not available on this server.", 503)
        now = self._clock()
        subscription = clean_subscription(subscription)
        watch, expires = clean_watch(watch, now)
        identifier = self.identifier(subscription["endpoint"])
        with self._lock:
            if identifier not in self._subscriptions and len(self._subscriptions) >= MAX_SUBSCRIPTIONS:
                raise PushError("Too many people are watching trips right now. Try again later.", 503)
            self._subscriptions[identifier] = {"subscription": subscription, "watch": watch, "expires": expires, "created": now, "sent": []}
            self._write()
        return identifier

    def register_native(self, body, user_id=None):
        """Store (or refresh) an FCM token with the same watch Web Push uses; the watch is optional until a trip is chosen."""
        if not self.native_ready():
            raise PushError("Native push notifications are not set up on this server.", 503)
        token, platform = body.get("token"), body.get("platform")
        if not isinstance(token, str) or not push_native.TOKEN.match(token):
            raise PushError("The push token is not valid.")
        if platform not in ("ios", "android"):
            raise PushError("Platform must be ios or android.")
        version, locale = body.get("app_version") or "", body.get("locale") or ""
        if not isinstance(version, str) or (version and not push_native.VERSION.match(version)) or not isinstance(locale, str) or (locale and not push_native.LOCALE.match(locale)):
            raise PushError("The app version or locale is not valid.")
        now = self._clock()
        if body.get("watch") is None:
            watch, expires = {"label": "", "lines": [], "route_ids": [], "origin": "", "destination": "", "destination_place_id": None, "deadline": None}, now + WATCH_DEFAULT.total_seconds()
        else:
            watch, expires = clean_watch(body["watch"], now)
        identifier = "n" + self.identifier(token)
        with self._lock:
            old = self._subscriptions.get(identifier)
            if not old and len(self._subscriptions) >= MAX_SUBSCRIPTIONS:
                raise PushError("Too many people are watching trips right now. Try again later.", 503)
            self._subscriptions[identifier] = {"native": {"token": token, "platform": platform, "app_version": version, "locale": locale}, "user": user_id, "watch": watch,
                                               "expires": expires, "created": now, "sent": old["sent"] if old else []}
            self._write()
        return identifier

    def unregister_native(self, token):
        if not isinstance(token, str):
            raise PushError("Send the push token to stop alerts.")
        with self._lock:
            removed = self._subscriptions.pop("n" + self.identifier(token), None)
            if removed:
                self._write()
        return bool(removed)

    def forget_user(self, user_id):
        """Account deletion: drop every token tied to the account."""
        with self._lock:
            gone = [i for i, entry in self._subscriptions.items() if user_id and entry.get("user") == user_id]
            for identifier in gone:
                del self._subscriptions[identifier]
            if gone:
                self._write()
        return len(gone)

    def unsubscribe(self, endpoint):
        if not isinstance(endpoint, str):
            raise PushError("Send the push endpoint to stop watching.")
        with self._lock:
            removed = self._subscriptions.pop(self.identifier(endpoint), None)
            if removed:
                self._write()
        return bool(removed)

    def test(self, endpoint, delay_s):
        """Send a clearly simulated disruption push after `delay_s` seconds (0 to 60)."""
        if not self.ready():
            raise PushError("Push notifications are not available on this server.", 503)
        try:
            delay_s = float(delay_s)
        except (TypeError, ValueError) as error:
            raise PushError("Delay must be a number of seconds from 0 to 60.") from error
        if not 0 <= delay_s <= 60:
            raise PushError("Delay must be a number of seconds from 0 to 60.")
        identifier = self.identifier(endpoint) if isinstance(endpoint, str) else None
        with self._lock:
            entry = self._subscriptions.get(identifier)
            if not entry and identifier:  # the native app passes its FCM token as the endpoint
                identifier = "n" + identifier
                entry = self._subscriptions.get(identifier)
        if not entry:
            raise PushError("Turn on notifications for a trip first.", 404)
        label = entry["watch"]["label"] or (entry["watch"]["lines"] or ["your trip"])[0]
        payload = {"title": f"Simulated disruption on {label}", "body": "This is a test of Reroute notifications. Tap to see your alternatives.",
                   "url": f"/?alternatives={identifier}", "tag": "planb-test", "simulated": True}
        if delay_s == 0:
            self._send(identifier, entry, payload)
        else:
            timer = threading.Timer(delay_s, self._send, (identifier, entry, payload))
            timer.daemon = True
            timer.start()
        return {"sent_in_s": delay_s}

    # ── Sending and monitoring ──────────────────────────────────────────────

    def _send(self, identifier, entry, payload):
        try:
            if entry.get("native"):
                self.native.send(entry["native"]["token"], payload)
            else:
                self._sender(entry["subscription"], json.dumps(payload), self.private_key, self.subject)
            return True
        except (Gone, push_native.Gone):
            with self._lock:
                self._subscriptions.pop(identifier, None)
                self._write()
        except Exception:  # a failing push service must never stop the monitor
            pass
        return False

    def check_once(self):
        """One monitoring pass. Returns the number of pushes sent."""
        now = self._clock()
        with self._lock:
            expired = [i for i, entry in self._subscriptions.items() if entry["expires"] <= now]
            for identifier in expired:
                del self._subscriptions[identifier]
            if expired:
                self._write()
            active = list(self._subscriptions.items())
        if not active:
            return 0
        try:
            alerts = self.monitor.alerts()["alerts"]
        except FeedError:
            alerts = []
        try:
            trips = self.monitor.trip_updates()
        except (FeedError, AttributeError):
            trips = []
        sent = 0
        for identifier, entry in active:
            watch = entry["watch"]
            name = watch["label"] or (watch["lines"] or ["your trip"])[0]
            problems = []
            for alert in alerts:
                if alert_matches(alert, watch):
                    problems.append((alert["id"], {"title": f"Disruption on {name}", "body": f"{alert['header']} ({alert['effect']}). Tap to see your alternatives.",
                                                   "tag": f"planb-{alert['id']}"}))
            routes = set(watch["route_ids"])
            if routes:
                for trip in trips:
                    start = _start(trip)
                    if trip["cancelled"] and trip["route_id"] in routes and start and -300 <= start.timestamp() - now <= 2700:
                        problems.append((f"cancel:{trip['trip_id']}", {"title": f"Service cancelled on {name}", "tag": f"planb-cancel-{trip['trip_id']}",
                                                                      "body": f"A service due at {start.hour % 12 or 12}:{start.minute:02d} {'am' if start.hour < 12 else 'pm'} is cancelled. Tap to see your alternatives."}))
            fresh = [(key, payload) for key, payload in problems if key not in entry["sent"]]
            for key, payload in fresh:
                payload.update({"url": f"/?alternatives={identifier}", "simulated": False})
                if self._send(identifier, entry, payload):
                    entry["sent"] = (entry["sent"] + [key])[-SENT_KEEP:]
                    sent += 1
        with self._lock:
            self._write()
        return sent

    def start(self):
        """Start the one-minute monitor thread (once per process)."""
        with self._lock:
            if self._thread or not (self.ready() or self.native_ready()):
                return
            self._thread = threading.Thread(target=self._run, name="push-monitor", daemon=True)
            self._thread.start()

    def _run(self):
        while True:
            time.sleep(CHECK_EVERY)
            try:
                self.check_once()
            except Exception:
                pass
