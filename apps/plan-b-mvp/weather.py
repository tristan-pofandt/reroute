"""Open-Meteo forecasts (no key) and the "bad weather" rules used for walking warnings.

A forecast (with the next hour's rain in 15-minute steps for the radar) is cached for ten minutes per roughly 1 km cell. Every failure returns None so the app keeps working
without weather. Demo mode can replace the forecast with a clearly flagged simulated one.
"""

from datetime import datetime, timedelta, timezone
import json
import threading
import time
from urllib.error import URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen

from mycelium_emitter import timed

URL = "https://api.open-meteo.com/v1/forecast"
CACHE_SECONDS = 600
BRISBANE = timezone(timedelta(hours=10), "AEST")
HOURLY = "temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,is_day"
CURRENT = "temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,is_day,relative_humidity_2m,wind_direction_10m"
DAILY = ("weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,"
         "wind_gusts_10m_max,wind_direction_10m_dominant,uv_index_max,sunrise,sunset")
# The next hour's predicted rain for the radar, in 15-minute steps. Open-Meteo's 15-minute data is native only in Central Europe and North
# America; for Australia it is interpolated from hourly model data. It is a model forecast, not radar.
MINUTELY = "precipitation,precipitation_probability"
MINUTELY_STEPS = 8  # two hours of 15-minute steps, so the next hour is still covered while a cached answer ages for 10 minutes
NEXT_HOUR_STEPS = 4
WET_MM = 0.1  # the smallest amount Open-Meteo reports for 15 minutes
COMPASS = ("N", "NE", "E", "SE", "S", "SW", "W", "NW")

LABELS = {0: "Clear sky", 1: "Mostly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Freezing fog",
          51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle", 56: "Freezing drizzle", 57: "Freezing drizzle",
          61: "Light rain", 63: "Rain", 65: "Heavy rain", 66: "Freezing rain", 67: "Heavy freezing rain",
          71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow grains", 80: "Light showers", 81: "Showers",
          82: "Heavy showers", 85: "Snow showers", 86: "Heavy snow showers", 95: "Thunderstorm",
          96: "Thunderstorm with hail", 99: "Severe thunderstorm with hail"}
THUNDER = {95, 96, 97, 98, 99}
HEAVY_RAIN = {65, 67, 75, 82, 86}
POP_LIMIT, RAIN_LIMIT_MM, HEAT_LIMIT_C, GUST_LIMIT_KMH = 50, 0.5, 35, 50
SIMULATED = {
    "clear": {"code": 0, "temp": 24.0, "apparent": 25.0, "prob": 0, "mm": 0.0, "wind": 9.0, "gust": 18.0},
    "rain": {"code": 65, "temp": 19.0, "apparent": 18.0, "prob": 90, "mm": 4.5, "wind": 20.0, "gust": 38.0},
    "storm": {"code": 95, "temp": 22.0, "apparent": 23.0, "prob": 95, "mm": 9.0, "wind": 35.0, "gust": 75.0},
    "heat": {"code": 0, "temp": 37.0, "apparent": 41.0, "prob": 0, "mm": 0.0, "wind": 8.0, "gust": 20.0},
}


def icon_for(code, is_day=True, apparent=None, gust=None):
    """One of sun, moon, cloud-sun, cloud, fog, drizzle, rain, storm, snow, wind, heat."""
    if code in THUNDER:
        return "storm"
    if code in (71, 73, 75, 77, 85, 86):
        return "snow"
    if code in (61, 63, 65, 66, 67, 80, 81, 82):
        return "rain"
    if code in (51, 53, 55, 56, 57):
        return "drizzle"
    if code in (45, 48):
        return "fog"
    if apparent is not None and apparent >= HEAT_LIMIT_C:
        return "heat"
    if gust is not None and gust >= GUST_LIMIT_KMH:
        return "wind"
    if code == 3:
        return "cloud"
    if code in (1, 2):
        return "cloud-sun" if is_day else "cloud"
    return "sun" if is_day else "moon"


def assess(code, prob, mm, apparent, gust):
    """(bad, kind, short phrase) for the departure hour. Kinds: storm, rain, heat, wind."""
    if code in THUNDER:
        return True, "storm", "Thunderstorms forecast"
    if (prob is not None and prob >= POP_LIMIT) or (mm is not None and mm >= RAIN_LIMIT_MM) or code in HEAVY_RAIN:
        if code in HEAVY_RAIN:
            return True, "rain", "Heavy rain forecast"
        chance = f" ({round(prob)}% chance)" if prob is not None else ""
        return True, "rain", f"Rain likely{chance}"
    if apparent is not None and apparent >= HEAT_LIMIT_C:
        return True, "heat", f"Hot, feels like {round(apparent)} degrees"
    if gust is not None and gust >= GUST_LIMIT_KMH:
        return True, "wind", f"Strong wind, gusts up to {round(gust)} km/h"
    return False, None, None


