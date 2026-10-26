// Reroute offline area pack. Stores one downloaded area on this device and uses it without internet:
// storage (IndexedDB), the download from the Reroute server, a canvas map with the same small subset of the Google Maps JavaScript API
// that app.js uses (app.js points its map code at RerouteOffline.maps while offline), place search, and offline routing: walking, cycling
// and driving on the OpenStreetMap network with A*, and scheduled Translink services with a RAPTOR-style search (up to one change).
// Map data © OpenStreetMap contributors (ODbL 1.0); timetables from Translink (CC BY 4.0). No Google Maps content is stored or drawn here.
// Plain script, no build step and no dependencies. The only network requests are the two /api/offline/* downloads.
(() => {
"use strict";

// ── Constants (keep the travel figures in step with live_routes.py) ──────────

const DB_NAME = "reroute-offline", DB_STORE = "packs", DB_KEY = "current";
const BNE_OFFSET_MS = 10 * 3600000; // Brisbane is UTC+10 all year (no daylight saving)
const LIMITS = Object.freeze({ max_side_km: 8, max_area_km2: 40, min_side_km: 0.5, max_days: 7, default_days: 3, region: Object.freeze([-28.4, 151.9, -26.0, 153.6]) });
const F = { ONEWAY: 1, ONEWAY_BACK: 2, WALK: 4, CYCLE: 8, DRIVE: 16, BRIDGE: 32, TUNNEL: 64, ROUNDABOUT: 128 };
const WALK_KMH = 4.8, WALK_MPS = WALK_KMH / 3.6, CYCLE_REF_KMH = 15;
const CYCLE_MODES = ["scooter", "ebike", "bicycle"];
const CYCLE_PROFILES = { scooter: ["E-scooter", 15], ebike: ["E-bike", 20], bicycle: ["Push bike", 15] };
const PUSH_BIKE_MAX_KM = 5, WALK_OPTION_MAX_KM = 5;
const HIRE_DEFAULTS = { scooter: [1, 0.45], ebike: [1, 0.45] }, HIRE_PROVIDERS = "Lime or Neuron";
const FUEL_CO2_PER_L = { DIESEL: 2.68, LPG: 1.51 }, PETROL_CO2_PER_L = 2.31;
const DEFAULT_FACTORS = { bus: 0.105, rail: 0.035, tram: 0.029, ferry: 0.019 };
const UNCHECKED_MODES = ["rideshare", ...CYCLE_MODES]; // never the panic-mode pick (no price or availability check)
const DRIVE_KMH = { motorway: 80, trunk: 70, primary: 55, secondary: 50, tertiary: 45, residential: 35, living: 15, service: 15, track: 15, pedestrian: 10 };
const PATHS = new Set(["footway", "cycleway", "path", "steps", "track", "pedestrian"]);
const NOTICE = "Offline estimate from downloaded data. Not live: check services and conditions when you can.";
const CHANGE_S = 60, TRANSFER_M = 250, TRANSFER_S = 300, HORIZON_S = 6 * 3600, MAX_SNAP_M = 1000, DETOUR = 1.3; // straight line × 1.3 for walks to stops
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const FONT = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const ATTRIBUTION = "© OpenStreetMap contributors";

// ── Small helpers ───────────────────────────────────────────────────────────

const RAD = Math.PI / 180, EARTH_M = 6371008.8;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const finite = (v) => typeof v === "number" && Number.isFinite(v);
const num = (v) => (v === null || v === undefined || v === "" || typeof v === "boolean" ? NaN : Number(v));
const round = (v, d = 0) => { const k = 10 ** d; return Math.round(v * k) / k; };
const now = () => (globalThis.performance?.now ? performance.now() : Date.now());
const raf = (fn) => (typeof requestAnimationFrame === "function" ? requestAnimationFrame(fn) : setTimeout(() => fn(now()), 16));
const unraf = (id) => (typeof cancelAnimationFrame === "function" ? cancelAnimationFrame(id) : clearTimeout(id));
const doc = () => (typeof document === "undefined" ? null : document);
const themeName = () => (doc()?.documentElement.dataset.theme === "light" ? "light" : "dark");
const motionOK = () => { const d = doc(); if (!d || d.documentElement.dataset.motion === "reduced") return false; try { return !matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return true; } };
const ordinal = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th"}`;
const compass = (b) => ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"][Math.round(b / 45) % 8];
const uniq = (list) => [...new Set(list)];
// Any LatLng shape (a {lat, lng} literal, a LatLng with methods, or [lat, lng]) as a plain literal, or null.
function ll(v) {
  if (!v || typeof v !== "object") return null;
  const lat = num(typeof v.lat === "function" ? v.lat() : Array.isArray(v) ? v[0] : v.lat), lng = num(typeof v.lng === "function" ? v.lng() : Array.isArray(v) ? v[1] : v.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

// ── Geometry and Web Mercator ───────────────────────────────────────────────

// Equirectangular distance in metres: within 0.1% of the great-circle distance across an 8 km area, and much faster.
function dist(lat1, lng1, lat2, lng2) { const x = (lng2 - lng1) * RAD * Math.cos((lat1 + lat2) * 0.5 * RAD), y = (lat2 - lat1) * RAD; return Math.sqrt(x * x + y * y) * EARTH_M; }
function bearing(lat1, lng1, lat2, lng2) {
  const y = Math.sin((lng2 - lng1) * RAD) * Math.cos(lat2 * RAD), x = Math.cos(lat1 * RAD) * Math.sin(lat2 * RAD) - Math.sin(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.cos((lng2 - lng1) * RAD);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}
const turnAngle = (from, to) => ((to - from + 540) % 360) - 180; // −180..180, positive = a right turn
// Web Mercator in "unit" world coordinates (0..1); zoom z has 256 · 2^z world pixels, like Google's zoom levels.
const mercX = (lng) => (lng + 180) / 360;
const mercY = (lat) => { const s = Math.sin(clamp(lat, -85.05, 85.05) * RAD); return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI); };
const latOf = (y) => Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) / RAD;
const lngOf = (x) => x * 360 - 180;
const pt5 = (lat, lng) => [round(lat, 5), round(lng, 5)];
function flatLen(p, a = 0, b = p.length / 2 - 1) { let m = 0; for (let i = a; i < b; i++) m += dist(p[2 * i], p[2 * i + 1], p[2 * i + 2], p[2 * i + 3]); return m; }
function lineLen(pts) { let m = 0; for (let i = 1; i < pts.length; i++) m += dist(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]); return m; }
// The bearing over the first (or last) dozen metres of a polyline, so a tiny kink at a junction does not decide the turn.
function headBearing(pts, fromEnd = false) {
  if (pts.length < 2) return 0;
  if (!fromEnd) { const a = pts[0]; let k = 1; while (k < pts.length - 1 && dist(a[0], a[1], pts[k][0], pts[k][1]) < 12) k++; return bearing(a[0], a[1], pts[k][0], pts[k][1]); }
  const b = pts[pts.length - 1]; let k = pts.length - 2;
  while (k > 0 && dist(pts[k][0], pts[k][1], b[0], b[1]) < 12) k--;
  return bearing(pts[k][0], pts[k][1], b[0], b[1]);
}
// The points of flat polyline p between two fractional positions (index + fraction), in travel order.
function slicePts(p, from, to) {
  const last = p.length / 2 - 1;
  const at = (pos) => { const i = Math.min(Math.floor(pos), last - 1), t = pos - i; return pt5(p[2 * i] + (p[2 * i + 2] - p[2 * i]) * t, p[2 * i + 1] + (p[2 * i + 3] - p[2 * i + 1]) * t); };
  const out = [at(from)];
  if (to >= from) for (let i = Math.floor(from) + 1; i < to; i++) out.push(pt5(p[2 * i], p[2 * i + 1]));
  else for (let i = Math.ceil(from) - 1; i > to; i--) out.push(pt5(p[2 * i], p[2 * i + 1]));
  out.push(at(to));
  return out.filter((q, i) => i === 0 || q[0] !== out[i - 1][0] || q[1] !== out[i - 1][1]);
}
const joinPts = (a, b) => (a.length && b.length && a.at(-1)[0] === b[0][0] && a.at(-1)[1] === b[0][1] ? a.concat(b.slice(1)) : a.concat(b));
const inBox = (box, lat, lng, pad = 0) => lat >= box[0] - pad && lat <= box[2] + pad && lng >= box[1] - pad && lng <= box[3] + pad;

// ── Brisbane time ───────────────────────────────────────────────────────────

const pad2 = (n) => String(n).padStart(2, "0");
const bne = (ms) => new Date(ms + BNE_OFFSET_MS); // read with the UTC getters for Brisbane wall-clock fields
const isoBne = (ms) => { const d = bne(Math.round(ms / 1000) * 1000); return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}+10:00`; };
const dayKey = (ms) => bne(ms).toISOString().slice(0, 10);
const dayStart = (key) => Date.parse(`${key}T00:00:00Z`) - BNE_OFFSET_MS; // GTFS times count from midnight (no daylight saving in Queensland)
const shiftDay = (key, n) => new Date(Date.parse(`${key}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const clock = (ms) => { const d = bne(ms), h = d.getUTCHours(); return `${h % 12 || 12}:${pad2(d.getUTCMinutes())} ${h < 12 ? "am" : "pm"}`; };
const dayLabel = (key) => { const d = new Date(`${key}T00:00:00Z`); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; };
const isDay = (v) => typeof v === "string" && /^\d{4}-\d\d-\d\d$/.test(v);
// A Date, epoch milliseconds, or an ISO string (a string without an offset is Brisbane local time).
function toMs(v) {
  if (v instanceof Date) return Number.isFinite(v.getTime()) ? v.getTime() : null;
  if (finite(v)) return v;
  if (typeof v !== "string" || !v) return null;
  const text = /[zZ]$|[+-]\d\d:?\d\d$/.test(v) ? v : `${/T\d\d:\d\d$/.test(v) ? `${v}:00` : v}+10:00`;
  const t = Date.parse(text);
  return Number.isFinite(t) ? t : null;
}

// ── Storage (IndexedDB, one pack) ───────────────────────────────────────────
// Every call resolves (null or false) instead of failing when IndexedDB is missing, blocked or full (private browsing, for example).

let dbPromise = null;
function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    let done = false;
    const finish = (db) => { if (!done) { done = true; resolve(db); } };
    try {
      if (typeof indexedDB === "undefined" || !indexedDB) return finish(null);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => { try { if (!req.result.objectStoreNames.contains(DB_STORE)) req.result.createObjectStore(DB_STORE); } catch { /* reported by onerror */ } };
      req.onsuccess = () => { const db = req.result; db.onversionchange = () => { db.close(); dbPromise = null; }; finish(db); };
      req.onerror = () => finish(null);
      req.onblocked = () => finish(null);
      setTimeout(() => finish(null), 6000); // some browsers never answer in private mode
    } catch { finish(null); }
  }).then((db) => { if (!db) dbPromise = null; return db; });
  return dbPromise;
}
async function idb(mode, op, fallback) {
  const db = await openDb();
  if (!db) return fallback;
  return new Promise((resolve) => {
    try {
      const t = db.transaction(DB_STORE, mode), req = op(t.objectStore(DB_STORE));
      let value = fallback;
      req.onsuccess = () => { value = req.result; };
      t.oncomplete = () => resolve(mode === "readonly" ? (value ?? fallback) : true);
      t.onerror = () => resolve(fallback);
      t.onabort = () => resolve(fallback);
    } catch { resolve(fallback); }
  });
}
const validPack = (p) => !!p && typeof p === "object" && p.version === 1 && Array.isArray(p.bbox) && p.bbox.length === 4 && p.bbox.every(finite) && !!p.map && Array.isArray(p.map.ways);
const sizes = new WeakMap(); // pack → approximate size in bytes
const savePack = (pack) => (validPack(pack) ? idb("readwrite", (s) => s.put(pack, DB_KEY), false) : Promise.resolve(false));
const loadPack = () => idb("readonly", (s) => s.get(DB_KEY), null).then((p) => (validPack(p) ? p : null), () => null);
const deletePack = () => idb("readwrite", (s) => s.delete(DB_KEY), false);
function packSummary(pack) {
  if (!validPack(pack)) return null;
  let bytes = sizes.get(pack);
  if (bytes === undefined) { try { bytes = JSON.stringify(pack).length; } catch { bytes = 0; } sizes.set(pack, bytes); }
  const t = pack.transit || {};
  return { bytes, ways: pack.map.ways.length, stops: t.stops?.length || 0, trips: t.trips?.length || 0, days: Array.isArray(t.days) ? [...t.days] : [], saved_at: pack.saved_at || null, bbox: [...pack.bbox], label: pack.label || "" };
}

// ── Area checks and download ────────────────────────────────────────────────

const cleanBox = (b) => (Array.isArray(b) && b.length === 4 && b.every((v) => finite(num(v))) && num(b[0]) < num(b[2]) && num(b[1]) < num(b[3]) ? b.map((v) => round(num(v), 5)) : null);
function areaSize(bbox) {
  const b = cleanBox(bbox);
  if (!b) return null;
  const mid = (b[0] + b[2]) / 2, width_km = dist(mid, b[1], mid, b[3]) / 1000, height_km = dist(b[0], b[1], b[2], b[1]) / 1000;
  return { width_km, height_km, area_km2: width_km * height_km };
}
// The same limits as the server, in plain English; null when the area is fine.
function checkArea(bbox, limits = LIMITS) {
  const b = cleanBox(bbox), lim = { ...LIMITS, ...(limits || {}) }, r = lim.region;
  if (!b) return "Choose an area on the map first.";
  if (b[0] < r[0] || b[1] < r[1] || b[2] > r[2] || b[3] > r[3]) return "Offline maps are available only inside South East Queensland.";
  const z = areaSize(b);
  if (z.width_km > lim.max_side_km || z.height_km > lim.max_side_km) return `The area can be at most ${lim.max_side_km} km on each side. Zoom in a little.`;
  if (z.area_km2 > lim.max_area_km2) return `The area can be at most ${lim.max_area_km2} km². Zoom in a little.`;
  if (z.width_km < lim.min_side_km || z.height_km < lim.min_side_km) return `The area must be at least ${lim.min_side_km} km on each side. Zoom out a little.`;
  return null;
}
const progress = (fn, info) => { try { fn?.(info); } catch (error) { console.error(error); } };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const RETRY_FOR_MS = 5 * 60000;
// The server prepares an area in the background (Overpass alone can take a few minutes). While it works it answers 503 with Retry-After;
// asking again is cheap, so poll every 10 to 15 s (a longer Retry-After is not waited out) for up to 5 minutes, with a countdown in onProgress.
async function fetchJson(url, step, onProgress, what) {
  const started = Date.now();
  for (let attempt = 1; ; attempt++) {
    const r = await fetchOnce(url, step, onProgress, what);
    if (r.data) return r;
    if (r.status !== 503) throw new Error(r.message);
    if (Date.now() - started >= RETRY_FOR_MS) throw new Error(`The ${what} is still being prepared after 5 minutes. Try the download again later.`);
    for (let left = clamp(Math.round(r.retryAfter) || 12, 10, 15); left > 0; left--) { progress(onProgress, { step, done: 0, total: 0, waiting: left, attempt }); await sleep(1000); }
  }
}
async function fetchOnce(url, step, onProgress, what) {
  let response;
  try { response = await fetch(url, { cache: "no-store", credentials: "same-origin" }); } catch { throw new Error(`The ${what} could not be downloaded. Check your connection and try again.`); }
  // A compressed response's Content-Length is not the size we count, so the total is unknown (0) then.
  if (!response.ok) { // an error body is not download progress
    const body = await response.text().catch(() => "");
    let error = null;
    try { error = JSON.parse(body)?.error; } catch { error = null; }
    const header = Number(response.headers.get("Retry-After"));
    return { data: null, status: response.status, retryAfter: Number.isFinite(header) && header > 0 ? header : 0,
      message: typeof error === "string" && error ? error : `The ${what} could not be downloaded (error ${response.status}).` };
  }
  const total = response.headers.get("Content-Encoding") ? 0 : Number(response.headers.get("Content-Length")) || 0;
  let text = "";
  try {
    if (response.body?.getReader && typeof TextDecoder !== "undefined") {
      const reader = response.body.getReader(), dec = new TextDecoder();
      let done = 0;
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        done += chunk.value.byteLength;
        text += dec.decode(chunk.value, { stream: true });
        progress(onProgress, { step, done, total: total >= done ? total : 0 });
      }
      text += dec.decode();
    } else text = await response.text();
  } catch { throw new Error(`The ${what} download was interrupted. Check your connection and try again.`); }
  let data = null;
  try { data = JSON.parse(text); } catch { data = null; }
  if (!data || typeof data !== "object") throw new Error(`The server sent an unreadable ${what}. Try again.`);
  return { data, bytes: text.length };
}
const flatOK = (p) => Array.isArray(p) && p.length >= 4 && p.length % 2 === 0 && p.every(finite);
const listOf = (list, ok) => (Array.isArray(list) ? list.filter((x) => { try { return ok(x); } catch { return false; } }) : []);
// Checks the shapes from /api/offline/map and keeps only well-formed features (the server already sends clean data).
function cleanMap(m) {
  if (!m || typeof m !== "object" || !Array.isArray(m.ways)) throw new Error("The map download was incomplete. Try again.");
  const ways = listOf(m.ways, (w) => w && typeof w.c === "string" && flatOK(w.p));
  ways.forEach((w) => {
    w.n = typeof w.n === "string" && w.n.trim() ? w.n.trim() : null;
    w.f = Number.isInteger(w.f) ? w.f : 0;
    w.j = Array.isArray(w.j) ? w.j.filter((i) => Number.isInteger(i) && i >= 0 && i < w.p.length / 2) : [];
  });
  if (!ways.length) throw new Error("The downloaded area has no roads or paths. Choose a different area.");
  const named = (x) => typeof x?.n === "string" && x.n && finite(x.lat) && finite(x.lng);
  return { ...m, ways, rail: listOf(m.rail, (r) => flatOK(r.p)), water: listOf(m.water, (w) => flatOK(w.p)), green: listOf(m.green, (g) => flatOK(g.p)), places: listOf(m.places, named), pois: listOf(m.pois, named) };
}
function cleanTransit(t) {
  if (!t || typeof t !== "object" || !Array.isArray(t.stops) || !Array.isArray(t.trips) || !Array.isArray(t.routes)) throw new Error("The timetable download was incomplete. Try again.");
  const stops = t.stops.length, routes = t.routes.length;
  const trips = listOf(t.trips, (x) => Array.isArray(x) && Number.isInteger(x[0]) && x[0] >= 0 && x[0] < routes && Number.isInteger(x[1]) && Array.isArray(x[3])
    && x[3].length >= 6 && x[3].length % 3 === 0 && x[3].every((v, i) => (i % 3 ? finite(v) : Number.isInteger(v) && v >= 0 && v < stops)));
  return { ...t, stops: t.stops.map((s) => (Array.isArray(s) && finite(s[2]) && finite(s[3]) ? s : [String(s?.[0] ?? ""), String(s?.[1] ?? "Stop"), 0, 0])), trips,
    days: listOf(t.days, isDay), services: t.services && typeof t.services === "object" ? t.services : {}, shapes: t.shapes && typeof t.shapes === "object" ? t.shapes : {} };
}
// "Around Toowong and Auchenflower": the suburbs or places nearest the middle of the area, as app.js names it.
function areaLabel(m, box) {
  const c = [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2], kinds = ["suburb", "neighbourhood", "quarter", "town", "city"];
  const near = m.places.filter((p) => kinds.includes(p.k)).sort((a, b) => dist(c[0], c[1], a.lat, a.lng) - dist(c[0], c[1], b.lat, b.lng));
  return near.length ? `Around ${near.slice(0, 2).map((p) => p.n).join(" and ")}` : "Downloaded area";
}
const randomId = () => { try { return [...crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, "0")).join(""); } catch { return Math.random().toString(16).slice(2, 18); } };
// Downloads the map, then the timetable, checks both, builds the pack and saves it. Resolves to the pack; rejects with a readable Error.
async function download(bbox, { days, onProgress, label } = {}) {
  const box = cleanBox(bbox);
  if (!box) throw new Error("Choose an area on the map first.");
  const q = `south=${box[0]}&west=${box[1]}&north=${box[2]}&east=${box[3]}`, n = clamp(Math.round(num(days)) || LIMITS.default_days, 1, LIMITS.max_days);
  progress(onProgress, { step: "map", done: 0, total: 0 });
  const map = await fetchJson(`/api/offline/map?${q}`, "map", onProgress, "offline map");
  const mapData = cleanMap(map.data);
  progress(onProgress, { step: "transit", done: 0, total: 0 });
  const transit = await fetchJson(`/api/offline/transit?${q}&days=${n}`, "transit", onProgress, "timetable");
  const transitData = cleanTransit(transit.data);
  const pack = { version: 1, id: randomId(), saved_at: new Date().toISOString(), bbox: box, label: typeof label === "string" && label.trim() ? label.trim().slice(0, 80) : areaLabel(mapData, box), map: mapData, transit: transitData };
  progress(onProgress, { step: "saving", done: 0, total: 1 });
  if (!(await savePack(pack))) throw new Error("This browser couldn't store the offline data (it may be in private browsing or out of space).");
  sizes.set(pack, map.bytes + transit.bytes + 200);
  progress(onProgress, { step: "saving", done: 1, total: 1 });
  return pack;
}

