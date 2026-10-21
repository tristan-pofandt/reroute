"""Demo mode: validated overrides that make a search show a disruption, weather or traffic on demand.

Everything produced here is flagged `simulated: true` and is labelled "Simulated" by the app. Nothing in this module
calls an external service.
"""

from gtfs_rt import delay_status, realtime_object

WEATHER = ("live", "clear", "rain", "storm", "heat")
DISRUPTED = ("none", "train", "bus", "ferry", "tram", "all")
TRAFFIC = ("live", "heavy", "crash")
CATEGORY = {"train": "rail", "bus": "bus", "ferry": "ferry", "tram": "tram"}
MODE_LABEL = {"rail": "train", "bus": "bus", "ferry": "ferry", "tram": "light rail"}


def parse(value, error=ValueError):
    """Validate the `demo` object of a request. Returns None when the request is not in demo mode."""
    if value is None or value is False:
        return None
    if not isinstance(value, dict):
        raise error("Demo settings must be an object.")
    result = {"weather": value.get("weather", "live"), "disrupted": value.get("disrupted", "none"),
              "traffic": value.get("traffic", "live"), "late_min": value.get("late_min", 0)}
    for name, allowed in (("weather", WEATHER), ("disrupted", DISRUPTED), ("traffic", TRAFFIC)):
        if result[name] not in allowed:
            raise error(f"Demo {name} must be one of: {', '.join(allowed)}.")
    late = result["late_min"]
    if isinstance(late, bool) or not isinstance(late, (int, float)) or not 0 <= late <= 30 or int(late) != late:
        raise error("Demo late minutes must be a whole number from 0 to 30.")
    result["late_min"] = int(late)
    return result


def applies(demo, category):
    """True when the demo disrupts lines of this category (bus, rail, tram or ferry)."""
    if not demo or demo["disrupted"] == "none":
        return False
    return demo["disrupted"] == "all" or CATEGORY[demo["disrupted"]] == category


def simulated_alert(line, category, late_min, route_ids=()):
    """A disruptive alert in the same shape as a real Translink one, flagged as simulated."""
    return {"id": f"demo-{line}", "header": f"Simulated disruption on {line}",
            "description": f"Demo mode: this {MODE_LABEL.get(category, 'service')} disruption is not real.",
            "effect": "Significant delays" if late_min else "Reduced service", "cause": "Simulated", "disruptive": True,
            "lines": [line.upper()], "route_ids": list(route_ids), "url": "", "simulated": True}


def apply_realtime(realtime, alert, late_min):
    """The step's realtime object with the simulated alert and any extra minutes of delay added."""
    result = dict(realtime)
    result["alerts"] = list(realtime.get("alerts", [])) + [alert["id"]]
    result["simulated"] = True
    if late_min and result["status"] != "cancelled":
        base = result["delay_min"] if result["status"] == "late" and result["delay_min"] else 0
        status, minutes = delay_status((base + late_min) * 60)
        result.update(realtime_object(status, minutes, result.get("vehicle"), result["alerts"], True))
    return result
