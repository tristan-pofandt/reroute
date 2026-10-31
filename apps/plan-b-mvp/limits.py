"""Abuse protection for a public URL: a per-IP hourly limit and a global daily cap on Google-backed requests."""

from collections import deque
from datetime import datetime, timedelta, timezone
import ipaddress
import threading
import time

BRISBANE = timezone(timedelta(hours=10), "AEST")


class RateLimiter:
    """Sliding-window limiter: at most `limit` hits per `window` seconds for each (bucket, client) pair."""

    def __init__(self, clock=time.time):
        self._clock = clock
        self._lock = threading.Lock()
        self._hits = {}

    def allow(self, bucket, client, limit, window=3600):
        """(allowed, seconds until a slot frees). A limit of 0 or less disables the check."""
        if limit <= 0:
            return True, 0
        now = self._clock()
        with self._lock:
            if len(self._hits) > 20000:
                self._hits = {key: hits for key, hits in self._hits.items() if hits and now - hits[-1] < window}
            hits = self._hits.setdefault((bucket, client), deque())
            while hits and now - hits[0] >= window:
                hits.popleft()
            if len(hits) >= limit:
                return False, max(1, int(window - (now - hits[0])) + 1)
            hits.append(now)
            return True, 0


class DailyCap:
    """A counter of billable requests per Brisbane day, shared by every visitor."""

    def __init__(self, cap, clock=time.time):
        self.cap = cap
        self._clock = clock
        self._lock = threading.Lock()
        self._day = None
        self.count = 0

    def _today(self):
        return datetime.fromtimestamp(self._clock(), BRISBANE).date()

    def take(self):
        """Count one request. False once the day's cap has been reached. A cap of 0 or less disables the check."""
        if self.cap <= 0:
            return True
        with self._lock:
            today = self._today()
            if today != self._day:
                self._day, self.count = today, 0
            if self.count >= self.cap:
                return False
            self.count += 1
            return True

    def used(self):
        """Requests counted so far today."""
        with self._lock:
            return self.count if self._day == self._today() else 0


def is_loopback(address):
    try:
        return ipaddress.ip_address(address or "").is_loopback
    except ValueError:
        return False