// ── Per-pack derived data (built lazily, cached in memory) ──────────────────

const derived = new WeakMap();
const prep = (pack) => { let d = derived.get(pack); if (!d) derived.set(pack, (d = { graphs: {} })); return d; };
let active = null;
function setActivePack(pack) { active = validPack(pack) ? pack : null; eachMap((m) => m._invalidate()); return active; }
const activePack = () => active;

// Joins water outlines that arrive in pieces into closed rings so they can be filled; the rest stay lines.
function stitch(lines) {
  const key = (p, i) => `${p[i]},${p[i + 1]}`, ends = new Map(), used = new Uint8Array(lines.length), rings = [], open = [];
  const rev = (p) => { const r = []; for (let i = p.length - 2; i >= 0; i -= 2) r.push(p[i], p[i + 1]); return r; };
  lines.forEach((p, i) => [key(p, 0), key(p, p.length - 2)].forEach((k) => { if (!ends.has(k)) ends.set(k, []); ends.get(k).push(i); }));
  const closed = (p) => key(p, 0) === key(p, p.length - 2);
  for (let i = 0; i < lines.length; i++) {
    if (used[i]) continue;
    used[i] = 1;
    let cur = lines[i];
    for (let side = 0; side < 2 && !closed(cur); side++) {
      for (let guard = 0; guard < 2000 && !closed(cur); guard++) {
        const tail = key(cur, cur.length - 2), j = (ends.get(tail) || []).find((k) => !used[k]);
        if (j === undefined) break;
        used[j] = 1;
        const q = key(lines[j], 0) === tail ? lines[j] : rev(lines[j]);
        cur = cur.concat(q.slice(2));
      }
      if (!closed(cur)) cur = rev(cur);
    }
    (closed(cur) && cur.length >= 8 ? rings : open).push(cur);
  }
  return { rings, open };
}
// Many flat [lat, lng, …] lines in one buffer of unit-Mercator x, y, with a bounding box per line.
function lineSet(list) {
  let total = 0;
  for (const p of list) total += p.length;
  const xy = new Float64Array(total), start = new Int32Array(list.length + 1), bb = new Float64Array(list.length * 4);
  let o = 0;
  list.forEach((p, i) => {
    start[i] = o;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let k = 0; k < p.length; k += 2) {
      const x = mercX(p[k + 1]), y = mercY(p[k]);
      xy[o++] = x; xy[o++] = y;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    bb[i * 4] = x0; bb[i * 4 + 1] = y0; bb[i * 4 + 2] = x1; bb[i * 4 + 3] = y1;
  });
  start[list.length] = o;
  return { xy, start, bb, n: list.length, seen: new Uint32Array(list.length), tick: 0 };
}
// A uniform grid over the area so a frame only visits the lines near the view.
function gridOf(set, R, cells) {
  const cw = (R.x1 - R.x0) / cells || 1e-9, ch = (R.y1 - R.y0) / cells || 1e-9, count = new Int32Array(cells * cells + 1);
  const range = (i) => [clamp(Math.floor((set.bb[i * 4] - R.x0) / cw), 0, cells - 1), clamp(Math.floor((set.bb[i * 4 + 1] - R.y0) / ch), 0, cells - 1),
    clamp(Math.floor((set.bb[i * 4 + 2] - R.x0) / cw), 0, cells - 1), clamp(Math.floor((set.bb[i * 4 + 3] - R.y0) / ch), 0, cells - 1)];
  for (let i = 0; i < set.n; i++) { const [c0, r0, c1, r1] = range(i); for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) count[r * cells + c + 1]++; }
  for (let k = 1; k < count.length; k++) count[k] += count[k - 1];
  const items = new Int32Array(count[count.length - 1]), fill = count.slice(0, -1);
  for (let i = 0; i < set.n; i++) { const [c0, r0, c1, r1] = range(i); for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) items[fill[r * cells + c]++] = i; }
  return { cells, cw, ch, off: count, items, x0: R.x0, y0: R.y0 };
}
function renderData(pack) {
  const d = prep(pack);
  if (d.render) return d.render;
  const m = pack.map, [s, w, n, e] = pack.bbox;
  const R = { x0: mercX(w), x1: mercX(e), y0: mercY(n), y1: mercY(s), lat: (s + n) / 2 };
  R.roads = lineSet(m.ways.map((way) => way.p));
  R.cls = Uint8Array.from(m.ways, (way) => CLASS_INDEX[way.c] ?? CLASS_INDEX.path);
  R.grid = gridOf(R.roads, R, 48);
  const water = m.water.filter((x) => x.k !== "coastline"), joined = stitch(water.filter((x) => !x.closed).map((x) => x.p));
  R.waterFill = lineSet([...water.filter((x) => x.closed).map((x) => x.p), ...joined.rings]);
  R.waterLine = lineSet(joined.open);
  R.coast = lineSet(m.water.filter((x) => x.k === "coastline").map((x) => x.p));
  R.green = lineSet(m.green.map((g) => g.p));
  R.rail = lineSet(m.rail.map((r) => r.p));
  R.railMinor = Uint8Array.from(m.rail, (r) => (r.k === "rail" ? 0 : 1));
  R.places = m.places.filter((p) => PLACE_STYLE[p.k]).map((p) => ({ name: p.n, style: PLACE_STYLE[p.k], x: mercX(p.lng), y: mercY(p.lat) })).sort((a, b) => a.style[1] - b.style[1]);
  R.pois = m.pois.filter((p) => POI_STYLE[p.k]).map((p) => ({ name: p.n, style: POI_STYLE[p.k], x: mercX(p.lng), y: mercY(p.lat) })).sort((a, b) => a.style[0] - b.style[0]);
  R.stops = (pack.transit?.stops || []).map((st) => ({ name: st[1], x: mercX(st[3]), y: mercY(st[2]) }));
  return (d.render = R);
}

// ── Canvas map styles ───────────────────────────────────────────────────────
// The dark colours follow DARK_MAP_STYLES and PICKER_DARK_STYLES in app.js; light is close to Google's default map.

const PALETTE = {
  dark: { outside: "#161922", land: "#202431", water: "#111927", green: "#1C2A2A", road: "#343A49", major: "#3D4455", motorway: "#4A5163", path: "#3A4152", ferry: "#2B4A66",
    rail: "#4B5263", railDash: "#202431", edge: "rgba(165, 180, 252, 0.6)", label: "#AAB2C0", place: "#C7CEDB", halo: "#202431", stop: "#818CF8", attrBg: "rgba(19, 21, 29, 0.85)", attr: "#C7CEDB", saved: "#FBBF24", note: "#AAB2C0" },
  light: { outside: "#D9DDE5", land: "#F1F3F6", water: "#AADAFF", green: "#CFEBCB", road: "#FFFFFF", major: "#FFFFFF", motorway: "#FCD98A", path: "#B3BAC6", ferry: "#6FA8DC",
    rail: "#A7ADB8", railDash: "#F1F3F6", edge: "rgba(79, 70, 229, 0.65)", label: "#5B6478", place: "#3D4456", halo: "#FFFFFF", stop: "#4F46E5", attrBg: "rgba(252, 252, 254, 0.88)", attr: "#3D4456", saved: "#B45309", note: "#5B6478",
    casing: { road: "#D3D8E0", major: "#C2C8D2", motorway: "#E0AE4E" } },
};
// Drawing order, minor first: [class, smallest zoom drawn, width in px at zoom 16, palette tone].
const ROAD_STYLE = [
  ["track", 15, 1.6, "path"], ["path", 15, 1.4, "path"], ["footway", 15, 1.4, "path"], ["cycleway", 15, 1.6, "path"], ["steps", 16, 1.8, "path"], ["pedestrian", 15, 3, "road"],
  ["service", 15, 3, "road"], ["living", 14, 4.5, "road"], ["residential", 13, 5, "road"], ["tertiary", 12, 6, "road"], ["secondary", 12, 6.5, "major"], ["primary", 11, 7.5, "major"],
  ["trunk", 11, 8.5, "motorway"], ["motorway", 11, 9, "motorway"], ["ferry", 12, 1.5, "ferry"],
];
const CLASS_INDEX = Object.fromEntries(ROAD_STYLE.map(([c], i) => [c, i]));
const ROAD_LABEL_ZOOM = { motorway: 14, trunk: 14, primary: 14, secondary: 15, tertiary: 15, residential: 16, living: 16, pedestrian: 16, service: 17, cycleway: 17, footway: 17, path: 17, track: 17 };
const roadWidth = (w16, z) => Math.max(0.6, w16 * 2 ** ((z - 16) * 0.85));
// [smallest zoom, priority, font px, weight]
const PLACE_STYLE = { city: [11, 0, 15, 700], town: [11, 1, 14, 600], suburb: [12, 2, 13, 600], quarter: [14, 3, 12, 500], neighbourhood: [14, 3, 12, 500], locality: [14, 4, 11.5, 500] };
const PLACE_LABEL = { city: "City", town: "Town", suburb: "Suburb", quarter: "Area", neighbourhood: "Neighbourhood", locality: "Locality" };
// [smallest zoom, tone, label]
const POI_STYLE = { station: [13, "rail", "Train station"], bus_station: [14, "bus", "Bus station"], ferry: [14, "ferry", "Ferry terminal"], hospital: [14, "red", "Hospital"], university: [14, "violet", "University"],
  college: [15, "violet", "College"], shopping: [15, "pink", "Shopping centre"], stadium: [14, "green", "Stadium"], attraction: [15, "teal", "Attraction"], library: [16, "slate", "Library"], police: [16, "slate", "Police"], park: [15, "green", "Park"] };
const TONES = { dark: { rail: "#FB923C", bus: "#818CF8", ferry: "#2DD4BF", red: "#F87171", violet: "#A78BFA", pink: "#F472B6", green: "#34D399", teal: "#2DD4BF", slate: "#94A3B8" },
  light: { rail: "#C2410C", bus: "#4F46E5", ferry: "#0F766E", red: "#B91C1C", violet: "#6D28D9", pink: "#BE185D", green: "#047857", teal: "#0F766E", slate: "#64748B" } };
const widths = new Map();
function textWidth(ctx, text) {
  const key = `${ctx.font}|${text}`;
  let w = widths.get(key);
  if (w === undefined) { w = ctx.measureText(text).width; if (widths.size > 3000) widths.clear(); widths.set(key, w); }
  return w;
}
const overlaps = (boxes, b) => boxes.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]);
function haloText(ctx, text, x, y, fill, halo) { ctx.lineWidth = 3; ctx.strokeStyle = halo; ctx.strokeText(text, x, y); ctx.fillStyle = fill; ctx.fillText(text, x, y); }
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }

// Marker images (data URLs from app.js), shared by every map; the oldest are dropped so a rotating "me" arrow cannot grow memory.
const images = new Map();
function imageFor(url) {
  let img = images.get(url);
  if (img) { images.delete(url); images.set(url, img); return img; }
  if (typeof Image === "undefined") return null;
  img = new Image();
  img.decoding = "async";
  img.onload = () => eachMap((m) => m._invalidate());
  img.src = url;
  images.set(url, img);
  if (images.size > 80) images.delete(images.keys().next().value);
  return img;
}

// ── Google Maps compatible shim: values, events and arrays ──────────────────

class MVCObject {
  addListener(name, fn) {
    const all = this.__l || (this.__l = new Map());
    if (!all.has(name)) all.set(name, new Set());
    const entry = { fn };
    all.get(name).add(entry);
    return { remove: () => all.get(name)?.delete(entry) };
  }
  _fire(name, ...args) { const list = this.__l?.get(name); if (list?.size) [...list].forEach((entry) => { try { entry.fn.apply(this, args); } catch (error) { console.error(error); } }); }
  _has(name) { return !!this.__l?.get(name)?.size; }
  get(key) { return this.__v?.[key]; }
  set(key, value) { (this.__v || (this.__v = {}))[key] = value; this._fire(`${key}_changed`); }
  setValues(values) { Object.entries(values || {}).forEach(([k, v]) => this.set(k, v)); }
  notify(key) { this._fire(`${key}_changed`); }
}
class LatLng {
  constructor(lat, lng) { const q = typeof lat === "object" && lat ? ll(lat) : { lat: num(lat), lng: num(lng) }; this._lat = q ? q.lat : NaN; this._lng = q ? q.lng : NaN; }
  lat() { return this._lat; }
  lng() { return this._lng; }
  equals(other) { const q = ll(other); return !!q && q.lat === this._lat && q.lng === this._lng; }
  toJSON() { return { lat: this._lat, lng: this._lng }; }
  toString() { return `(${this._lat}, ${this._lng})`; }
  toUrlValue(precision = 6) { return `${round(this._lat, precision)},${round(this._lng, precision)}`; }
}
class Point { constructor(x, y) { this.x = Number(x); this.y = Number(y); } equals(o) { return !!o && o.x === this.x && o.y === this.y; } toString() { return `(${this.x}, ${this.y})`; } }
class Size { constructor(width, height) { this.width = Number(width); this.height = Number(height); } equals(o) { return !!o && o.width === this.width && o.height === this.height; } toString() { return `(${this.width}, ${this.height})`; } }
class LatLngBounds {
  constructor(sw, ne) { this._s = Infinity; this._w = Infinity; this._n = -Infinity; this._e = -Infinity; if (sw) this.extend(sw); if (ne) this.extend(ne); }
  extend(point) {
    const q = point && "north" in point ? null : ll(point);
    if (q) { this._s = Math.min(this._s, q.lat); this._n = Math.max(this._n, q.lat); this._w = Math.min(this._w, q.lng); this._e = Math.max(this._e, q.lng); }
    else if (point && finite(num(point.north))) { this.extend({ lat: point.south, lng: point.west }); this.extend({ lat: point.north, lng: point.east }); }
    return this;
  }
  union(other) { if (other && !other.isEmpty?.()) { this.extend(other.getSouthWest()); this.extend(other.getNorthEast()); } return this; }
  isEmpty() { return !(this._s <= this._n && this._w <= this._e); }
  contains(point) { const q = ll(point); return !!q && !this.isEmpty() && q.lat >= this._s && q.lat <= this._n && q.lng >= this._w && q.lng <= this._e; }
  getCenter() { return new LatLng((this._s + this._n) / 2, (this._w + this._e) / 2); }
  getSouthWest() { return new LatLng(this._s, this._w); }
  getNorthEast() { return new LatLng(this._n, this._e); }
  toJSON() { return { south: this._s, west: this._w, north: this._n, east: this._e }; }
  toString() { return `(${this.getSouthWest()}, ${this.getNorthEast()})`; }
}
// Stored but not drawn: map types such as the rain radar need internet, so offline they are a harmless no-op.
class MVCArray extends MVCObject {
  constructor(items = []) { super(); this._a = [...items]; }
  getArray() { return this._a; }
  getLength() { return this._a.length; }
  getAt(i) { return this._a[i]; }
  setAt(i, v) { this._a[i] = v; this._fire("set_at", i); }
  insertAt(i, v) { this._a.splice(i, 0, v); this._fire("insert_at", i); }
  removeAt(i) { const [v] = this._a.splice(i, 1); this._fire("remove_at", i, v); return v; }
  push(v) { this._a.push(v); this._fire("insert_at", this._a.length - 1); return this._a.length; }
  pop() { return this._a.length ? this.removeAt(this._a.length - 1) : undefined; }
  clear() { while (this._a.length) this.pop(); }
  forEach(fn) { this._a.forEach(fn); }
}
const event = {
  addListener: (obj, name, fn) => obj.addListener(name, fn),
  addListenerOnce(obj, name, fn) { const handle = obj.addListener(name, function (...args) { handle.remove(); fn.apply(this, args); }); return handle; },
  removeListener: (handle) => handle?.remove?.(),
  trigger(obj, name, ...args) { if (name === "resize" && obj instanceof OfflineMap) obj._resize(); obj?._fire?.(name, ...args); },
  clearInstanceListeners: (obj) => obj?.__l?.clear(),
  clearListeners: (obj, name) => obj?.__l?.delete(name),
  addDomListener(el, name, fn, capture) { el.addEventListener(name, fn, capture); return { remove: () => el.removeEventListener(name, fn, capture) }; },
};

// ── Shim overlays: Polyline, Marker, InfoWindow, OverlayView ────────────────

