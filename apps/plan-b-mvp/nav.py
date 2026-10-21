"""Turn Google Routes steps into the turn-by-turn `nav` list used by live in-app directions."""

from google_api import decode_polyline


def _point(step, name, fallback):
    lat_lng = ((step.get(name) or {}).get("latLng")) or {}
    if "latitude" in lat_lng and "longitude" in lat_lng:
        return [lat_lng["latitude"], lat_lng["longitude"]]
    return fallback


def _whole_seconds(value):
    try:
        return round(float(str(value).rstrip("s")))
    except ValueError:
        return None


def nav_step(step, mode, instruction=None):
    """One nav item. `mode` is walk, transit or drive. Polyline, start and end come from the step itself."""
    encoded = (step.get("polyline") or {}).get("encodedPolyline")
    points = decode_polyline(encoded) if encoded else []
    guidance = step.get("navigationInstruction") or {}
    maneuver = guidance.get("maneuver")
    return {
        "mode": mode,
        "instruction": instruction or " ".join((guidance.get("instructions") or "").split()) or {"walk": "Walk", "drive": "Continue"}.get(mode, "Continue"),
        "maneuver": None if maneuver in (None, "MANEUVER_UNSPECIFIED") else maneuver,
        "distance_m": int(step.get("distanceMeters") or 0),
        "duration_s": _whole_seconds(step["staticDuration"]) if step.get("staticDuration") else None,
        "start": _point(step, "startLocation", points[0] if points else None),
        "end": _point(step, "endLocation", points[-1] if points else None),
        "polyline": points,
        "transit": None,
    }
