// The only place that knows where Reroute keeps its data: an adapter over the legacy localStorage keys (app.js is not changed).
//   settings  planb.settings, without saved_places     places  planb.settings.saved_places     trips  planb.trips
// A key whose value is missing on this device reads as undefined, so it is never uploaded as empty.
const SETTINGS = "planb.settings", TRIPS = "planb.trips";

function load(name) {
  try { const raw = localStorage.getItem(name); return raw === null ? undefined : JSON.parse(raw); } catch { return undefined; }
}

export const KEYS = ["settings", "places", "trips"];

export function readLocal() {
  const settings = load(SETTINGS);
  const { saved_places: places, ...rest } = settings && typeof settings === "object" ? settings : {};
  return { settings: settings === undefined ? undefined : rest, places, trips: load(TRIPS) };
}

export function writeLocal(key, value) {
  try {
    if (key === "trips") localStorage.setItem(TRIPS, JSON.stringify(value));
    else {
      const now = load(SETTINGS) || {};
      localStorage.setItem(SETTINGS, JSON.stringify(key === "places" ? { ...now, saved_places: value } : { ...value, ...(now.saved_places ? { saved_places: now.saved_places } : {}) }));
    }
    return true;
  } catch { return false; }
}

export const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