// Route lines are kept in unit-Mercator coordinates so a frame only scales and shifts them.
class Polyline extends MVCObject {
  constructor(options = {}) { super(); this._o = { strokeColor: "#000000", strokeOpacity: 1, strokeWeight: 3, zIndex: 0, clickable: true, visible: true }; this._map = null; this._path = []; this._xy = new Float64Array(0); this.setOptions(options); }
  setOptions(options = {}) {
    const { map, path, ...rest } = options || {};
    Object.assign(this._o, rest);
    if (path !== undefined) this.setPath(path);
    if (map !== undefined) this.setMap(map); else this._map?._invalidate();
  }
  setPath(path) {
    const list = Array.isArray(path) ? path : path?.getArray?.() || [];
    this._path = list.map(ll).filter(Boolean);
    this._xy = new Float64Array(this._path.length * 2);
    this._path.forEach((q, i) => { this._xy[2 * i] = mercX(q.lng); this._xy[2 * i + 1] = mercY(q.lat); });
    this._map?._invalidate();
  }
  getPath() { return new MVCArray(this._path.map((q) => new LatLng(q.lat, q.lng))); }
  setMap(map) {
    map = map instanceof OfflineMap ? map : null;
    if (this._map === map) return;
    if (this._map) { this._map._polylines.delete(this); this._map._invalidate(); }
    this._map = map;
    if (map) { map._polylines.add(this); map._invalidate(); }
  }
  getMap() { return this._map; }
  setVisible(v) { this.setOptions({ visible: !!v }); }
  getVisible() { return this._o.visible !== false; }
  get(key) { return key === "map" ? this._map : key === "path" ? this.getPath() : this._o[key]; }
  set(key, value) { this.setOptions({ [key]: value }); }
}
class Marker extends MVCObject {
  constructor(options = {}) { super(); this._o = { clickable: true, visible: true, zIndex: 0, title: "", opacity: 1 }; this._map = null; this._pos = null; this.setOptions(options); }
  setOptions(options = {}) {
    const { map, position, ...rest } = options || {};
    Object.assign(this._o, rest);
    if (position !== undefined) this.setPosition(position);
    if (map !== undefined) this.setMap(map); else this._map?._invalidate();
  }
  setPosition(p) { const q = ll(p); this._pos = q && { ...q, x: mercX(q.lng), y: mercY(q.lat) }; this._map?._invalidate(); this._fire("position_changed"); }
  getPosition() { return this._pos ? new LatLng(this._pos.lat, this._pos.lng) : null; }
  setIcon(icon) { this.setOptions({ icon }); }
  getIcon() { return this._o.icon; }
  setTitle(title) { this._o.title = String(title ?? ""); }
  getTitle() { return this._o.title; }
  setZIndex(z) { this.setOptions({ zIndex: Number(z) || 0 }); }
  setVisible(v) { this.setOptions({ visible: !!v }); }
  getVisible() { return this._o.visible !== false; }
  setOpacity(v) { this.setOptions({ opacity: Number(v) }); }
  setDraggable() { /* dragging markers is not supported offline; app.js drags its own HTML pin instead */ }
  setLabel() { /* labels are not drawn offline */ }
  setMap(map) {
    map = map instanceof OfflineMap ? map : null;
    if (this._map === map) return;
    if (this._map) { this._map._markers.delete(this); this._map._invalidate(); }
    this._map = map;
    if (map) { map._markers.add(this); map._invalidate(); }
  }
  getMap() { return this._map; }
  get(key) { return key === "map" ? this._map : key === "position" ? this.getPosition() : this._o[key]; }
  set(key, value) { this.setOptions({ [key]: value }); }
  // The icon to draw now: keeps the previous image while a new data URL decodes, so a rotating arrow never blinks.
  _art() {
    const icon = this._o.icon, url = typeof icon === "string" ? icon : icon?.url;
    if (url) { const img = imageFor(url); if (img && img.complete && img.naturalWidth) { this._img = img; this._imgIcon = icon; } }
    if (!this._img) return null;
    const ic = typeof this._imgIcon === "object" ? this._imgIcon : {}, w = ic.scaledSize?.width || this._img.naturalWidth, h = ic.scaledSize?.height || this._img.naturalHeight;
    return { img: this._img, w, h, ax: ic.anchor ? ic.anchor.x : w / 2, ay: ic.anchor ? ic.anchor.y : h };
  }
  // Screen rectangle [x0, y0, x1, y1] at the map's current view.
  _rect(map) {
    if (!this._pos) return null;
    const [x, y] = map._screen(this._pos.x, this._pos.y), art = this._art();
    return art ? [x - art.ax, y - art.ay, x - art.ax + art.w, y - art.ay + art.h] : [x - 11, y - 30, x + 11, y];
  }
}
// HTML is rebuilt from a short list of harmless tags as text nodes, so content passed to an info window can never run script.
const SAFE_TAGS = new Set(["B", "STRONG", "I", "EM", "SMALL", "SPAN", "BR", "P", "DIV"]);
function safeFill(target, content) {
  target.replaceChildren();
  if (content && typeof content === "object" && content.nodeType) { target.append(content); return; }
  const text = String(content ?? "");
  if (typeof DOMParser === "undefined") { target.textContent = text; return; }
  const parsed = new DOMParser().parseFromString(`<body>${text}</body>`, "text/html");
  const copy = (from, to) => from.childNodes.forEach((n) => {
    if (n.nodeType === 3) to.append(document.createTextNode(n.textContent));
    else if (n.nodeType === 1) { if (SAFE_TAGS.has(n.tagName)) { const el = document.createElement(n.tagName.toLowerCase()); copy(n, el); to.append(el); } else copy(n, to); }
  });
  copy(parsed.body, target);
}
class InfoWindow extends MVCObject {
  constructor(options = {}) { super(); this._content = options.content ?? ""; this._pos = ll(options.position); this._map = null; this._el = null; }
  setContent(content) { this._content = content; if (this._body) safeFill(this._body, content); }
  getContent() { return this._content; }
  setPosition(p) { this._pos = ll(p); this._map?._invalidate(); }
  getPosition() { return this._pos ? new LatLng(this._pos.lat, this._pos.lng) : null; }
  open(arg, anchor) {
    const map = arg instanceof OfflineMap ? arg : arg?.map instanceof OfflineMap ? arg.map : (anchor || arg?.anchor)?.getMap?.();
    if (!map) return;
    const a = anchor || arg?.anchor;
    if (a?.getPosition?.()) this._pos = ll(a.getPosition());
    this.close();
    const el = this._el = document.createElement("div");
    el.setAttribute("role", "dialog");
    el.style.cssText = "position:absolute;left:0;top:0;transform:translate(-50%,calc(-100% - 12px));min-width:120px;max-width:240px;padding:10px 32px 10px 12px;border-radius:12px;"
      + "background:var(--bg-pop,#1D212C);color:var(--text-main,#F1F5F9);border:1px solid var(--border-strong,rgba(255,255,255,.12));box-shadow:var(--shadow-pop,0 18px 48px rgba(0,0,0,.55));"
      + `font:13px/1.4 ${FONT};pointer-events:auto;white-space:normal`;
    this._body = document.createElement("div");
    safeFill(this._body, this._content);
    const close = document.createElement("button");
    close.type = "button";
    close.setAttribute("aria-label", "Close");
    close.textContent = "×";
    close.style.cssText = "position:absolute;top:2px;right:4px;width:28px;height:28px;border:0;background:none;color:inherit;font-size:18px;line-height:1;cursor:pointer";
    close.addEventListener("click", () => { this.close(); this._fire("closeclick"); });
    el.append(this._body, close);
    OverlayView.preventMapHitsAndGesturesFrom(el);
    map._panes.floatPane.append(el);
    this._map = map;
    map._infos.add(this);
    this._place();
    this._fire("domready");
  }
  close() { if (!this._map) return; this._map._infos.delete(this); this._el?.remove(); this._el = this._body = null; this._map = null; this._fire("close"); }
  getMap() { return this._map; }
  _place() { if (!this._el || !this._pos) return; const [x, y] = this._map._screen(mercX(this._pos.lng), mercY(this._pos.lat)); this._el.style.left = `${x}px`; this._el.style.top = `${y}px`; }
}
// Custom HTML overlays: onAdd, draw and onRemove are set by the caller; draw() runs after every view change, in the same frame as the canvas.
class OverlayView extends MVCObject {
  setMap(map) {
    map = map instanceof OfflineMap ? map : null;
    if (this._map === map) return;
    const old = this._map;
    this._map = map;
    if (old) { old._overlays.delete(this); if (this._added) { this._added = false; try { this.onRemove?.(); } catch (error) { console.error(error); } } }
    if (map) {
      map._overlays.add(this);
      // Like Google, onAdd waits until the caller has finished setting the overlay up.
      queueMicrotask(() => { if (this._map !== map || this._added) return; this._added = true; try { this.onAdd?.(); this.draw?.(); } catch (error) { console.error(error); } });
    }
  }
  getMap() { return this._map || null; }
  getPanes() { return this._map ? this._map._panes : null; }
  getProjection() { return this._added && this._map ? this._map._proj : null; }
  static preventMapHitsAndGesturesFrom(el) { ["pointerdown", "mousedown", "touchstart", "click", "dblclick", "contextmenu", "wheel"].forEach((type) => el.addEventListener(type, (e) => e.stopPropagation())); }
  static preventMapHitsFrom(el) { ["click", "dblclick", "contextmenu"].forEach((type) => el.addEventListener(type, (e) => e.stopPropagation())); }
}

// ── The canvas map ──────────────────────────────────────────────────────────

const live = new Set(); // every map, so a new active pack or theme redraws them; maps whose element left the page are dropped
// A map is dead once its element has left the page: after it was seen on it, or if it never was within 2 s of being made.
const deadMap = (m) => !m._root.isConnected && (m._seen || now() - m._born > 2000);
function eachMap(fn) { live.forEach((m) => { if (m._root.isConnected) { m._seen = true; fn(m); } else if (deadMap(m)) { m._dispose(); live.delete(m); } }); }
let themeWatch = null;
function watchTheme() {
  if (themeWatch || typeof MutationObserver === "undefined" || !doc()) return;
  themeWatch = new MutationObserver(() => eachMap((m) => m._invalidate()));
  themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
}
const pads = (p) => (finite(num(p)) ? { top: +p, right: +p, bottom: +p, left: +p } : { top: +p?.top || 0, right: +p?.right || 0, bottom: +p?.bottom || 0, left: +p?.left || 0 });

class OfflineMap extends MVCObject {
  constructor(el, options = {}) {
    super();
    this._el = el;
    this._opts = { gestureHandling: "greedy", minZoom: 11, maxZoom: 19, draggable: true, scrollwheel: true, disableDoubleClickZoom: false, keyboardShortcuts: true, offlineExtras: null };
    this._cx = mercX(153.0251); this._cy = mercY(-27.4698); this._z = 13; this._zt = 13;
    this._w = 0; this._h = 0; this._dpr = 1;
    this._polylines = new Set(); this._markers = new Set(); this._overlays = new Set(); this._infos = new Set();
    this._extras = [];
    this.overlayMapTypes = new MVCArray();
    this.controls = [];
    this._born = now();
    eachMap(() => {}); // sweep maps that have left the page since the last one was made
    this._build();
    this.setOptions(options);
    live.add(this);
    watchTheme();
    this._resize();
    this._settle();
  }
  _build() {
    const el = this._el, root = this._root = document.createElement("div");
    try { if (getComputedStyle(el).position === "static") el.style.position = "relative"; } catch { /* not in the document yet */ }
    el.style.overflow = "hidden";
    root.className = "offline-map";
    root.tabIndex = 0;
    root.setAttribute("role", "region");
    root.setAttribute("aria-label", "Offline map. Use the arrow keys to move and plus or minus to zoom.");
    root.style.cssText = "position:absolute;inset:0;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;outline-offset:-3px";
    const canvas = this._canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;display:block";
    const layer = document.createElement("div");
    layer.style.cssText = "position:absolute;left:0;top:0;width:0;height:0;z-index:1";
    const pane = (z) => { const p = document.createElement("div"); p.style.cssText = `position:absolute;left:0;top:0;width:0;height:0;z-index:${z}`; layer.append(p); return p; };
    const overlayLayer = pane(1), markerLayer = pane(2), overlayMouseTarget = pane(3), floatPane = pane(4);
    this._panes = { mapPane: overlayLayer, overlayLayer, markerLayer, overlayImage: markerLayer, overlayMouseTarget, floatShadow: floatPane, floatPane };
    root.append(canvas, layer);
    el.append(root);
    this._ctx = canvas.getContext("2d");
    this._proj = {
      fromLatLngToDivPixel: (p) => { const q = ll(p); if (!q) return null; const [x, y] = this._screen(mercX(q.lng), mercY(q.lat)); return new Point(x, y); },
      fromLatLngToContainerPixel: (p) => this._proj.fromLatLngToDivPixel(p),
      fromDivPixelToLatLng: (pt) => (pt ? this._latLngAt(pt.x, pt.y) : null),
      fromContainerPixelToLatLng: (pt) => (pt ? this._latLngAt(pt.x, pt.y) : null),
      getWorldWidth: () => this._scale(),
      getVisibleRegion: () => this.getBounds(),
    };
    if (typeof ResizeObserver === "function") { this._ro = new ResizeObserver(() => this._resize()); this._ro.observe(el); }
    else { this._onWinResize = () => this._resize(); window.addEventListener("resize", this._onWinResize); }
    this._bindInput();
  }
  _dispose() {
    this._disposed = true;
    this._ro?.disconnect();
    if (this._onWinResize) window.removeEventListener("resize", this._onWinResize);
    unraf(this._raf); this._raf = 0; clearTimeout(this._idleTimer); clearTimeout(this._snapTimer);
    this._canvas.width = 0; this._canvas.height = 0; // a phone-sized canvas holds several megabytes
  }

  // View maths: unit-Mercator centre (cx, cy) and a zoom whose world is 256 · 2^z pixels wide.
  _scale() { return 256 * 2 ** this._z; }
  _screen(ux, uy) { const S = this._scale(); return [(ux - this._cx) * S + this._w / 2, (uy - this._cy) * S + this._h / 2]; }
  _unitAt(x, y) { const S = this._scale(); return [this._cx + (x - this._w / 2) / S, this._cy + (y - this._h / 2) / S]; }
  _latLngAt(x, y) { const [ux, uy] = this._unitAt(x, y); return new LatLng(latOf(uy), lngOf(ux)); }
  _placeAt(ux, uy, ax, ay) { const S = this._scale(); this._cx = ux - (ax - this._w / 2) / S; this._cy = clamp(uy - (ay - this._h / 2) / S, 0, 1); }
  _clampZ(z) { return clamp(z, clamp(num(this._opts.minZoom) || 11, 3, 21), clamp(num(this._opts.maxZoom) || 19, 3, 21)); }
  _target(z) { if (z !== this._zt) { this._zt = z; this._fire("zoom_changed"); } }
  _viewChanged() { this._fire("center_changed"); this._fire("bounds_changed"); }
  _invalidate() { if (!this._raf && !this._disposed) this._raf = raf((t) => this._frame(t)); }
  // "idle" fires once the view has stopped moving, like Google's.
  _settle() {
    clearTimeout(this._idleTimer);
    if (this._anim || this._gesture) return;
    this._idleTimer = setTimeout(() => { if (!this._anim && !this._gesture) this._fire("idle"); }, 40);
  }
  _stopAnim(complete) {
    const a = this._anim;
    if (!a) return;
    this._anim = null;
    if (complete && a.kind !== "fling") { this._z = a.z1; this._placeAt(a.ux, a.uy, a.ax1, a.ay1); }
  }
  // Moves the unit point (ux, uy) from screen point a0 to a1 while the zoom goes to z1; covers zooming about a point and panning.
  _animate(ux, uy, ax0, ay0, ax1, ay1, z1, ms = 260) {
    this._stopAnim(false);
    this._target(z1);
    if (!motionOK() || !this._w) { this._z = z1; this._placeAt(ux, uy, ax1, ay1); this._viewChanged(); this._invalidate(); this._settle(); return; }
    this._anim = { ux, uy, ax0, ay0, ax1, ay1, z0: this._z, z1, ms, t0: null };
    this._invalidate();
  }
  _zoomAround(z, ax = this._w / 2, ay = this._h / 2, animate = true) {
    z = this._clampZ(z);
    const [ux, uy] = this._unitAt(ax, ay);
    if (animate) this._animate(ux, uy, ax, ay, ax, ay, z);
    else { this._stopAnim(false); this._z = z; this._target(z); this._placeAt(ux, uy, ax, ay); this._viewChanged(); this._invalidate(); this._settle(); }
  }
  _step(t) {
    const a = this._anim;
    if (a.kind === "fling") {
      const dt = Math.min(48, t - (a.last ?? t)), S = this._scale(), k = Math.exp(-dt / 320);
      a.last = t;
      this._cx -= (a.vx * dt) / S; this._cy = clamp(this._cy - (a.vy * dt) / S, 0, 1);
      a.vx *= k; a.vy *= k;
      this._viewChanged();
      if (Math.hypot(a.vx, a.vy) < 0.03) { this._anim = null; this._settle(); }
      return;
    }
    if (a.t0 === null) a.t0 = t;
    const p = Math.min(1, (t - a.t0) / a.ms), e = 1 - (1 - p) ** 3;
    this._z = a.z0 + (a.z1 - a.z0) * e;
    this._placeAt(a.ux, a.uy, a.ax0 + (a.ax1 - a.ax0) * e, a.ay0 + (a.ay1 - a.ay0) * e);
    this._viewChanged();
    if (p >= 1) { this._anim = null; this._z = a.z1; this._settle(); }
  }
  _frame(t) {
    this._raf = 0;
    if (!this._root.isConnected) { if (deadMap(this)) { this._dispose(); live.delete(this); } return; }
    this._seen = true;
    if (this._anim) this._step(t);
    try { this._draw(); } catch (error) { console.error(error); }
    this._overlays.forEach((o) => { if (o._added) { try { o.draw?.(); } catch (error) { console.error(error); } } });
    this._infos.forEach((iw) => iw._place());
    if (this._anim) this._invalidate();
  }
  _resize() {
    if (this._disposed) return;
    const w = this._el.clientWidth || 0, h = this._el.clientHeight || 0, dpr = Math.min(3, globalThis.devicePixelRatio || 1);
    this._rect = null;
    if (w !== this._w || h !== this._h || dpr !== this._dpr) {
      this._w = w; this._h = h; this._dpr = dpr;
      this._canvas.width = Math.max(1, Math.round(w * dpr));
      this._canvas.height = Math.max(1, Math.round(h * dpr));
      if (w && h && this._pendingFit) { const [b, p] = this._pendingFit; this._pendingFit = null; this.fitBounds(b, p); }
      this._viewChanged();
    }
    this._invalidate();
  }

