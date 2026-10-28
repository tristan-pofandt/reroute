"""Per-day counters of billable Google requests with a cost estimate, for the admin-only /admin/usage. No user identifiers."""

from datetime import datetime
import threading
import time

from limits import BRISBANE

KEEP_DAYS = 31
_lock = threading.Lock()
_days = {}  # "YYYY-MM-DD" (Brisbane) -> {(api, sku): count}; in memory only (shortcut: lost on restart, persist if the pilot needs history)


def count(api, sku, clock=time.time):
    day = datetime.fromtimestamp(clock(), BRISBANE).date().isoformat()
    with _lock:
        today = _days.setdefault(day, {})
        today[(api, sku)] = today.get((api, sku), 0) + 1
        for old in sorted(_days)[:-KEEP_DAYS]:
            del _days[old]


def summary(prices, note=""):
    """prices: {(api, sku): usd per 1000}. Unknown SKUs are counted but costed at 0."""
    with _lock:
        snap = {day: dict(items) for day, items in _days.items()}
    days = {}
    for day, items in sorted(snap.items()):
        rows = [{"api": a, "sku": s, "count": n, "usd": round(n * prices.get((a, s), 0) / 1000, 5)} for (a, s), n in sorted(items.items())]
        days[day] = {"requests": sum(r["count"] for r in rows), "usd": round(sum(r["usd"] for r in rows), 5), "items": rows}
    return {"days": days, "total_usd": round(sum(d["usd"] for d in days.values()), 5), "note": note}


def reset():
    with _lock:
        _days.clear()
