// Forward navigator.geolocation to @capacitor/geolocation (native permission prompt + purpose string). The web is untouched.
import { Geolocation } from "@capacitor/geolocation";

const toPos = (p) => ({ coords: { latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy, altitude: p.coords.altitude ?? null, altitudeAccuracy: p.coords.altitudeAccuracy ?? null, heading: p.coords.heading ?? null, speed: p.coords.speed ?? null }, timestamp: p.timestamp });
const err = (e) => ({ code: /denied/i.test(e?.message || "") ? 1 : /unavailable/i.test(e?.message || "") ? 2 : 3, message: e?.message || "Location error", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
const opts = (o = {}) => ({ enableHighAccuracy: !!o.enableHighAccuracy, timeout: o.timeout ?? 10000, maximumAge: o.maximumAge ?? 0 });

export function install() {
  const ids = new Map(); // shim id -> Promise<native watch id>
  const shim = {
    getCurrentPosition: (ok, bad, o) => { Geolocation.getCurrentPosition(opts(o)).then((p) => ok(toPos(p)), (e) => bad?.(err(e))); },
    watchPosition: (ok, bad, o) => {
      const id = ids.size + 1 + Math.floor(Math.random() * 1e6);
      ids.set(id, Geolocation.watchPosition(opts(o), (p, e) => (p ? ok(toPos(p)) : bad?.(err(e)))));
      return id;
    },
    clearWatch: (id) => { ids.get(id)?.then((nid) => Geolocation.clearWatch({ id: nid })); ids.delete(id); },
  };
  Object.defineProperty(navigator, "geolocation", { value: shim, configurable: true });
  // app.js reads navigator.permissions for geolocation (a UI hint); answer from the native permission state.
  const q = navigator.permissions?.query?.bind(navigator.permissions);
  if (q) navigator.permissions.query = (d) => (d?.name !== "geolocation" ? q(d) : Geolocation.checkPermissions().then((s) => ({ state: s.location === "granted" ? "granted" : s.location === "denied" ? "denied" : "prompt", addEventListener() {}, removeEventListener() {} })).catch(() => q(d)));
}