  // Public API (the Google Maps subset app.js uses).
  getDiv() { return this._el; }
  getCenter() { return new LatLng(latOf(this._cy), lngOf(this._cx)); }
  setCenter(p) { const q = ll(p); if (!q) return; this._stopAnim(true); this._cx = mercX(q.lng); this._cy = mercY(q.lat); this._viewChanged(); this._invalidate(); this._settle(); }
  getZoom() { return this._zt; }
  setZoom(z) {
    if (!Number.isFinite(num(z))) return;
    z = this._clampZ(num(z));
    if (this._anim && this._anim.kind !== "fling") this._stopAnim(true);
    this._zoomAround(z, this._w / 2, this._h / 2, Math.abs(z - this._z) <= 2);
  }
  panTo(p) {
    const q = ll(p);
    if (!q) return;
    this._stopAnim(true);
    const ux = mercX(q.lng), uy = mercY(q.lat), [x, y] = this._screen(ux, uy);
    if (Math.hypot(x - this._w / 2, y - this._h / 2) > 2 * Math.max(this._w, this._h)) return this.setCenter(q);
    this._animate(ux, uy, x, y, this._w / 2, this._h / 2, this._z, 320);
  }
  panBy(dx, dy) { const S = this._scale(); this._stopAnim(true); this._cx += Number(dx) / S; this._cy = clamp(this._cy + Number(dy) / S, 0, 1); this._viewChanged(); this._invalidate(); this._settle(); }
  fitBounds(bounds, padding) {
    const b = bounds instanceof LatLngBounds ? bounds : new LatLngBounds().extend(bounds);
    if (b.isEmpty()) return;
    if (!this._w || !this._h) { this._pendingFit = [b, padding]; return; }
    const p = pads(padding), aw = Math.max(1, this._w - p.left - p.right), ah = Math.max(1, this._h - p.top - p.bottom);
    const x0 = mercX(b._w), x1 = mercX(b._e), y0 = mercY(b._n), y1 = mercY(b._s);
    // Fractional, so the area fills the view (Google's raster maps floor this; the canvas has no tiles to keep whole).
    const z = this._clampZ(Math.log2(Math.min(aw / Math.max(x1 - x0, 1e-12), ah / Math.max(y1 - y0, 1e-12)) / 256));
    this._stopAnim(false);
    this._z = z;
    this._target(z);
    this._placeAt((x0 + x1) / 2, (y0 + y1) / 2, p.left + aw / 2, p.top + ah / 2);
    this._viewChanged();
    this._invalidate();
    this._settle();
  }
  getBounds() {
    if (!this._w) return null;
    const [x0, y0] = this._unitAt(0, 0), [x1, y1] = this._unitAt(this._w, this._h);
    return new LatLngBounds({ lat: latOf(y1), lng: lngOf(x0) }, { lat: latOf(y0), lng: lngOf(x1) });
  }
  getProjection() { return { fromLatLngToPoint: (p) => { const q = ll(p); return q ? new Point(mercX(q.lng) * 256, mercY(q.lat) * 256) : null; }, fromPointToLatLng: (pt) => new LatLng(latOf(pt.y / 256), lngOf(pt.x / 256)) }; }
  getHeading() { return 0; }
  getTilt() { return 0; }
  getMapTypeId() { return "roadmap"; }
  setMapTypeId() { /* only the offline road map exists */ }
  get(key) { return key === "center" ? this.getCenter() : key === "zoom" ? this.getZoom() : this._opts[key]; }
  set(key, value) { this.setOptions({ [key]: value }); }
  // offlineExtras: { places: [{ name, lat, lng }] } draws the traveller's saved places (a Reroute extension; Google ignores unknown options).
  setOptions(options = {}) {
    const o = options || {};
    Object.entries(o).forEach(([k, v]) => { if (!["center", "zoom"].includes(k)) this._opts[k] = v; });
    if ("offlineExtras" in o) this._extras = (o.offlineExtras?.places || []).map((p) => { const q = ll(p); return q && { name: String(p.name || "Saved place").slice(0, 40), x: mercX(q.lng), y: mercY(q.lat) }; }).filter(Boolean);
    if (o.center) this.setCenter(o.center);
    if (o.zoom !== undefined) { this._stopAnim(true); this._z = this._clampZ(Number.isFinite(num(o.zoom)) ? num(o.zoom) : 13); this._target(this._z); this._viewChanged(); this._settle(); }
    else if ("minZoom" in o || "maxZoom" in o) { const z = this._clampZ(this._z); if (z !== this._z) { this._z = z; this._target(z); } }
    this._invalidate(); // "styles" from app.js means the theme changed, so a redraw is enough
  }