def walking_warning(kind, phrase, walking_minutes):
    """The warning shown on a route option, or None when there is little walking or the weather is fine."""
    if not kind or not walking_minutes or walking_minutes < 5:
        return None
    return f"{phrase}: about {walking_minutes} min of this route is walking outside."


def _hour(stamp):
    return datetime.fromisoformat(stamp).replace(tzinfo=BRISBANE)


def _slot(raw, index):
    hourly = raw["hourly"]

    def value(name):
        series = hourly.get(name) or []
        return series[index] if index < len(series) else None

    return {"time": hourly["time"][index], "temp_c": value("temperature_2m"), "apparent_c": value("apparent_temperature"),
            "precip_prob": value("precipitation_probability"), "precip_mm": value("precipitation"), "code": value("weather_code"),
            "wind_kmh": value("wind_speed_10m"), "gust_kmh": value("wind_gusts_10m"), "is_day": bool(value("is_day"))}


def build(raw, at=None, now=None):
    """Turn an Open-Meteo response into the app's weather object for time `at` (default now). None if `at` is outside the forecast."""
    now = now or datetime.now(BRISBANE)
    at = at or now
    times = (raw.get("hourly") or {}).get("time") or []
    if not times:
        return None
    first = _hour(times[0])
    index = int((at - first).total_seconds() // 3600)
    if not 0 <= index < len(times):
        return None
    slot = _slot(raw, index)
    live = abs((at - now).total_seconds()) <= 1800 and raw.get("current")
    if live:
        cur = raw["current"]
        current = {"temp_c": cur.get("temperature_2m"), "apparent_c": cur.get("apparent_temperature"), "code": cur.get("weather_code"),
                   "wind_kmh": cur.get("wind_speed_10m"), "gust_kmh": cur.get("wind_gusts_10m"), "precip_mm": cur.get("precipitation"),
                   "is_day": bool(cur.get("is_day", 1))}
    else:
        current = {"temp_c": slot["temp_c"], "apparent_c": slot["apparent_c"], "code": slot["code"], "wind_kmh": slot["wind_kmh"],
                   "gust_kmh": slot["gust_kmh"], "precip_mm": slot["precip_mm"], "is_day": slot["is_day"]}
    code = current["code"] if current["code"] is not None else 0
    current["code"] = code
    current["label"] = LABELS.get(code, "Unknown")
    current["icon"] = icon_for(code, current["is_day"], current["apparent_c"], current["gust_kmh"])
    hours = []
    for position in range(index, min(index + 6, len(times))):
        item = _slot(raw, position)
        hours.append({"time": _hour(item["time"]).isoformat(), "temp_c": item["temp_c"], "precip_prob": item["precip_prob"],
                      "code": item["code"] if item["code"] is not None else 0,
                      "icon": icon_for(item["code"] if item["code"] is not None else 0, item["is_day"], item["apparent_c"], item["gust_kmh"])})
    bad, kind, phrase = assess(slot["code"], slot["precip_prob"], slot["precip_mm"], slot["apparent_c"], slot["gust_kmh"])
    return {"current": current, "hours": hours, "bad": bad, "warning": phrase, "kind": kind, "simulated": False,
            "source": "Open-Meteo", "fetched_at": now.isoformat()}


def simulate(kind, at=None, now=None):
    """A flagged, invented forecast for demo mode (clear, rain, storm or heat)."""
    preset = SIMULATED[kind]
    now = now or datetime.now(BRISBANE)
    start = (at or now).replace(minute=0, second=0, microsecond=0)
    code = preset["code"]
    current = {"temp_c": preset["temp"], "apparent_c": preset["apparent"], "code": code, "label": LABELS[code],
               "icon": icon_for(code, True, preset["apparent"], preset["gust"]), "wind_kmh": preset["wind"], "gust_kmh": preset["gust"],
               "precip_mm": preset["mm"], "is_day": True}
    hours = [{"time": (start + timedelta(hours=offset)).isoformat(), "temp_c": preset["temp"], "precip_prob": preset["prob"],
              "code": code, "icon": current["icon"]} for offset in range(6)]
    bad, weather_kind, phrase = assess(code, preset["prob"], preset["mm"], preset["apparent"], preset["gust"])
    return {"current": current, "hours": hours, "bad": bad, "warning": phrase, "kind": weather_kind, "simulated": True,
            "source": "Simulated", "fetched_at": now.isoformat()}


def compass(degrees):
    """Eight-point compass name for a wind direction in degrees (the direction the wind comes from)."""
    if degrees is None:
        return None
    return COMPASS[round((degrees % 360) / 45) % 8]


def _series_value(series, index):
    return series[index] if series and index < len(series) else None


def next_hour(raw, now=None):
    """The next hour's predicted rain (a model forecast, not radar): up to four 15-minute steps, each the rain in the 15 minutes up to its
    end time, from Open-Meteo's minutely_15 data. Without that data it falls back to the next hourly step. None when neither is present."""
    now = now or datetime.now(BRISBANE)
    minutely = raw.get("minutely_15") or {}
    steps, minutes = [], 15
    for index, stamp in enumerate(minutely.get("time") or []):
        end = _hour(stamp)
        mm = _series_value(minutely.get("precipitation"), index)
        if end <= now or mm is None:
            continue
        steps.append({"start": (end - timedelta(minutes=15)).isoformat(), "end": end.isoformat(), "precip_mm": mm,
                      "precip_prob": _series_value(minutely.get("precipitation_probability"), index)})
        if len(steps) == NEXT_HOUR_STEPS:
            break
    if not steps:
        hourly, minutes = raw.get("hourly") or {}, 60
        for index, stamp in enumerate(hourly.get("time") or []):
            end = _hour(stamp)
            mm = _series_value(hourly.get("precipitation"), index)
            if end > now and mm is not None:
                steps = [{"start": (end - timedelta(hours=1)).isoformat(), "end": end.isoformat(), "precip_mm": mm,
                          "precip_prob": _series_value(hourly.get("precipitation_probability"), index)}]
                break
    if not steps:
        return None
    chances = [step["precip_prob"] for step in steps if step["precip_prob"] is not None]
    wet = next((step for step in steps if step["precip_mm"] >= WET_MM), None)
    return {"steps": steps, "step_minutes": minutes, "total_mm": round(sum(step["precip_mm"] for step in steps), 1),
            "max_prob": max(chances) if chances else None, "rain_from": wet["start"] if wet else None,
            "interpolated": True, "source": "Open-Meteo model forecast"}


def detail(raw, now=None):
    """The weather page: the home widget's object plus humidity, wind direction, the next 24 hours, up to 7 days and the next hour's rain."""
    now = now or datetime.now(BRISBANE)
    base = build(raw, None, now)
    if base is None:
        return None
    times = raw["hourly"]["time"]
    index = int((now - _hour(times[0])).total_seconds() // 3600)
    hourly = []
    for position in range(max(0, index), min(index + 24, len(times))):
        item = _slot(raw, position)
        code = item["code"] if item["code"] is not None else 0
        hourly.append({"time": _hour(item["time"]).isoformat(), "temp_c": item["temp_c"], "precip_prob": item["precip_prob"], "precip_mm": item["precip_mm"],
                       "wind_kmh": item["wind_kmh"], "gust_kmh": item["gust_kmh"], "code": code,
                       "icon": icon_for(code, item["is_day"], item["apparent_c"], item["gust_kmh"])})
    daily = raw.get("daily") or {}

    def day_value(name, position):
        series = daily.get(name) or []
        return series[position] if position < len(series) else None

    days = []
    for position, date in enumerate((daily.get("time") or [])[:7]):
        code = day_value("weather_code", position)
        code = code if code is not None else 0
        direction = day_value("wind_direction_10m_dominant", position)
        days.append({"date": date, "code": code, "label": LABELS.get(code, "Unknown"), "icon": icon_for(code, True, None, day_value("wind_gusts_10m_max", position)),
                     "max_c": day_value("temperature_2m_max", position), "min_c": day_value("temperature_2m_min", position),
                     "precip_mm": day_value("precipitation_sum", position), "precip_prob": day_value("precipitation_probability_max", position),
                     "wind_kmh": day_value("wind_speed_10m_max", position), "gust_kmh": day_value("wind_gusts_10m_max", position),
                     "wind_dir": direction, "wind_from": compass(direction), "uv": day_value("uv_index_max", position),
                     "sunrise": day_value("sunrise", position), "sunset": day_value("sunset", position)})
    current = dict(base["current"])
    cur = raw.get("current") or {}
    current["humidity"] = cur.get("relative_humidity_2m")
    current["wind_dir"] = cur.get("wind_direction_10m")
    current["wind_from"] = compass(cur.get("wind_direction_10m"))
    return {**base, "current": current, "hourly": hourly, "days": days, "next_hour": next_hour(raw, now)}


def simulate_detail(kind, now=None):
    """The weather page for demo mode: the simulated forecast held for 24 hours and 7 days, flagged as simulated."""
    now = now or datetime.now(BRISBANE)
    base = simulate(kind, None, now)
    preset = SIMULATED[kind]
    start = now.replace(minute=0, second=0, microsecond=0)
    icon = base["current"]["icon"]
    hourly = [{"time": (start + timedelta(hours=offset)).isoformat(), "temp_c": preset["temp"], "precip_prob": preset["prob"], "precip_mm": preset["mm"],
               "wind_kmh": preset["wind"], "gust_kmh": preset["gust"], "code": preset["code"], "icon": icon} for offset in range(24)]
    days = [{"date": (start + timedelta(days=offset)).date().isoformat(), "code": preset["code"], "label": LABELS[preset["code"]], "icon": icon,
             "max_c": preset["temp"] + 2, "min_c": preset["temp"] - 6, "precip_mm": round(preset["mm"] * 6, 1), "precip_prob": preset["prob"],
             "wind_kmh": preset["wind"], "gust_kmh": preset["gust"], "wind_dir": 135, "wind_from": "SE", "uv": 8, "sunrise": None, "sunset": None}
            for offset in range(7)]
    current = {**base["current"], "humidity": 85 if preset["prob"] >= 50 else 50, "wind_dir": 135, "wind_from": "SE"}
    quarter = now.replace(minute=now.minute - now.minute % 15, second=0, microsecond=0)
    steps = [{"start": (quarter + timedelta(minutes=15 * offset)).isoformat(), "end": (quarter + timedelta(minutes=15 * (offset + 1))).isoformat(),
              "precip_mm": round(preset["mm"] / 4, 1), "precip_prob": preset["prob"]} for offset in range(NEXT_HOUR_STEPS)]
    soon = {"steps": steps, "step_minutes": 15, "total_mm": round(sum(step["precip_mm"] for step in steps), 1), "max_prob": preset["prob"],
            "rain_from": steps[0]["start"] if steps[0]["precip_mm"] >= WET_MM else None, "interpolated": False, "source": "Simulated"}
    return {**base, "current": current, "hourly": hourly, "days": days, "next_hour": soon}


def public(weather):
    """The weather object without internal fields."""
    if weather is None:
        return None
    return {key: value for key, value in weather.items() if key != "kind"}


class Weather:
    """Cached Open-Meteo lookups. `fetch(url)` is injectable so tests never touch the network."""

    def __init__(self, fetch=None, clock=time.time):
        self._fetch = fetch or self._download
        self._clock = clock
        self._lock = threading.Lock()
        self._cache = {}

    @staticmethod
    def _download(url):
        request = Request(url, headers={"User-Agent": "Reroute-student-MVP"})
        with timed("external", "file:apps/plan-b-mvp/weather.py", "external:" + str(urlsplit(url).hostname)), urlopen(request, timeout=10) as response:
            return json.load(response)

    def raw(self, lat, lng, force=False):
        key = (round(lat, 2), round(lng, 2))
        with self._lock:
            hit = self._cache.get(key)
            if hit and not force and self._clock() - hit[0] < CACHE_SECONDS:
                return hit[1]
        query = urlencode({"latitude": f"{lat:.3f}", "longitude": f"{lng:.3f}", "current": CURRENT, "hourly": HOURLY, "daily": DAILY,
                           "minutely_15": MINUTELY, "forecast_minutely_15": MINUTELY_STEPS, "forecast_days": 7, "timezone": "Australia/Brisbane",
                           "wind_speed_unit": "kmh"})
        try:
            data = self._fetch(f"{URL}?{query}")
        except (URLError, TimeoutError, OSError, ValueError):
            return None
        if not isinstance(data, dict) or not (data.get("hourly") or {}).get("time"):
            return None
        with self._lock:
            self._cache[key] = (self._clock(), data)
        return data

    def forecast(self, lat, lng, at=None, now=None, force=False):
        """The weather object for a place at time `at`, or None when Open-Meteo is unavailable."""
        data = self.raw(lat, lng, force)
        if not data:
            return None
        try:
            return build(data, at, now)
        except (KeyError, ValueError, TypeError, IndexError):
            return None

    def details(self, lat, lng, now=None):
        """The weather page object (24 hours and the week ahead), or None when Open-Meteo is unavailable."""
        data = self.raw(lat, lng)
        if not data:
            return None
        try:
            return detail(data, now)
        except (KeyError, ValueError, TypeError, IndexError):
            return None