  // Input: one-finger (or mouse) pan, two-finger pinch about the gesture centre, wheel, double-tap and double-click zoom, keys.
  _bindInput() {
    const root = this._root, pts = new Map();
    let g = null, tap = null, lastTap = null, wheelAcc = 0;
    const local = (e) => { const r = this._rect || (this._rect = root.getBoundingClientRect()); return [e.clientX - r.left, e.clientY - r.top]; };
    const canMove = () => this._opts.gestureHandling !== "none" && this._opts.draggable !== false;
    const startPan = (moved) => { const [p] = pts.values(); g = { kind: "pan", x0: p.x, y0: p.y, cx: this._cx, cy: this._cy, moved, hist: [[now(), p.x, p.y]] }; };
    const startPinch = () => {
      const [a, b] = [...pts.values()], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, [ux, uy] = this._unitAt(mx, my);
      g = { kind: "pinch", d0: Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)), z0: this._z, ux, uy, mx, my };
    };
    const ev = (x, y, domEvent) => ({ latLng: this._latLngAt(x, y), pixel: new Point(x, y), domEvent, stop() {} });
    root.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      this._rect = root.getBoundingClientRect();
      const [x, y] = local(e);
      pts.set(e.pointerId, { x, y });
      try { root.setPointerCapture(e.pointerId); } catch { /* the pointer already ended */ }
      if (this._anim) this._stopAnim(false);
      this._gesture = true;
      clearTimeout(this._idleTimer);
      if (pts.size === 1) { startPan(false); tap = { x, y }; this._pinched = false; }
      else { tap = null; if (g?.moved && g.kind === "pan") this._fire("dragend"); if (pts.size === 2) { startPinch(); this._pinched = true; } }
    });
    root.addEventListener("pointermove", (e) => {
      const p = pts.get(e.pointerId);
      if (!p) { if (e.pointerType === "mouse") this._hover(...local(e)); return; }
      [p.x, p.y] = local(e);
      if (tap && Math.hypot(p.x - tap.x, p.y - tap.y) > 8) tap = null;
      if (!g || !canMove()) return;
      if (g.kind === "pinch" && pts.size >= 2) {
        const [a, b] = [...pts.values()], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        this._z = this._clampZ(g.z0 + Math.log2(Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)) / g.d0));
        this._placeAt(g.ux, g.uy, mx, my);
        g.mx = mx; g.my = my;
        this._target(Math.round(this._z));
        this._viewChanged();
        this._invalidate();
      } else if (g.kind === "pan") {
        const dx = p.x - g.x0, dy = p.y - g.y0;
        if (!g.moved && Math.hypot(dx, dy) < (e.pointerType === "mouse" ? 3 : 6)) return;
        if (!g.moved) { g.moved = true; this._fire("dragstart"); }
        const S = this._scale();
        this._cx = g.cx - dx / S; this._cy = clamp(g.cy - dy / S, 0, 1);
        g.hist.push([now(), p.x, p.y]);
        if (g.hist.length > 6) g.hist.shift();
        this._fire("drag");
        this._viewChanged();
        this._invalidate();
      }
    });
    const end = (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      if (pts.size === 1 && g?.kind === "pinch") { this._pinchAt = [g.mx, g.my]; startPan(true); return; } // keep panning with the finger left
      if (pts.size) return;
      const was = g, fractional = this._pinched && Math.abs(this._z - Math.round(this._z)) > 1e-6; // a pinch settles on a whole level
      g = null;
      this._gesture = false;
      if (was?.moved && !this._pinched) this._fire("dragend");
      if (fractional) { const [ax, ay] = was?.kind === "pinch" ? [was.mx, was.my] : this._pinchAt || [this._w / 2, this._h / 2]; this._zoomAround(Math.round(this._z), ax, ay); }
      else if (was?.moved && was.kind === "pan" && !this._pinched && motionOK() && e.type === "pointerup") this._fling(was.hist);
      else if (tap && e.type === "pointerup" && !this._pinched) {
        const [x, y] = local(e), t = now();
        if (e.pointerType !== "mouse" && lastTap && t - lastTap.t < 320 && Math.hypot(x - lastTap.x, y - lastTap.y) < 30) {
          lastTap = null;
          if (canMove() && !this._opts.disableDoubleClickZoom) this._zoomAround(this._zt + 1, x, y);
        } else { lastTap = { t, x, y }; this._tap(x, y, ev(x, y, e)); }
      }
      tap = null;
      this._settle();
    };
    root.addEventListener("pointerup", end);
    root.addEventListener("pointercancel", end);
    root.addEventListener("dblclick", (e) => { if (!canMove() || this._opts.disableDoubleClickZoom) return; e.preventDefault(); const [x, y] = local(e); this._zoomAround(this._zt + 1, x, y); });
    root.addEventListener("contextmenu", (e) => { e.preventDefault(); const [x, y] = local(e); this._fire("contextmenu", ev(x, y, e)); });
    root.addEventListener("pointerleave", () => { if (root.title) root.title = ""; });
    root.addEventListener("wheel", (e) => {
      if (!canMove() || this._opts.scrollwheel === false) return;
      e.preventDefault();
      this._rect = root.getBoundingClientRect();
      const [x, y] = local(e), dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
      if (!e.ctrlKey && Math.abs(dy) >= 50) { wheelAcc = 0; this._zoomAround(this._zt + (dy < 0 ? 1 : -1), x, y); return; } // a mouse wheel notch: one level
      // Trackpads send many small steps (pinch arrives as ctrl + wheel): zoom smoothly, then settle on a whole level.
      wheelAcc += dy;
      this._stopAnim(false);
      const [ux, uy] = this._unitAt(x, y);
      this._z = this._clampZ(this._z - dy * (e.ctrlKey ? 0.012 : 0.004));
      this._placeAt(ux, uy, x, y);
      this._target(Math.round(this._z));
      this._viewChanged();
      this._invalidate();
      clearTimeout(this._snapTimer);
      this._snapTimer = setTimeout(() => { wheelAcc = 0; this._zoomAround(Math.round(this._z), x, y); }, 160);
    }, { passive: false });
    root.addEventListener("keydown", (e) => {
      if (this._opts.keyboardShortcuts === false || e.target !== root) return;
      const step = 90, keys = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (keys[e.key]) { e.preventDefault(); this.panBy(...keys[e.key]); }
      else if (e.key === "+" || e.key === "=") { e.preventDefault(); this._zoomAround(this._zt + 1); }
      else if (e.key === "-" || e.key === "_") { e.preventDefault(); this._zoomAround(this._zt - 1); }
    });
  }
  _fling(hist) {
    if (hist.length < 2) return;
    const last = hist[hist.length - 1], first = hist.find((h) => last[0] - h[0] < 100) || hist[0], dt = last[0] - first[0];
    if (dt <= 0 || now() - last[0] > 60) return;
    const vx = (last[1] - first[1]) / dt, vy = (last[2] - first[2]) / dt;
    if (Math.hypot(vx, vy) < 0.3) return;
    this._anim = { kind: "fling", vx, vy, last: null };
    this._invalidate();
  }
  _hitMarker(x, y) {
    const list = [...this._markers].filter((m) => m._pos && m._o.visible !== false).sort((a, b) => (b._o.zIndex || 0) - (a._o.zIndex || 0));
    return list.find((m) => { const r = m._rect(this); return r && x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3]; }) || null;
  }
  _hitLine(x, y) {
    const S = this._scale(), list = [...this._polylines].filter((l) => l._o.clickable !== false && l._o.visible !== false).sort((a, b) => (b._o.zIndex || 0) - (a._o.zIndex || 0));
    for (const line of list) {
      const xy = line._xy, tol = (line._o.strokeWeight || 3) / 2 + 8;
      for (let i = 2; i < xy.length; i += 2) {
        const [ax, ay] = this._screen(xy[i - 2], xy[i - 1]), bx = (xy[i] - xy[i - 2]) * S, by = (xy[i + 1] - xy[i - 1]) * S, len2 = bx * bx + by * by;
        const t = len2 ? clamp(((x - ax) * bx + (y - ay) * by) / len2, 0, 1) : 0;
        if (Math.hypot(ax + t * bx - x, ay + t * by - y) <= tol) return line;
      }
    }
    return null;
  }
  // A tap goes to the topmost clickable marker, then a clickable line, then the map (as on Google).
  _tap(x, y, e) {
    const marker = this._hitMarker(x, y);
    if (marker) { if (marker._o.clickable !== false) { marker._fire("click", e); return; } }
    const line = this._hitLine(x, y);
    if (line) { line._fire("click", e); return; }
    this._fire("click", e);
  }
  _hover(x, y) {
    const marker = this._hitMarker(x, y), line = marker ? null : this._hitLine(x, y);
    const title = marker?._o.title || "", cursor = (marker && marker._o.clickable !== false && marker._has("click")) || line?._has("click") ? "pointer" : "";
    if (this._root.title !== title) this._root.title = title;
    if (this._root.style.cursor !== cursor) this._root.style.cursor = cursor;
  }

  // Drawing: the area (land, green, water, roads, rail), labels, then the app's lines and markers, then the attribution.
  _draw() {
    const ctx = this._ctx, w = this._w, h = this._h;
    if (!ctx || !w || !h) return;
    const dpr = this._dpr, pal = PALETTE[themeName()], S = this._scale(), ox = this._cx - w / 2 / S, oy = this._cy - h / 2 / S;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.fillStyle = pal.outside;
    ctx.fillRect(0, 0, w, h);
    if (active) this._drawPack(ctx, active, pal, S, ox, oy, w, h);
    else {
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `600 14px ${FONT}`;
      haloText(ctx, "No offline map downloaded", w / 2, h / 2 - 9, pal.place, pal.outside);
      ctx.font = `500 12px ${FONT}`;
      haloText(ctx, "Download an area in Settings, Offline info.", w / 2, h / 2 + 11, pal.note, pal.outside);
    }
    this._drawLines(ctx, S, ox, oy);
    this._drawMarkers(ctx);
    // Required attribution, always legible in the bottom-right corner.
    ctx.font = `500 10.5px ${FONT}`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    const tw = textWidth(ctx, ATTRIBUTION);
    ctx.globalAlpha = 1;
    ctx.fillStyle = pal.attrBg;
    roundRect(ctx, w - tw - 14, h - 20, tw + 10, 16, 5);
    ctx.fill();
    ctx.fillStyle = pal.attr;
    ctx.fillText(ATTRIBUTION, w - 9, h - 12);
  }
  _drawPack(ctx, pack, pal, S, ox, oy, w, h) {
    const R = renderData(pack), z = this._z, light = themeName() === "light", m = 32 / S;
    const vx0 = ox - m, vy0 = oy - m, vx1 = ox + w / S + m, vy1 = oy + h / S + m;
    const visible = (set, i) => set.bb[i * 4] <= vx1 && set.bb[i * 4 + 2] >= vx0 && set.bb[i * 4 + 1] <= vy1 && set.bb[i * 4 + 3] >= vy0;
    const trace = (set, i, close) => {
      const xy = set.xy, a = set.start[i], b = set.start[i + 1];
      let px = (xy[a] - ox) * S, py = (xy[a + 1] - oy) * S;
      ctx.moveTo(px, py);
      for (let k = a + 2; k < b; k += 2) {
        const x = (xy[k] - ox) * S, y = (xy[k + 1] - oy) * S;
        if (k < b - 2 && Math.abs(x - px) < 0.7 && Math.abs(y - py) < 0.7) continue; // sub-pixel steps add nothing
        ctx.lineTo(x, y); px = x; py = y;
      }
      if (close) ctx.closePath();
    };
    const fillAll = (set, colour) => { ctx.beginPath(); for (let i = 0; i < set.n; i++) if (visible(set, i)) trace(set, i, true); ctx.fillStyle = colour; ctx.fill(); };
    const strokeAll = (set, colour, width, pick) => { ctx.beginPath(); for (let i = 0; i < set.n; i++) if ((!pick || pick(i)) && visible(set, i)) trace(set, i, false); ctx.strokeStyle = colour; ctx.lineWidth = width; ctx.stroke(); };
    const bx = (R.x0 - ox) * S, by = (R.y0 - oy) * S, bw = (R.x1 - R.x0) * S, bh = (R.y1 - R.y0) * S;
    ctx.fillStyle = pal.land;
    ctx.fillRect(bx, by, bw, bh);
    ctx.save();
    ctx.beginPath();
    ctx.rect(bx, by, bw, bh);
    ctx.clip();
    fillAll(R.green, pal.green);
    fillAll(R.waterFill, pal.water);
    const mpp = 156543.03 * Math.cos(R.lat * RAD) / 2 ** z; // metres per pixel
    strokeAll(R.waterLine, pal.water, Math.max(1.5, 30 / mpp));
    strokeAll(R.coast, pal.water, 2);
    // Roads: the grid gives the ways near the view; each class is one path and one stroke.
    const roads = R.roads, gr = R.grid, tick = ++roads.tick, byClass = ROAD_STYLE.map(() => []);
    const c0 = clamp(Math.floor((vx0 - gr.x0) / gr.cw), 0, gr.cells - 1), c1 = clamp(Math.floor((vx1 - gr.x0) / gr.cw), 0, gr.cells - 1);
    const r0 = clamp(Math.floor((vy0 - gr.y0) / gr.ch), 0, gr.cells - 1), r1 = clamp(Math.floor((vy1 - gr.y0) / gr.ch), 0, gr.cells - 1);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const cell = r * gr.cells + c;
      for (let k = gr.off[cell]; k < gr.off[cell + 1]; k++) {
        const i = gr.items[k];
        if (roads.seen[i] === tick) continue;
        roads.seen[i] = tick;
        if (z >= ROAD_STYLE[R.cls[i]][1] && visible(roads, i)) byClass[R.cls[i]].push(i);
      }
    }
    const strokeClass = (ci, colour, width, dash) => { const list = byClass[ci]; if (!list.length) return; ctx.beginPath(); list.forEach((i) => trace(roads, i, false)); ctx.setLineDash(dash || []); ctx.strokeStyle = colour; ctx.lineWidth = width; ctx.stroke(); };
    if (light && z >= 13) ROAD_STYLE.forEach(([, , w16, tone], ci) => { if (pal.casing[tone]) strokeClass(ci, pal.casing[tone], roadWidth(w16, z) + (z >= 15 ? 2 : 1.2)); });
    ROAD_STYLE.forEach(([cls, , w16, tone], ci) => {
      const width = roadWidth(w16, z), dash = tone === "ferry" ? [6, 5] : tone === "path" && z >= 17 ? [Math.max(2, width * 1.6), Math.max(2, width * 1.2)] : null;
      strokeClass(ci, pal[tone], cls === "steps" && z >= 17 ? width * 1.6 : width, dash);
    });
    ctx.setLineDash([]);
    // Rail: a solid line, with ties drawn as a dash pattern when zoomed in.
    if (R.rail.n) {
      const major = (i) => !R.railMinor[i], minor = (i) => !!R.railMinor[i], rw = z >= 15 ? 3 : 1.6;
      strokeAll(R.rail, pal.rail, rw, major);
      strokeAll(R.rail, pal.rail, rw * 0.7, minor);
      if (z >= 15) { ctx.setLineDash([5, 5]); strokeAll(R.rail, pal.railDash, rw - 1.6, major); ctx.setLineDash([]); }
    }
    ctx.restore();
    // The edge of the downloaded area.
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = pal.edge;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.setLineDash([]);
    // Stops from the timetable, at street level.
    const sx = (u) => (u - ox) * S, sy = (u) => (u - oy) * S, inView = (x, y) => x > -20 && y > -20 && x < w + 20 && y < h + 20;
    if (z >= 16) {
      const r = z >= 18 ? 3.5 : 2.6;
      ctx.beginPath();
      R.stops.forEach((st) => { const x = sx(st.x), y = sy(st.y); if (inView(x, y)) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2); } });
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = pal.land;
      ctx.stroke();
      ctx.fillStyle = pal.stop;
      ctx.fill();
    }
    this._drawLabels(ctx, pack, R, pal, S, ox, oy, w, h, sx, sy, inView, byClass);
  }
  // Labels in priority order, each kept only if it does not overlap one already placed.
  _drawLabels(ctx, pack, R, pal, S, ox, oy, w, h, sx, sy, inView, byClass) {
    const z = this._z, boxes = [[w - 200, h - 22, w, h]], tones = TONES[themeName()]; // the attribution corner stays clear
    // Labels stay inside the downloaded area, where the map has data.
    const area = [(R.x0 - ox) * S, (R.y0 - oy) * S, (R.x1 - ox) * S, (R.y1 - oy) * S], inArea = (b) => b[0] >= area[0] && b[2] <= area[2] && b[1] >= area[1] && b[3] <= area[3];
    this._markers.forEach((m) => { if (m._o.visible !== false) { const r = m._rect(this); if (r) boxes.push(r); } }); // and the app's markers
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    const place = (text, x, y, font, fill, align = "center", gap = 0) => {
      ctx.font = font;
      ctx.textAlign = align;
      const tw = textWidth(ctx, text), x0 = align === "left" ? x + gap : x - tw / 2, box = [x0 - 3, y - 9, x0 + tw + 3, y + 9];
      if (box[0] < 2 || box[2] > w - 2 || box[1] < 2 || box[3] > h - 2 || !inArea(box) || overlaps(boxes, box)) return false;
      boxes.push(box);
      haloText(ctx, text, align === "left" ? x + gap : x, y, fill, pal.halo);
      return true;
    };
    const dot = (x, y, r, colour) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = colour; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = pal.halo; ctx.stroke(); };
    // The traveller's saved places first.
    if (z >= 12) this._extras.forEach((p) => {
      const x = sx(p.x), y = sy(p.y);
      if (!inView(x, y)) return;
      dot(x, y, 6, pal.saved);
      ctx.fillStyle = pal.halo; ctx.font = `700 9px ${FONT}`; ctx.textAlign = "center"; ctx.fillText("★", x, y + 0.5);
      boxes.push([x - 7, y - 7, x + 7, y + 7]);
      place(p.name, x, y, `700 12px ${FONT}`, pal.saved, "left", 10);
    });
    R.places.forEach((p) => {
      const [zMin, , size, weight] = p.style;
      if (z < zMin || (zMin >= 14 && z >= 18)) return;
      const x = sx(p.x), y = sy(p.y);
      if (inView(x, y)) place(p.name, x, y, `${weight} ${size}px ${FONT}`, pal.place);
    });
    R.pois.forEach((p) => {
      const [zMin, tone] = p.style;
      if (z < zMin) return;
      const x = sx(p.x), y = sy(p.y);
      if (!inView(x, y) || !inArea([x - 5, y - 5, x + 5, y + 5]) || overlaps(boxes, [x - 5, y - 5, x + 5, y + 5])) return;
      const placed = place(p.name, x, y, `600 11px ${FONT}`, tones[tone], "left", 8);
      if (placed || z >= 16) { dot(x, y, 4.5, tones[tone]); boxes.push([x - 5, y - 5, x + 5, y + 5]); }
    });
    if (z >= 14) this._roadLabels(ctx, pack, R, pal, S, ox, oy, w, h, boxes, byClass, inArea);
    if (z >= 18) {
      ctx.font = `500 10.5px ${FONT}`;
      R.stops.forEach((st) => { const x = sx(st.x), y = sy(st.y); if (inView(x, y)) place(st.name, x, y, `500 10.5px ${FONT}`, pal.stop, "left", 6); });
    }
  }
  // Road names along the longest nearly straight run of each named road in view, never upside down, at most one per name nearby.
  _roadLabels(ctx, pack, R, pal, S, ox, oy, w, h, boxes, byClass, inArea) {
    const z = this._z, ways = pack.map.ways, roads = R.roads, placed = new Map();
    let count = 0;
    ctx.font = `500 11px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let ci = ROAD_STYLE.length - 1; ci >= 0 && count < 60; ci--) {
      const [cls] = ROAD_STYLE[ci];
      if (!ROAD_LABEL_ZOOM[cls] || z < ROAD_LABEL_ZOOM[cls]) continue;
      for (const i of byClass[ci]) {
        const name = ways[i].n;
        if (!name) continue;
        const xy = roads.xy, a = roads.start[i], b = roads.start[i + 1];
        let best = null, run = null;
        for (let k = a + 2; k < b; k += 2) {
          const x0 = (xy[k - 2] - ox) * S, y0 = (xy[k - 1] - oy) * S, x1 = (xy[k] - ox) * S, y1 = (xy[k + 1] - oy) * S, ang = Math.atan2(y1 - y0, x1 - x0);
          if (run && Math.abs(Math.atan2(Math.sin(ang - run.ang), Math.cos(ang - run.ang))) < 0.2) { run.x1 = x1; run.y1 = y1; }
          else run = { x0, y0, x1, y1, ang };
          const len = Math.hypot(run.x1 - run.x0, run.y1 - run.y0);
          if (!best || len > best.len) best = { ...run, len };
        }
        const tw = textWidth(ctx, name);
        if (!best || best.len < tw + 24) continue;
        const mx = (best.x0 + best.x1) / 2, my = (best.y0 + best.y1) / 2;
        if (mx < 0 || my < 0 || mx > w || my > h) continue;
        if ((placed.get(name) || []).some(([px, py]) => Math.hypot(px - mx, py - my) < 260)) continue;
        let ang = Math.atan2(best.y1 - best.y0, best.x1 - best.x0);
        if (ang > Math.PI / 2) ang -= Math.PI; else if (ang < -Math.PI / 2) ang += Math.PI;
        const c = Math.abs(Math.cos(ang)), s = Math.abs(Math.sin(ang)), hw = (tw / 2 + 3) * c + 7 * s, hh = (tw / 2 + 3) * s + 7 * c, box = [mx - hw, my - hh, mx + hw, my + hh];
        if (box[0] < 2 || box[1] < 2 || box[2] > w - 2 || box[3] > h - 2 || !inArea(box) || overlaps(boxes, box)) continue;
        boxes.push(box);
        if (!placed.has(name)) placed.set(name, []);
        placed.get(name).push([mx, my]);
        ctx.save();
        ctx.translate(mx, my);
        ctx.rotate(ang);
        haloText(ctx, name, 0, 0.5, pal.label, pal.halo);
        ctx.restore();
        if (++count >= 60) break;
      }
    }
  }
  _drawLines(ctx, S, ox, oy) {
    const lines = [...this._polylines].filter((l) => l._o.visible !== false && l._xy.length >= 4).sort((a, b) => (a._o.zIndex || 0) - (b._o.zIndex || 0));
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.setLineDash([]);
    lines.forEach((line) => {
      const xy = line._xy;
      ctx.beginPath();
      ctx.moveTo((xy[0] - ox) * S, (xy[1] - oy) * S);
      for (let i = 2; i < xy.length; i += 2) ctx.lineTo((xy[i] - ox) * S, (xy[i + 1] - oy) * S);
      ctx.globalAlpha = clamp(num(line._o.strokeOpacity) ?? 1, 0, 1);
      if (!Number.isFinite(ctx.globalAlpha)) ctx.globalAlpha = 1;
      ctx.strokeStyle = line._o.strokeColor || "#000000";
      ctx.lineWidth = num(line._o.strokeWeight) || 3;
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }
  _drawMarkers(ctx) {
    const list = [...this._markers].filter((m) => m._pos && m._o.visible !== false).sort((a, b) => (a._o.zIndex || 0) - (b._o.zIndex || 0));
    list.forEach((m) => {
      const [x, y] = this._screen(m._pos.x, m._pos.y);
      if (x < -60 || y < -60 || x > this._w + 60 || y > this._h + 60) return;
      ctx.globalAlpha = clamp(Number(m._o.opacity ?? 1), 0, 1);
      const art = m._art();
      if (art) ctx.drawImage(art.img, x - art.ax, y - art.ay, art.w, art.h);
      else if (!m._o.icon || typeof m._o.icon === "object" && !m._o.icon.url || typeof Image === "undefined") {
        // Google's default pin shape, drawn so a marker without an image still shows.
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.bezierCurveTo(x - 4, y - 10, x - 10, y - 14, x - 10, y - 21);
        ctx.arc(x, y - 21, 10, Math.PI, 0);
        ctx.bezierCurveTo(x + 10, y - 14, x + 4, y - 10, x, y);
        ctx.fillStyle = "#EA4335"; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = "#B31412"; ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y - 21, 3.5, 0, Math.PI * 2); ctx.fillStyle = "#7A0E0C"; ctx.fill();
      }
    });
    ctx.globalAlpha = 1;
  }
}

const maps = Object.freeze({
  Map: OfflineMap, Marker, Polyline, InfoWindow, OverlayView, LatLng, LatLngBounds, Point, Size, MVCArray, MVCObject, event,
  importLibrary() { return Promise.resolve(maps); },
  MapTypeId: Object.freeze({ ROADMAP: "roadmap" }),
  offline: true,
});

// ── Routing graph (per pack and profile) ────────────────────────────────────

const PROFILES = {
  walk: { name: "walk", flag: F.WALK, oneway: false, vmax: WALK_MPS, speed: (c) => (c === "steps" ? WALK_MPS * 0.6 : WALK_MPS) },
  cycle: { name: "cycle", flag: F.CYCLE, oneway: true, vmax: CYCLE_REF_KMH / 3.6, speed: (c) => (CYCLE_REF_KMH / 3.6) * (c === "steps" ? 0.2 : PATHS.has(c) ? 0.85 : 1) },
  drive: { name: "drive", flag: F.DRIVE, oneway: true, vmax: 80 / 3.6, speed: (c) => (DRIVE_KMH[c] || 30) / 3.6 },
};
const NO_CARS = new Set(["footway", "cycleway", "path", "steps", "pedestrian", "ferry"]);
// Cars never use paths, steps or pedestrian streets, whatever the flags say.
const usable = (w, P) => (w.f & P.flag) !== 0 && w.c !== "ferry" && !(P.name === "drive" && NO_CARS.has(w.c));
// Whether a profile may travel a way in its drawn direction and against it. Cyclists follow one-way roads but not paths; a roundabout is
// one-way even when it is not tagged so.
function directions(w, P) {
  if (!P.oneway || (P.name === "cycle" && !(w.f & F.DRIVE))) return [true, true];
  if (w.f & F.ONEWAY) return [true, false];
  if (w.f & F.ONEWAY_BACK) return [false, true];
  if (w.f & F.ROUNDABOUT) return [true, false];
  return [true, true];
}
const nodeKey = (lat, lng) => Math.round(lat * 1e5) * 4e7 + Math.round(lng * 1e5) + 2e7; // exact for 5-decimal coordinates
function cutsOf(w) { const n = w.p.length / 2, c = new Set([0, n - 1]); w.j.forEach((i) => c.add(i)); return [...c].sort((a, b) => a - b); }
// Nodes are the junctions and ends of ways (shared coordinates join ways); an edge runs between consecutive nodes of one way, weighted by
// travel time. Stored as compressed adjacency arrays so a city area fits in a few megabytes.
function buildGraph(pack, name) {
  const P = PROFILES[name], ways = pack.map.ways, ids = new Map(), lat = [], lng = [];
  const node = (la, ln) => { const k = nodeKey(la, ln); let id = ids.get(k); if (id === undefined) { id = lat.length; ids.set(k, id); lat.push(la); lng.push(ln); } return id; };
  const from = [], to = [], sec = [], way = [], pa = [], pb = [];
  const add = (u, v, s, wi, a, b) => { from.push(u); to.push(v); sec.push(s); way.push(wi); pa.push(a); pb.push(b); };
  for (let wi = 0; wi < ways.length; wi++) {
    const w = ways[wi];
    if (!usable(w, P)) continue;
    const [fwd, back] = directions(w, P), speed = P.speed(w.c), p = w.p, cuts = cutsOf(w);
    for (let k = 1; k < cuts.length; k++) {
      const a = cuts[k - 1], b = cuts[k], len = flatLen(p, a, b);
      if (len <= 0) continue;
      const u = node(p[2 * a], p[2 * a + 1]), v = node(p[2 * b], p[2 * b + 1]);
      if (u === v) continue;
      if (fwd) add(u, v, len / speed, wi, a, b);
      if (back) add(v, u, len / speed, wi, b, a);
    }
  }
  const n = lat.length, m = from.length, off = new Int32Array(n + 1);
  for (let e = 0; e < m; e++) off[from[e] + 1]++;
  for (let i = 0; i < n; i++) off[i + 1] += off[i];
  const cur = off.slice(0, n), G = { P, name, n, m, ids, lat: Float64Array.from(lat), lng: Float64Array.from(lng), off,
    src: new Int32Array(m), to: new Int32Array(m), sec: new Float32Array(m), way: new Int32Array(m), a: new Int32Array(m), b: new Int32Array(m) };
  for (let e = 0; e < m; e++) { const k = cur[from[e]]++; G.src[k] = from[e]; G.to[k] = to[e]; G.sec[k] = sec[e]; G.way[k] = way[e]; G.a[k] = pa[e]; G.b[k] = pb[e]; }
  // The largest connected part of the network: snapping prefers it, so a route never starts on an isolated fragment (a private car park).
  const root = new Int32Array(n).map((_, i) => i), find = (x) => { while (root[x] !== x) x = root[x] = root[root[x]]; return x; };
  for (let e = 0; e < m; e++) { const a = find(G.src[e]), b = find(G.to[e]); if (a !== b) root[a] = b; }
  const size = new Int32Array(n);
  let big = -1;
  for (let i = 0; i < n; i++) { const r = find(i); if (++size[r] > (big < 0 ? 0 : size[big])) big = r; }
  G.main = new Uint8Array(ways.length);
  for (let e = 0; e < m; e++) if (find(G.src[e]) === big) G.main[G.way[e]] = 1;
  return G;
}
const graph = (pack, name) => { const d = prep(pack); return d.graphs[name] || (d.graphs[name] = buildGraph(pack, name)); };
// A grid of every way segment (about 150 m cells) to snap a point to the nearest usable road or path.
function segIndex(pack) {
  const d = prep(pack);
  if (d.seg) return d.seg;
  const ways = pack.map.ways, [s, w, n, e] = pack.bbox, cell = 0.0015, cols = Math.ceil((e - w) / cell) + 1, rows = Math.ceil((n - s) / cell) + 1;
  const cr = (la) => clamp(Math.floor((la - s) / cell), 0, rows - 1), cc = (ln) => clamp(Math.floor((ln - w) / cell), 0, cols - 1);
  const count = new Int32Array(rows * cols + 1);
  const each = (fn) => ways.forEach((way, wi) => { const p = way.p; for (let i = 0; i + 3 < p.length; i += 2) {
    const r0 = cr(Math.min(p[i], p[i + 2])), r1 = cr(Math.max(p[i], p[i + 2])), c0 = cc(Math.min(p[i + 1], p[i + 3])), c1 = cc(Math.max(p[i + 1], p[i + 3]));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) fn(r * cols + c, wi, i / 2);
  } });
  each((k) => count[k + 1]++);
  for (let k = 1; k < count.length; k++) count[k] += count[k - 1];
  const fill = count.slice(0, -1), segWay = new Int32Array(count[count.length - 1]), segAt = new Int32Array(count[count.length - 1]);
  each((k, wi, i) => { const at = fill[k]++; segWay[at] = wi; segAt[at] = i; });
  return (d.seg = { s, w, cell, cols, rows, off: count, segWay, segAt });
}
// The nearest point on a way the profile can use, as a fractional position on its graph edge (the edge is split there for routing).
function snap(pack, G, lat, lng) {
  const X = segIndex(pack), ways = pack.map.ways, P = G.P, ky = RAD * EARTH_M, kx = ky * Math.cos(lat * RAD), cellM = X.cell * Math.min(kx, ky);
  const r0 = Math.floor((lat - X.s) / X.cell), c0 = Math.floor((lng - X.w) / X.cell), maxRing = Math.ceil(MAX_SNAP_M / cellM) + 1;
  let best = null, bestD = Infinity, mainOnly = true;
  const test = (r, c) => {
    if (r < 0 || c < 0 || r >= X.rows || c >= X.cols) return;
    const k = r * X.cols + c;
    for (let q = X.off[k]; q < X.off[k + 1]; q++) {
      const wi = X.segWay[q], w = ways[wi];
      if (!usable(w, P) || (mainOnly && !G.main[wi])) continue;
      const i = X.segAt[q], p = w.p, ax = (p[2 * i + 1] - lng) * kx, ay = (p[2 * i] - lat) * ky, bx = (p[2 * i + 3] - lng) * kx - ax, by = (p[2 * i + 2] - lat) * ky - ay;
      const len2 = bx * bx + by * by, t = len2 ? clamp(-(ax * bx + ay * by) / len2, 0, 1) : 0, d = Math.hypot(ax + t * bx, ay + t * by);
      if (d < bestD) { bestD = d; best = { wi, i, t }; }
    }
  };
  const rings = () => {
    for (let ring = 0; ring <= maxRing; ring++) {
      if (best && bestD < (ring - 1) * cellM) break; // every cell further out is at least this far away
      if (!ring) { test(r0, c0); continue; }
      for (let c = c0 - ring; c <= c0 + ring; c++) { test(r0 - ring, c); test(r0 + ring, c); }
      for (let r = r0 - ring + 1; r <= r0 + ring - 1; r++) { test(r, c0 - ring); test(r, c0 + ring); }
    }
  };
  rings();
  if (!best || bestD > MAX_SNAP_M) { mainOnly = false; best = null; bestD = Infinity; rings(); } // nothing on the main network nearby
  if (!best || bestD > MAX_SNAP_M) return null;
  const w = ways[best.wi], p = w.p, pos = best.i + best.t, cuts = cutsOf(w);
  let k = 1;
  while (k < cuts.length - 1 && cuts[k] <= pos) k++;
  const a = cuts[k - 1], b = cuts[k], u = G.ids.get(nodeKey(p[2 * a], p[2 * a + 1])), v = G.ids.get(nodeKey(p[2 * b], p[2 * b + 1]));
  const segLen = dist(p[2 * best.i], p[2 * best.i + 1], p[2 * best.i + 2], p[2 * best.i + 3]), dA = flatLen(p, a, best.i) + best.t * segLen, total = flatLen(p, a, b);
  const [fwd, back] = directions(w, P), at = slicePts(p, pos, pos)[0];
  return { wi: best.wi, pos, a, b, u, v, dA, dB: Math.max(0, total - dA), fwd: fwd && v !== undefined, back: back && u !== undefined, speed: P.speed(w.c), lat: at[0], lng: at[1], off: bestD };
}
class Heap {
  constructor(cap = 1024) { this.k = new Float64Array(cap); this.v = new Int32Array(cap); this.size = 0; }
  push(key, val) {
    if (this.size === this.k.length) { const k = new Float64Array(this.size * 2), v = new Int32Array(this.size * 2); k.set(this.k); v.set(this.v); this.k = k; this.v = v; }
    const K = this.k, V = this.v;
    let i = this.size++;
    while (i > 0) { const p = (i - 1) >> 1; if (K[p] <= key) break; K[i] = K[p]; V[i] = V[p]; i = p; }
    K[i] = key; V[i] = val;
  }
  pop() {
    const K = this.k, V = this.v, top = V[0], n = --this.size;
    if (n > 0) {
      const key = K[n], val = V[n];
      let i = 0;
      for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && K[c + 1] < K[c]) c++; if (K[c] >= key) break; K[i] = K[c]; V[i] = V[c]; i = c; }
      K[i] = key; V[i] = val;
    }
    return top;
  }
}
// A* from one point to another on a profile's graph. The heuristic (straight-line distance at the profile's top speed) never overestimates,
// so the first time the target is settled the route is the fastest. Returns the route as pieces of ways, or null when there is none.
function route(pack, profile, from, to) {
  const G = graph(pack, profile), A = snap(pack, G, from.lat, from.lng), B = snap(pack, G, to.lat, to.lng);
  if (!A || !B) return null;
  const starts = [];
  if (A.fwd) starts.push([A.v, A.dB / A.speed, A.b]);
  if (A.back) starts.push([A.u, A.dA / A.speed, A.a]);
  const ends = new Map(), endAt = (node, cost, pos) => { if (node !== undefined && !(ends.get(node)?.[0] <= cost)) ends.set(node, [cost, pos]); };
  if (B.fwd) endAt(B.u, B.dA / B.speed, B.a);
  if (B.back) endAt(B.v, B.dB / B.speed, B.b);
  let best = Infinity, bestNode = -2;
  if (A.wi === B.wi && A.a === B.a && A.b === B.b && ((B.pos >= A.pos && A.fwd) || (B.pos < A.pos && A.back))) { best = Math.abs(B.dA - A.dA) / A.speed; bestNode = -1; }
  const n = G.n, g = new Float64Array(n).fill(Infinity), via = new Int32Array(n).fill(-1), done = new Uint8Array(n), heap = new Heap(), vmax = G.P.vmax * 1.002;
  const h = (i) => dist(G.lat[i], G.lng[i], B.lat, B.lng) / vmax;
  starts.forEach(([node, cost], k) => { if (cost < g[node]) { g[node] = cost; via[node] = -2 - k; heap.push(cost + h(node), node); } });
  while (heap.size) {
    if (heap.k[0] >= best) break;
    const u = heap.pop();
    if (done[u]) continue;
    done[u] = 1;
    const end = ends.get(u);
    if (end && g[u] + end[0] < best) { best = g[u] + end[0]; bestNode = u; }
    for (let e = G.off[u]; e < G.off[u + 1]; e++) {
      const v = G.to[e];
      if (done[v]) continue;
      const nv = g[u] + G.sec[e];
      if (nv < g[v]) { g[v] = nv; via[v] = e; heap.push(nv + h(v), v); }
    }
  }
  if (bestNode === -2) return null;
  const raw = [];
  if (bestNode === -1) raw.push([A.wi, A.pos, B.pos, -1]);
  else {
    raw.push([B.wi, ends.get(bestNode)[1], B.pos, -1]);
    let v = bestNode;
    for (let guard = 0; via[v] >= 0 && guard < n; guard++) { const e = via[v]; raw.push([G.way[e], G.a[e], G.b[e], v]); v = G.src[e]; }
    raw.push([A.wi, A.pos, starts[-2 - via[v]][2], v]);
    raw.reverse();
  }
  return assemble(pack, G, raw, A, B);
}
// Route pieces [way, from position, to position, graph node at the end] as polylines with lengths and times.
function assemble(pack, G, raw, A, B) {
  const ways = pack.map.ways, pieces = [];
  raw.forEach(([wi, a, b, node]) => {
    if (Math.abs(a - b) < 1e-9) return;
    const pts = slicePts(ways[wi].p, a, b), len = lineLen(pts);
    if (len > 0.05) pieces.push({ wi, pts, len, sec: len / G.P.speed(ways[wi].c), node });
  });
  if (!pieces.length) { const p = [[A.lat, A.lng], [B.lat, B.lng]].map(([la, ln]) => pt5(la, ln)); pieces.push({ wi: A.wi, pts: p, len: lineLen(p), sec: lineLen(p) / A.speed, node: -1 }); }
  let pts = [];
  pieces.forEach((pc) => { pts = joinPts(pts, pc.pts); });
  return { G, pieces, pts, len: pieces.reduce((s, pc) => s + pc.len, 0), sec: pieces.reduce((s, pc) => s + pc.sec, 0), from: A, to: B };
}
// Walking times from one point to every node within `limit` seconds: a bounded Dijkstra over the walking graph (whose edges run both ways
// at the same speed, so the same tree also gives the times *to* that point). Used for the walks to and from stops and between stops.
function walkTree(pack, from, limit) {
  const G = graph(pack, "walk"), A = snap(pack, G, from.lat, from.lng);
  if (!A) return null;
  const g = new Map(), via = new Map(), heap = new Heap(64);
  const seed = (node, cost, code) => { if (node !== undefined && cost <= limit && !(g.get(node) <= cost)) { g.set(node, cost); via.set(node, code); heap.push(cost, node); } };
  seed(A.u, A.dA / A.speed, -2); // -2: reached from the start along its edge towards position a, -3: towards b
  seed(A.v, A.dB / A.speed, -3);
  while (heap.size) {
    const cost = heap.k[0], u = heap.pop();
    if (cost > g.get(u)) continue;
    for (let e = G.off[u]; e < G.off[u + 1]; e++) {
      const v = G.to[e], nv = cost + G.sec[e];
      if (nv <= limit && !(g.get(v) <= nv)) { g.set(v, nv); via.set(v, e); heap.push(nv, v); }
    }
  }
  return { G, A, g, via, base: A.off / WALK_MPS };
}
// The walking time from a tree's origin to a snapped point (door or stop), with the bit of each end that is off the network.
function treeReach(T, S) {
  let best = Infinity, node = -2;
  const viaU = T.g.get(S.u), viaV = T.g.get(S.v), A = T.A;
  if (viaU !== undefined && viaU + S.dA / S.speed < best) { best = viaU + S.dA / S.speed; node = S.u; }
  if (viaV !== undefined && viaV + S.dB / S.speed < best) { best = viaV + S.dB / S.speed; node = S.v; }
  if (S.wi === A.wi && S.a === A.a && S.b === A.b && Math.abs(S.dA - A.dA) / S.speed < best) { best = Math.abs(S.dA - A.dA) / S.speed; node = -1; }
  return { sec: best + T.base + S.off / WALK_MPS, node };
}
function treeRoute(pack, T, S, reach) {
  const G = T.G, A = T.A, raw = [];
  if (reach.node === -1) raw.push([A.wi, A.pos, S.pos, -1]);
  else {
    raw.push([S.wi, reach.node === S.u ? S.a : S.b, S.pos, -1]);
    let v = reach.node;
    for (let guard = 0; T.via.get(v) >= 0 && guard < G.n; guard++) { const e = T.via.get(v); raw.push([G.way[e], G.a[e], G.b[e], v]); v = G.src[e]; }
    raw.push([A.wi, A.pos, T.via.get(v) === -2 ? A.a : A.b, v]);
    raw.reverse();
  }
  return assemble(pack, G, raw, A, S);
}
// The same walk in the other direction (walking edges are the same both ways); each piece ends at the node the original piece started from.
function reverseRoute(r) {
  const P = r.pieces, pieces = P.map((pc, i) => ({ ...pc, pts: [...pc.pts].reverse(), node: i > 0 ? P[i - 1].node : -1 })).reverse();
  return { ...r, pieces, pts: [...r.pts].reverse(), from: r.to, to: r.from };
}

// ── Turn-by-turn instructions ───────────────────────────────────────────────
// Consecutive pieces on the same named road become one step; a change of road, or a sharp turn that stays on the same road, starts a new
// one. The turn angle between the end of one step and the start of the next picks the maneuver (names match MANEUVER_ICON in app.js).

function turnOf(d, label, stay, named, steps) {
  const a = Math.abs(d), side = d < 0 ? "LEFT" : "RIGHT", word = d < 0 ? "left" : "right";
  const onto = stay ? (named ? ` to stay on ${label}` : steps ? " onto the steps" : "") : label ? ` onto ${label}` : "";
  if (a < 25) return ["STRAIGHT", stay || label === "the path" ? `Continue on ${label}` : label ? `Continue onto ${label}` : "Continue straight"];
  if (a < 60) return [`TURN_SLIGHT_${side}`, `Slight ${word}${onto}`];
  if (a < 135) return [`TURN_${side}`, `Turn ${word}${onto}`];
  if (a < 170) return [`TURN_SHARP_${side}`, `Sharp ${word}${onto}`];
  return [`UTURN_${side}`, `Make a U-turn${onto}`];
}
function guidance(pack, r, mode) {
  const ways = pack.map.ways, G = r.G, rings = G.name !== "walk";
  const groups = [];
  const absorb = (into, gr) => { into.pts = joinPts(into.pts, gr.pts); into.len += gr.len; into.sec += gr.sec; into.nodes.push(...gr.nodes); };
  // A node where the way simply bends (no other way to take) never needs an instruction to stay on the same road or path.
  const noChoice = (node) => { if (node < 0) return false; const out = new Set(); for (let e = G.off[node]; e < G.off[node + 1]; e++) out.add(G.to[e]); return out.size <= 2; };
  r.pieces.forEach((pc) => {
    const w = ways[pc.wi], ring = rings && !!(w.f & F.ROUNDABOUT), key = ring ? "@ring" : w.n ? `n:${w.n}` : PATHS.has(w.c) ? "~path" : "~road";
    const gr = { key, ring, name: w.n, cls: w.c, pts: pc.pts, len: pc.len, sec: pc.sec, nodes: [pc.node] }, last = groups[groups.length - 1];
    if (last && last.key === key && (ring || noChoice(last.nodes[last.nodes.length - 1]) || Math.abs(turnAngle(headBearing(last.pts, true), headBearing(pc.pts))) < 60)) absorb(last, gr);
    else { gr.stay = !!last && last.key === key; groups.push(gr); }
  });
  // A stub of a few metres (a slip lane, a kerb ramp) folds into the step before it, and same-road neighbours then join up.
  const merged = [];
  groups.forEach((gr) => {
    const last = merged[merged.length - 1];
    if (last && !gr.ring && !last.ring && (gr.len < 12 || (last.key === gr.key && !gr.stay))) absorb(last, gr);
    else merged.push(gr);
  });
  // A roundabout becomes part of the step that leaves it: "At the roundabout, take the 2nd exit onto …". Exits are the nodes on the ring with a
  // way out that the profile may use.
  const steps = [];
  for (let i = 0; i < merged.length; i++) {
    const gr = merged[i], next = merged[i + 1];
    if (gr.ring && next && i > 0) {
      let exits = 0;
      gr.nodes.forEach((node) => { if (node < 0) return; for (let e = G.off[node]; e < G.off[node + 1]; e++) if (!(ways[G.way[e]].f & F.ROUNDABOUT)) { exits++; break; } });
      steps.push({ ...next, pts: joinPts(gr.pts, next.pts), len: gr.len + next.len, sec: gr.sec + next.sec, exits });
      i++;
    } else steps.push(gr);
  }
  return steps.map((gr, i) => {
    const label = gr.name || (gr.key === "~path" ? (gr.cls === "steps" ? "the steps" : "the path") : null);
    let maneuver, instruction;
    if (i === 0) { maneuver = "DEPART"; instruction = `Head ${compass(headBearing(gr.pts))}${label ? ` on ${label}` : ""}`; }
    else if (gr.exits !== undefined) { maneuver = "ROUNDABOUT_LEFT"; instruction = `At the roundabout, take the ${gr.exits ? `${ordinal(gr.exits)} ` : ""}exit${label ? ` onto ${label}` : ""}`; }
    else if (gr.ring) { maneuver = "ROUNDABOUT_LEFT"; instruction = "Enter the roundabout"; }
    else [maneuver, instruction] = turnOf(turnAngle(headBearing(steps[i - 1].pts, true), headBearing(gr.pts)), label, gr.stay, !!gr.name, gr.cls === "steps" && steps[i - 1].cls !== "steps");
    return { mode, instruction, maneuver, distance_m: Math.round(gr.len), duration_s: Math.round(gr.sec), start: gr.pts[0], end: gr.pts[gr.pts.length - 1], polyline: gr.pts, transit: null };
  });
}

// ── Transit index and RAPTOR search ─────────────────────────────────────────

const routeCategory = (t) => (t === 0 || t === 5 || t === 6 || t === 7 || (t >= 900 && t < 1000) ? "tram"
  : t === 1 || t === 2 || t === 12 || (t >= 100 && t < 200) || (t >= 400 && t < 500) ? "rail" : t === 4 || (t >= 1000 && t < 1300) ? "ferry" : "bus");
const MODE_SETTING = { bus: "bus", rail: "train", tram: "tram", ferry: "ferry" };
const KIND_LABEL = { rail: "Train", bus: "Bus", tram: "Light rail", ferry: "Ferry" };
function transitIndex(pack) {
  const d = prep(pack);
  if (d.transit !== undefined) return d.transit;
  const t = pack.transit;
  if (!t || !Array.isArray(t.stops) || !t.stops.length || !Array.isArray(t.trips) || !t.trips.length) return (d.transit = null);
  const n = t.stops.length, lat = Float64Array.from(t.stops, (s) => s[2]), lng = Float64Array.from(t.stops, (s) => s[3]);
  const cat = t.routes.map((r) => routeCategory(Number(r[2]))), bySvc = new Map(), first = new Float64Array(t.trips.length), last = new Float64Array(t.trips.length);
  const stopCats = Array.from({ length: n }, () => new Set());
  t.trips.forEach((trip, i) => {
    if (!bySvc.has(trip[1])) bySvc.set(trip[1], []);
    bySvc.get(trip[1]).push(i);
    const st = trip[3];
    first[i] = st[2]; last[i] = st[st.length - 2];
    for (let k = 0; k < st.length; k += 3) stopCats[st[k]].add(cat[trip[0]]);
  });
  const cell = 0.0025, grid = new Map(), cellKey = (r, c) => r * 100000 + c;
  for (let s = 0; s < n; s++) { const k = cellKey(Math.floor(lat[s] / cell), Math.floor(lng[s] / cell)); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(s); }
  const near = (la, ln, radius) => {
    const out = [], rr = Math.ceil(radius / (cell * 100000)) + 1, r0 = Math.floor(la / cell), c0 = Math.floor(ln / cell);
    for (let r = r0 - rr; r <= r0 + rr; r++) for (let c = c0 - rr; c <= c0 + rr; c++) (grid.get(cellKey(r, c)) || []).forEach((s) => { const m = dist(la, ln, lat[s], lng[s]); if (m <= radius) out.push([s, m]); });
    return out;
  };
  return (d.transit = { t, n, lat, lng, cat, bySvc, first, last, stopCats, near, snaps: new Map() });
}
const stopSnap = (pack, TI, s) => { if (!TI.snaps.has(s)) TI.snaps.set(s, snap(pack, graph(pack, "walk"), TI.lat[s], TI.lng[s])); return TI.snaps.get(s); };
// Walking transfers to stops up to 250 m away, timed on the walking graph so a river or motorway between two stops is not a transfer.
function footpaths(pack, TI) {
  if (TI.fpOff) return;
  const off = new Int32Array(TI.n + 1), to = [], sec = [];
  for (let s = 0; s < TI.n; s++) {
    const near = TI.near(TI.lat[s], TI.lng[s], TRANSFER_M).filter(([u]) => u !== s), T = near.length ? walkTree(pack, { lat: TI.lat[s], lng: TI.lng[s] }, TRANSFER_S) : null;
    near.forEach(([u, m]) => { const S = T && stopSnap(pack, TI, u), t = !T ? (m * DETOUR) / WALK_MPS : S ? treeReach(T, S).sec : Infinity; if (t <= TRANSFER_S) { to.push(u); sec.push(t); } });
    off[s + 1] = to.length;
  }
  Object.assign(TI, { fpOff: off, fpTo: Int32Array.from(to), fpSec: Float64Array.from(sec) });
}
// The trips running around the departure: today's service day, yesterday's trips that run past midnight and tomorrow's early ones.
function activeTrips(TI, depS, allowed) {
  const key = dayKey(depS * 1000), trip = [], base = [];
  for (const k of [-1, 0, 1]) {
    const day = shiftDay(key, k), svcs = TI.t.services[day];
    if (!Array.isArray(svcs)) continue;
    const b = dayStart(day) / 1000;
    uniq(svcs).forEach((svc) => (TI.bySvc.get(svc) || []).forEach((ti) => {
      if (!allowed.has(TI.cat[TI.t.trips[ti][0]])) return;
      if (b + TI.last[ti] < depS || b + TI.first[ti] > depS + HORIZON_S) return;
      trip.push(ti); base.push(b);
    }));
  }
  return { n: trip.length, trip: Int32Array.from(trip), base: Float64Array.from(base) };
}
const labels = (n) => ({ k: new Int32Array(n).fill(-1), b: new Int32Array(n), a: new Int32Array(n) });
// One RAPTOR round: ride every trip from the stops reached in the previous round. A rider boards at the stop with the least walking to it
// (and, among equals, the latest one), and each later stop of the trip records the arrival if it is the best so far this round.
function scan(TI, inst, prev, pen, cur, lab) {
  const trips = TI.t.trips;
  for (let k = 0; k < inst.n; k++) {
    const st = trips[inst.trip[k]][3], base = inst.base[k];
    let board = -1, boardPen = Infinity;
    for (let i = 0; i < st.length; i += 3) {
      const s = st[i];
      if (board >= 0) { const arr = base + st[i + 1]; if (arr < cur[s]) { cur[s] = arr; lab.k[s] = k; lab.b[s] = board; lab.a[s] = i; } }
      if (prev[s] <= base + st[i + 2] && pen[s] <= boardPen) { board = i; boardPen = pen[s]; }
    }
  }
}
function raptor(TI, inst, access, egress, t0) {
  const n = TI.n, inf = () => new Float64Array(n).fill(Infinity);
  const tau0 = inf(), pen0 = inf();
  access.forEach((sec, s) => { tau0[s] = t0 + sec; pen0[s] = sec; });
  const tau1 = inf(), lab1 = labels(n);
  scan(TI, inst, tau0, pen0, tau1, lab1);
  // A change: at least a minute at the same stop, or a short walk to a nearby stop plus that minute.
  const tau1x = inf(), from = new Int32Array(n).fill(-1), walk = inf();
  for (let s = 0; s < n; s++) {
    if (tau1[s] === Infinity) continue;
    if (tau1[s] + CHANGE_S < tau1x[s]) { tau1x[s] = tau1[s] + CHANGE_S; from[s] = s; walk[s] = 0; }
    for (let q = TI.fpOff[s]; q < TI.fpOff[s + 1]; q++) { const u = TI.fpTo[q], t = tau1[s] + TI.fpSec[q] + CHANGE_S; if (t < tau1x[u]) { tau1x[u] = t; from[u] = s; walk[u] = TI.fpSec[q]; } }
  }
  const tau2 = inf(), lab2 = labels(n);
  scan(TI, inst, tau1x, walk, tau2, lab2);
  const best = (tau) => { let bt = Infinity, bs = -1; egress.forEach((sec, s) => { if (tau[s] + sec < bt) { bt = tau[s] + sec; bs = s; } }); return bs; };
  const ride = (lab, s) => ({ k: lab.k[s], b: lab.b[s], a: lab.a[s] });
  const out = [], d = best(tau1), x = best(tau2);
  if (d >= 0) out.push({ rides: [ride(lab1, d)], egress: d });
  if (x >= 0 && (d < 0 || tau2[x] + egress.get(x) < tau1[d] + egress.get(d))) {
    const r2 = ride(lab2, x), s2 = TI.t.trips[inst.trip[r2.k]][3][r2.b], f = from[s2];
    if (f >= 0 && lab1.k[f] >= 0) out.push({ rides: [ride(lab1, f), r2], egress: x, transferWalk: f !== s2 ? [f, s2] : null });
  }
  return out;
}

// ── Plan assembly ───────────────────────────────────────────────────────────

function normalise(request, nowMs) {
  const r = request || {}, from = ll(r.from), to = ll(r.to), modes = r.modes && typeof r.modes === "object" ? r.modes : { transit: true, drive: true };
  const pick = (v, lo, hi, fallback) => { const x = num(v); return Number.isFinite(x) && x >= lo && x <= hi ? x : fallback; };
  const factors = { ...DEFAULT_FACTORS };
  Object.entries(r.factors || {}).forEach(([k, v]) => { if (k in factors) factors[k] = pick(v, 0, 1, factors[k]); });
  const hire = {};
  Object.entries(HIRE_DEFAULTS).forEach(([mode, [unlock, perMin]]) => { const given = r.hire?.[mode] || {}; hire[mode] = { unlock: pick(given.unlock, 0, 10, unlock), per_min: pick(given.per_min, 0, 3, perMin) }; });
  const transitModes = { bus: true, train: true, tram: true, ferry: true, ...(r.transit_modes || {}) };
  const savedName = (q) => (Array.isArray(r.saved) ? r.saved.find((p) => ll(p) && q && dist(q.lat, q.lng, +p.lat, +p.lng) < 30)?.name : null);
  const label = (q, given) => (typeof given === "string" && given.trim() ? given.trim().slice(0, 200) : savedName(q) || (q ? `${q.lat.toFixed(5)}, ${q.lng.toFixed(5)}` : ""));
  const dep = toMs(r.departure), settingsPrice = pick(r.fuel_price ?? r.vehicle?.fuel_price, 0.5, 5, null), fallback = pick(r.fuel_price_fallback?.price, 0.5, 5, null);
  const fuelSource = settingsPrice !== null ? "your Settings price" : fallback !== null ? String(r.fuel_price_fallback.source || "saved with your offline area").slice(0, 80) : null;
  return {
    from, to, origin: label(from, r.from?.label), destination: label(to, r.to?.label), purpose: r.purpose === "panic" ? "panic" : "regular",
    departure: dep === null ? nowMs + 60000 : dep, deadline: toMs(r.deadline),
    modes: Object.fromEntries(["transit", "drive", "rideshare", ...CYCLE_MODES].map((m) => [m, modes[m] === true])),
    transit: new Set(Object.entries(MODE_SETTING).filter(([, key]) => transitModes[key] !== false).map(([cat]) => cat)),
    walking: Math.round(pick(r.walking, 0, 120, 15)), budget: pick(r.budget, 0, 500, 20), factors, hire,
    fuel_l_per_100km: pick(r.fuel_l_per_100km, 2, 30, 8), fuel_type: typeof r.fuel_type === "string" ? r.fuel_type : "SP91", fuel_price: settingsPrice ?? fallback, fuel_source: fuelSource, fuel_manual: settingsPrice !== null,
    parking_cost: pick(r.parking_cost, 0, 200, null), flat_fare: pick(r.flat_fare ?? r.transit_flat_fare, 0, 50, null),
  };
}
function mapsUrl(req, mode) {
  const travel = { transit: "transit", drive: "driving", walk: "walking", scooter: "bicycling", ebike: "bicycling", bicycle: "bicycling" }[mode] || "driving";
  const q = new URLSearchParams({ api: "1", origin: `${req.from.lat.toFixed(6)},${req.from.lng.toFixed(6)}`, destination: `${req.to.lat.toFixed(6)},${req.to.lng.toFixed(6)}`, travelmode: travel });
  return `https://www.google.com/maps/dir/?${q}`;
}
// The same limit checks as _limits in live_routes.py (offline there are no alerts, cancellations or closures to report).
function limits(o, req) {
  const reasons = [];
  if (req.deadline && o._arrive > req.deadline) reasons.push({ limit: "deadline", text: "Arrives after your deadline" });
  if (o.walking_minutes === null) reasons.push({ limit: "walking", text: "Walking time unavailable" });
  else if (o.walking_minutes > req.walking) reasons.push({ limit: "walking", text: `More than your ${req.walking}-minute walking limit` });
  if (!o.cost_known) reasons.push({ limit: "cost", text: o.cost_unknown_text || "Cost unknown, so your budget can't be confirmed" });
  else if (o.cost > req.budget) reasons.push({ limit: "cost", text: `Costs more than your $${req.budget} limit` });
  return reasons;
}
const ends = (req) => ({ start: [req.from.lat, req.from.lng].map((v) => round(v, 6)), end: [req.to.lat, req.to.lng].map((v) => round(v, 6)) });
function driveOption(pack, req, r) {
  const items = guidance(pack, r, "drive"), km = r.len / 1000, sec = r.sec, price = req.fuel_price;
  const litres = (km * req.fuel_l_per_100km) / 100, fuelCost = price === null ? null : round(litres * price, 2), breakdown = [];
  if (fuelCost !== null) breakdown.push({ label: `Fuel (${km.toFixed(1)} km at $${price.toFixed(2)}/L, ${req.fuel_l_per_100km} L/100 km; ${req.fuel_source})`, amount: fuelCost });
  const parkingKnown = req.parking_cost !== null;
  if (parkingKnown) breakdown.push({ label: "Parking (your setting)", amount: req.parking_cost });
  const known = fuelCost !== null && parkingKnown, total = breakdown.length ? round(breakdown.reduce((s, x) => s + x.amount, 0), 2) : null;
  return {
    id: "drive-0", mode: "drive", kind: "car", title: "Drive", subtitle: "Your own car", duration_minutes: Math.ceil(sec / 60), _arrive: req.departure + sec * 1000,
    walking_minutes: 0, transfers: 0, lines: [], distance_km: round(km, 1),
    steps: items.slice(0, 25).map((it) => ({ kind: "car", title: it.instruction, minutes: Math.ceil(it.duration_s / 60) })),
    segments: [{ kind: "car", points: r.pts }], other_minutes: null, ...ends(req), nav: items, traffic: null,
    cost_known: known, cost: total, cost_breakdown: breakdown,
    cost_label: fuelCost === null ? `Partial: ${["fuel price", !parkingKnown && "parking cost"].filter(Boolean).join(", ")} unknown`
      : `Fuel at $${price.toFixed(2)}/L (${req.fuel_source})${known ? " and parking" : "; parking cost unknown"}`,
    cost_unknown_text: "Driving cost is incomplete", fuel_price: price, co2_kg: round(litres * (FUEL_CO2_PER_L[req.fuel_type] ?? PETROL_CO2_PER_L), 2),
    parking: null, parking_note: "Parking availability not checked",
  };
}
function cycleOption(pack, req, r, mode) {
  const [label, kmh] = CYCLE_PROFILES[mode], km = r.len / 1000, minutes = Math.max(1, Math.ceil((km / kmh) * 60)), mps = kmh / 3.6;
  const items = guidance(pack, r, mode).map((it) => ({ ...it, duration_s: Math.round(it.distance_m / mps) }));
  let cost = { cost: null, cost_known: false, cost_label: "Hire and equipment costs not checked", cost_breakdown: [], cost_unknown_text: "Availability and hire prices are not checked" };
  const price = req.hire[mode];
  if (price) {
    const riding = round(price.per_min * minutes, 2);
    cost = { cost: round(price.unlock + riding, 2), cost_known: true, cost_estimated: true,
      cost_label: `Estimated hire: $${price.unlock.toFixed(2)} unlock + $${price.per_min.toFixed(2)} a minute for ${minutes} min (assumed prices; ${HIRE_PROVIDERS} show the real price in their app)`,
      cost_breakdown: [{ label: "Unlock fee (assumed)", amount: round(price.unlock, 2) }, { label: `${minutes} min at $${price.per_min.toFixed(2)} a minute (assumed)`, amount: riding }], hire_providers: ["Lime", "Neuron"] };
  }
  return {
    id: `${mode}-0`, mode, kind: mode, title: label, subtitle: `Cycling route · ${kmh} km/h assumed`, duration_minutes: minutes, _arrive: req.departure + minutes * 60000,
    walking_minutes: 0, transfers: 0, lines: [], distance_km: round(km, 1), ...cost,
    co2_kg: 0, co2_note: `No tailpipe emissions; ${mode === "bicycle" ? "manufacturing not counted" : "charging and manufacturing not counted"}`,
    notice: `${NOTICE} This is an OpenStreetMap cycling route, not a route checked for scooter or bike access. Time uses an assumed average speed of ${kmh} km/h. Check local rules, path access and conditions before travelling.`,
    steps: items.slice(0, 25).map((it) => ({ kind: mode, title: it.instruction, minutes: Math.ceil(it.duration_s / 60) })),
    segments: [{ kind: mode, points: r.pts }], other_minutes: null, ...ends(req), nav: items,
  };
}
function walkOption(pack, req, r) {
  const items = guidance(pack, r, "walk"), minutes = Math.max(1, Math.ceil(r.sec / 60));
  return {
    id: "walk-0", mode: "walk", kind: "walk", title: "Walk", subtitle: `Walking route · ${WALK_KMH} km/h assumed`, duration_minutes: minutes, _arrive: req.departure + r.sec * 1000,
    walking_minutes: minutes, transfers: 0, lines: [], distance_km: round(r.len / 1000, 1), cost: 0, cost_known: true, cost_label: "Walking is free", cost_breakdown: [],
    co2_kg: 0, co2_note: "No tailpipe emissions", steps: items.slice(0, 25).map((it) => ({ kind: "walk", title: it.instruction, minutes: Math.ceil(it.duration_s / 60) })),
    segments: [{ kind: "walk", points: r.pts }], other_minutes: null, ...ends(req), nav: items,
  };
}
// A walk between two points on the walking graph, or a straight line at walking pace when the graph has no way through.
function walkLeg(pack, from, to, toName) {
  const r = route(pack, "walk", from, to);
  if (r) {
    const items = guidance(pack, r, "walk");
    // Join the snapped route to the exact stop or door.
    const pts = joinPts(joinPts([pt5(from.lat, from.lng)], r.pts), [pt5(to.lat, to.lng)]), extra = r.from.off + r.to.off;
    return { sec: r.sec + extra / WALK_MPS, len: r.len + extra, pts, items };
  }
  const m = dist(from.lat, from.lng, to.lat, to.lng) * DETOUR, pts = [pt5(from.lat, from.lng), pt5(to.lat, to.lng)];
  return { sec: m / WALK_MPS, len: m, pts, items: [{ mode: "walk", instruction: toName ? `Walk to ${toName}` : "Walk to your destination", maneuver: "DEPART", distance_m: Math.round(m), duration_s: Math.round(m / WALK_MPS), start: pts[0], end: pts[1], polyline: pts, transit: null }] };
}
// The in-vehicle path: the route's shape between the two stops when it passes close to both, otherwise straight lines between the stops.
function ridePath(TI, routeIndex, st, b, a) {
  const t = TI.t, stopPts = [];
  for (let i = b; i <= a; i += 3) stopPts.push(pt5(TI.lat[st[i]], TI.lng[st[i]]));
  const shape = t.shapes?.[routeIndex] ?? t.shapes?.[String(routeIndex)];
  if (!flatOK(shape)) return stopPts;
  const nearest = (lat, lng, lo, hi) => { let bi = -1, bd = Infinity; for (let i = lo; i <= hi; i++) { const d = dist(lat, lng, shape[2 * i], shape[2 * i + 1]); if (d < bd) { bd = d; bi = i; } } return [bi, bd]; };
  const n = shape.length / 2, s0 = st[b], s1 = st[a], [i0, d0] = nearest(TI.lat[s0], TI.lng[s0], 0, n - 1);
  const fwd = nearest(TI.lat[s1], TI.lng[s1], i0, n - 1), back = nearest(TI.lat[s1], TI.lng[s1], 0, i0);
  const [i1, d1] = fwd[1] <= back[1] ? fwd : back;
  if (d0 > 150 || d1 > 150 || i0 === i1) return stopPts;
  const out = [];
  if (i1 > i0) for (let i = i0; i <= i1; i++) out.push(pt5(shape[2 * i], shape[2 * i + 1]));
  else for (let i = i0; i >= i1; i--) out.push(pt5(shape[2 * i], shape[2 * i + 1]));
  return joinPts(joinPts([stopPts[0]], out), [stopPts[stopPts.length - 1]]);
}
// A walk along a tree's path to (or, reversed, from) a snapped point; a straight line at walking pace if the tree does not reach it.
function treeLeg(pack, T, S, fromPt, toPt, toName, reverse) {
  const reach = T && S ? treeReach(T, S) : null;
  if (!reach || !Number.isFinite(reach.sec)) return walkLeg(pack, fromPt, toPt, toName);
  const r = reverse ? reverseRoute(treeRoute(pack, T, S, reach)) : treeRoute(pack, T, S, reach);
  const pts = joinPts(joinPts([pt5(fromPt.lat, fromPt.lng)], r.pts), [pt5(toPt.lat, toPt.lng)]);
  return { sec: reach.sec, len: r.len + T.A.off + S.off, pts, items: guidance(pack, r, "walk") };
}
const offlineRealtime = () => ({ status: "none", delay_min: null, label: "Scheduled · offline", vehicle: null, alerts: [], simulated: false });
// One public transport option in the shape transit_option() in live_routes.py builds (steps, segments, nav with transit details).
function transitOption(pack, req, TI, inst, J, index, trees) {
  const t = TI.t, trips = t.trips, details = [], segments = [], nav = [], lines = [], vehicleKm = {};
  let walkSec = 0, rideSec = 0, distM = 0, leave = null, at = null, possible = true;
  const stopName = (s) => String(t.stops[s][1] || "the stop");
  const stopPt = (s) => ({ lat: TI.lat[s], lng: TI.lng[s] });
  const addWalk = (w, toName) => {
    walkSec += w.sec; distM += w.len;
    if (w.len < 15) return w;
    const minutes = Math.ceil(w.sec / 60);
    details.push({ kind: "walk", title: `Walk about ${minutes} min ${toName ? `to ${toName}` : "to your destination"}`, minutes, directions: w.items.map((it) => it.instruction) });
    segments.push({ kind: "walk", points: w.pts });
    nav.push(...w.items);
    return w;
  };
  J.rides.forEach((rd, ri) => {
    const trip = trips[inst.trip[rd.k]], base = inst.base[rd.k], st = trip[3], route = t.routes[trip[0]] || [];
    const s0 = st[rd.b], s1 = st[rd.a], dep = (base + st[rd.b + 2]) * 1000, arr = (base + st[rd.a + 1]) * 1000, category = TI.cat[trip[0]];
    // The walks use the same walking-graph paths that timed the search; a journey that cannot be made after all is dropped.
    if (ri === 0) {
      const w = addWalk(treeLeg(pack, trees.from, stopSnap(pack, TI, s0), req.from, stopPt(s0), stopName(s0), false), stopName(s0));
      leave = dep - w.sec * 1000;
      if (leave < req.departure - 30000) possible = false;
    } else if (J.transferWalk) {
      const [f, u] = J.transferWalk, T = walkTree(pack, stopPt(f), TRANSFER_S * 2);
      const w = addWalk(treeLeg(pack, T, stopSnap(pack, TI, u), stopPt(f), stopPt(u), stopName(u), false), stopName(u));
      if (at + w.sec * 1000 > dep) possible = false;
    } else if (at + CHANGE_S * 1000 > dep + 1) possible = false;
    const short = String(route[0] || "").trim(), long = String(route[1] || "").trim(), name = (category === "rail" ? long || short : short || long) || "public transport", colour = /^#[0-9A-Fa-f]{6}$/.test(route[3] || "") ? route[3].toUpperCase() : null;
    const board = stopName(s0), alight = stopName(s1), title = `Take ${name} from ${board} to ${alight}`, stops = (rd.a - rd.b) / 3, pts = ridePath(TI, trip[0], st, rd.b, rd.a), len = lineLen(pts);
    lines.push({ name, full_name: long || name, category });
    rideSec += (arr - dep) / 1000; distM += len;
    vehicleKm[category] = (vehicleKm[category] || 0) + len / 1000;
    details.push({ kind: category, title, line: name, board_time: clock(dep), stops, headsign: trip[2] || null, minutes: Math.ceil((arr - dep) / 60000) });
    const segment = { kind: category, points: pts, label: name };
    if (colour) segment.colour = colour;
    segments.push(segment);
    nav.push({ mode: "transit", instruction: title, maneuver: null, distance_m: Math.round(len), duration_s: Math.round((arr - dep) / 1000), start: pts[0], end: pts[pts.length - 1], polyline: pts,
      transit: { line: name, name: long || name, vehicle: category, headsign: trip[2] || null, colour, departure_stop: board, arrival_stop: alight,
        departure_time: isoBne(dep), arrival_time: isoBne(arr), stops, route_ids: [], stop_id: null, trip_id: null, realtime: offlineRealtime(), live_query: null } });
    at = arr;
    if (ri === J.rides.length - 1) { const w = addWalk(treeLeg(pack, trees.to, stopSnap(pack, TI, s1), stopPt(s1), req.to, null, true), null); at = arr + w.sec * 1000; }
  });
  if (!possible) return null;
  const leaveAt = Math.max(req.departure, leave), cats = uniq(lines.map((l) => l.category)), total = (at - leaveAt) / 1000;
  const flat = req.flat_fare;
  return {
    id: `transit-${index}`, mode: "transit", kind: cats.length === 1 ? cats[0] : "mixed",
    title: uniq(lines.map((l) => (l.category === "rail" && l.full_name !== l.name ? l.full_name : l.name))).join(" + ") || "Public transport",
    subtitle: [...cats].sort().map((c) => KIND_LABEL[c]).join(" · ") || "Public transport",
    duration_minutes: Math.ceil(total / 60), _arrive: at, _leave: leave, walking_minutes: Math.ceil(walkSec / 60), transfers: Math.max(0, lines.length - 1), lines,
    cost: flat, cost_known: flat !== null, cost_label: flat !== null ? "Flat fare from your Settings (fares aren't available offline)" : "Fare unavailable offline",
    cost_breakdown: flat !== null ? [{ label: "Public transport flat fare (your setting)", amount: flat }] : [], cost_unknown_text: "Fare unavailable, so your budget can't be confirmed",
    distance_km: round(distM / 1000, 1), co2_kg: round(Object.entries(vehicleKm).reduce((s, [c, km]) => s + km * (req.factors[c] ?? DEFAULT_FACTORS[c]), 0), 2),
    steps: details, segments, other_minutes: Math.ceil(Math.max(0, total - walkSec - rideSec) / 60), ...ends(req), nav,
    elevation: null, realtime: null, avoided: false,
  };
}
// Up to three scheduled journeys: repeated searches from later and later departures, keeping those no other journey beats on leaving later,
// arriving earlier and changing less.
function transitOptions(pack, req, errors, walkArrive) {
  const TI = transitIndex(pack);
  if (!TI) { errors.push("Public transport: the downloaded area has no timetable."); return []; }
  const key = dayKey(req.departure), days = TI.t.days || [];
  if (!Array.isArray(TI.t.services[key])) {
    errors.push(days.length ? `Public transport: your downloaded timetable covers ${dayLabel(days[0])}${days.length > 1 ? ` to ${dayLabel(days[days.length - 1])}` : ""} only. Download the area again for later dates.` : "Public transport: the downloaded timetable has no service days.");
    return [];
  }
  if (!req.transit.size) return [];
  // Real walking times to and from nearby stops: one bounded search over the walking graph from each end (up to the walking limit, at least 8 min).
  const limit = Math.max(req.walking, 8) * 60, trees = { from: walkTree(pack, req.from, limit), to: walkTree(pack, req.to, limit) }, access = new Map(), egress = new Map();
  const reachable = (T, pt, into) => TI.near(pt.lat, pt.lng, limit * WALK_MPS).forEach(([s, m]) => {
    const S = T && stopSnap(pack, TI, s), sec = !T ? (m * DETOUR) / WALK_MPS : S ? treeReach(T, S).sec : Infinity;
    if (sec <= limit) into.set(s, sec);
  });
  reachable(trees.from, req.from, access);
  reachable(trees.to, req.to, egress);
  footpaths(pack, TI);
  if (!access.size || !egress.size) { errors.push(`Public transport: no stop is within about ${Math.max(req.walking, 8)} minutes' walk of your ${access.size ? "destination" : "starting point"}.`); return []; }
  const depS = req.departure / 1000, inst = activeTrips(TI, depS, req.transit), found = [], seen = new Set();
  let t0 = depS;
  for (let run = 0; run < 6 && inst.n; run++) {
    const js = raptor(TI, inst, access, egress, t0);
    if (!js.length) break;
    let nextLeave = Infinity;
    js.forEach((J) => {
      const trips = TI.t.trips, r0 = J.rides[0], last = J.rides[J.rides.length - 1];
      const st0 = trips[inst.trip[r0.k]][3], stL = trips[inst.trip[last.k]][3];
      J.leave = inst.base[r0.k] + st0[r0.b + 2] - access.get(st0[r0.b]);
      J.arrive = inst.base[last.k] + stL[last.a + 1] + egress.get(J.egress);
      J.transfers = J.rides.length - 1;
      nextLeave = Math.min(nextLeave, J.leave);
      const sig = J.rides.map((rd) => `${inst.trip[rd.k]}@${inst.base[rd.k]}:${rd.b}-${rd.a}`).join("|");
      if (!seen.has(sig)) { seen.add(sig); found.push(J); }
    });
    t0 = Math.max(t0 + 60, nextLeave + 60);
  }
  const keep = found.filter((J) => !found.some((O) => O !== J && O.leave >= J.leave && O.arrive <= J.arrive && O.transfers <= J.transfers && (O.leave > J.leave || O.arrive < J.arrive || O.transfers < J.transfers)))
    .filter((J) => !(walkArrive && J.arrive * 1000 >= walkArrive)) // never offer a bus that is slower than just walking there
    .sort((a, b) => a.arrive - b.arrive || a.transfers - b.transfers).slice(0, 6);
  const built = keep.map((J) => transitOption(pack, req, TI, inst, J, 0, trees)).filter(Boolean).sort((a, b) => a._arrive - b._arrive).slice(0, 3);
  if (!built.length) {
    errors.push(found.length ? "Public transport: walking there is quicker than any scheduled service." : `Public transport: no scheduled service in your downloaded timetable gets you there after ${clock(req.departure)}.`);
    return [];
  }
  return built.map((o, i) => ({ ...o, id: `transit-${i}` }));
}
// Panic mode: the easiest option that still makes the deadline, public transport first (recommend() in live_routes.py).
function recommend(options, req) {
  const pool = options.filter((o) => !UNCHECKED_MODES.includes(o.mode)).length ? options.filter((o) => !UNCHECKED_MODES.includes(o.mode)) : options;
  if (!pool.length) return null;
  let onTime = pool.filter((o) => !req.deadline || o._arrive <= req.deadline);
  onTime = onTime.filter((o) => o.mode === "transit").length ? onTime.filter((o) => o.mode === "transit") : onTime;
  if (!onTime.length) { const best = pool.reduce((a, b) => (b._arrive < a._arrive ? b : a)); return { id: best.id, why: "Nothing makes your deadline. This is the earliest arrival." }; }
  const effort = (o) => (o.walking_minutes ?? 30) + 8 * o.transfers;
  const best = onTime.reduce((a, b) => (effort(b) < effort(a) || (effort(b) === effort(a) && b._arrive < a._arrive) ? b : a));
  const earliest = onTime.reduce((a, b) => (b._arrive < a._arrive ? b : a));
  const changes = best.transfers === 0 ? "no changes" : `${best.transfers} change${best.transfers !== 1 ? "s" : ""}`, walking = best.walking_minutes ? `${best.walking_minutes} min walking` : "almost no walking";
  return { id: best.id, why: `${req.deadline ? "Arrives before your deadline" : "Gets you there"} with ${changes} and ${walking}${best !== earliest ? ", the least effort of the options that are on time" : ""}.` };
}
// The offline counterpart of POST /api/plan: the same plan shape app.js reads, from the downloaded pack only. Synchronous; awaiting it is fine.
function plan(pack, request) {
  const nowMs = Date.now(), req = normalise(request, nowMs), errors = [], notes = ["Only places inside your downloaded area can be routed.", "Offline results come from downloaded OpenStreetMap roads and the Translink timetable, so delays, cancellations and road closures are not included."];
  const result = {
    options: [], recommended_id: null, recommended_reason: null, baseline: null,
    fuel: req.fuel_price !== null ? { price: req.fuel_price, stations: 0, manual: req.fuel_manual, fuel_type: req.fuel_type, source: req.fuel_source } : null, parking: null, rides: [], weather: null,
    errors, notes, queried_at: isoBne(nowMs), purpose: req.purpose, origin: req.origin, destination: req.destination, start: null, end: null,
    departure: isoBne(req.departure), deadline: req.deadline ? isoBne(req.deadline) : null, factors: req.factors, offline: true, api_cost: null, demo: false,
  };
  if (!validPack(pack)) { errors.push("No offline area is downloaded."); return result; }
  if (!req.from || !req.to) { errors.push("Choose a starting point and a destination inside your downloaded area."); return result; }
  Object.assign(result, ends(req));
  const outside = [!inBox(pack.bbox, req.from.lat, req.from.lng, 0.0005) && "starting point", !inBox(pack.bbox, req.to.lat, req.to.lng, 0.0005) && "destination"].filter(Boolean);
  if (outside.length) { errors.push(`Your ${outside.join(" and ")} ${outside.length > 1 ? "are" : "is"} outside your downloaded area. Offline routes can only use places inside it.`); return result; }
  if (dist(req.from.lat, req.from.lng, req.to.lat, req.to.lng) < 20) { errors.push("Choose different starting and destination places."); return result; }
  if (req.deadline && req.deadline <= req.departure) { errors.push("The arrival deadline must be after departure."); return result; }
  if (!Object.values(req.modes).some(Boolean)) { errors.push("Choose at least one way to travel in Settings."); return result; }
  const options = [];
  const attempt = (label, fn) => { try { return fn(); } catch (error) { console.error(error); errors.push(`${label}: offline routing failed (${error.message}).`); return null; } };
  // Driving is always worked out (as the baseline for CO₂ and cost savings, like the server) and shown when it is turned on.
  const drive = attempt("Driving", () => { const r = route(pack, "drive", req.from, req.to); return r && driveOption(pack, req, r); });
  if (!drive && req.modes.drive) errors.push("Driving: no route was found in the downloaded road network.");
  const walkRoute = attempt("Walking", () => route(pack, "walk", req.from, req.to));
  const walkArrive = walkRoute ? req.departure + walkRoute.sec * 1000 : null;
  if (req.modes.transit) options.push(...(attempt("Public transport", () => transitOptions(pack, req, errors, walkArrive)) || []));
  if (CYCLE_MODES.some((m) => req.modes[m])) {
    const r = attempt("Cycling options", () => route(pack, "cycle", req.from, req.to));
    if (!r) errors.push("Cycling options: no route was found in the downloaded path and road network.");
    else CYCLE_MODES.forEach((mode) => {
      if (!req.modes[mode]) return;
      if (mode === "bicycle" && r.len / 1000 > PUSH_BIKE_MAX_KM) { notes.push(`Push bike is only offered for trips up to ${PUSH_BIKE_MAX_KM} km; this trip is ${round(r.len / 1000, 1)} km.`); return; }
      options.push(cycleOption(pack, req, r, mode));
    });
  }
  if (walkRoute && walkRoute.len / 1000 <= WALK_OPTION_MAX_KM) options.push(walkOption(pack, req, walkRoute));
  if (req.modes.drive && drive) options.push(drive);
  if (req.modes.rideshare) notes.push("Uber needs an internet connection, so it isn't offered offline.");
  options.forEach((o) => {
    o.reasons = limits(o, req);
    o.fits = !o.reasons.length;
    o.maps_url = mapsUrl(req, o.mode);
    o.weather_warning = null;
    o.offline = true;
    o.notice = o.notice || NOTICE;
    if (drive && o !== drive) o.vs_drive = { minutes: Math.round((o._arrive - drive._arrive) / 60000), co2_saved_kg: round(drive.co2_kg - o.co2_kg, 2), cost_saved: drive.cost_known && o.cost_known ? round(drive.cost - o.cost, 2) : null };
  });
  options.sort((a, b) => Number(!a.fits) - Number(!b.fits) || a._arrive - b._arrive);
  if (req.purpose === "panic") { const pick = recommend(options, req); if (pick) { result.recommended_id = pick.id; result.recommended_reason = pick.why; } }
  if (drive) result.baseline = { co2_kg: drive.co2_kg, cost: drive.cost, cost_known: drive.cost_known, minutes: drive.duration_minutes, distance_km: drive.distance_km };
  result.options = options.map((o) => {
    const { _arrive, _leave, ...out } = o, leave = _leave && _leave > req.departure ? _leave : req.departure;
    out.arrival = isoBne(_arrive);
    out.leave_at = isoBne(leave);
    out.door_to_door_minutes = Math.ceil((_arrive - leave) / 60000);
    if (req.deadline) out.buffer_minutes = Math.floor((req.deadline - _arrive) / 60000);
    return out;
  });
  result.notes = uniq(notes);
  return result;
}

// ── Place search ────────────────────────────────────────────────────────────

const norm = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const KIND_ORDER = { saved: 0, place: 1, poi: 2, street: 3, stop: 4 };
function searchIndex(pack) {
  const d = prep(pack);
  if (d.search) return d.search;
  const m = pack.map, items = [], add = (kind, main, secondary, lat, lng) => { const key = norm(main); if (key) items.push({ kind, main, secondary, lat: round(lat, 6), lng: round(lng, 6), key, words: key.split(" ") }); };
  const areas = m.places.filter((p) => ["suburb", "town", "city", "quarter", "neighbourhood"].includes(p.k));
  const areaOf = (lat, lng) => { let best = null, bd = Infinity; areas.forEach((p) => { const dd = dist(lat, lng, p.lat, p.lng); if (dd < bd) { bd = dd; best = p.n; } }); return best; };
  m.places.forEach((p) => add("place", p.n, PLACE_LABEL[p.k] || "Area", p.lat, p.lng));
  m.pois.forEach((p) => add("poi", p.n, [POI_STYLE[p.k]?.[2] || "Place", areaOf(p.lat, p.lng)].filter(Boolean).join(" · "), p.lat, p.lng));
  const TI = transitIndex(pack), stopNames = new Set();
  (pack.transit?.stops || []).forEach((s, i) => {
    const name = String(s[1] || "").trim().replace(/,?\s+platform\s+\w+$/i, ""); // one suggestion per station, not per platform
    if (!name || stopNames.has(name.toLowerCase())) return;
    stopNames.add(name.toLowerCase());
    const cats = TI ? [...TI.stopCats[i]] : [], type = cats.length === 1 ? { rail: "Train station", ferry: "Ferry terminal", tram: "Light rail stop", bus: "Bus stop" }[cats[0]] : "Stop";
    add("stop", name, type, s[2], s[3]);
  });
  // Streets: one entry per name and area, at the middle of the longest piece of that road.
  const streets = new Map();
  m.ways.forEach((w) => {
    if (!w.n || w.c === "ferry") return;
    const len = flatLen(w.p), half = len / 2;
    let acc = 0, mid = [w.p[0], w.p[1]];
    for (let i = 0; i + 3 < w.p.length; i += 2) { const s = dist(w.p[i], w.p[i + 1], w.p[i + 2], w.p[i + 3]); if (acc + s >= half) { const t = s ? (half - acc) / s : 0; mid = [w.p[i] + (w.p[i + 2] - w.p[i]) * t, w.p[i + 1] + (w.p[i + 3] - w.p[i + 1]) * t]; break; } acc += s; }
    const area = areaOf(mid[0], mid[1]), key = `${w.n}|${area}`, cur = streets.get(key);
    if (!cur || len > cur.len) streets.set(key, { name: w.n, area, len, mid });
  });
  streets.forEach((s) => add("street", s.name, s.area || "Street", s.mid[0], s.mid[1]));
  return (d.search = { items });
}
// Up to 7 suggestions: exact names first, then names that start with the text, then any word that starts with each word typed, then text inside a name.
function search(pack, text, extra) {
  const q = norm(text);
  if (!q || !validPack(pack)) return [];
  const words = q.split(" ");
  const score = (it) => (it.key === q ? 0 : it.key.startsWith(q) ? 1 : words.every((w) => it.words.some((x) => x.startsWith(w))) ? 2 : it.key.includes(q) ? 3 : -1);
  const saved = (Array.isArray(extra) ? extra : []).map((p) => { const c = ll(p), main = String(p?.name || "").trim(), key = norm(main); return c && key ? { kind: "saved", main, secondary: inBox(pack.bbox, c.lat, c.lng) ? "Saved place" : "Saved place · outside your offline area", lat: c.lat, lng: c.lng, key, words: key.split(" ") } : null; }).filter(Boolean);
  const hits = [];
  [...saved, ...searchIndex(pack).items].forEach((it) => { const s = score(it); if (s >= 0) hits.push([s, it]); });
  hits.sort((a, b) => a[0] - b[0] || KIND_ORDER[a[1].kind] - KIND_ORDER[b[1].kind] || a[1].main.length - b[1].main.length || a[1].main.localeCompare(b[1].main));
  const out = [], seen = new Set();
  for (const [, it] of hits) {
    const key = `${it.kind}|${it.key}|${it.secondary}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ kind: it.kind, main: it.main, secondary: it.secondary, lat: it.lat, lng: it.lng });
    if (out.length === 7) break;
  }
  return out;
}

// Builds the map drawing data, routing graphs, timetable index and search index in steps, so the first offline search is quick.
async function warm(pack) {
  if (!validPack(pack)) return false;
  const pause = () => new Promise((resolve) => setTimeout(resolve, 0));
  for (const job of [() => renderData(pack), () => graph(pack, "walk"), () => graph(pack, "drive"), () => graph(pack, "cycle"), () => segIndex(pack), () => transitIndex(pack), () => searchIndex(pack)]) {
    try { job(); } catch (error) { console.error(error); }
    await pause();
  }
  return true;
}

window.RerouteOffline = Object.freeze({
  version: 1, LIMITS, savePack, loadPack, deletePack, packSummary, download, checkArea, areaSize, setActivePack, activePack, maps, search, plan, warm,
});
})();
