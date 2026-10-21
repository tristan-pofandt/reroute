/* Plan B MVP v3 — mobile-first front end. Plain JavaScript, no build step. */
"use strict";

// ── Icons: Lucide-style, 24 px grid, 1.75 stroke, round caps (icons under 16 px get a slightly heavier stroke) ─────────────

const svg = (body, size = 20) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${size < 16 ? 2.1 : 1.75}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

const I = {
  bus: (s) => svg('<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3 10h18M8 5v4M16 5v4M7.5 16.5h.01M16.5 16.5h.01"/>', s),
  train: (s) => svg('<rect x="4.5" y="3" width="15" height="15" rx="2.5"/><path d="M4.5 11h15M12 3v8M8.5 19l-2 2.5M15.5 19l2 2.5M8.5 15h.01M15.5 15h.01"/>', s),
  tram: (s) => svg('<rect x="5" y="6" width="14" height="12" rx="2.5"/><path d="M9 3h6M12 3v3M5 12h14M9 18l-2 3M15 18l2 3"/>', s),
  ferry: (s) => svg('<path d="M3 17c1.5 1.3 3 1.3 4.5 0s3-1.3 4.5 0 3 1.3 4.5 0 3-1.3 4.5 0"/><path d="M5 14l1.5-5h11L19 14M9 9V5h6v4"/>', s),
  rideshare: (s) => svg('<path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2"/><rect x="7" y="17" width="4" height="4" rx="1"/><rect x="13" y="17" width="4" height="4" rx="1"/><path d="M5 7l1.5-4h11L19 7"/>', s),
  car: (s) => svg('<path d="M5 17h14M3 17v-4.5l2.2-5.3A2 2 0 0 1 7 6h10a2 2 0 0 1 1.8 1.2L21 12.5V17"/><path d="M3 12.5h18"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>', s),
  walk: (s) => svg('<circle cx="12" cy="4" r="1.5"/><path d="M9 8.5l1 4 2 2 1 5M15 8.5l-1 4M9 12.5l-3 3.5M15 12.5l3 3.5"/>', s),
  clock: (s) => svg('<circle cx="12" cy="12" r="10"/><polyline points="12 6.5 12 12 15.5 14"/>', s),
  dollar: (s) => svg('<line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5.5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6.5"/>', s),
  chevronLeft: (s = 22) => svg('<polyline points="15 18 9 12 15 6"/>', s),
  chevronRight: (s = 16) => svg('<polyline points="9 18 15 12 9 6"/>', s),
  arrowRight: (s = 14) => svg('<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>', s),
  alert: (s) => svg('<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>', s),
  checkCircle: (s) => svg('<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>', s),
  xCircle: (s) => svg('<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>', s),
  pin: (s) => svg('<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>', s),
  transfer: (s) => svg('<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>', s),
  route: (s) => svg('<circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H16a3.5 3.5 0 0 0 0-7H8a3.5 3.5 0 0 1 0-7h7.5"/>', s),
  signal: (s) => svg('<path d="M2 20h.01M7 20v-4M12 20v-8M17 20V8M22 4v16"/>', s),
  minus: (s = 16) => svg('<line x1="5" y1="12" x2="19" y2="12"/>', s),
  plus: (s = 16) => svg('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>', s),
  x: (s = 16) => svg('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>', s),
  check: (s = 14) => svg('<polyline points="20 6 9 17 4 12"/>', s),
  hourglass: (s) => svg('<path d="M6 2h12M6 22h12M7 2v4.5a5 5 0 0 0 10 0V2M7 22v-4.5a5 5 0 0 1 10 0V22"/>', s),
  gear: (s = 20) => svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>', s),
  leaf: (s) => svg('<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>', s),
  mountain: (s) => svg('<path d="M8 3l4 8 5-5 5 15H2L8 3z"/>', s),
  parking: (s) => svg('<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>', s),
  users: (s) => svg('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>', s),
  bolt: (s) => svg('<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>', s),
  activity: (s) => svg('<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>', s),
  refresh: (s) => svg('<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>', s),
  locate: (s) => svg('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="7"/>', s),
  expand: (s = 18) => svg('<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>', s),
  shrink: (s = 18) => svg('<polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/>', s),
  fit: (s = 18) => svg('<path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3"/>', s),
  search: (s) => svg('<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>', s),
  external: (s = 16) => svg('<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>', s),
  moon: (s) => svg('<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>', s),
  home: (s) => svg('<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>', s),
  // Weather
  sun: (s) => svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>', s),
  cloud: (s) => svg('<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z"/>', s),
  cloudSun: (s) => svg('<path d="M12 2v2M4.93 4.93l1.41 1.41M20 12h2M19.07 4.93l-1.41 1.41M15.95 12.65a4 4 0 0 0-5.93-4.13"/><path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6z"/>', s),
  drizzle: (s) => svg('<path d="M4 14.9A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.24"/><path d="M8 19v1M8 14v1M16 19v1M16 14v1M12 21v1M12 16v1"/>', s),
  rain: (s) => svg('<path d="M4 14.9A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.24"/><path d="M16 14v6M8 14v6M12 16v6"/>', s),
  storm: (s) => svg('<path d="M6 16.33A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.97"/><path d="m13 12-3 5h4l-3 5"/>', s),
  fog: (s) => svg('<path d="M4 14.9A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.24"/><path d="M16 17H7M17 21H9"/>', s),
  snow: (s) => svg('<line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/><path d="m20 16-4-4 4-4M4 8l4 4-4 4M16 4l-4 4-4-4M8 20l4-4 4 4"/>', s),
  wind: (s) => svg('<path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/>', s),
  heat: (s) => svg('<path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0z"/><path d="M18 5h3M18 9h2"/>', s),
  // Directions and maneuvers
  navArrow: (s) => svg('<polygon points="3 11 22 2 13 21 11 13 3 11"/>', s),
  arrowUp: (s) => svg('<path d="M12 19V5M5 12l7-7 7 7"/>', s),
  turnLeft: (s) => svg('<polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>', s),
  slightLeft: (s) => svg('<path d="M7 17V7h10M17 17 7 7"/>', s),
  sharpLeft: (s) => svg('<polyline points="9 10 4 15 9 20"/><path d="M20 4v7a4 4 0 0 1-4 4H4"/>', s),
  uturn: (s) => svg('<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>', s),
  roundabout: (s) => svg('<circle cx="12" cy="13" r="3.5"/><path d="M12 21v-4.5M12 9.5V3M9 6l3-3 3 3"/>', s),
  fork: (s) => svg('<path d="M16 3h5v5M8 3H3v5M12 22v-8.3a4 4 0 0 0-1.17-2.87L3 3M15 9l6-6"/>', s),
  merge: (s) => svg('<path d="m8 6 4-4 4 4M12 2v10.3a4 4 0 0 1-1.17 2.87L4 22M20 22l-5-5"/>', s),
  flag: (s) => svg('<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>', s),
  volume: (s) => svg('<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14"/>', s),
  volumeOff: (s) => svg('<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="22" y1="9" x2="16" y2="15"/><line x1="16" y1="9" x2="22" y2="15"/>', s),
  // Traffic
  cone: (s) => svg('<path d="M12 3 6.5 19h11L12 3z"/><path d="M8.7 13h6.6M3 21h18"/>', s),
  road: (s) => svg('<path d="M4 21 8 3M20 21 16 3M12 5v3M12 11v3M12 17v3"/>', s),
  // App
  download: (s) => svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>', s),
  share: (s) => svg('<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>', s),
  qr: (s) => svg('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M21 14v.01M14 21h.01M17.5 21H21v-3.5"/>', s),
  copy: (s) => svg('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>', s),
  bell: (s) => svg('<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>', s),
  flask: (s) => svg('<path d="M10 2v7.31L4.5 19a2 2 0 0 0 1.74 3h11.52a2 2 0 0 0 1.74-3L14 9.31V2M8.5 2h7M7 16h10"/>', s),
  play: (s) => svg('<polygon points="6 3 20 12 6 21 6 3"/>', s),
};
const WX_ICON = { sun: I.sun, moon: I.moon, "cloud-sun": I.cloudSun, cloud: I.cloud, fog: I.fog, drizzle: I.drizzle, rain: I.rain, storm: I.storm, snow: I.snow, wind: I.wind, heat: I.heat };
const WX_TONE = { sun: "var(--warning)", moon: "var(--violet)", "cloud-sun": "var(--warning)", cloud: "var(--text-muted)", fog: "var(--text-muted)", drizzle: "var(--accent)", rain: "var(--accent)", storm: "var(--violet)", snow: "var(--teal)", wind: "var(--teal)", heat: "var(--error)" };
const wxIcon = (name, size = 20) => (WX_ICON[name] || I.cloud)(size);
// Google maneuver names to arrows. Right-hand variants mirror the left-hand icon.
const MANEUVER_ICON = { TURN_LEFT: "turnLeft", TURN_SLIGHT_LEFT: "slightLeft", TURN_SHARP_LEFT: "sharpLeft", UTURN_LEFT: "uturn", ROUNDABOUT_LEFT: "roundabout", RAMP_LEFT: "slightLeft", FORK_LEFT: "fork", MERGE: "merge", STRAIGHT: "arrowUp", NAME_CHANGE: "arrowUp", DEPART: "navArrow", ARRIVE: "flag" };
function maneuverIcon(maneuver, size = 28) {
  const key = String(maneuver || "").toUpperCase();
  const right = key.endsWith("_RIGHT");
  const icon = I[MANEUVER_ICON[right ? key.replace(/_RIGHT$/, "_LEFT") : key] || "arrowUp"](size);
  return right ? `<span class="flip">${icon}</span>` : icon;
}
const KIND_ICON = { bus: I.bus, rail: I.train, tram: I.tram, ferry: I.ferry, mixed: I.route, rideshare: I.rideshare, car: I.car, walk: I.walk, carpool: I.users };
// Colours are CSS variables so they follow the theme; cssColour() resolves them for Leaflet.
const SEGMENT_COLOUR = { walk: "var(--seg-walk)", bus: "var(--seg-bus)", rail: "var(--seg-rail)", tram: "var(--seg-tram)", ferry: "var(--seg-ferry)", car: "var(--seg-car)", rideshare: "var(--seg-rideshare)" };
const KIND_NAME = { walk: "Walk", bus: "Bus", rail: "Train", tram: "Light rail", ferry: "Ferry", car: "Drive", rideshare: "Uber" };
const cssColour = (value) => { const m = /var\((--[\w-]+)\)/.exec(value || ""); return m ? getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() : value; };

// ── Persistent preferences (this browser only) ───────────────────────────────

const store = {
  get(name, fallback) { try { const v = localStorage.getItem(`planb.${name}`); return v === null ? fallback : JSON.parse(v); } catch { return fallback; } },
  set(name, value) { try { localStorage.setItem(`planb.${name}`, JSON.stringify(value)); } catch { /* storage unavailable: keep in memory */ } },
};

const DEFAULT_SETTINGS = {
  theme: "dark", motion: "full",
  modes: { transit: true, drive: true, rideshare: true },
  transit_modes: { bus: true, train: true, tram: true, ferry: true },
  fuel_l_per_100km: 8, fuel_type: "SP91", fuel_price_mode: "auto", fuel_price: 2.3,
  parking_cost: null, use_flat_fare: true, flat_fare: 0.5,
  budget: 10, walking: 15,
  show: { buffer: true, cost: true, walking: true, transfers: true, elevation: true, co2: true, parking: true, realtime: true },
  places: { home: "", work: "The University of Queensland, St Lucia QLD 4072" },
  place_ids: { home: null, work: null },
  watch: true, voice: false,
  factors: { bus: 0.105, rail: 0.035, tram: 0.029, ferry: 0.019 },
};

function loadSettings() {
  const saved = store.get("settings", {});
  const merged = { ...DEFAULT_SETTINGS, ...saved };
  for (const key of ["modes", "transit_modes", "show", "places", "place_ids", "factors"]) merged[key] = { ...DEFAULT_SETTINGS[key], ...(saved[key] || {}) };
  return merged;
}

const DEMO_DEFAULT = { on: false, weather: "live", disrupted: "none", traffic: "live", late_min: 0, start: "preset", simulate: true };
const settings = loadSettings();
const saveSettings = () => store.set("settings", settings);

// ── App state ────────────────────────────────────────────────────────────────

const state = {
  screen: "home", stack: ["home"],
  status: null, alerts: null, alertsError: null, weather: null, weatherError: null, weatherPlace: "Brisbane", installEvent: null,
  demo: { ...DEMO_DEFAULT, ...store.get("demo", {}) }, costOpen: false, errorKind: "error",
  nav: null,
  sync: { loading: false, feedback: null, at: null },
  purpose: "planb", form: null, plan: null, loading: false, error: null,
  sort: "best", chosenId: null,
  watch: { lines: [], seen: new Set(), alert: null },
  panic: { phase: "ask", coords: null, locating: false, dest: "", by: "", error: null },
  rides: { mine: [], loading: false, error: null, joining: null },
  dashTable: false, fuelPreview: null, fuelLoading: false,
};

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const money = (v) => (v === null || v === undefined ? "Unknown" : `$${Number(v).toFixed(2).replace(/\.00$/, "")}`);
const kg = (v) => (Math.abs(v) < 1 ? `${Math.round(v * 1000)} g` : `${v.toFixed(1)} kg`);
const timeOf = (iso) => new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Brisbane", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso)).replace(" ", " ");
const dateLabel = (iso) => new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Brisbane", weekday: "short", day: "numeric", month: "short" }).format(new Date(iso));
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const findOption = (id) => state.plan?.options.find((o) => o.id === id);
const BRISBANE_PARTS = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Brisbane", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
const brisbaneLocal = (date) => {
  const p = Object.fromEntries(BRISBANE_PARTS.formatToParts(date).map((part) => [part.type, part.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour === "24" ? "00" : p.hour}:${p.minute}`;
};
const brisbaneNowLocal = () => brisbaneLocal(new Date());
const addMinutes = (local, minutes) => brisbaneLocal(new Date(new Date(`${local}:00+10:00`).getTime() + minutes * 60000));

const hourOf = (iso) => new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Brisbane", hour: "numeric", hour12: true }).format(new Date(iso)).replace(/[  ]/g, " ");
const usd = (v) => `$${Number(v).toFixed(v < 0.1 ? 3 : 2)}`;
const fmtDist = (m) => (m < 1000 ? `${m < 100 ? Math.max(5, Math.round(m / 5) * 5) : Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`);
const fmtMins = (s) => { const m = Math.max(1, Math.round(s / 60)); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`; };
const simTag = (on) => (on ? `<span class="sim-tag">Simulated</span>` : "");
const demoOn = () => state.demo.on;
const saveDemo = () => store.set("demo", state.demo);
const demoBody = () => (demoOn() ? { weather: state.demo.weather, disrupted: state.demo.disrupted, traffic: state.demo.traffic, late_min: state.demo.late_min } : undefined);
const DEMO_PRESET = { origin: "Taringa Station, Brisbane QLD", destination: "The University of Queensland, St Lucia QLD 4072" };
const BRISBANE = [-27.4698, 153.0251];

// Geometry for live directions: distances in metres on a local flat approximation, fine at city scale.
const RAD = Math.PI / 180;
const dist = (a, b) => 6371000 * Math.hypot((b[0] - a[0]) * RAD, (b[1] - a[1]) * RAD * Math.cos((a[0] + b[0]) * RAD / 2));
const bearing = (a, b) => ((Math.atan2((b[1] - a[1]) * Math.cos(a[0] * RAD), b[0] - a[0]) / RAD) + 360) % 360;
function project(p, line) {
  let best = { d: Infinity, along: 0 }, acc = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i], b = line[i + 1], k = Math.cos(a[0] * RAD) * 6371000 * RAD;
    const bx = (b[1] - a[1]) * k, by = (b[0] - a[0]) * 6371000 * RAD, px = (p[1] - a[1]) * k, py = (p[0] - a[0]) * 6371000 * RAD;
    const len2 = bx * bx + by * by, seg = Math.sqrt(len2);
    const t = len2 ? Math.max(0, Math.min(1, (px * bx + py * by) / len2)) : 0;
    const d = Math.hypot(px - bx * t, py - by * t);
    if (d < best.d) best = { d, along: acc + seg * t };
    acc += seg;
  }
  return { ...best, total: acc };
}
function pointAlong(line, fraction) {
  const lens = line.slice(1).map((p, i) => dist(line[i], p));
  let target = lens.reduce((s, l) => s + l, 0) * Math.max(0, Math.min(1, fraction));
  for (let i = 0; i < lens.length; i++) {
    if (target <= lens[i] || i === lens.length - 1) { const t = lens[i] ? Math.min(1, target / lens[i]) : 0; return [line[i][0] + (line[i + 1][0] - line[i][0]) * t, line[i][1] + (line[i + 1][1] - line[i][1]) * t]; }
    target -= lens[i];
  }
  return line[0];
}

// ── Shared components ────────────────────────────────────────────────────────

function navbar(back, right = "") {
  const backBtn = back ? `<button class="nav-back" data-action="back" aria-label="Back to ${esc(back)}">${I.chevronLeft(20)}<span>${esc(back)}</span></button>` : "";
  return `<header class="navbar"><div class="side">${backBtn}</div><div class="side end">${right}</div></header>`;
}
const gearButton = () => `<button class="icon-btn" data-action="open-settings" aria-label="Settings">${I.gear(20)}</button>`;
const row = (icon, tone, label, value = "", extra = "") =>
  `<div class="row ${extra}"><span class="row-icon" style="--tone:${tone}">${icon}</span><span class="row-label">${label}</span>${value}</div>`;
const valueSpan = (text, strong = false) => `<span class="row-value${strong ? " strong" : ""}">${esc(text)}</span>`;
// Feedback banner: kind is warning (default), info, error or success. It fades and slides in when it is created.
function notice(text, kind = "warning") {
  const icon = kind === "info" ? I.signal(16) : kind === "success" ? I.checkCircle(16) : I.alert(16);
  return `<div class="feedback-banner ${kind}" role="${kind === "error" ? "alert" : "status"}">${icon}<span>${text}</span></div>`;
}
// Shimmer placeholders (never a spinner or "Loading…" text).
const skelLines = (label, ...widths) => `<div class="skel-stack" role="status" aria-label="${esc(label)}">${widths.map((w, i) => `<div class="skeleton skel-line${i ? " sm" : ""} w-${w}"></div>`).join("")}</div>`;
const skelBar = (label, width = 72) => `<span class="skeleton skel-line" style="width:${width}px;margin:0" aria-hidden="true"></span><span class="visually-hidden">${esc(label)}</span>`;
const skeletonCard = () => `<div class="skel-card" aria-hidden="true"><div class="skel-head"><div class="skeleton skel-tile"></div><div><div class="skeleton skel-line w-60"></div><div class="skeleton skel-line sm w-40"></div></div></div><div class="skeleton skel-block"></div><div class="skeleton skel-line w-80"></div><div class="skeleton skel-line sm w-60"></div></div>`;
function stepper(field, value, display, min, max) {
  return `<div class="stepper" role="group" aria-label="${esc(field)}">
    <button data-action="step" data-field="${field}" data-delta="-1" ${value <= min ? "disabled" : ""} aria-label="Decrease">${I.minus()}</button>
    <output aria-live="polite">${display}</output>
    <button data-action="step" data-field="${field}" data-delta="1" ${value >= max ? "disabled" : ""} aria-label="Increase">${I.plus()}</button></div>`;
}
function toggle(name, checked, label) {
  return `<label class="switch"><input type="checkbox" data-setting="${name}" ${checked ? "checked" : ""} aria-label="${esc(label)}"><span class="track"></span><span class="knob"></span></label>`;
}
function segmented(name, value, choices, action = "segment") {
  const index = Math.max(0, choices.findIndex(([v]) => v === value));
  return `<div class="segmented" role="group">
    <span class="thumb" style="width:calc((100% - 4px) / ${choices.length});transform:translateX(${index * 100}%)"></span>
    ${choices.map(([v, label]) => `<button data-action="${action}" data-name="${name}" data-value="${v}" aria-pressed="${v === value}">${esc(label)}</button>`).join("")}</div>`;
}

// ── Weather ──────────────────────────────────────────────────────────────────

// The home widget: skeleton while loading, an error line if Open-Meteo is unreachable, otherwise now, a bad-weather warning and the next hours.
function weatherInner() {
  const w = state.weather;
  if (!w) {
    return state.weatherError ? `<div class="wx-head"><p class="eyebrow">${I.cloud(14)}Weather</p></div><p class="hint">${esc(state.weatherError)}</p>`
      : `<div class="wx-skel" role="status" aria-label="Loading the weather"><div class="skeleton skel-line w-30"></div><div class="skeleton skel-block"></div><div class="skeleton skel-line w-100"></div></div>`;
  }
  const c = w.current;
  const warn = w.bad && w.warning ? `<div class="wx-warn" role="alert">${I.alert(18)}<div><b>${esc(w.warning)}${simTag(w.simulated)}</b><span>Allow extra time if your trip includes walking between stops.</span></div></div>` : "";
  const hours = (w.hours || []).slice(0, 6).map((h) => `<div class="wx-hour"><span>${hourOf(h.time)}</span>${wxIcon(h.icon, 20)}<b>${Math.round(h.temp_c)}°</b><i>${h.precip_prob >= 20 ? `${h.precip_prob}%` : ""}</i></div>`).join("");
  return `<div class="wx-head"><p class="eyebrow">${I.cloud(14)}Weather · ${esc(state.weatherPlace)}</p>${w.simulated ? `<span class="badge info">Simulated</span>` : ""}</div>
    <div class="wx-main"><div class="wx-temp">${Math.round(c.temp_c)}<sup>°</sup></div>
      <div class="wx-now"><strong>${esc(c.label)}</strong><span>Feels like ${Math.round(c.apparent_c)}° · Wind ${Math.round(c.wind_kmh)} km/h${c.gust_kmh > c.wind_kmh + 10 ? `, gusts ${Math.round(c.gust_kmh)}` : ""}${c.precip_mm > 0 ? ` · ${c.precip_mm} mm rain` : ""}</span></div>
      <span class="wx-icon" style="--tone:${WX_TONE[c.icon] || "var(--accent)"}">${wxIcon(c.icon, 28)}</span></div>
    ${warn}${hours ? `<div class="wx-hours" aria-label="Next hours">${hours}</div>` : ""}
    <p class="fine wx-foot">${esc(w.source)}${w.simulated ? "" : ` · updated ${timeOf(w.fetched_at)}`}</p>`;
}
const weatherCard = () => `<section class="wx" data-wx aria-label="Weather">${weatherInner()}</section>`;
const renderWeather = () => { const el = currentPage?.querySelector("[data-wx]"); if (el) el.innerHTML = weatherInner(); };

// ── Live status ──────────────────────────────────────────────────────────────

const live = { id: null, at: null, polledAt: 0, results: {}, failed: false };
const liveKey = (o, i) => `${state.plan?.queried_at}|${o.id}|${i}`;
const rtOf = (o, i) => live.results[liveKey(o, i)] || o.nav[i].transit.realtime;
function rtPill(rt) {
  const major = rt.status === "late" && (rt.delay_min || 0) >= 5;
  return `<span class="rt ${esc(rt.status)}${major ? " major" : ""}">${esc(rt.label)}${rt.simulated ? " · Simulated" : ""}</span>`;
}
function liveLine(o, i, pillOnly = false) {
  const rt = rtOf(o, i), v = pillOnly ? null : rt.vehicle;
  const where = v ? (v.stops_away === null || v.stops_away === undefined ? "Vehicle on the map" : v.stops_away <= 0 ? "Vehicle at your stop" : `${plural(v.stops_away, "stop")} away`) : "";
  return rtPill(rt) + (where ? `<span class="rt-veh">${I.pin(12)}${where}</span>` : "");
}
const liveSlot = (o, i) => `<span class="rt-line" data-live="${esc(o.id)}:${i}">${liveLine(o, i)}</span>`;
// Maps each transit entry of o.steps to the matching transit item in o.nav, in order. Returns the nav index or -1.
function stepNav(o) {
  const idx = (o.nav || []).map((n, i) => (n.transit ? i : -1)).filter((i) => i >= 0);
  let k = 0;
  return (s) => (["bus", "rail", "tram", "ferry"].includes(s.kind) && k < idx.length ? idx[k++] : -1);
}
const hasLive = (o) => !!o?.nav?.some((n) => n.transit?.live_query);
const liveAgeText = () => {
  if (live.failed) return "Live data unavailable. Retrying.";
  const secs = Math.max(0, Math.round((Date.now() - (live.at || Date.parse(state.plan?.queried_at) || Date.now())) / 1000));
  return `Updated ${secs < 5 ? "just now" : secs < 60 ? `${secs}s ago` : `${Math.floor(secs / 60)} min ago`}`;
};
const liveAge = () => `<span class="live-age${live.failed ? " stale" : ""}" data-live-age><span class="live-dot"></span><span>${liveAgeText()}</span></span>`;
const anySimulated = (o) => !!(o.nav?.some((n) => n.transit?.realtime.simulated) || o.realtime?.alerts?.some((a) => a.simulated));

// ── Traffic (QLDTraffic) ─────────────────────────────────────────────────────

const TRAFFIC_ICON = { crash: I.alert, hazard: I.alert, flooding: I.rain, roadworks: I.cone, "special event": I.users, congestion: I.road };
const trafficIcon = (e, size = 16) => (e.closure ? I.xCircle : TRAFFIC_ICON[e.type] || I.alert)(size);
function trafficFact(o) {
  const t = o.traffic;
  if (o.mode !== "drive" || !t) return "";
  const sim = t.source === "Simulated" ? " · Simulated" : "";
  if (t.available === false) return `<span class="fact">${I.road(14)}Traffic events unavailable</span>`;
  if (t.closure) return `<span class="fact bad">${I.xCircle(14)}Road closure on route${sim}</span>`;
  if (t.events.length) return `<span class="fact warn">${I.cone(14)}${plural(t.events.length, "traffic event")}${t.added_delay_min ? ` · +${t.added_delay_min} min` : ""}${sim}</span>`;
  return `<span class="fact good">${I.road(14)}No traffic incidents</span>`;
}
function trafficSection(o) {
  const t = o.traffic;
  if (o.mode !== "drive" || !t) return "";
  const rows = t.events.map((e) => row(trafficIcon(e), e.closure ? "var(--error)" : "var(--warning)",
    `${esc(e.title)}${e.simulated ? `<span class="tag">Simulated</span>` : ""}<small>${[e.road, e.impact, e.closure ? "Road closed" : ""].filter(Boolean).map(esc).join(" · ")}</small>`,
    e.closure ? `<span class="badge error">Closure</span>` : valueSpan(e.delay_min ? `+${e.delay_min} min` : "No delay est.", true))).join("");
  return `<p class="section-header">Traffic on your route</p><div class="group"><div class="group-card">${rows || `<div class="row"><span class="row-label">${t.available === false ? "QLDTraffic events could not be loaded, so incidents are not included." : "No incidents reported on this route."}</span></div>`}</div>
    <p class="group-footer">${t.added_delay_min ? `Incidents add about ${t.added_delay_min} min (an estimate, capped at 20). ` : ""}Google's drive time already includes normal congestion. Source: ${t.source === "Simulated" ? "Simulated demo data" : "QLDTraffic open data"}.</p></div>`;
}

// Demo mode only: what this search cost in Google API requests, collapsed to one line.
function costLine() {
  const c = state.plan?.api_cost;
  if (!demoOn() || !c) return "";
  return `<div class="cost-line"><button class="cost-toggle" data-action="toggle-cost" aria-expanded="${state.costOpen}">${I.dollar(14)}<span>Google API cost, this search</span><b>${usd(c.total_usd)}</b><span class="chev">${I.chevronRight(14)}</span></button>
    ${state.costOpen ? `<div class="cost-detail"><table class="data-table"><thead><tr><th>Request</th><th>Count</th><th>Per 1,000</th><th>Cost</th></tr></thead><tbody>${c.items.map((it) => `<tr><td>${esc(it.sku)}</td><td>${it.count}</td><td>${usd(it.unit_usd_per_1000)}</td><td>${usd(it.usd)}</td></tr>`).join("")}</tbody></table>
      <p class="fine">${esc(c.note)}</p></div>` : ""}</div>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// Screens
// ══════════════════════════════════════════════════════════════════════════════

// The Plan B mark: the direct route is broken, Plan B curves around it.
function logo(size = 40, id = "lg") {
  return `<svg width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6D70F5"/><stop offset="1" stop-color="#4F46E5"/></linearGradient></defs>
    <rect width="64" height="64" rx="15" fill="url(#${id})"/>
    <path d="M16 48 L48 16" fill="none" stroke="#fff" stroke-opacity=".38" stroke-width="4" stroke-linecap="round" stroke-dasharray="1 7"/>
    <path d="M28.5 31.5l7 7M35.5 31.5l-7 7" stroke="#FCA5A5" stroke-width="3.6" stroke-linecap="round"/>
    <path d="M16 48 C16 30 27 18 45 18" fill="none" stroke="#fff" stroke-width="5.2" stroke-linecap="round"/>
    <circle cx="16" cy="48" r="5" fill="#34D399" stroke="#fff" stroke-width="2.6"/>
    <circle cx="47" cy="17" r="6" fill="#fff"/><circle cx="47" cy="17" r="2.6" fill="#4F46E5"/></svg>`;
}

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Brisbane", hour: "numeric", hour12: false }).format(new Date())) % 24;
  return hour < 5 ? "Late night" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

const prefersReducedMotion = () => document.documentElement.dataset.motion === "reduced" || matchMedia("(prefers-reduced-motion: reduce)").matches;

function heroArt() {
  const detour = "M238 150 C238 104 262 74 314 72";
  const streets = [[0, 40, 360, 22], [0, 96, 360, 118], [0, 150, 360, 176], [60, 0, 84, 190], [150, 0, 128, 190], [262, 0, 290, 190]]
    .map(([x1, y1, x2, y2]) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`).join("");
  return `<svg class="hero-art" viewBox="0 0 360 200" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
    <defs><clipPath id="hero-wipe"><rect class="wipe" x="220" y="56" width="120" height="110"/></clipPath></defs>
    <g class="streets">${streets}</g>
    <path class="river" d="M-10 196 C80 170 120 120 210 132 S330 110 380 70"/>
    <path class="direct" d="M238 150 L314 72"/>
    <path class="broken" d="M270 105l11 11M281 105l-11 11"/>
    <g clip-path="url(#hero-wipe)"><path class="detour-glow" d="${detour}"/><path class="detour" d="${detour}"/></g>
    <circle class="start" cx="238" cy="150" r="7"/>
    <circle class="dest-ping" cx="314" cy="72" r="9"/>
    <circle class="dest" cx="314" cy="72" r="8"/><circle class="dest-core" cx="314" cy="72" r="3.4"/>
    ${prefersReducedMotion() ? "" : `<g class="bus-dot"><circle r="6.5"/><animateMotion dur="5.5s" begin="1.6s" repeatCount="indefinite" path="${detour}" keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines=".45 0 .55 1"/></g>`}
  </svg>`;
}

function homeHero(alertCount, impact) {
  const live = state.alertsError ? `<span class="banner-chip">${I.signal(14)}Live alerts unavailable</span>`
    : !state.alerts ? `<span class="skeleton skel-chip" role="status" aria-label="Checking Translink alerts"></span>`
    : `<button class="banner-chip" data-action="open-alerts"><span class="live-dot"></span>Translink live · ${plural(alertCount, "alert")}</button>`;
  return `
    <section class="hero" aria-labelledby="hero-title">
      ${heroArt()}
      <div class="hero-copy">
        <p class="eyebrow">${greeting()}</p>
        <h1 id="hero-title">When your journey goes wrong, <em>what now?</em></h1>
      </div>
      <div class="hero-chips">
        ${live}
        ${impact.co2 > 0 ? `<button class="banner-chip" data-action="go" data-screen="dashboard">${I.leaf(14)}${kg(impact.co2)} CO₂ avoided this month</button>`
          : `<button class="banner-chip" data-action="start" data-purpose="regular">${I.leaf(14)}Plan a greener trip</button>`}
      </div>
    </section>`;
}

// Live data refresh: button, then skeleton, then a success or error banner that dismisses itself after 3 seconds.
function syncCardInner() {
  const s = state.sync;
  const fb = s.feedback;
  const body = s.loading
    ? `<div class="sync-body" role="status" aria-label="Refreshing live data"><div><div class="skeleton skel-line w-60"></div><div class="skeleton skel-line sm w-40"></div></div><div class="skeleton skel-btn"></div></div>`
    : `<div class="sync-body"><div><strong>Live data</strong><span class="hint">${s.at ? `Updated ${timeOf(s.at)}` : "Translink alerts and conditions near you"}</span></div>
        <button class="btn btn-secondary" data-action="sync">${I.refresh(16)}Refresh live data</button></div>`;
  return body + (fb ? notice(esc(fb.text), fb.kind) : "");
}
const syncCard = () => `<div class="sync-card" data-sync>${syncCardInner()}</div>`;
const renderSync = () => { const el = currentPage?.querySelector("[data-sync]"); if (el) el.innerHTML = syncCardInner(); };

function homeScreen() {
  const live = state.status?.live_available;
  const alerts = (state.alerts?.alerts || []).filter((a) => a.disruptive);
  const impact = impactTotals(thisMonthTrips());
  const myRides = state.rides.mine.length;
  return `
    <div class="scroll tight">
      <div class="home-top"><span class="brand">${logo(36, "lg-home")}<span class="wordmark">Plan<span>B</span></span></span><div class="home-actions"><button class="icon-btn${demoOn() ? " on" : ""}" data-action="open-demo" aria-label="Demo mode">${I.flask(20)}</button>${gearButton()}</div></div>
      ${homeHero(alerts.length, impact)}
      <button class="panic-btn" data-action="go" data-screen="panic">
        <span class="panic-icon">${I.bolt(24)}</span>
        <span><strong>Panic mode</strong><small>Get me there now. One answer, no decisions.</small></span>
      </button>
      ${weatherCard()}
      <p class="section-header">Plan</p>
      <div class="group"><div class="group-card">
        <button class="row lg" data-action="start" data-purpose="planb"><span class="row-icon" style="--tone:var(--warning)">${I.alert(20)}</span><span class="row-label">My journey is disrupted<small>Compare alternatives against your deadline</small></span><span class="chev">${I.chevronRight()}</span></button>
        <button class="row lg" data-action="start" data-purpose="regular"><span class="row-icon" style="--tone:var(--success)">${I.leaf(20)}</span><span class="row-label">Plan a trip<small>Everyday routes, public transport first</small></span><span class="chev">${I.chevronRight()}</span></button>
      </div></div>
      <p class="section-header">Right now</p>
      <button class="tile-card" data-action="open-alerts">
        <div class="tile-head"><h3>${state.alerts ? `<span class="live-dot"></span>` : ""}Translink right now</h3>${I.chevronRight()}</div>
        ${state.alertsError ? `<p class="hint">${esc(state.alertsError)}</p>`
          : !state.alerts ? skelLines("Checking live service alerts", 80, 60)
          : alerts.length ? `<div class="alert-list-mini">${alerts.slice(0, 3).map((a) => `<p>${a.lines.slice(0, 2).map((l) => `<span class="line-tag">${esc(l)}</span>`).join("")}<span>${esc(a.header)}</span></p>`).join("")}</div>
            <p class="fine" style="margin-top:12px">${plural(alerts.length, "active disruption alert")} from Translink GTFS-Realtime</p>`
          : `<p class="hint">No disruption alerts reported.</p>`}
      </button>
      ${syncCard()}
      <p class="section-header">Impact and sharing</p>
      <button class="tile-card" data-action="go" data-screen="dashboard">
        <div class="tile-head"><h3>${I.leaf(16)}Your impact this month</h3>${I.chevronRight()}</div>
        <div class="stat-row">
          <div class="stat"><b>${kg(impact.co2)}</b><span>CO₂ avoided</span></div>
          <div class="stat"><b>${money(impact.saved)}</b><span>saved vs driving</span></div>
          <div class="stat"><b>${impact.greenTrips}</b><span>low-car trips</span></div>
        </div>
      </button>
      <button class="tile-card" data-action="go" data-screen="rides">
        <div class="tile-head"><h3>${I.users(16)}Shared rides</h3>${I.chevronRight()}</div>
        <p class="hint">${myRides ? `You're in ${plural(myRides, "shared ride")}.` : "Disrupted with lots of others? Share a car or split an Uber with people heading your way."}</p>
      </button>
      <p class="section-header">Get the app</p>
      <div class="group"><div class="group-card">
        ${canInstall() ? `<button class="row" data-action="install"><span class="row-icon" style="--tone:var(--accent)">${I.download(18)}</span><span class="row-label">Install Plan B<small>Add it to your home screen for background alerts</small></span><span class="chev">${I.chevronRight()}</span></button>` : ""}
        <button class="row" data-action="open-share"><span class="row-icon" style="--tone:var(--teal)">${I.qr(18)}</span><span class="row-label">Share this app<small>QR code and link for friends and testers</small></span><span class="chev">${I.chevronRight()}</span></button>
      </div></div>
      ${live === false ? notice("Live search is off: no Google Maps API key was found on the server. See the README.", "error") : ""}
      <p class="fine" style="margin-top:24px"><a href="demo.html">Fictional interview scenario</a> · Estimates only, always check before you travel</p>
    </div>`;
}

function placeChips(field) {
  const chips = [];
  if (field === "origin") chips.push(`<button class="chip" data-action="use-location">${I.locate(14)}Current location</button>`);
  if (settings.places.home) chips.push(`<button class="chip" data-action="fill-place" data-field="${field}" data-place="home">${I.home(14)}Home</button>`);
  if (settings.places.work) chips.push(`<button class="chip" data-action="fill-place" data-field="${field}" data-place="work">${I.pin(14)}Work/Uni</button>`);
  return chips.length ? `<div class="place-chips">${chips.join("")}</div>` : "";
}

function journeyScreen() {
  const f = state.form;
  const planB = state.purpose === "planb";
  const modes = [settings.modes.transit && "Public transport", settings.modes.drive && "My car", settings.modes.rideshare && "Uber"].filter(Boolean).join(", ") || "None";
  return `
    ${navbar("Home", gearButton())}
    <div class="scroll">
      <p class="eyebrow">${planB ? "Disrupted journey" : "Plan a trip"}</p>
      <h2 class="large-title">${planB ? "Where do you need to be?" : "Where are you going?"}</h2>
      <p class="subtitle">${planB ? "Tell us your deadline. We'll find what still gets you there, using live Translink alerts." : "Public transport options come first, with the true cost of driving alongside."}</p>
      <p class="section-header">Journey</p>
      <div class="group"><div class="group-card">
        <div class="row field-row"><span class="row-icon" style="--tone:var(--success)">${I.walk(18)}</span><div class="place-input"><label for="f-origin">From</label><input id="f-origin" type="text" data-field="origin" ${acAttrs("form.origin")} value="${esc(f.origin)}" placeholder="Address, stop or place" autocomplete="off"></div></div>
        ${placeChips("origin")}
        <div class="row field-row"><span class="row-icon" style="--tone:var(--error)">${I.pin(18)}</span><div class="place-input"><label for="f-destination">To</label><input id="f-destination" type="text" data-field="destination" ${acAttrs("form.destination")} value="${esc(f.destination)}" placeholder="Address or place" autocomplete="off"></div></div>
        ${placeChips("destination")}
      </div></div>
      <p class="section-header">When</p>
      <div class="group"><div class="group-card">
        <div class="row"><span class="row-icon" style="--tone:var(--accent)">${I.clock(18)}</span><span class="row-label">Leave now</span>${toggle("form.leave_now", f.leave_now, "Leave now")}</div>
        ${f.leave_now ? "" : row(I.clock(18), "var(--violet)", "Leave at", `<input type="datetime-local" data-field="departure" value="${esc(f.departure)}" aria-label="Departure time">`)}
        ${row(I.hourglass(18), "var(--warning)", planB ? "Arrive by" : "Arrive by <small>Optional</small>", `<input type="datetime-local" data-field="deadline" value="${esc(f.deadline)}" aria-label="Arrival deadline">`)}
      </div>
      <p class="group-footer">Brisbane time.${planB ? "" : " Leave the deadline empty to just see the options."}</p></div>
      <p class="section-header">Limits</p>
      <div class="group"><div class="group-card">
        ${row(I.dollar(18), "var(--success)", "Max cost", stepper("budget", f.budget, `$${f.budget}`, 0, 200))}
        ${row(I.walk(18), "var(--accent)", "Max walking", stepper("walking", f.walking, `${f.walking} min`, 0, 60))}
      </div></div>
      ${planB ? `<p class="section-header">What was disrupted? (optional)</p>
      <div class="group"><div class="group-card">
        <div class="row field-row"><span class="row-icon" style="--tone:var(--error)">${I.alert(18)}</span><div class="place-input"><input type="text" data-field="avoid" value="${esc(f.avoid)}" placeholder="Bus or train line, e.g. 412" aria-label="Disrupted service"></div></div>
      </div><p class="group-footer">Routes using this service are flagged. Live Translink alerts are checked automatically.</p></div>` : ""}
      <div class="group"><div class="group-card">
        <button class="row" data-action="open-settings"><span class="row-icon" style="--tone:var(--violet)">${I.route(18)}</span><span class="row-label">Ways to travel<small>${esc(modes)}</small></span><span class="chev">${I.chevronRight()}</span></button>
      </div></div>
      ${state.error ? notice(esc(state.error), state.errorKind) : ""}
    </div>
    <footer class="sticky">
      <button class="btn btn-primary${state.loading ? " is-loading" : ""}" data-action="search" ${state.loading || !state.status?.live_available ? "disabled" : ""} ${state.loading ? 'aria-busy="true"' : ""}>
        ${state.loading ? skelBar("Checking routes and live services", 120) : planB ? "Find my Plan B" : "Show routes"}
      </button>
    </footer>`;
}

// ── Option cards ─────────────────────────────────────────────────────────────

function bufferInfo(o) {
  if (o.buffer_minutes === undefined) return { text: `${o.duration_minutes} min trip`, cls: "none" };
  const b = o.buffer_minutes;
  return { text: b >= 0 ? `${b} min early` : `${-b} min late`, cls: b < 0 ? "late" : b < 5 ? "tight" : "good" };
}

function leaveLabel(o, sentence = false) {
  const wait = Math.round((new Date(o.leave_at) - new Date(state.plan.departure)) / 60000);
  if (wait <= 2) return sentence ? "Go now" : "Leave now";
  return `Leave by ${timeOf(o.leave_at)}`;
}

function climbFact(o) {
  if (!o.elevation) return "";
  const g = o.elevation.gain_m;
  if (g < 10) return `<span class="fact good">${I.mountain(14)}Flat walk</span>`;
  if (g < 30) return `<span class="fact">${I.mountain(14)}Gentle climb +${g} m</span>`;
  return `<span class="fact warn">${I.mountain(14)}Uphill walk +${g} m</span>`;
}

function realtimeFact(o) {
  const rt = o.realtime;
  if (!rt) return "";
  const disruptive = rt.alerts.filter((a) => a.disruptive);
  const sim = anySimulated(o) ? " · Simulated" : "";
  if (disruptive.length) return `<span class="fact bad">${I.alert(14)}Translink alert${sim}</span>`;
  if (!rt.checked) return rt.error ? `<span class="fact">${I.signal(14)}Live status unavailable</span>` : "";
  if (rt.delay > 2) return `<span class="fact warn">${I.signal(14)}Running ~${rt.delay} min late${sim}</span>`;
  if (rt.cancelled) return `<span class="fact warn">${I.signal(14)}${plural(rt.cancelled, "cancelled trip")} today</span>`;
  return `<span class="fact good">${I.signal(14)}Running to schedule</span>`;
}

const weatherFact = (o) => (o.weather_warning ? `<span class="fact warn">${wxIcon(state.plan?.weather?.current?.icon || "rain", 14)}${esc(o.weather_warning)}${state.plan?.weather?.simulated ? " · Simulated" : ""}</span>` : "");

function parkingFact(o) {
  if (o.mode !== "drive" || !o.parking_note) return "";
  const p = o.parking;
  const cls = !p ? "" : !p.count ? "bad" : p.any_paid ? "warn" : "good";
  return `<span class="fact ${cls}">${I.parking(14)}${esc(o.parking_note)}</span>`;
}

function ecoFact(o) {
  if (!state.plan?.baseline || o.co2_kg === undefined) return "";
  const saved = o.vs_drive?.co2_saved_kg;
  if (o.mode !== "transit") return `<span class="fact">${I.leaf(14)}${kg(o.co2_kg)} CO₂</span>`;
  return `<span class="fact ${saved > 0 ? "good" : ""}">${I.leaf(14)}${kg(o.co2_kg)} CO₂${saved > 0.05 ? ` · ${kg(saved)} less than driving` : ""}</span>`;
}

function tradeoff(o) {
  if (o.mode === "rideshare") return "Open Uber for the live price and pickup time. It's door to door, but costs more than public transport.";
  const parts = [];
  if (o.buffer_minutes !== undefined) parts.push(`Arrives ${bufferInfo(o).text}`);
  else parts.push(`About ${o.duration_minutes} minutes`);
  if (o.mode === "transit") {
    parts.push(o.transfers ? plural(o.transfers, "change") : "no changes");
    if (o.walking_minutes !== null) parts.push(`${o.walking_minutes} min walking${o.elevation && o.elevation.gain_m >= 30 ? " with a climb" : ""}`);
  }
  if (o.vs_drive?.cost_saved > 0.5) parts.push(`saves ${money(o.vs_drive.cost_saved)} on driving`);
  if (o.mode === "drive" && o.parking?.any_paid) parts.push("plus paid parking at the other end");
  let text = parts.join(", ") + ".";
  if (!o.fits && o.reasons.length) text += ` ${o.reasons[0].text}.`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function badge(o) {
  if (o.fits) return o.buffer_minutes !== undefined && o.buffer_minutes < 5
    ? `<span class="badge tight">${I.alert(12)}Tight</span>` : `<span class="badge success">${I.checkCircle(12)}Fits</span>`;
  const hard = o.reasons.some((r) => ["deadline", "disruption"].includes(r.limit));
  return `<span class="badge ${hard ? "error" : "warning"}">${hard ? I.xCircle(12) : I.alert(12)}${hard ? (o.reasons[0].limit === "disruption" ? "Disrupted" : "Late") : "Check"}</span>`;
}

function optionCard(o, index, highlight) {
  const show = settings.show;
  const icon = (KIND_ICON[o.kind] || I.route)(20);
  const b = bufferInfo(o);
  const costOver = o.reasons.some((r) => r.limit === "cost" && o.cost_known);
  const walkOver = o.reasons.some((r) => r.limit === "walking");
  const facts = [
    show.realtime ? realtimeFact(o) : "", weatherFact(o), trafficFact(o), show.elevation ? climbFact(o) : "",
    show.parking ? parkingFact(o) : "", show.co2 ? ecoFact(o) : "",
    o.vs_drive?.cost_saved > 0.5 && show.cost ? `<span class="fact good">${I.dollar(14)}Saves ${money(o.vs_drive.cost_saved)} vs driving</span>` : "",
  ].filter(Boolean).join("");
  const sub = [o.subtitle, o.mode === "transit" ? leaveLabel(o) : `${o.duration_minutes} min`, show.transfers && o.transfers ? plural(o.transfers, "transfer") : ""].filter(Boolean).join(" · ");
  const stats = [
    show.cost ? `<span class="${costOver ? "over" : ""}"><b>${o.cost_known ? money(o.cost) : o.mode === "rideshare" ? "In Uber" : o.cost !== null && o.cost !== undefined ? `${money(o.cost)}+` : "?"}</b> ${o.mode === "transit" ? "fare" : "cost"}</span>` : "",
    show.walking && o.walking_minutes !== null ? `<span class="${walkOver ? "over" : ""}"><b>${o.walking_minutes} min</b> walk</span>` : "",
  ].join("");
  return `
    <article class="card ${highlight}" style="animation-delay:${index * 55}ms">
      <button class="card-body" data-action="open-sheet" data-id="${esc(o.id)}" aria-label="Details for ${esc(o.title)}">
        <div class="card-head">
          <div class="card-title"><span class="mode-tile ${esc(o.kind)}">${icon}</span>
            <div style="min-width:0"><div class="card-name">${esc(o.title)}</div><div class="card-sub">${esc(sub)}</div></div></div>
          ${badge(o)}
        </div>
        <div class="arrival-box">
          <div><div class="arrival-time">${o.mode === "rideshare" ? "~" : ""}${timeOf(o.arrival)}</div>
          ${show.buffer ? `<div class="buffer ${b.cls}">${b.text}</div>` : ""}</div>
          <div class="stats">${stats}</div>
        </div>
        ${facts ? `<div class="facts">${facts}</div>` : ""}
        <p class="tradeoff">${esc(tradeoff(o))}</p>
      </button>
      ${o.mode === "rideshare"
        ? `<a class="card-action" href="${esc(o.uber_url)}" target="_blank" rel="noopener noreferrer">Open in Uber ${I.external(16)}</a>`
        : `<button class="card-action ${o.fits ? "" : "quiet"}" data-action="${o.fits ? "choose" : "open-sheet"}" data-id="${esc(o.id)}">${o.fits ? "Choose this option" : "See why it doesn't fit"}</button>`}
    </article>`;
}

const SORTS = [["best", "Best fit"], ["pt", "Public transport first"], ["arrival", "Earliest"], ["cost", "Cheapest"], ["walking", "Least walking"], ["co2", "Lowest CO₂"]];
const SORT_WHY = {
  best: "Options inside every limit come first, then the earliest arrival.",
  pt: "Public transport comes first, then whatever fits your limits, then the earliest arrival.",
  arrival: "Earliest estimated arrival first.",
  cost: "Lowest known total cost first. Unknown costs go last.",
  walking: "Least walking first.",
  co2: "Lowest estimated CO₂ first.",
};

function sortedOptions() {
  const list = [...state.plan.options];
  const arrival = (a, b) => new Date(a.arrival) - new Date(b.arrival);
  const known = (o, key) => (o[key] === null || o[key] === undefined ? Infinity : o[key]);
  const by = {
    best: (a, b) => Number(b.fits) - Number(a.fits) || arrival(a, b),
    pt: (a, b) => Number(b.mode === "transit") - Number(a.mode === "transit") || Number(b.fits) - Number(a.fits) || arrival(a, b),
    arrival,
    cost: (a, b) => (a.cost_known ? a.cost : Infinity) - (b.cost_known ? b.cost : Infinity) || arrival(a, b),
    walking: (a, b) => known(a, "walking_minutes") - known(b, "walking_minutes") || arrival(a, b),
    co2: (a, b) => known(a, "co2_kg") - known(b, "co2_kg") || arrival(a, b),
  }[state.sort];
  return list.sort(by);
}

const ridesTile = (title, text) => `<button class="tile-card" data-action="go" data-screen="rides"><div class="tile-head"><h3>${I.users(16)}${title}</h3>${I.chevronRight()}</div><p class="hint">${text}</p></button>`;

function resultsScreen() {
  const p = state.plan;
  const f = state.form;
  const planB = p.purpose === "planb";
  const options = sortedOptions();
  const fit = options.filter((o) => o.fits).length;
  const chips = `<div class="chips">
      ${p.deadline ? `<span class="chip">${I.clock(14)}By ${timeOf(p.deadline)}</span>` : ""}
      <span class="chip">${I.dollar(14)}$${f.budget} max</span>
      <span class="chip">${I.walk(14)}${f.walking} min walk</span>
      ${state.alerts ? `<span class="chip live"><span class="live-dot"></span>Translink live</span>` : ""}
    </div>`;
  const sortChips = `<div class="chips" role="group" aria-label="Sort options">${SORTS.map(([v, label]) => `<button class="chip" data-action="sort" data-value="${v}" aria-pressed="${state.sort === v}">${esc(label)}</button>`).join("")}</div>`;
  let body;
  if (state.loading) {
    body = `<div class="cards" role="status" aria-label="Finding options">${skeletonCard()}${skeletonCard()}${skeletonCard()}</div>`;
  } else if (!options.length) {
    body = `<div class="empty-card"><div class="empty-icon">${I.alert(24)}</div><h3>No routes found</h3><p>${p.errors.length ? esc(p.errors.join(" ")) : "Try another time, place or travel mode."}</p></div>`;
  } else {
    const noneFit = !fit && p.deadline;
    body = (noneFit ? `<div class="empty-card"><div class="empty-icon">${I.alert(24)}</div><h3>No option meets all your limits</h3><p>Every option misses at least one limit. Each card says which one. Change a limit deliberately, or choose and verify.</p></div>` : "")
      + `<p class="why-rank">${esc(SORT_WHY[state.sort])}</p>`
      + `<div class="cards">${options.map((o, i) => optionCard(o, i, i === 0 && o.fits ? "best" : "")).join("")}</div>`;
  }
  const rides = p.rides?.length ? ridesTile(`${plural(p.rides.length, "shared ride")} heading your way`, "Share a car or split an Uber. It costs less for everyone and means fewer cars.")
    : ridesTile("Going this way with others?", "Offer spare seats or start a split Uber on the shared ride board.");
  const fuel = p.fuel?.price ? `Driving cost uses ${p.fuel.manual ? "your fuel price of" : `the average ${esc(p.fuel.fuel_type)} price near your start (${p.fuel.stations} stations, Google Places):`} $${p.fuel.price.toFixed(2)}/L at ${settings.fuel_l_per_100km} L/100 km.` : "Fuel price unavailable. Driving cost is incomplete.";
  return `
    ${navbar("Edit", gearButton())}
    <div class="scroll tight">
      ${chips}
      <div class="heading-row"><div><p class="eyebrow">${planB ? "Plan B options" : "Routes"}</p><h2>${planB ? "Choose your Plan B" : "Your options"}</h2>
        ${state.loading ? `<div class="skeleton skel-line sm w-60" role="status" aria-label="Updating options" style="margin-top:8px"></div>` : `<p>${fit} of ${options.length} fit your limits</p>`}</div>
        <button class="icon-btn" data-action="map-overview" aria-label="Show all routes on a map">${I.route(20)}</button></div>
      ${sortChips}
      <div style="height:16px"></div>
      ${state.error ? notice(esc(state.error), state.errorKind) : ""}
      ${costLine()}
      ${body}
      ${rides}
      ${p.errors.length && options.length ? notice(esc(p.errors.join(" ")), "error") : ""}
      ${p.notes.map((n) => notice(esc(n), "info")).join("")}
      <p class="fine" style="margin:16px 4px 0">Route times from Google Maps, checked ${timeOf(p.queried_at)}. ${fuel} CO₂ figures are estimates (see Settings). Always check services before you travel.</p>
    </div>`;
}

// ── Detail sheet ─────────────────────────────────────────────────────────────

function limitCheck(label, ok, detail) {
  const cls = ok === null ? "na" : ok ? "ok" : "no";
  const icon = ok === null ? I.minus(12) : ok ? I.check(13) : I.x(12);
  return `<div class="row"><span class="check ${cls}">${icon}</span><span class="row-label">${label}</span><span class="row-value">${esc(detail)}</span></div>`;
}

// The map slot shows a shimmer until Leaflet has loaded (see mountMaps).
function mapBlock(id, caption = "") {
  return `<div class="map-wrap" data-map-wrap="${esc(id)}"><div class="map" data-map="${esc(id)}"><div class="skeleton map-skeleton" role="status" aria-label="Loading map"></div></div>
    <div class="map-controls">
      <button data-action="map-zoom" data-delta="1" aria-label="Zoom in">${I.plus(18)}</button>
      <button data-action="map-zoom" data-delta="-1" aria-label="Zoom out">${I.minus(18)}</button>
      <button data-action="map-fit" aria-label="Fit route">${I.fit()}</button>
      <button data-action="map-expand" aria-label="Expand map">${I.expand()}</button>
    </div></div>
    <div class="map-legend">${caption}</div>`;
}

function legendFor(o) {
  const kinds = [...new Set(o.segments.map((s) => s.kind))];
  return kinds.map((k) => `<span><i class="${k === "walk" ? "dash" : ""}" style="background:${SEGMENT_COLOUR[k] || "var(--accent)"}"></i>${KIND_NAME[k] || k}</span>`).join("")
    + `<span><i class="dot" style="background:var(--success)"></i>Start</span><span><i class="dot" style="background:var(--error)"></i>Destination found by Google</span>`;
}

function sheetContent(o) {
  const f = state.form;
  const lim = Object.fromEntries(o.reasons.map((r) => [r.limit, r]));
  const b = bufferInfo(o);
  const rt = o.realtime;
  const explain = o.fits
    ? `<div class="explain success"><h4>${o.buffer_minutes !== undefined && o.buffer_minutes < 5 ? "Fits, but with little spare time" : "Meets every limit"}</h4><p>${esc(tradeoff(o))}</p></div>`
    : `<div class="explain ${o.reasons.some((r) => ["deadline", "disruption"].includes(r.limit)) ? "error" : "warning"}"><h4>Check before choosing${anySimulated(o) ? simTag(true) : ""}</h4>${o.reasons.map((r) => `<p>${esc(r.text)}</p>`).join("")}</div>`;
  const alerts = rt?.alerts?.length ? `<p class="section-header">Translink alerts</p><div class="group"><div class="group-card">${rt.alerts.map((a) =>
      `<div class="row top"><span class="row-label"><b>${esc(a.effect)}:</b> ${esc(a.header)}${a.simulated ? `<span class="tag">Simulated</span>` : ""}<small>${esc(a.description.slice(0, 220))}${a.description.length > 220 ? "…" : ""}</small></span></div>`).join("")}</div></div>` : "";
  const breakdown = (o.cost_breakdown || []).map((item) => row(I.dollar(16), "var(--success)", esc(item.label), valueSpan(money(item.amount), true))).join("");
  const parking = o.mode === "drive" && o.parking ? `<p class="section-header">Parking near the destination</p><div class="group"><div class="group-card">
      ${o.parking.parks.length ? o.parking.parks.map((pk) => row(I.parking(16), "var(--accent)", `${esc(pk.name)}<small>${pk.distance_m} m from destination${pk.paid ? " · paid" : ""}${pk.free ? " · free option" : ""}</small>`)).join("")
        : `<div class="row"><span class="row-label">No car parks listed within ${o.parking.radius_m} m. Parking may be hard to find.</span></div>`}
    </div><p class="group-footer">Car parks from Google Places. Parking prices aren't published there. Set a typical parking cost in Settings to include it.</p></div>` : "";
  const stepOf = stepNav(o);
  const steps = o.steps.slice(0, 12).map((s) => { const ni = stepOf(s); return row((KIND_ICON[s.kind] || I.route)(16), SEGMENT_COLOUR[s.kind] || "var(--accent)", `${esc(s.title)}${s.board_time ? `<small>Board at ${esc(s.board_time)}${s.stops ? ` · ${plural(s.stops, "stop")}` : ""}</small>` : ""}${s.directions?.length > 1 ? `<small>${s.directions.map(esc).join(" · ")}</small>` : ""}${ni >= 0 ? liveSlot(o, ni) : ""}`, s.minutes ? valueSpan(`${s.minutes} min`) : ""); }).join("");
  const weather = o.weather_warning ? `<div class="explain warning"><h4>Weather${simTag(state.plan.weather?.simulated)}</h4><p>${esc(o.weather_warning)}</p></div>` : "";
  const elevation = o.elevation ? row(I.mountain(16), "var(--teal)", "Walking climb", valueSpan(`+${o.elevation.gain_m} m / −${o.elevation.loss_m} m`, true)) : "";
  return `
    <div class="grabber"><span></span></div>
    <div class="sheet-head"><h3 id="sheet-title">${esc(o.title)}</h3><button class="icon-btn" data-action="close-sheet" aria-label="Close">${I.x(18)}</button></div>
    <div class="sheet-scroll">
      <div class="big-arrival">
        <div><div class="t">${timeOf(o.arrival)}</div><div class="buffer ${b.cls}">${b.text}</div></div>
        <div class="d">${leaveLabel(o)}${state.plan.deadline ? `<br>Deadline ${timeOf(state.plan.deadline)}` : ""}${o.scheduled_arrival ? `<br>Timetable ${timeOf(o.scheduled_arrival)}` : ""}</div>
      </div>
      ${explain}
      ${weather}
      ${o.segments?.length ? mapBlock(o.id, legendFor(o)) : ""}
      <p class="section-header">Your limits</p>
      <div class="group"><div class="group-card">
        ${state.plan.deadline ? limitCheck("Deadline", !lim.deadline, b.text) : ""}
        ${limitCheck(`Cost ($${f.budget})`, o.cost_known ? !lim.cost : null, o.cost_known ? money(o.cost) : "Unknown")}
        ${limitCheck(`Walking (${f.walking} min)`, o.walking_minutes === null ? null : !lim.walking, o.walking_minutes === null ? "Unknown" : `${o.walking_minutes} min`)}
        ${o.mode === "transit" ? limitCheck("Live service status", rt ? (rt.checked ? !lim.disruption : null) : null, rt?.checked ? (lim.disruption ? "Alert" : rt.delay > 2 ? `~${rt.delay} min late` : "No alerts") : "Not checked") : ""}
      </div></div>
      <p class="section-header">Journey</p>
      <div class="group"><div class="group-card">
        ${row(I.clock(16), "var(--violet)", "Travel time", valueSpan(`${o.duration_minutes} min`, true))}
        ${o.mode === "transit" ? row(I.transfer(16), "var(--warning)", "Transfers", valueSpan(String(o.transfers), true)) : ""}
        ${elevation}
        ${o.distance_km ? row(I.route(16), "var(--teal)", "Distance", valueSpan(`${o.distance_km} km`, true)) : ""}
        ${o.co2_kg !== undefined ? row(I.leaf(16), "var(--success)", "Estimated CO₂", valueSpan(kg(o.co2_kg), true)) : ""}
        ${o.traffic?.added_delay_min ? row(I.cone(16), "var(--warning)", "Traffic incidents", valueSpan(`+${o.traffic.added_delay_min} min${o.traffic.source === "Simulated" ? " · Simulated" : ""}`, true)) : ""}
        ${o.vs_drive ? row(I.car(16), "var(--text-muted)", "Compared with driving", valueSpan(`${o.vs_drive.minutes >= 0 ? "+" : ""}${o.vs_drive.minutes} min · ${o.vs_drive.co2_saved_kg >= 0 ? "−" : "+"}${kg(Math.abs(o.vs_drive.co2_saved_kg))}${o.vs_drive.cost_saved !== null ? ` · ${o.vs_drive.cost_saved >= 0 ? "saves" : "costs"} ${money(Math.abs(o.vs_drive.cost_saved))}` : ""}`)) : ""}
      </div><p class="group-footer">${esc(o.cost_label || "")}${o.elevation?.source ? ` · Elevation: ${esc(o.elevation.source)}` : ""}</p></div>
      ${breakdown ? `<p class="section-header">Cost breakdown</p><div class="group"><div class="group-card">${breakdown}</div></div>` : ""}
      ${trafficSection(o)}
      ${parking}
      ${alerts}
      <div class="section-live"><p class="section-header">Steps</p>${hasLive(o) ? liveAge() : ""}</div>
      <div class="group"><div class="group-card">${steps}</div></div>
    </div>
    <div class="sheet-foot">
      ${o.mode === "rideshare"
        ? `<a class="btn btn-inverse" href="${esc(o.uber_url)}" target="_blank" rel="noopener noreferrer">Open in Uber for the live price ${I.external()}</a>`
        : `<button class="btn ${o.fits ? "btn-primary" : "btn-secondary"}" data-action="choose" data-id="${esc(o.id)}">${o.fits ? "Choose this option" : "Choose anyway"}</button>`}
    </div>`;
}

// ── Next steps ───────────────────────────────────────────────────────────────

function nextScreen() {
  const o = findOption(state.chosenId);
  if (!o) return resultsScreen();
  const b = bufferInfo(o);
  const stepOf = stepNav(o);
  const steps = o.steps.slice(0, 14).map((s, i, all) => {
    const last = i === all.length - 1;
    const ni = stepOf(s);
    return `<div class="step"><div class="step-rail"><span class="step-num ${last ? "arrive" : ""}">${last ? I.check(16) : i + 1}</span>${last ? "" : '<span class="step-line"></span>'}</div>
      <div class="step-body"><span class="ic" style="color:${SEGMENT_COLOUR[s.kind] || "var(--accent)"}">${(KIND_ICON[s.kind] || I.route)(20)}</span><div><p>${esc(s.title)}</p>${s.board_time || s.minutes ? `<small>${[s.board_time && `Board at ${s.board_time}`, s.minutes && `about ${s.minutes} min`].filter(Boolean).join(" · ")}</small>` : ""}${ni >= 0 ? liveSlot(o, ni) : ""}</div></div></div>`;
  }).join("");
  const logged = store.get("trips", []).some((t) => t.ref === tripRef(o));
  const watchAlert = state.watch.alert;
  return `
    ${navbar("Options", gearButton())}
    <div class="scroll">
      ${watchAlert ? `<div class="watch-banner" role="alert">${I.alert(20)}<div><p><b>New disruption on ${esc(watchAlert.lines.join(", "))}:</b> ${esc(watchAlert.header)}</p><button class="btn btn-primary" data-action="replan">See my alternatives</button></div></div>` : ""}
      <div class="confirm ${o.fits ? "" : "warn"}">
        <p class="eyebrow">${o.fits ? I.checkCircle(16) : I.alert(16)}${o.fits ? "Plan B confirmed" : "Chosen, but outside your limits"}</p>
        <h2>${esc(o.title)}</h2>
        <div class="confirm-grid">
          <div><span>Arrival</span><b>${timeOf(o.arrival)}</b></div>
          <div><span>${state.plan.deadline ? "Buffer" : "Trip"}</span><b>${b.text}</b></div>
          <div><span>Cost</span><b>${o.cost_known ? money(o.cost) : "Unknown"}</b></div>
          <div><span>CO₂ avoided vs driving</span><b>${o.vs_drive ? kg(Math.max(0, o.vs_drive.co2_saved_kg)) : "–"}</b></div>
        </div>
      </div>
      ${o.weather_warning ? notice(`<b>Weather:</b> ${esc(o.weather_warning)}${state.plan.weather?.simulated ? " (Simulated)" : ""}`) : ""}
      ${o.traffic?.closure ? notice("<b>Road closure on this route.</b> Check the closure before you leave.", "error") : o.traffic?.added_delay_min ? notice(`<b>Traffic incidents:</b> about ${o.traffic.added_delay_min} min added${o.traffic.source === "Simulated" ? " (Simulated)" : ""}.`) : ""}
      <div class="actions">
        ${o.nav?.length ? `<button class="btn btn-primary" data-action="start-nav" data-id="${esc(o.id)}">${I.navArrow(18)}Start directions</button>` : ""}
        <button class="btn ${logged ? "btn-secondary" : "btn-success"}" data-action="log-trip" ${logged ? "disabled" : ""}>${logged ? `${I.check(16)}Added to your impact` : `${I.leaf(18)}I'm taking this trip`}</button>
        <div class="btn-row">
          <a class="btn btn-secondary" href="${esc(o.maps_url)}" target="_blank" rel="noopener noreferrer" aria-label="Open in Google Maps">Google Maps ${I.external(16)}</a>
          <a class="btn btn-secondary" href="https://jp.translink.com.au/plan-your-journey/journey-planner" target="_blank" rel="noopener noreferrer">Translink ${I.external(16)}</a>
        </div>
      </div>
      ${o.mode === "transit" ? `<div class="group"><div class="group-card">
        <div class="row"><span class="row-icon" style="--tone:var(--error)">${I.signal(18)}</span><span class="row-label">Watch for disruptions<small>Checks Translink every minute while this app is open</small></span>${toggle("watch", settings.watch, "Watch for disruptions")}</div>
        <div class="row"><span class="row-icon" style="--tone:var(--accent)">${I.bell(18)}</span><span class="row-label">Watch this trip in the background<small>Get a notification even when Plan B is closed</small></span>${toggle("bg.watch", bgWatchActive(o), "Watch this trip in the background")}</div>
        <div class="bg-slot" data-bg-slot>${bgSlotInner()}</div>
      </div><p class="group-footer">Background alerts need HTTPS${isIos() ? ", and on iPhone Plan B must be added to your Home Screen first" : ""}. They are sent by this Plan B server.</p></div>` : ""}
      <div class="section-live"><p class="section-header">Step-by-step</p>${hasLive(o) ? liveAge() : ""}</div>
      <div class="timeline">${steps}</div>
      ${o.segments?.length ? `<p class="section-header">Route map</p>${mapBlock(o.id, legendFor(o))}` : ""}
      ${ridesTile("Share this trip", "Have spare seats, or want to split an Uber? Post it to the shared ride board.")}
      ${notice("Estimates only. Check the service, stops and walking path before you travel.")}
    </div>
    <footer class="sticky"><button class="btn btn-primary" data-action="done">Done</button></footer>`;
}

// ── Panic mode ───────────────────────────────────────────────────────────────

function panicScreen() {
  const pm = state.panic;
  const top = `<div class="panic-top"><span class="panic-label">${I.bolt(14)}PANIC MODE</span><button class="panic-exit" data-action="exit-panic">Exit</button></div>`;
  if (pm.phase === "answer" && state.plan) {
    const o = findOption(state.plan.recommended_id);
    if (o) {
      const late = state.plan.deadline && o.buffer_minutes < 0;
      const stepOf = stepNav(o);
      const steps = o.steps.slice(0, 8).map((s) => { const ni = stepOf(s); return `<li><span>${esc(s.title)}${s.board_time || s.minutes ? `<small>${[s.board_time && `Board at ${s.board_time}`, s.minutes && `${s.minutes} min`].filter(Boolean).join(" · ")}</small>` : ""}${ni >= 0 ? liveSlot(o, ni) : ""}</span></li>`; }).join("");
      return `${top}<div class="scroll">
        <p class="lead">${leaveLabel(o, true)}. ${esc(o.title)}.</p>
        <div class="panic-answer">
          <div class="when">${timeOf(o.arrival)} <small>arrival</small></div>
          <p class="why ${late ? "bad" : ""}">${esc(state.plan.recommended_reason)}</p>
          ${[realtimeFact(o), weatherFact(o), trafficFact(o)].some(Boolean) ? `<div class="facts" style="margin:12px 0 0">${realtimeFact(o)}${weatherFact(o)}${trafficFact(o)}</div>` : ""}
        </div>
        ${hasLive(o) ? liveAge() : ""}
        ${costLine()}
        <ol class="panic-steps">${steps}</ol>
        <div class="actions">
          ${o.nav?.length ? `<button class="panic-go" data-action="start-nav" data-id="${esc(o.id)}">Start directions</button>` : `<a class="panic-go" href="${esc(o.maps_url)}" target="_blank" rel="noopener noreferrer">Start directions</a>`}
          <a class="btn btn-secondary" href="${esc(o.maps_url)}" target="_blank" rel="noopener noreferrer">Open in Google Maps ${I.external(16)}</a>
          <button class="btn btn-secondary" data-action="panic-others">See other options</button>
        </div>
        ${notice("Estimate from Google and Translink. Check signs at the stop.")}
      </div>`;
    }
  }
  const chips = [settings.places.home && ["home", "Home"], settings.places.work && ["work", "Work/Uni"], store.get("lastDestination", "") && ["last", "Last place"]].filter(Boolean);
  return `${top}<div class="scroll">
    <h1>Where do you need to be?</h1>
    ${pm.locating ? `<div class="lead">${skelLines("Finding your location", 60)}</div>` : `<p class="lead">${pm.coords ? "Using your current location." : demoOn() && state.demo.start === "preset" ? "Demo start point: Taringa Station." : "Location unavailable. Type where you are."}</p>`}
    ${pm.coords || pm.locating ? "" : `<div class="panic-field"><input class="panic-input" data-panic="origin" ${acAttrs("panic.origin")} placeholder="Where are you now?" value="${esc(pm.origin || "")}" aria-label="Where are you now"></div>`}
    <div class="panic-field"><input class="panic-input" data-panic="dest" ${acAttrs("panic.dest")} placeholder="Destination" value="${esc(pm.dest)}" aria-label="Destination"></div>
    ${chips.length ? `<div class="panic-chips">${chips.map(([k, l]) => `<button class="panic-chip" data-action="panic-place" data-place="${k}">${esc(l)}</button>`).join("")}</div>` : ""}
    <label class="panic-by">Need to be there by <input class="panic-input" type="time" data-panic="by" value="${esc(pm.by)}" aria-label="Deadline (optional)"></label>
    ${pm.error ? notice(esc(pm.error), pm.errorKind || "error") : ""}
    <button class="panic-go${pm.phase === "loading" ? " is-loading" : ""}" data-action="panic-go" ${pm.phase === "loading" ? 'disabled aria-busy="true"' : ""}>${pm.phase === "loading" ? skelBar("Finding the fastest safe option", 140) : "Get me there"}</button>
  </div>`;
}

// ── Live directions ──────────────────────────────────────────────────────────

const modeKind = (s) => (s.transit ? s.transit.vehicle : s.mode === "drive" ? "car" : "walk");
const vehicleTile = (t, size = 28) => (KIND_ICON[t.vehicle] || I.bus)(size);

function navSteps(o) {
  const steps = o.nav.map((n, i) => ({ ...n, i, poly: n.polyline?.length > 1 ? n.polyline : [n.start, n.end] }));
  const end = steps.at(-1).end;
  steps.push({ arrive: true, mode: "arrive", instruction: "Arrive at your destination", maneuver: "ARRIVE", distance_m: 0, duration_s: 0, start: end, end, poly: [end, end], i: steps.length });
  return steps;
}

function navInit(o) {
  state.nav = { optionId: o.id, steps: navSteps(o), idx: 0, pos: null, heading: null, acc: null, following: true, error: null, offSince: null, off: false, sheetOpen: false, autoOpened: false,
    finished: false, replanning: false, replanError: null, said: new Set(), sim: null, lock: null, watchId: null, timer: null };
}

// What the banner says. Walking and driving show the upcoming maneuver and the distance to it; a transit leg shows boarding, then the alight countdown.
const navRiding = (n, s) => { const pr = n.pos && project(n.pos, s.poly); return pr && pr.d < 150 && pr.along > 100 ? pr : null; };
const boardName = (t) => (t.vehicle === "rail" && t.name ? `the ${t.name} train` : t.line);
function navView() {
  const n = state.nav, s = n.steps[n.idx];
  if (n.finished || !s || s.arrive) return { done: true, icon: I.flag(30), head: "You have arrived", instr: (state.plan?.destination || "").split(",")[0], remain: 0 };
  if (s.transit) {
    const t = s.transit, pr = navRiding(n, s);
    if (pr) {
      const left = Math.max(0, t.stops - Math.round((t.stops * pr.along) / Math.max(1, pr.total)));
      return { icon: vehicleTile(t), head: left <= 1 ? "Get off at the next stop" : `Alight after ${left} stops`, instr: `Ride ${t.line} to ${t.headsign || t.arrival_stop}`, sub: `Get off at ${t.arrival_stop}`, live: s.i, pill: true, remain: 0 };
    }
    return { icon: vehicleTile(t), head: "At your stop", instr: `Board ${boardName(t)} to ${t.headsign || t.arrival_stop}`, sub: `at ${t.departure_stop}`, live: s.i, remain: 0 };
  }
  const nxt = n.steps[n.idx + 1], pr = n.pos ? project(n.pos, s.poly) : null;
  const remain = pr ? Math.max(0, pr.total - pr.along) : s.distance_m;
  if (!pr || !nxt || pr.along <= 25) return { icon: maneuverIcon(s.maneuver || "DEPART", 30), head: n.idx === 0 ? "Start" : "Now", instr: s.instruction, sub: `${fmtDist(remain)} on this step`, remain: 0 };
  if (nxt.transit) return { icon: vehicleTile(nxt.transit), head: `In ${fmtDist(remain)}`, instr: `Board ${boardName(nxt.transit)} to ${nxt.transit.headsign || nxt.transit.arrival_stop}`, sub: `at ${nxt.transit.departure_stop}`, live: nxt.i, remain };
  return { icon: maneuverIcon(nxt.maneuver, 30), head: `In ${fmtDist(remain)}`, instr: nxt.instruction, remain };
}

function navRemaining() {
  const n = state.nav, o = findOption(n.optionId);
  let m = 0, sec = 0;
  n.steps.forEach((s, i) => {
    if (i < n.idx || s.arrive) return;
    let frac = 1;
    if (i === n.idx && n.pos) { const pr = project(n.pos, s.poly); if (pr.total && pr.d < 150) frac = Math.max(0, 1 - pr.along / pr.total); }
    m += s.distance_m * frac;
    sec += s.duration_s * frac;
    if (s.transit && frac > 0.95) { const rt = rtOf(o, s.i); if (rt.status === "late") sec += (rt.delay_min || 0) * 60; }
  });
  return { m, sec };
}

const navBannerHtml = () => {
  const n = state.nav, o = findOption(n.optionId), v = navView();
  return `<div class="nav-card nav-banner"><span class="nav-icon${v.done ? " done" : ""}">${v.icon}</span><div class="nav-text"><span class="nav-dist">${esc(v.head)}</span><span class="nav-instr">${esc(v.instr)}</span>
    ${v.sub || v.live !== undefined ? `<span class="nav-sub">${esc(v.sub || "")}${v.live !== undefined ? `<span class="rt-line" data-live="${esc(o.id)}:${v.live}${v.pill ? ":p" : ""}">${liveLine(o, v.live, v.pill)}</span>` : ""}</span>` : ""}</div></div>`;
};
function navNoticesHtml() {
  const n = state.nav;
  const next = `<button class="btn btn-secondary" data-action="nav-skip">Next step</button>`;
  if (n.replanning) return `<div class="nav-card nav-skel" role="status" aria-label="Finding a new route"><div class="skeleton skel-tile" style="width:48px;height:48px;border-radius:14px"></div><div><div class="skeleton skel-line w-60"></div><div class="skeleton skel-line sm w-80"></div></div></div>`;
  if (n.finished) return "";
  const cards = [];
  if (n.sim) cards.push(`<span class="badge info nav-sim">Simulated journey, not using GPS</span>`);
  if (n.error === "denied") cards.push(`<div class="nav-card nav-notice">${notice("<b>Location is blocked.</b> Allow location for Plan B in your browser settings to follow your position. The steps below still work: tap Next step as you go.", "error")}${next}</div>`);
  else if (n.error === "unsupported") cards.push(`<div class="nav-card nav-notice">${notice("This browser can't share its location, so Plan B can't follow you. The steps below still work.", "error")}${next}</div>`);
  else if (n.error === "weak") cards.push(`<div class="nav-card nav-notice">${notice("GPS signal is weak. Plan B will keep trying.")}</div>`);
  else if (!n.pos) cards.push(`<div class="nav-card nav-skel" role="status" aria-label="Finding your location"><div class="skeleton skel-tile" style="width:48px;height:48px;border-radius:14px"></div><div><div class="skeleton skel-line w-60"></div><div class="skeleton skel-line sm w-40"></div></div></div>`);
  if (n.off) cards.push(`<div class="nav-card nav-notice">${notice("<b>You're off the route.</b> Plan B can find a new way from where you are.")}<button class="btn btn-primary" data-action="nav-replan">${I.route(16)}Re-plan from here</button></div>`);
  if (n.replanError) cards.push(`<div class="nav-card nav-notice">${notice(esc(n.replanError), "error")}</div>`);
  return cards.join("");
}
function navEtaHtml() {
  const n = state.nav;
  if (n.finished) return `<b>Arrived</b><span>${esc((state.plan?.destination || "").split(",")[0])}</span>`;
  const r = navRemaining();
  return `<b>${timeOf(new Date(Date.now() + r.sec * 1000))}</b><span>${fmtMins(r.sec)} · ${fmtDist(r.m)}${n.sim ? " · Simulated" : ""}</span>`;
}
function navStepsHtml() {
  const n = state.nav, o = findOption(n.optionId);
  return n.steps.map((s, i) => {
    const cls = i < n.idx || n.finished ? "done" : i === n.idx ? "current" : "";
    const t = s.transit;
    const icon = s.arrive ? I.flag(18) : t ? vehicleTile(t, 18) : maneuverIcon(s.maneuver || "STRAIGHT", 18);
    const tone = s.arrive ? "var(--success)" : SEGMENT_COLOUR[modeKind(s)] || "var(--accent)";
    const small = s.arrive ? "" : t ? `${esc(t.departure_stop)} to ${esc(t.arrival_stop)} · ${plural(t.stops, "stop")}` : `${fmtDist(s.distance_m)} · ${fmtMins(s.duration_s)}`;
    return `<div class="nav-step ${cls}"${cls === "current" ? ' aria-current="step"' : ""}><span class="row-icon" style="--tone:${tone}">${icon}</span><div><p>${esc(t ? `Take ${t.line} to ${t.headsign || t.arrival_stop}` : s.instruction)}</p>${small ? `<small>${small}</small>` : ""}${t ? `<span class="rt-line" data-live="${esc(o.id)}:${s.i}">${liveLine(o, s.i)}</span>` : ""}</div></div>`;
  }).join("");
}
function navFabsHtml() {
  const n = state.nav;
  return `<button class="fab${n.following ? " on" : ""}" data-action="nav-recenter" aria-pressed="${n.following}" aria-label="${n.following ? "Following your position" : "Recenter on my position"}">${I.locate(22)}</button>
    <button class="fab${settings.voice ? " on" : ""}" data-action="nav-voice" aria-pressed="${settings.voice}" aria-label="Voice prompts">${(settings.voice ? I.volume : I.volumeOff)(22)}</button>`;
}

function navScreen() {
  const n = state.nav, o = n && findOption(n.optionId);
  if (!o) return `${navbar("Home")}<div class="scroll"><div class="empty-card"><div class="empty-icon">${I.route(24)}</div><h3>No route to follow</h3><p>Choose an option with directions first.</p></div></div>`;
  return `<div class="nav-map" data-map="__nav"><div class="skeleton map-skeleton" role="status" aria-label="Loading map"></div></div>
    <div class="nav-top"><div data-nav-banner>${navBannerHtml()}</div><div class="nav-stack" data-nav-notices>${navNoticesHtml()}</div></div>
    <div class="nav-fabs" data-nav-fabs>${navFabsHtml()}</div>
    <div class="visually-hidden" aria-live="polite" data-nav-say></div>
    <div class="nav-sheet${n.sheetOpen ? " open" : ""}" data-nav-sheet>
      <button class="nav-grab" data-action="nav-sheet" aria-label="Show or hide the step list" aria-expanded="${n.sheetOpen}"><span></span></button>
      <div class="nav-eta"><button class="nav-eta-main" data-action="nav-sheet"><span data-nav-eta>${navEtaHtml()}</span>${hasLive(o) ? liveAge() : ""}</button><button class="btn btn-secondary nav-exit" data-action="exit-nav">${I.x(16)}${n.finished ? "Done" : "Exit"}</button></div>
      <div class="nav-steps" data-nav-steps ${n.sheetOpen ? "" : "inert"}>${navStepsHtml()}</div>
    </div>`;
}

// Scrolls only the step list (scrollIntoView would also shift the clipped page when the sheet is collapsed).
const revealStep = (list) => { const cur = list?.querySelector(".current"); if (cur) list.scrollTop = Math.max(0, cur.offsetTop - list.offsetTop - list.clientHeight / 3); };
const setHTML = (el, html) => { if (el && el.__h !== html) { el.innerHTML = html; el.__h = html; } };
function navPaint() {
  const n = state.nav;
  if (!n || state.screen !== "nav" || !currentPage) return;
  const q = (s) => currentPage.querySelector(s);
  if (n.error === "denied" && !n.autoOpened) { n.autoOpened = true; n.sheetOpen = true; q("[data-nav-sheet]")?.classList.add("open"); q("[data-nav-steps]")?.removeAttribute("inert"); }
  setHTML(q("[data-nav-banner]"), navBannerHtml());
  setHTML(q("[data-nav-notices]"), navNoticesHtml());
  setHTML(q("[data-nav-eta]"), navEtaHtml());
  setHTML(q("[data-nav-fabs]"), navFabsHtml());
  const exit = q(".nav-exit");
  if (exit && n.finished && !exit.dataset.done) { exit.dataset.done = "1"; exit.innerHTML = `${I.x(16)}Done`; }
  const list = q("[data-nav-steps]");
  const html = navStepsHtml();
  if (list && list.__h !== html) {
    const top = list.scrollTop, moved = list.__idx !== n.idx;
    list.innerHTML = html;
    list.__h = html;
    if (moved) { list.__idx = n.idx; revealStep(list); } else list.scrollTop = top;
  }
  navMap();
}

function navEntry() { for (const entry of maps.values()) if (entry.nav) return entry; return null; }
function navLines(entry) {
  const n = state.nav;
  entry.lines.forEach(({ line, step }) => {
    const done = step.i < n.idx, cur = step.i === n.idx, kind = modeKind(step);
    line.setStyle({ color: done ? cssColour("var(--text-faint)") : step.transit?.colour || cssColour(SEGMENT_COLOUR[kind] || "var(--accent)"), weight: cur ? 8 : kind === "walk" ? 4 : 6, opacity: done ? 0.45 : cur ? 1 : 0.85, dashArray: kind === "walk" ? "2 9" : null });
    if (cur) line.bringToFront();
  });
}
function buildNavMap(el) {
  const n = state.nav;
  if (!n) return;
  el.replaceChildren();
  const map = L.map(el, { zoomControl: false, attributionControl: true, zoomSnap: 0.5 });
  const entry = { map, tiles: tileLayer().addTo(map), bounds: null, lines: [], optionId: n.optionId, vehicles: new Map(), nav: true, me: null, zoomIdx: -1 };
  entry.restyle = () => navLines(entry);
  n.steps.forEach((s) => { if (!s.arrive) entry.lines.push({ line: L.polyline(s.poly, { lineCap: "round", lineJoin: "round" }).addTo(map), step: s }); });
  const pin = (cls) => L.divIcon({ className: "", html: `<div class="pin-hit"><div class="pin ${cls}"></div></div>`, iconSize: [44, 44], iconAnchor: [22, 22] });
  L.marker(n.steps[0].start, { icon: pin("start"), interactive: false }).addTo(map);
  L.marker(n.steps.at(-1).end, { icon: pin("end"), interactive: false }).addTo(map);
  entry.bounds = L.latLngBounds(n.steps.flatMap((s) => s.poly));
  map.fitBounds(entry.bounds, { padding: [48, 48] });
  map.on("dragstart", () => { if (state.nav?.following) { state.nav.following = false; navPaint(); } });
  maps.set(el, entry);
  navLines(entry);
  navMap();
  setTimeout(() => { if (maps.get(el) === entry) { map.invalidateSize(); if (!state.nav?.pos) map.fitBounds(entry.bounds, { padding: [48, 48] }); } }, 420);
}
function navMap() {
  const n = state.nav, entry = navEntry();
  if (!n || !entry) return;
  if (entry.lineIdx !== n.idx) { entry.lineIdx = n.idx; navLines(entry); }
  if (n.pos) {
    if (!entry.me) {
      entry.me = L.marker(n.pos, { icon: L.divIcon({ className: "me-marker", html: '<div class="me-hit"><div class="me"><span class="me-arrow"></span></div></div>', iconSize: [44, 44], iconAnchor: [22, 22] }), interactive: false, keyboard: false, zIndexOffset: 1000 }).addTo(entry.map);
      setTimeout(() => entry.me?.getElement()?.classList.add("me-glide"), 300);
    } else entry.me.setLatLng(n.pos);
    const arrow = entry.me.getElement()?.querySelector(".me-arrow");
    if (arrow) { arrow.classList.toggle("on", n.heading !== null); if (n.heading !== null) arrow.style.transform = `rotate(${Math.round(n.heading)}deg)`; }
    if (n.following) {
      const s = n.steps[n.idx], animate = !prefersReducedMotion(), riding = s?.transit && navRiding(n, s);
      const v = s?.transit && !riding ? rtOf(findOption(n.optionId), s.i).vehicle : null;
      if (v) {
        // Waiting at the stop: frame you and the approaching vehicle together.
        const sig = `${n.idx}|${v.lat},${v.lng}`;
        if (entry.fitSig !== sig) { entry.fitSig = sig; entry.zoomIdx = null; entry.map.fitBounds(L.latLngBounds([n.pos, [v.lat, v.lng]]), { paddingTopLeft: [48, 210], paddingBottomRight: [48, 170], maxZoom: 16, animate }); }
      } else {
        const key = `${n.idx}${riding ? "r" : ""}`, zoom = s?.transit ? 15 : s?.mode === "drive" ? 16 : 17;
        entry.fitSig = null;
        if (entry.zoomIdx !== key) { entry.zoomIdx = key; entry.map.setView(n.pos, zoom, { animate }); } else entry.map.panTo(n.pos, { animate, duration: 0.5, easeLinearity: 1 });
      }
    }
  }
  syncVehicles(entry, n.idx);
}

function navFix(pos, heading, acc) {
  const n = state.nav;
  if (!n || state.screen !== "nav") return;
  n.heading = heading ?? (n.pos && dist(n.pos, pos) > 4 ? bearing(n.pos, pos) : n.heading);
  n.pos = pos;
  n.acc = acc;
  if (!n.finished && (acc ?? 0) <= 100) navAdvance();
  navPaint();
}
// Advance when within ~25 m of the step end, or past it along the polyline. Off route: more than 60 m from the current step for 10 s.
function navAdvance() {
  const n = state.nav, now = Date.now();
  let guard = 4;
  while (guard-- > 0 && !n.finished) {
    const s = n.steps[n.idx];
    if (!s || s.arrive) { n.finished = true; break; }
    const pr = project(n.pos, s.poly);
    const done = s.transit ? dist(n.pos, s.end) < 60 && pr.along > pr.total * 0.5 : dist(n.pos, s.end) <= 25 || (pr.d < 60 && pr.along >= pr.total - 8);
    if (!done) break;
    n.idx++;
    n.offSince = null;
    n.off = false;
    if (n.steps[n.idx].arrive) n.finished = true;
    navAnnounce();
  }
  const s = n.steps[n.idx];
  if (!n.finished && s && !s.transit && (n.acc ?? 0) <= 60) {
    if (project(n.pos, s.poly).d > 60) { n.offSince ||= now; if (now - n.offSince >= 10000) n.off = true; } else { n.offSince = null; n.off = false; }
  } else { n.offSince = null; n.off = false; }
  const v = navView();
  if (v.remain && v.remain <= 100 && !n.said.has(n.idx)) { n.said.add(n.idx); if (settings.voice) speak(v.instr); }
  if (n.finished && !n.arrivedSaid) { n.arrivedSaid = true; endBgWatch(); }
}
function navAnnounce() {
  const v = navView(), text = v.done ? "You have arrived." : `${v.head === "Now" || v.head === "Start" ? "" : `${v.head}. `}${v.instr}`;
  const region = currentPage?.querySelector("[data-nav-say]");
  if (region) region.textContent = text;
  if (settings.voice) speak(text);
}
function speak(text) {
  try { if (!("speechSynthesis" in window)) return; speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = "en-AU"; speechSynthesis.speak(u); } catch { /* voice is optional */ }
}
async function lockScreen() { try { if ("wakeLock" in navigator && state.nav && !state.nav.lock) state.nav.lock = await navigator.wakeLock.request("screen"); } catch { /* not supported or denied */ } }

// Follows the real GPS, or in demo mode plays the route back 25 times faster along the step polylines.
function navBegin() {
  const n = state.nav;
  if (!n || state.screen !== "nav") return;
  lockScreen();
  if (demoOn() && state.demo.simulate) {
    n.sim = { idx: 0, t: 0, last: performance.now(), hold: 0 };
    n.timer = setInterval(() => {
      const sim = n.sim, now = performance.now(), dt = (now - sim.last) / 1000;
      sim.last = now;
      const s = n.steps[sim.idx];
      if (!s || s.arrive || document.hidden) return;
      if (s.transit && sim.t === 0 && !sim.hold) sim.hold = now + 4000;
      if (now < sim.hold) return navFix(s.poly[0], n.heading, 5);
      sim.t += dt * 25;
      const dur = Math.max(s.duration_s, 20), pos = pointAlong(s.poly, sim.t / dur);
      if (sim.t >= dur) { sim.idx++; sim.t = 0; sim.hold = 0; }
      navFix(pos, null, 5);
    }, 500);
    return navPaint();
  }
  if (!navigator.geolocation) { n.error = "unsupported"; return navPaint(); }
  n.watchId = navigator.geolocation.watchPosition(
    (p) => { n.error = null; navFix([p.coords.latitude, p.coords.longitude], Number.isFinite(p.coords.heading) ? p.coords.heading : null, p.coords.accuracy); },
    (err) => { n.error = err.code === 1 ? "denied" : "weak"; navPaint(); }, { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 });
  // A fix only arrives when you move, so re-check progress and the off-route timer while standing still too.
  n.timer = setInterval(() => { if (state.nav === n && n.pos && !n.finished) { navAdvance(); navPaint(); } }, 2000);
}
function navHalt() {
  const n = state.nav;
  if (!n) return;
  if (n.watchId !== null) navigator.geolocation?.clearWatch(n.watchId);
  clearInterval(n.timer);
  n.lock?.release?.().catch(() => {});
  try { speechSynthesis.cancel(); } catch { /* optional */ }
}
function navStop() { navHalt(); state.nav = null; }

async function navReplan() {
  const n = state.nav, o = findOption(n.optionId);
  if (!n.pos || n.replanning) return;
  n.replanning = true;
  n.replanError = null;
  navPaint();
  try {
    const origin = `${n.pos[0].toFixed(6)},${n.pos[1].toFixed(6)}`;
    const plan = await postJSON("/api/plan", payload({ origin, origin_place_id: null, leave_now: true }));
    const pool = plan.options.filter((x) => x.nav?.length);
    const pick = pool.find((x) => x.mode === o.mode && x.fits) || pool.find((x) => x.mode === o.mode) || pool.find((x) => x.id === plan.recommended_id) || pool[0];
    if (!pick) throw new Error("No route was found from here. Try again in a moment.");
    const keepSim = n.sim;
    navHalt();
    state.plan = plan;
    state.form.origin = origin;
    state.form.originPlaceId = null;
    state.chosenId = pick.id;
    navInit(pick);
    rerender();
    if (keepSim) state.nav.sim = null;
    navBegin();
    toast("New route found from your position.");
  } catch (error) {
    n.replanning = false;
    n.replanError = error.message;
    navPaint();
  }
}

// ── Impact dashboard ─────────────────────────────────────────────────────────

const tripRef = (o) => `${state.plan?.queried_at}|${o.id}`;
const thisMonthTrips = () => { const m = new Date().toISOString().slice(0, 7); return store.get("trips", []).filter((t) => t.date.slice(0, 7) === m); };
function impactTotals(trips) {
  return {
    co2: trips.reduce((s, t) => s + Math.max(0, t.co2_saved || 0), 0),
    saved: trips.reduce((s, t) => s + Math.max(0, t.cost_saved || 0), 0),
    greenTrips: trips.filter((t) => t.mode !== "drive").length,
    trips: trips.length,
  };
}

function monthSeries() {
  const trips = store.get("trips", []);
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const inMonth = trips.filter((t) => t.date.slice(0, 7) === key);
    const totals = impactTotals(inMonth);
    months.push({ key, label: d.toLocaleDateString("en-AU", { month: "short" }), ...totals });
  }
  return months;
}

function barChart(id, months, field, format, title, subtitle) {
  const W = 330, H = 150, left = 30, bottom = 20, top = 16;
  const max = Math.max(...months.map((m) => m[field]), field === "co2" ? 1 : 5);
  const nice = (v) => { const p = 10 ** Math.floor(Math.log10(v)); return Math.ceil(v / p) * p; };
  const ymax = nice(max);
  const bw = 22, step = (W - left) / months.length;
  const y = (v) => top + (H - top - bottom) * (1 - v / ymax);
  const grid = [0, 0.5, 1].map((f) => `<line class="grid" x1="${left}" x2="${W}" y1="${y(ymax * f)}" y2="${y(ymax * f)}"/><text class="axis-label" x="${left - 6}" y="${y(ymax * f) + 3}" text-anchor="end">${format(ymax * f, true)}</text>`).join("");
  const bars = months.map((m, i) => {
    const x = left + step * i + (step - bw) / 2;
    const v = m[field];
    const h = Math.max(0, y(0) - y(v));
    const r = Math.min(4, h);
    const path = h > 0 ? `M${x},${y(0)} V${y(v) + r} Q${x},${y(v)} ${x + r},${y(v)} H${x + bw - r} Q${x + bw},${y(v)} ${x + bw},${y(v) + r} V${y(0)} Z` : "";
    const isLast = i === months.length - 1;
    return `<g class="bar-group" tabindex="0" data-tip="${esc(`${m.label}: ${format(v)} · ${plural(m.trips, "trip")}`)}" data-x="${x + bw / 2}" data-y="${y(v)}">
      <rect class="bar-hit" x="${left + step * i}" y="${top}" width="${step}" height="${H - top - bottom}"/>
      ${path ? `<path class="bar${isLast ? " now" : ""}" style="--i:${i}" d="${path}"/>` : ""}
      ${isLast && v > 0 ? `<text class="value-label" x="${x + bw / 2}" y="${y(v) - 5}" text-anchor="middle">${format(v)}</text>` : ""}
      <text class="axis-label" x="${x + bw / 2}" y="${H - 5}" text-anchor="middle">${m.label}</text></g>`;
  }).join("");
  return `<div class="chart-card" data-chart="${id}"><h3>${title}</h3><p>${subtitle}</p>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)} by month">${grid}${bars}</svg><div class="chart-tip"></div></div>`;
}

function dashboardScreen() {
  const all = store.get("trips", []);
  const t = impactTotals(all);
  const months = monthSeries();
  const share = t.trips ? Math.round((t.greenTrips / t.trips) * 100) : 0;
  const table = state.dashTable ? `<table class="data-table"><thead><tr><th>Month</th><th>Trips</th><th>CO₂ avoided</th><th>Saved</th></tr></thead><tbody>${months.map((m) => `<tr><td>${m.label}</td><td>${m.trips}</td><td>${kg(m.co2)}</td><td>${money(m.saved)}</td></tr>`).join("")}</tbody></table>` : "";
  const recent = all.slice(-8).reverse();
  return `
    ${navbar("Home", gearButton())}
    <div class="scroll">
      <p class="eyebrow">Impact</p>
      <h2 class="large-title">Your impact</h2>
      <p class="subtitle">Each trip you log is compared with driving the same journey alone in your car (fuel, tolls and parking where known).</p>
      <div class="kpis">
        <div class="kpi lead"><span>CO₂ avoided</span><b>${kg(t.co2)}</b><small>all time</small></div>
        <div class="kpi-row">
          <div class="kpi"><span>Saved</span><b>${money(t.saved)}</b><small>vs driving</small></div>
          <div class="kpi"><span>Low-car</span><b>${t.greenTrips}</b><small>of ${t.trips} logged</small></div>
          <div class="kpi"><span>Not driving</span><b>${share}%</b><small>of trips</small></div>
        </div>
      </div>
      ${all.length ? `
        ${barChart("co2", months, "co2", (v, axis) => (axis ? `${v < 1 && v > 0 ? v.toFixed(1) : Math.round(v)}` : kg(v)), "CO₂ avoided per month", "kg CO₂, last six months")}
        ${barChart("saved", months, "saved", (v, axis) => (axis ? `$${Math.round(v)}` : money(v)), "Money saved per month", "Compared with driving, last six months")}
        <button class="btn btn-text" data-action="toggle-table">${state.dashTable ? "Hide table" : "Show as a table"}</button>
        ${table}
        <p class="section-header" style="margin-top:16px">Recent trips</p>
        <div class="group"><div class="group-card">${recent.map((trip) => row((KIND_ICON[trip.kind] || I.route)(16), SEGMENT_COLOUR[trip.kind] || "var(--accent)", `${esc(trip.title)}<small>${dateLabel(trip.date)} · ${trip.co2_saved > 0 ? `${kg(trip.co2_saved)} CO₂ avoided` : "no CO₂ saving"}</small>`, valueSpan(trip.cost_saved > 0 ? `+${money(trip.cost_saved)}` : ""), "trip-row")).join("")}</div></div>`
      : `<div class="empty-card"><div class="empty-icon" style="--tone:var(--success)">${I.leaf(24)}</div><h3>No trips logged yet</h3><p>Choose a route and tap “I'm taking this trip” to start tracking your savings.</p></div>`}
      ${notice("Savings are estimates using the CO₂ factors and car settings in Settings. Your trip history stays on this device.", "info")}
    </div>`;
}

// ── Shared ride board ────────────────────────────────────────────────────────

function rideCard(r) {
  const seats = Array.from({ length: r.seats_total }, (_, i) => `<i class="${i < r.seats_total - r.seats_left ? "taken" : ""}"></i>`).join("");
  const baseline = state.plan?.baseline;
  const groupCo2 = baseline && r.group_size > 1 ? baseline.co2_kg * (r.group_size - 1) : 0;
  return `<div class="ride-card ${r.is_member ? "mine" : ""}">
    <div class="ride-head"><span class="mode-tile ${r.kind === "uber" ? "rideshare" : "car"}">${(r.kind === "uber" ? I.rideshare : I.car)(20)}</span>
      <div style="flex:1;min-width:0"><strong>${esc(r.nickname)} · ${esc(r.kind_label)}</strong><div class="card-sub">Leaves ${timeOf(r.depart_at)} · ${r.seats_left} of ${r.seats_total} seats free <span class="seat-dots">${seats}</span></div></div>
      ${r.is_owner ? `<span class="badge info">Yours</span>` : r.is_member ? `<span class="badge success">Joined</span>` : ""}</div>
    <p class="ride-meta">${esc(r.origin_label)} ${I.arrowRight(14)} <b>${esc(r.destination_label)}</b><br>Meet at <b>${esc(r.meet_point)}</b>${r.note ? `<br>${esc(r.note)}` : ""}
      ${r.trip_cost ? (r.group_size > 1 ? `<br>About <b>${money(r.per_person)} each</b> (${money(r.trip_cost)} split ${r.group_size} ways)` : `<br>Trip cost <b>${money(r.trip_cost)}</b>, split between everyone who joins`) : ""}
      ${r.riders.length ? `<br>Riding: ${r.riders.map(esc).join(", ")}` : ""}
      ${groupCo2 > 0.05 ? `<br>${I.leaf(14)} Sharing avoids about ${kg(groupCo2)} CO₂ compared with everyone driving alone` : ""}</p>
    ${r.is_member ? `<button class="btn btn-secondary" data-action="ride-leave" data-id="${esc(r.id)}">${r.is_owner ? "Cancel this ride" : "Leave this ride"}</button>`
      : state.rides.joining === r.id ? `<div class="form-stack"><label>Your first name or nickname<input data-ride-join="nickname" maxlength="24"></label><button class="btn btn-primary" data-action="ride-join" data-id="${esc(r.id)}" ${r.seats_left ? "" : "disabled"}>Join</button></div>`
      : `<button class="btn btn-primary" data-action="ride-join-start" data-id="${esc(r.id)}" ${r.seats_left ? "" : "disabled"}>${r.seats_left ? "Join this ride" : "Full"}</button>`}
  </div>`;
}

function ridesScreen() {
  const p = state.plan;
  const matches = (p?.rides || []).filter((r) => !state.rides.mine.some((m) => m.id === r.id));
  return `
    ${navbar("Back", gearButton())}
    <div class="scroll">
      <p class="eyebrow">Shared rides</p>
      <h2 class="large-title">Travel together</h2>
      <p class="subtitle">When a service fails, hundreds of people need the same thing. Share a car or split an Uber with people heading your way. It costs less for everyone and means fewer cars on the road.</p>
      ${state.rides.error ? notice(esc(state.rides.error), "error") : ""}
      ${state.rides.loading ? `<p class="section-header">Your rides</p><div class="cards" role="status" aria-label="Loading your rides">${skeletonCard()}</div>`
        : state.rides.mine.length ? `<p class="section-header">Your rides</p>${state.rides.mine.map(rideCard).join("")}` : ""}
      <p class="section-header">${p ? `Heading from ${esc(p.origin)} towards ${esc(p.destination)}` : "Heading your way"}</p>
      ${!p ? `<div class="empty-card"><h3>Search a journey first</h3><p>We match rides by where you're starting, where you're going and when.</p></div>`
        : matches.length ? matches.map(rideCard).join("")
        : `<div class="empty-card"><div class="empty-icon" style="--tone:var(--accent)">${I.users(24)}</div><h3>No shared rides yet</h3><p>Be the first. Anyone searching a similar trip on this Plan B server will see your post.</p></div>`}
      ${p?.start && p?.end ? `<button class="btn btn-primary" data-action="open-ride-form" style="margin:8px 0 24px">Offer seats or start a split Uber</button>` : ""}
      ${notice("Prototype: posts are visible to everyone using this Plan B server and expire 30 minutes after departure. Don't post phone numbers or exact addresses. Meet somewhere public and trust your judgement.")}
    </div>`;
}

function rideFormSheet() {
  const p = state.plan;
  const driveCost = p?.baseline?.cost;
  return `<div class="grabber"><span></span></div>
    <div class="sheet-head"><h3 id="sheet-title">Share a ride</h3><button class="icon-btn" data-action="close-sheet" aria-label="Close">${I.x(18)}</button></div>
    <div class="sheet-scroll"><div class="form-stack" id="ride-form">
      ${segmented("ride_kind", state.rideKind || "car", [["car", "I have a car"], ["uber", "Split an Uber"]], "ride-kind")}
      <div class="form-pair"><label>First name or nickname<input name="nickname" maxlength="24" required></label>
        <label>${(state.rideKind || "car") === "car" ? "Spare seats" : "Others wanted"}<select name="seats">${[1, 2, 3, 4, 5, 6].map((n) => `<option ${n === 3 ? "selected" : ""}>${n}</option>`).join("")}</select></label></div>
      <label>Public meeting point<input name="meet_point" maxlength="80" placeholder="e.g. Taringa Station main entrance" required></label>
      <div class="form-pair"><label>Leaving at<input name="depart_at" type="datetime-local" value="${esc(p.departure.slice(0, 16))}"></label>
        <label>${(state.rideKind || "car") === "car" ? "Trip cost to share ($)" : "Uber estimate ($)"}<input name="trip_cost" type="number" min="0" max="500" step="0.5" value="${(state.rideKind || "car") === "car" && driveCost ? driveCost.toFixed(2) : ""}" placeholder="${(state.rideKind || "car") === "uber" ? "From the Uber app" : "Optional"}"></label></div>
      <label>Note (optional)<input name="note" maxlength="140" placeholder="e.g. Heading to the Great Court"></label>
      <p class="fine">Shared from your search: ${esc(p.origin)} ${I.arrowRight(12)} ${esc(p.destination)}. Only rounded start and end points (about 100 m) are stored.</p>
    </div></div>
    <div class="sheet-foot"><button class="btn btn-primary" data-action="ride-create">Post to the ride board</button></div>`;
}

// ── Alerts sheet ─────────────────────────────────────────────────────────────

function alertsBody() {
  const q = (state.alertQuery || "").trim().toUpperCase();
  const list = (state.alerts?.alerts || []).filter((a) => a.disruptive && (!q || a.lines.some((l) => l.includes(q)) || a.header.toUpperCase().includes(q)));
  if (state.alertsError && !state.alerts) return notice(esc(state.alertsError), "error");
  if (!state.alerts) return `<div class="group" role="status" aria-label="Loading alerts"><div class="group-card">${[0, 1, 2].map(() => `<div class="row top" aria-hidden="true"><div class="skel-stack" style="flex:1"><div class="skeleton skel-line w-30"></div><div class="skeleton skel-line w-100"></div><div class="skeleton skel-line sm w-60"></div></div></div>`).join("")}</div></div>`;
  if (!list.length) return `<div class="empty-card"><div class="empty-icon" style="--tone:var(--success)">${I.checkCircle(24)}</div><h3>No matching alerts</h3><p>Nothing disruptive is reported for that line right now.</p></div>`;
  return `<div class="group"><div class="group-card">${list.slice(0, 40).map((a) => `<div class="row top"><span class="row-label">${a.lines.slice(0, 6).map((l) => `<span class="line-tag">${esc(l)}</span> `).join("")}<br><b>${esc(a.effect)}:</b> ${esc(a.header)}<small>${esc(a.description.slice(0, 260))}${a.description.length > 260 ? "…" : ""}</small></span></div>`).join("")}</div></div>`;
}

function alertsSheet() {
  return `<div class="grabber"><span></span></div>
    <div class="sheet-head"><h3 id="sheet-title">Translink alerts</h3><button class="icon-btn" data-action="close-sheet" aria-label="Close">${I.x(18)}</button></div>
    <div class="sheet-scroll">
      <div class="group"><div class="group-card"><div class="row field-row"><span class="chev">${I.search(18)}</span><input type="text" data-alert-query value="${esc(state.alertQuery || "")}" placeholder="Filter by line, e.g. 412" aria-label="Filter alerts by line"></div></div></div>
      <div data-alert-results>${alertsBody()}</div>
      <p class="fine" style="margin:0 4px 16px">Source: Translink SEQ GTFS-Realtime, refreshed every minute${state.alerts ? `, last checked ${timeOf(state.alerts.fetched_at)}` : ""}.</p>
    </div>`;
}

// ── Settings panel ───────────────────────────────────────────────────────────

function settingsContent() {
  const s = settings;
  const fuelTypes = state.status?.fuel_types || { SP91: "Unleaded 91" };
  const showRow = (key, label, hint) => `<div class="row"><span class="row-label">${label}${hint ? `<small>${hint}</small>` : ""}</span>${toggle(`show.${key}`, s.show[key], label)}</div>`;
  const modeRow = (path, icon, tone, label, hint, checked) => `<div class="row"><span class="row-icon" style="--tone:${tone}">${icon}</span><span class="row-label">${label}${hint ? `<small>${hint}</small>` : ""}</span>${toggle(path, checked, label)}</div>`;
  const fuelPreview = state.fuelLoading ? `<div class="row" role="status" aria-label="Checking fuel prices"><div class="skel-stack" style="flex:1"><div class="skeleton skel-line w-60"></div><div class="skeleton skel-line sm w-80"></div></div></div>`
    : `<div class="row"><span class="row-label">${state.fuelPreview ? `Now about <b>$${state.fuelPreview.price.toFixed(2)}/L</b><small>Average of ${state.fuelPreview.stations} stations nearby · Google Places</small>` : "Checked near your start point when you search"}</span></div>`;
  return `
    ${navbar(null, `<button class="nav-action" data-action="close-settings">Done</button>`)}
    <div class="settings-scroll">
      <p class="eyebrow">Preferences</p>
      <h2 class="large-title">Settings</h2>
      <p class="subtitle">Everything here stays on this device.</p>

      <p class="section-header">Appearance</p>
      <div class="group"><div class="group-card">
        <div class="row"><span class="row-icon" style="--tone:var(--violet)">${I.moon(18)}</span><span class="row-label">Theme</span>${segmented("theme", s.theme, [["system", "Auto"], ["light", "Light"], ["dark", "Dark"]])}</div>
        <div class="row"><span class="row-icon" style="--tone:var(--teal)">${I.activity(18)}</span><span class="row-label">Reduce motion</span>${toggle("motion_reduced", s.motion === "reduced", "Reduce motion")}</div>
      </div></div>

      <p class="section-header">Ways to travel</p>
      <div class="group"><div class="group-card">
        ${modeRow("modes.transit", I.bus(18), "var(--accent)", "Public transport", "", s.modes.transit)}
        ${s.modes.transit ? `<div class="chip-set">${[["bus", "Bus"], ["train", "Train"], ["tram", "Light rail"], ["ferry", "Ferry"]].map(([k, l]) => `<button class="chip" data-action="toggle-transit" data-value="${k}" aria-pressed="${s.transit_modes[k]}">${l}</button>`).join("")}</div>` : ""}
        ${modeRow("modes.drive", I.car(18), "var(--text-muted)", "My own car", "Driving is always used to show what you save", s.modes.drive)}
        ${modeRow("modes.rideshare", I.rideshare(18), "var(--seg-rideshare)", "Uber", "Opens Uber for the live price", s.modes.rideshare)}
      </div></div>

      <p class="section-header">Your car</p>
      <div class="group"><div class="group-card">
        ${row(I.car(18), "var(--text-muted)", "Fuel use", stepper("fuel_l_per_100km", s.fuel_l_per_100km, `${s.fuel_l_per_100km} L/100 km`, 3, 25))}
        <div class="row"><span class="row-icon" style="--tone:var(--warning)">${I.dollar(18)}</span><span class="row-label">Fuel type</span><select data-setting-select="fuel_type" aria-label="Fuel type">${Object.entries(fuelTypes).map(([k, l]) => `<option value="${k}" ${k === s.fuel_type ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></div>
        <div class="row"><span class="row-label">Fuel price</span>${segmented("fuel_price_mode", s.fuel_price_mode, [["auto", "Live average"], ["manual", "My price"]])}</div>
        ${s.fuel_price_mode === "manual" ? `<div class="row"><span class="row-label">My price ($/L)</span><input type="number" min="0.5" max="5" step="0.01" data-setting-number="fuel_price" value="${s.fuel_price}" aria-label="Fuel price in dollars per litre"></div>` : fuelPreview}
        <div class="row"><span class="row-icon" style="--tone:var(--accent)">${I.parking(18)}</span><span class="row-label">Typical parking cost<small>Leave empty if unknown</small></span><input type="number" min="0" max="200" step="0.5" data-setting-number="parking_cost" value="${s.parking_cost ?? ""}" placeholder="$" aria-label="Typical parking cost"></div>
      </div><p class="group-footer">Car parks near your destination are found automatically, but prices aren't published, so add what you usually pay.</p></div>

      <p class="section-header">Public transport fares</p>
      <div class="group"><div class="group-card">
        <div class="row"><span class="row-label">Use a flat fare when Google has none<small>Translink fares are currently a flat 50c a trip. Check current fares.</small></span>${toggle("use_flat_fare", s.use_flat_fare, "Use flat fare")}</div>
        ${s.use_flat_fare ? `<div class="row"><span class="row-label">Flat fare ($)</span><input type="number" min="0" max="50" step="0.05" data-setting-number="flat_fare" value="${s.flat_fare}" aria-label="Flat fare in dollars"></div>` : ""}
      </div></div>

      <p class="section-header">Default limits</p>
      <div class="group"><div class="group-card">
        ${row(I.dollar(18), "var(--success)", "Max cost", stepper("set.budget", s.budget, `$${s.budget}`, 0, 200))}
        ${row(I.walk(18), "var(--accent)", "Max walking", stepper("set.walking", s.walking, `${s.walking} min`, 0, 60))}
      </div></div>

      <p class="section-header">Show on route cards</p>
      <div class="group"><div class="group-card">
        ${showRow("buffer", "Deadline buffer")}${showRow("cost", "Cost and savings")}${showRow("walking", "Walking time")}
        ${showRow("transfers", "Transfers")}${showRow("elevation", "Elevation gain", "Uphill metres on the walking parts")}
        ${showRow("co2", "CO₂ emissions")}${showRow("parking", "Parking availability")}${showRow("realtime", "Live Translink status")}
      </div></div>

      <p class="section-header">Saved places</p>
      <div class="group"><div class="group-card">
        <div class="row field-row"><span class="row-icon" style="--tone:var(--accent)">${I.home(18)}</span><input type="text" data-setting-text="places.home" ${acAttrs("places.home")} value="${esc(s.places.home)}" placeholder="Home address" aria-label="Home address"></div>
        <div class="row field-row"><span class="row-icon" style="--tone:var(--warning)">${I.pin(18)}</span><input type="text" data-setting-text="places.work" ${acAttrs("places.work")} value="${esc(s.places.work)}" placeholder="Work or uni" aria-label="Work or uni address"></div>
      </div><p class="group-footer">Used by Panic mode and the quick-fill buttons. Stored only on this device.</p></div>

      <p class="section-header">Live disruptions</p>
      <div class="group"><div class="group-card">
        <div class="row"><span class="row-icon" style="--tone:var(--error)">${I.signal(18)}</span><span class="row-label">Watch my chosen trip<small>Alerts you in the app if Translink posts a disruption</small></span>${toggle("watch", s.watch, "Watch my chosen trip")}</div>
      </div></div>

      <p class="section-header">Directions</p>
      <div class="group"><div class="group-card">
        <div class="row"><span class="row-icon" style="--tone:var(--accent)">${I.volume(18)}</span><span class="row-label">Voice prompts<small>Speak each turn aloud during live directions</small></span>${toggle("voice", s.voice, "Voice prompts")}</div>
      </div></div>

      <p class="section-header">App</p>
      <div class="group"><div class="group-card">
        ${canInstall() ? `<button class="row" data-action="settings-install"><span class="row-icon" style="--tone:var(--accent)">${I.download(18)}</span><span class="row-label">Install Plan B<small>${standalone() ? "" : "Add it to your home screen"}</small></span><span class="chev">${I.chevronRight()}</span></button>` : standalone() ? `<div class="row"><span class="row-icon" style="--tone:var(--success)">${I.checkCircle(18)}</span><span class="row-label">Installed<small>Plan B is running as an app</small></span></div>` : ""}
        <button class="row" data-action="settings-share"><span class="row-icon" style="--tone:var(--teal)">${I.qr(18)}</span><span class="row-label">Share this app<small>QR code and link</small></span><span class="chev">${I.chevronRight()}</span></button>
        <button class="row" data-action="settings-demo"><span class="row-icon" style="--tone:var(--violet)">${I.flask(18)}</span><span class="row-label">Demo mode<small>Simulate weather, disruptions and traffic for a walkthrough</small></span>${valueSpan(demoOn() ? "On" : "Off")}<span class="chev">${I.chevronRight()}</span></button>
      </div><p class="group-footer">Background alerts need HTTPS${isIos() ? ". On iPhone, add Plan B to your Home Screen first" : ""}.</p></div>

      <p class="section-header">CO₂ factors (kg per passenger-km)</p>
      <div class="group"><div class="group-card">
        ${[["bus", "Bus"], ["rail", "Train"], ["tram", "Light rail"], ["ferry", "Ferry"]].map(([k, l]) => `<div class="row"><span class="row-label">${l}</span><input type="number" min="0" max="1" step="0.001" data-setting-number="factors.${k}" value="${s.factors[k]}" aria-label="${l} CO₂ factor"></div>`).join("")}
      </div><p class="group-footer">Approximate defaults adapted from UK government averages. Brisbane's real values differ. Car CO₂ uses your fuel use × 2.31 kg per litre of petrol (2.68 for diesel).</p></div>

      <p class="section-header">Data</p>
      <div class="group"><div class="group-card">
        <button class="row" data-action="clear-trips"><span class="row-label" style="color:var(--error-text)">Clear impact history</span></button>
        <a class="row" href="demo.html"><span class="row-label">Fictional interview scenario</span><span class="chev">${I.chevronRight()}</span></a>
      </div><p class="group-footer">Settings and trip history are saved in this browser only. Searches go to Google through the local server. Live alerts come from Translink, elevation from Google or Open-Meteo.</p></div>
    </div>`;
}

let settingsEl = null;
function openSettings() {
  if (settingsEl) return;
  settingsEl = document.createElement("div");
  settingsEl.className = "settings-backdrop";
  settingsEl.dataset.action = "settings-backdrop";
  settingsEl.innerHTML = `<div class="settings-panel" role="dialog" aria-modal="true" aria-label="Settings">${settingsContent()}</div>`;
  viewport.appendChild(settingsEl);
  requestAnimationFrame(() => requestAnimationFrame(() => settingsEl?.classList.add("open")));
  settingsEl.querySelector(".nav-action").focus({ preventScroll: true });
  if (settings.fuel_price_mode === "auto" && !state.fuelPreview) previewFuel();
}
function rerenderSettings() {
  if (!settingsEl) return;
  const scroller = settingsEl.querySelector(".settings-scroll");
  const top = scroller.scrollTop;
  settingsEl.querySelector(".settings-panel").innerHTML = settingsContent();
  settingsEl.querySelector(".settings-scroll").scrollTop = top;
}
function closeSettings() {
  if (!settingsEl) return;
  const el = settingsEl;
  settingsEl = null;
  el.classList.remove("open");
  setTimeout(() => el.remove(), 360);
  rerender();
}
async function previewFuel() {
  if (state.fuelLoading) return;
  const start = state.plan?.start || [-27.4975, 152.9786];
  state.fuelLoading = true;
  rerenderSettings();
  try {
    const r = await fetch(`/api/fuel?lat=${start[0]}&lng=${start[1]}&type=${settings.fuel_type}`);
    const data = await r.json();
    if (r.ok && data.price) state.fuelPreview = data;
  } catch { /* preview is optional */ }
  state.fuelLoading = false;
  rerenderSettings();
}

function applyTheme() {
  const theme = settings.theme === "light" ? "light" : settings.theme === "system" && !matchMedia("(prefers-color-scheme: dark)").matches ? "light" : "dark";
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]').content = theme === "light" ? "#EEF0F5" : "#090A0F";
  if (settings.motion === "reduced") document.documentElement.dataset.motion = "reduced"; else delete document.documentElement.dataset.motion;
  maps.forEach((entry) => entry.restyle());
}

// ══════════════════════════════════════════════════════════════════════════════
// Rendering, navigation, sheets and maps
// ══════════════════════════════════════════════════════════════════════════════

const SCREENS = { home: homeScreen, journey: journeyScreen, results: resultsScreen, next: nextScreen, panic: panicScreen, nav: navScreen, dashboard: dashboardScreen, rides: ridesScreen };
const pageClass = (screen) => `page${screen === "panic" || screen === "nav" ? ` ${screen}` : ""}`;
const viewport = document.getElementById("viewport");
const app = document.getElementById("app");
let currentPage = null;
let transitioning = false;
const maps = new Map();
const mounting = new Set();

function makePage(screen) {
  const page = document.createElement("section");
  page.className = pageClass(screen);
  page.dataset.screen = screen;
  page.innerHTML = SCREENS[screen]();
  return page;
}

function navigate(screen, direction = "forward") {
  if (transitioning || screen === state.screen) return;
  if (state.screen === "nav") navStop();
  if (screen === "panic") startPanicLocate();
  collapseExpanded();
  closeSheet(true);
  app.dataset.screen = screen;
  transitioning = true;
  if (direction === "forward" || direction === "up") state.stack.push(screen);
  else { while (state.stack.length > 1 && state.stack[state.stack.length - 1] !== screen) state.stack.pop(); if (state.stack[state.stack.length - 1] !== screen) state.stack = [screen]; }
  state.screen = screen;
  const incoming = makePage(screen);
  const outgoing = currentPage;
  const inCls = { forward: "in-forward", back: "in-back", up: "in-up", down: "in-back" }[direction];
  const outCls = { forward: "out-forward", back: "out-back", up: "out-forward", down: "out-down" }[direction];
  incoming.classList.add(inCls);
  if (direction === "back" || direction === "down") viewport.insertBefore(incoming, outgoing); else viewport.appendChild(incoming);
  outgoing?.classList.add(outCls);
  currentPage = incoming;
  mountMaps(incoming);
  bindCharts(incoming);
  setTimeout(() => {
    outgoing?.remove();
    incoming.classList.remove(inCls);
    transitioning = false;
    maps.forEach((entry) => entry.map.invalidateSize());
    cleanMaps();
  }, 400);
}

// Panic mode locates as soon as it opens.
function startPanicLocate() {
  if (state.screen === "panic") return;
  state.panic = { ...state.panic, phase: "ask", error: null, locating: true, coords: null };
  if (demoOn() && state.demo.start === "preset") {
    Object.assign(state.panic, { locating: false, origin: DEMO_PRESET.origin, originPlaceId: null, dest: state.panic.dest || DEMO_PRESET.destination });
    return;
  }
  locate((coords) => { state.panic.coords = coords; state.panic.locating = false; if (state.screen === "panic") rerender(); });
}

function goBack() {
  if (state.stack.length < 2) return navigate("home", "back");
  const target = state.stack[state.stack.length - 2];
  navigate(target, state.screen === "panic" || state.screen === "nav" ? "down" : "back");
}

function rerender() {
  if (!currentPage) { currentPage = makePage(state.screen); viewport.appendChild(currentPage); }
  else {
    const scroller = currentPage.querySelector(".scroll");
    const top = scroller ? scroller.scrollTop : 0;
    const focused = document.activeElement?.dataset?.field;
    currentPage.className = pageClass(state.screen);
    currentPage.innerHTML = SCREENS[state.screen]();
    const next = currentPage.querySelector(".scroll");
    if (next) next.scrollTop = top;
    if (focused) currentPage.querySelector(`[data-field="${focused}"]`)?.focus({ preventScroll: true });
  }
  mountMaps(currentPage);
  bindCharts(currentPage);
  cleanMaps();
}

// Maps: Leaflet is fetched the first time a map slot appears -----------------------

const LEAFLET = {
  css: ["https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css", "sha256-tXCrvaljxgtN5LT/Syb5Mm9T+yzPFGH98JVcoJT7JTk="],
  js: ["https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js", "sha256-XJrs/DDkVkUZ29zdzFOkGCJ9zHVo5hnpdi3c7HYJ7Uc="],
};
let leafletPromise = null;
function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  const inject = (tag, props) => new Promise((resolve, reject) => {
    const el = Object.assign(document.createElement(tag), props, { crossOrigin: "anonymous", onload: resolve, onerror: () => { el.remove(); reject(new Error("Map library unavailable")); } });
    document.head.appendChild(el);
  });
  leafletPromise ||= Promise.all([
    inject("link", { rel: "stylesheet", href: LEAFLET.css[0], integrity: LEAFLET.css[1] }),
    inject("script", { src: LEAFLET.js[0], integrity: LEAFLET.js[1], async: true }),
  ]).then(() => window.L).catch((error) => { leafletPromise = null; throw error; });
  return leafletPromise;
}

function tileLayer() {
  // OpenStreetMap tiles, decoded off the main thread. Dark mode darkens them with a CSS filter.
  const Tiles = L.TileLayer.extend({ createTile(coords, done) { const tile = L.TileLayer.prototype.createTile.call(this, coords, done); tile.decoding = "async"; return tile; } });
  return new Tiles("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  });
}

function mountMaps(root) {
  const slots = [...root.querySelectorAll("[data-map]")].filter((el) => !maps.has(el) && !mounting.has(el));
  if (!slots.length) return;
  slots.forEach((el) => mounting.add(el));
  loadLeaflet().then(() => slots.forEach((el) => { mounting.delete(el); if (document.body.contains(el)) buildMap(el); }))
    .catch(() => slots.forEach((el) => { mounting.delete(el); el.innerHTML = '<p class="map-fail">The map could not be loaded. Check your connection and reopen this view.</p>'; }));
}

function buildMap(el) {
  const id = el.dataset.map;
  if (id === "__nav") return buildNavMap(el);
  const options = id === "__all" ? state.plan.options : [findOption(id)].filter(Boolean);
  if (!options.length) return;
  el.replaceChildren();
  const map = L.map(el, { zoomControl: false, attributionControl: true, scrollWheelZoom: true, zoomSnap: 0.5 });
  const entry = { map, tiles: tileLayer().addTo(map), bounds: null, lines: [], optionId: id === "__all" ? null : id, vehicles: new Map() };
  entry.restyle = () => { entry.lines.forEach(({ line, kind }) => line.setStyle({ color: cssColour(SEGMENT_COLOUR[kind] || "var(--accent)") })); };
  const group = [];
  options.forEach((o, index) => {
    const faded = id === "__all" && index > 0;
    (o.segments || []).forEach((s) => {
      if (!s.points?.length) return;
      const line = L.polyline(s.points, {
        color: cssColour(SEGMENT_COLOUR[s.kind] || "var(--accent)"), weight: s.kind === "walk" ? 4 : 6, opacity: faded ? 0.35 : 0.92,
        dashArray: s.kind === "walk" ? "2 9" : null, lineCap: "round", lineJoin: "round",
      }).addTo(map);
      if (s.label) line.bindTooltip(`${KIND_NAME[s.kind] || ""} ${s.label}`, { sticky: true });
      if (id === "__all") line.bindPopup(`<b>${esc(o.title)}</b><br>Arrive ${timeOf(o.arrival)}`);
      entry.lines.push({ line, kind: s.kind });
      group.push(line);
    });
  });
  const pin = (cls) => L.divIcon({ className: "", html: `<div class="pin-hit"><div class="pin ${cls}"></div></div>`, iconSize: [44, 44], iconAnchor: [22, 22] });
  const first = options[0];
  const pts = (first.segments || []).flatMap((s) => s.points || []);
  if (pts.length) {
    L.marker(pts[0], { icon: pin("start"), interactive: false }).addTo(map);
    L.marker(pts[pts.length - 1], { icon: pin("end"), interactive: false }).addTo(map);
  }
  if (id !== "__all") (first.traffic?.events || []).forEach((ev) => {
    L.marker([ev.lat, ev.lng], { icon: L.divIcon({ className: "", html: `<div class="pin-hit"><div class="tev${ev.closure ? " closure" : ""}">${trafficIcon(ev, 15)}</div></div>`, iconSize: [44, 44], iconAnchor: [22, 22] }), title: ev.title })
      .bindTooltip(`${esc(ev.title)}${ev.road ? ` · ${esc(ev.road)}` : ""}${ev.simulated ? " · Simulated" : ""}`, { direction: "top", offset: [0, -14] }).addTo(map);
  });
  if (first.mode === "drive" && first.parking?.parks) {
    first.parking.parks.forEach((pk) => L.marker(pk.location, { icon: pin("park"), title: pk.name }).bindTooltip(`${esc(pk.name)} · ${pk.distance_m} m`).addTo(map));
  }
  syncVehicles(entry);
  if (group.length) {
    entry.bounds = L.featureGroup(group).getBounds();
    entry.vehicles.forEach((marker) => entry.bounds.extend(marker.getLatLng()));
    map.fitBounds(entry.bounds, { padding: [24, 24] });
  } else if (state.plan.end) map.setView(state.plan.end, 14);
  maps.set(el, entry);
  setTimeout(() => { if (maps.get(el) !== entry) return; map.invalidateSize(); if (entry.bounds) map.fitBounds(entry.bounds, { padding: [24, 24] }); }, 420);
}

// Live vehicle markers: one per transit leg with a position. Moves are glided by a CSS transform transition on the marker element.
function vehicleIcon(t, bearingDeg) {
  const colour = t.colour || SEGMENT_COLOUR[t.vehicle] || "var(--seg-bus)";
  const icon = (KIND_ICON[t.vehicle] || I.bus)(15);
  return L.divIcon({ className: "veh-marker", html: `<div class="veh-hit"><div class="veh" style="--tone:${colour}">${bearingDeg === null || bearingDeg === undefined ? "" : `<span class="veh-arrow" style="transform:rotate(${Math.round(bearingDeg)}deg)"></span>`}${icon}</div></div>`, iconSize: [44, 44], iconAnchor: [22, 22] });
}
function syncVehicles(entry, fromStep = 0) {
  const o = entry.optionId && findOption(entry.optionId);
  if (!o?.nav || !window.L) return;
  const seen = new Set();
  o.nav.forEach((n, i) => {
    const v = n.transit && i >= fromStep ? rtOf(o, i).vehicle : null;
    if (!v) return;
    seen.add(i);
    const text = `${KIND_NAME[n.transit.vehicle] || "Vehicle"} ${esc(n.transit.line)}${v.stops_away === null || v.stops_away === undefined ? "" : ` · ${plural(v.stops_away, "stop")} away`}`;
    let marker = entry.vehicles.get(i);
    if (!marker) {
      marker = L.marker([v.lat, v.lng], { icon: vehicleIcon(n.transit, v.bearing), keyboard: false }).bindTooltip(text, { direction: "top", offset: [0, -16] }).addTo(entry.map);
      entry.vehicles.set(i, marker);
      setTimeout(() => marker.getElement()?.classList.add("veh-glide"), 300);
    } else {
      marker.setLatLng([v.lat, v.lng]).setTooltipContent(text);
      const arrow = marker.getElement()?.querySelector(".veh-arrow");
      if (arrow && v.bearing !== null && v.bearing !== undefined) arrow.style.transform = `rotate(${Math.round(v.bearing)}deg)`;
    }
  });
  entry.vehicles.forEach((marker, i) => { if (!seen.has(i)) { marker.remove(); entry.vehicles.delete(i); } });
}

// A map expanded to full screen lives in the viewport, so put it back (or drop it) whenever the page or sheet that owned it goes away.
function collapseExpanded() {
  viewport.querySelectorAll(".map-wrap.expanded").forEach((wrap) => {
    wrap.classList.remove("expanded");
    if (wrap._home && document.body.contains(wrap._home)) wrap._home.insertBefore(wrap, wrap._next?.parentNode === wrap._home ? wrap._next : null); else wrap.remove();
  });
}
function cleanMaps() { maps.forEach((entry, el) => { if (!document.body.contains(el)) { entry.map.remove(); maps.delete(el); } }); }
function mapEntryFor(button) { const el = button.closest(".map-wrap")?.querySelector("[data-map]"); return el ? maps.get(el) : null; }

// Charts: hover / focus tooltips ------------------------------------------------

function bindCharts(root) {
  root.querySelectorAll("[data-chart]").forEach((card) => {
    const tip = card.querySelector(".chart-tip");
    const svgEl = card.querySelector("svg");
    const show = (g) => {
      const box = svgEl.getBoundingClientRect();
      const scale = box.width / svgEl.viewBox.baseVal.width;
      tip.textContent = g.dataset.tip;
      tip.style.left = `${svgEl.offsetLeft + Number(g.dataset.x) * scale}px`;
      tip.style.top = `${svgEl.offsetTop + Number(g.dataset.y) * scale - 30}px`;
      tip.classList.add("on");
    };
    card.querySelectorAll(".bar-group").forEach((g) => {
      g.addEventListener("mouseenter", () => show(g));
      g.addEventListener("focus", () => show(g));
      g.addEventListener("mouseleave", () => tip.classList.remove("on"));
      g.addEventListener("blur", () => tip.classList.remove("on"));
    });
  });
}

// Sheets -----------------------------------------------------------------------

let sheetEl = null;
let lastFocus = null;
function openSheet(html) {
  closeSheet(true);
  lastFocus = document.activeElement;
  sheetEl = document.createElement("div");
  sheetEl.className = "sheet-backdrop";
  sheetEl.dataset.action = "backdrop";
  sheetEl.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">${html}</div>`;
  viewport.appendChild(sheetEl);
  requestAnimationFrame(() => requestAnimationFrame(() => sheetEl?.classList.add("open")));
  mountMaps(sheetEl);
  sheetEl.querySelector(".icon-btn")?.focus({ preventScroll: true });
}
function closeSheet(immediate = false) {
  if (!sheetEl) return;
  collapseExpanded();
  const el = sheetEl;
  sheetEl = null;
  if (immediate) { el.remove(); cleanMaps(); return; }
  el.classList.remove("open");
  setTimeout(() => { el.remove(); cleanMaps(); }, 320);
  lastFocus?.focus?.({ preventScroll: true });
}

function toast(text, kind = "success") {
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.setAttribute("role", "status");
  el.innerHTML = `${(kind === "warning" ? I.alert : I.checkCircle)(18)}<span>${esc(text)}</span>`;
  viewport.appendChild(el);
  setTimeout(() => { el.classList.add("leaving"); setTimeout(() => el.remove(), 280); }, 2600);
}

// ══════════════════════════════════════════════════════════════════════════════
// Data
// ══════════════════════════════════════════════════════════════════════════════

function payload(extra = {}) {
  const f = state.form;
  return {
    origin: f.origin.trim(), destination: f.destination.trim(), purpose: state.purpose,
    origin_place_id: f.originPlaceId || null, destination_place_id: f.destinationPlaceId || null,
    leave_now: f.leave_now, departure: f.departure, deadline: f.deadline || null,
    budget: f.budget, walking: f.walking,
    modes: settings.modes, transit_modes: settings.transit_modes,
    vehicle: { fuel_l_per_100km: settings.fuel_l_per_100km, fuel_type: settings.fuel_type, fuel_price: settings.fuel_price_mode === "manual" ? settings.fuel_price : null },
    parking_cost: settings.parking_cost, transit_flat_fare: settings.use_flat_fare ? settings.flat_fare : null,
    emission_factors: settings.factors, want_elevation: settings.show.elevation,
    avoid_lines: f.avoid ? f.avoid.split(/[,\s]+/).filter(Boolean).slice(0, 10) : [],
    ride_tokens: store.get("rideTokens", []).map((t) => t.token),
    ...(demoOn() ? { demo: demoBody() } : {}),
    ...extra,
  };
}

async function postJSON(url, body) {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({ error: "The server returned an unreadable response." }));
  if (!response.ok) {
    let message = data.error || `Request failed (${response.status})`;
    const wait = Number(response.headers.get("Retry-After"));
    if (response.status === 429 && wait > 0 && !/second|minute|hour|try again/i.test(message)) message += ` Try again in ${wait < 90 ? `${wait} seconds` : `${Math.ceil(wait / 60)} minutes`}.`;
    throw Object.assign(new Error(message), { status: response.status });
  }
  return data;
}

async function search(extra = {}) {
  if (state.loading) return;
  const f = state.form;
  if (f.origin.trim().length < 3 || f.destination.trim().length < 3) { state.error = "Enter where you're starting and where you're going."; return rerender(); }
  if (state.purpose === "planb" && !f.deadline) { state.error = "Enter the time you need to arrive by."; return rerender(); }
  state.loading = true;
  state.error = null;
  state.errorKind = "error";
  state.costOpen = false;
  rerender();
  try {
    state.plan = await postJSON("/api/plan", payload(extra));
    store.set("lastDestination", f.destination.trim());
    store.set("lastDestinationPlaceId", f.destinationPlaceId || null);
    state.sort = state.purpose === "regular" ? "pt" : "best";
    state.loading = false;
    if (state.screen === "results") rerender();
    else { rerender(); const go = () => (transitioning ? setTimeout(go, 120) : navigate("results")); go(); }
  } catch (error) {
    state.loading = false;
    state.error = error.message;
    state.errorKind = error.status === 429 ? "warning" : "error";
    rerender();
  }
}

async function fetchAlerts() {
  const r = await fetch("/api/alerts").catch(() => null);
  const data = await r?.json().catch(() => ({}));
  if (!r?.ok) throw new Error(data?.error || "Live Translink alerts are unavailable.");
  state.alerts = data;
  state.alertsError = null;
  return data;
}

const alertSignature = () => state.alertsError || (state.alerts ? state.alerts.alerts.filter((a) => a.disruptive).map((a) => a.id).join("|") : "loading");

// Re-renders only when what the screens show has changed, so cards do not replay their entrance every minute.
async function loadAlerts() {
  const before = alertSignature();
  await fetchAlerts().catch((error) => { state.alertsError = error.message; });
  checkWatch();
  if (alertSignature() !== before && ["home", "results"].includes(state.screen) && !transitioning && !settingsEl && !document.activeElement?.matches?.("input")) rerender();
  if (sheetEl?.querySelector("[data-alert-results]")) sheetEl.querySelector("[data-alert-results]").innerHTML = alertsBody();
}

// "Refresh live data": POST /api/sync with the location when it is known. Falls back to GET /api/alerts until the endpoint exists.
let syncTimer = null;
async function syncLive() {
  if (state.sync.loading) return;
  clearTimeout(syncTimer);
  state.sync = { ...state.sync, loading: true, feedback: null };
  renderSync();
  const coords = state.panic.coords || state.biasCoords || state.plan?.start || null;
  try {
    const data = await postJSON("/api/sync", coords ? { lat: coords[0], lng: coords[1] } : {}).catch((error) => { if ([404, 405, 501].includes(error.status)) return null; throw error; });
    if (data) await fetchAlerts().catch(() => {}); else await fetchAlerts();
    if (data && data.status && data.status !== "success") throw new Error(data.message || "Live data could not be refreshed.");
    if (data?.weather && !(demoOn() && state.demo.weather !== "live")) { state.weather = data.weather; state.weatherError = null; renderWeather(); } else await loadWeather();
    const active = (state.alerts?.alerts || []).filter((a) => a.disruptive).length;
    state.sync = { loading: false, at: data?.fetched_at || new Date().toISOString(), feedback: { kind: "success", text: data?.message || `Live data updated. ${plural(active, "active disruption")}.` } };
  } catch (error) {
    state.sync = { ...state.sync, loading: false, feedback: { kind: "error", text: error.message || "Live data could not be refreshed. Try again." } };
  }
  checkWatch();
  if (state.screen === "home" && !transitioning) rerender(); else renderSync();
  syncTimer = setTimeout(() => {
    const banner = currentPage?.querySelector("[data-sync] .feedback-banner");
    banner?.classList.add("is-leaving");
    setTimeout(() => { state.sync.feedback = null; renderSync(); }, banner ? 200 : 0);
  }, 3000);
}

function checkWatch() {
  if (!settings.watch || !state.watch.lines.length || !state.alerts) return;
  const keys = new Set(state.watch.lines.map((l) => l.toUpperCase()));
  const hit = state.alerts.alerts.find((a) => a.disruptive && !state.watch.seen.has(a.id) && a.lines.some((l) => keys.has(l)));
  if (hit) {
    state.watch.seen.add(hit.id);
    state.watch.alert = { ...hit, lines: hit.lines.filter((l) => keys.has(l)) };
    toast(`Disruption on ${state.watch.alert.lines.join(", ")}. Open Plan B for alternatives.`);
    if (state.screen === "next") rerender();
  }
}

async function loadMyRides() {
  const tokens = store.get("rideTokens", []);
  if (!tokens.length) { state.rides.mine = []; return; }
  state.rides.loading = true;
  if (state.screen === "rides") rerender();
  try {
    const data = await postJSON("/api/rides/mine", { tokens: tokens.map((t) => t.token) });
    state.rides.mine = data.rides;
    const live = new Set(data.rides.map((r) => r.id));
    store.set("rideTokens", tokens.filter((t) => live.has(t.id)));
  } catch { /* the ride board is optional */ }
  state.rides.loading = false;
}

function freshForm() {
  const now = brisbaneNowLocal();
  const preset = demoOn() && state.demo.start === "preset";
  return {
    origin: preset ? DEMO_PRESET.origin : store.get("lastOrigin", "Taringa Station, Brisbane QLD"),
    originPlaceId: preset ? null : store.get("lastOriginPlaceId", null),
    destination: preset ? DEMO_PRESET.destination : store.get("lastDestination", "") || settings.places.work || "",
    destinationPlaceId: preset ? null : store.get("lastDestination", "") ? store.get("lastDestinationPlaceId", null) : settings.place_ids.work || null,
    leave_now: true, departure: addMinutes(now, 10), deadline: state.purpose === "planb" ? addMinutes(now, 60) : "",
    budget: settings.budget, walking: settings.walking, avoid: "",
  };
}

function locate(onDone) {
  if (!navigator.geolocation) return onDone(null);
  navigator.geolocation.getCurrentPosition(
    (pos) => onDone([pos.coords.latitude, pos.coords.longitude]),
    () => onDone(null), { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 });
}

// ══════════════════════════════════════════════════════════════════════════════
// Actions
// ══════════════════════════════════════════════════════════════════════════════

function setPath(object, path, value) {
  const keys = path.split(".");
  let target = object;
  keys.slice(0, -1).forEach((k) => { target = target[k]; });
  target[keys[keys.length - 1]] = value;
}

const actions = {
  back: goBack,
  go: (el) => navigate(el.dataset.screen, el.dataset.screen === "panic" ? "up" : "forward"),
  start: (el) => {
    state.purpose = el.dataset.purpose;
    state.form = freshForm();
    state.error = null;
    navigate("journey");
  },
  search: () => { store.set("lastOrigin", state.form.origin.trim()); store.set("lastOriginPlaceId", state.form.originPlaceId || null); search(); },
  step: (el) => {
    const field = el.dataset.field;
    const delta = Number(el.dataset.delta);
    if (field.startsWith("set.")) {
      const key = field.slice(4);
      settings[key] = Math.max(0, settings[key] + delta * (key === "budget" ? 1 : 5));
      saveSettings();
      return rerenderSettings();
    }
    if (field === "fuel_l_per_100km") {
      settings.fuel_l_per_100km = Math.min(25, Math.max(3, Math.round((settings.fuel_l_per_100km + delta * 0.5) * 10) / 10));
      saveSettings();
      return rerenderSettings();
    }
    const step = field === "budget" ? (state.form.budget >= 20 ? 5 : 1) : 5;
    state.form[field] = Math.max(0, state.form[field] + delta * step);
    rerender();
  },
  "use-location": (el) => {
    el.disabled = true;
    el.innerHTML = skelBar("Locating", 96);
    locate((coords) => {
      if (coords) { state.form.origin = `${coords[0].toFixed(6)},${coords[1].toFixed(6)}`; state.form.originPlaceId = null; state.biasCoords = coords; }
      else state.error = "Location is unavailable. Type your starting point instead.";
      rerender();
    });
  },
  "fill-place": (el) => {
    state.form[el.dataset.field] = settings.places[el.dataset.place];
    state.form[`${el.dataset.field}PlaceId`] = settings.place_ids[el.dataset.place] || null;
    rerender();
  },
  sort: (el) => { state.sort = el.dataset.value; rerender(); currentPage.querySelector(`[data-action="sort"][data-value="${state.sort}"]`)?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" }); },
  "open-sheet": (el) => { const o = findOption(el.dataset.id); if (o) { openSheet(sheetContent(o)); sheetEl.dataset.option = o.id; } },
  "close-sheet": () => closeSheet(),
  backdrop: (el, event) => { if (event.target === el) closeSheet(); },
  "map-overview": () => openSheet(`<div class="grabber"><span></span></div><div class="sheet-head"><h3 id="sheet-title">All routes</h3><button class="icon-btn" data-action="close-sheet" aria-label="Close">${I.x(18)}</button></div><div class="sheet-scroll">${mapBlock("__all", "The first option in the list is drawn strongest. Tap a line for details.")}</div>`),
  choose: (el) => {
    state.chosenId = el.dataset.id;
    const o = findOption(state.chosenId);
    state.watch = { lines: (o?.lines || []).map((l) => l.name), seen: new Set((o?.realtime?.alerts || []).map((a) => a.id)), alert: null };
    closeSheet(true);
    navigate("next");
  },
  "log-trip": () => {
    const o = findOption(state.chosenId);
    if (!o) return;
    const trips = store.get("trips", []);
    trips.push({
      ref: tripRef(o), date: new Date().toISOString(), mode: o.mode, kind: o.kind, title: o.title,
      co2_kg: o.co2_kg, co2_saved: o.vs_drive ? Math.max(0, o.vs_drive.co2_saved_kg) : 0,
      cost: o.cost_known ? o.cost : null, cost_saved: o.vs_drive?.cost_saved ?? null, distance_km: o.distance_km,
    });
    store.set("trips", trips.slice(-500));
    toast(o.vs_drive?.co2_saved_kg > 0 ? `Logged. ${kg(o.vs_drive.co2_saved_kg)} CO₂ avoided.` : "Logged to your trips.");
    rerender();
  },
  replan: () => {
    const lines = state.watch.alert?.lines || [];
    state.purpose = "planb";
    state.form.avoid = lines.join(" ");
    state.form.leave_now = true;
    if (!state.form.deadline) state.form.deadline = addMinutes(brisbaneNowLocal(), 60);
    state.watch.alert = null;
    navigate("results", "back");
    search({ avoid_lines: lines, purpose: "planb", leave_now: true });
  },
  done: () => { endBgWatch(); state.chosenId = null; state.stack = ["home"]; navigate("home", "back"); },
  "open-alerts": () => { openSheet(alertsSheet()); },
  sync: syncLive,
  "open-settings": openSettings,
  "close-settings": closeSettings,
  "settings-backdrop": (el, event) => { if (event.target === el) closeSettings(); },
  segment: (el) => {
    const { name, value } = el.dataset;
    settings[name] = value;
    saveSettings();
    if (name === "theme") applyTheme();
    if (name === "fuel_price_mode" && value === "auto") previewFuel();
    rerenderSettings();
  },
  "toggle-transit": (el) => { settings.transit_modes[el.dataset.value] = !settings.transit_modes[el.dataset.value]; saveSettings(); rerenderSettings(); },
  "clear-trips": () => { store.set("trips", []); toast("Impact history cleared."); rerenderSettings(); rerender(); },
  "toggle-table": () => { state.dashTable = !state.dashTable; rerender(); },
  "map-zoom": (el) => { const e = mapEntryFor(el); if (e) e.map.setZoom(e.map.getZoom() + Number(el.dataset.delta)); },
  "map-fit": (el) => { const e = mapEntryFor(el); if (e?.bounds) e.map.flyToBounds(e.bounds, { padding: [24, 24], duration: 0.6 }); },
  "map-expand": (el) => {
    const wrap = el.closest(".map-wrap");
    const expanded = !wrap.classList.contains("expanded");
    if (expanded) { wrap._home = wrap.parentElement; wrap._next = wrap.nextSibling; viewport.appendChild(wrap); }
    else if (wrap._home) wrap._home.insertBefore(wrap, wrap._next);
    wrap.classList.toggle("expanded", expanded);
    el.innerHTML = expanded ? I.shrink() : I.expand();
    el.setAttribute("aria-label", expanded ? "Shrink map" : "Expand map");
    const e = mapEntryFor(el);
    setTimeout(() => { if (!e || !document.body.contains(e.map.getContainer())) return; e.map.invalidateSize(); if (e.bounds) e.map.fitBounds(e.bounds, { padding: [30, 30] }); }, 60);
  },
  // Live directions
  "start-nav": (el) => {
    const o = findOption(el.dataset.id);
    if (!o?.nav?.length) return;
    closeSheet(true);
    state.chosenId = o.id;
    navInit(o);
    navigate("nav", "up");
    setTimeout(navBegin, 450);
  },
  "exit-nav": () => navigate(state.stack.length > 1 ? state.stack[state.stack.length - 2] : "home", "down"),
  "nav-sheet": () => {
    const n = state.nav, sheet = currentPage.querySelector("[data-nav-sheet]");
    n.sheetOpen = !n.sheetOpen;
    sheet.classList.toggle("open", n.sheetOpen);
    sheet.querySelector("[data-nav-steps]").toggleAttribute("inert", !n.sheetOpen);
    sheet.querySelector(".nav-grab").setAttribute("aria-expanded", String(n.sheetOpen));
    if (n.sheetOpen) revealStep(sheet.querySelector("[data-nav-steps]"));
  },
  "nav-skip": () => {
    const n = state.nav;
    if (n.finished) return;
    n.idx = Math.min(n.idx + 1, n.steps.length - 1);
    n.offSince = null;
    n.off = false;
    if (n.steps[n.idx].arrive) n.finished = true;
    navAnnounce();
    navPaint();
  },
  "nav-recenter": () => { const n = state.nav, entry = navEntry(); n.following = true; if (entry) { entry.zoomIdx = null; entry.fitSig = null; if (!n.pos) entry.map.fitBounds(entry.bounds, { padding: [48, 48] }); } navPaint(); },
  "nav-voice": () => { settings.voice = !settings.voice; saveSettings(); if (settings.voice) speak("Voice prompts on."); else try { speechSynthesis.cancel(); } catch { /* optional */ } navPaint(); },
  "nav-replan": navReplan,
  // Demo mode, sharing, install
  "open-demo": openDemoSheet,
  "demo-set": (el) => { const { name, value } = el.dataset; state.demo[name] = name === "late_min" ? Number(value) : value; saveDemo(); refreshDemoSheet(); if (name === "weather") loadWeather(); },
  "demo-exit": () => { state.demo.on = false; saveDemo(); renderDemoPill(); loadWeather(); closeSheet(); toast("Demo mode is off."); },
  "demo-push": demoPush,
  "settings-demo": () => { closeSettings(); setTimeout(openDemoSheet, 420); },
  "open-share": () => openSheet(shareSheet()),
  "settings-share": () => { closeSettings(); setTimeout(() => openSheet(shareSheet()), 420); },
  "copy-link": copyLink,
  "share-native": (el) => navigator.share({ title: "Plan B", text: "Plan B finds a way to your destination when public transport is disrupted.", url: el.dataset.url }).catch(() => {}),
  install: installApp,
  "settings-install": () => { if (state.installEvent) installApp(); else { closeSettings(); setTimeout(() => openSheet(installSheet()), 420); } },
  "toggle-cost": () => { state.costOpen = !state.costOpen; const el = currentPage.querySelector(".cost-line"); if (el) el.outerHTML = costLine(); },
  // Panic mode
  "exit-panic": () => { state.panic.phase = "ask"; navigate(state.stack.length > 1 ? state.stack[state.stack.length - 2] : "home", "down"); },
  "panic-place": (el) => {
    state.panic.dest = el.dataset.place === "last" ? store.get("lastDestination", "") : settings.places[el.dataset.place];
    state.panic.destPlaceId = el.dataset.place === "last" ? store.get("lastDestinationPlaceId", null) : settings.place_ids[el.dataset.place] || null;
    rerender();
  },
  "panic-go": async () => {
    const pm = state.panic;
    const origin = pm.coords ? `${pm.coords[0].toFixed(6)},${pm.coords[1].toFixed(6)}` : (pm.origin || "").trim();
    if (origin.length < 3 || pm.dest.trim().length < 3) { pm.error = "Enter where you are and where you need to be."; return rerender(); }
    let deadline = null;
    if (pm.by) {
      const today = brisbaneNowLocal().slice(0, 10);
      deadline = `${today}T${pm.by}`;
      if (deadline <= brisbaneNowLocal()) deadline = `${addMinutes(`${today}T${pm.by}`, 24 * 60)}`;
    }
    pm.phase = "loading";
    pm.error = null;
    rerender();
    state.purpose = "panic";
    state.form = { ...freshForm(), origin, destination: pm.dest.trim(), leave_now: true, deadline: deadline || "", budget: 200, walking: 60,
      originPlaceId: pm.coords ? null : pm.originPlaceId || null, destinationPlaceId: pm.destPlaceId || null };
    try {
      state.plan = await postJSON("/api/plan", payload({ purpose: "panic" }));
      store.set("lastDestination", pm.dest.trim());
      pm.phase = state.plan.recommended_id ? "answer" : "ask";
      if (!state.plan.recommended_id) pm.error = state.plan.errors.join(" ") || "No route was found. Try a nearby landmark.";
    } catch (error) {
      pm.phase = "ask";
      pm.error = error.message;
      pm.errorKind = error.status === 429 ? "warning" : "error";
    }
    rerender();
  },
  "panic-others": () => { state.sort = "arrival"; state.stack = ["home"]; navigate("results", "forward"); },
  // Ride board
  "open-ride-form": () => { state.rideKind = state.rideKind || "car"; openSheet(rideFormSheet()); },
  "ride-kind": (el) => { state.rideKind = el.dataset.value; const values = rideFormValues(); openSheet(rideFormSheet()); restoreRideForm(values); },
  "ride-create": async () => {
    const form = rideFormValues();
    const p = state.plan;
    try {
      const data = await postJSON("/api/rides", {
        kind: state.rideKind || "car", nickname: form.nickname, seats: form.seats, meet_point: form.meet_point,
        depart_at: form.depart_at, trip_cost: form.trip_cost, note: form.note,
        origin: p.start, destination: p.end, origin_label: p.origin.slice(0, 80), destination_label: p.destination.slice(0, 80),
      });
      store.set("rideTokens", [...store.get("rideTokens", []), { id: data.ride.id, token: data.token }]);
      closeSheet();
      await loadMyRides();
      toast("Posted. People searching a similar trip will see it.");
      rerender();
    } catch (error) {
      const err = sheetEl?.querySelector(".sheet-foot");
      if (err) err.insertAdjacentHTML("afterbegin", notice(esc(error.message), "error"));
    }
  },
  "ride-join-start": (el) => { state.rides.joining = el.dataset.id; rerender(); currentPage.querySelector('[data-ride-join="nickname"]')?.focus(); },
  "ride-join": async (el) => {
    const nickname = currentPage.querySelector('[data-ride-join="nickname"]')?.value || "";
    try {
      const data = await postJSON("/api/rides/join", { id: el.dataset.id, nickname });
      store.set("rideTokens", [...store.get("rideTokens", []), { id: data.ride.id, token: data.token }]);
      state.rides.joining = null;
      state.rides.error = null;
      await loadMyRides();
      toast("You've joined. Meet at the meeting point on time.");
    } catch (error) { state.rides.error = error.message; }
    rerender();
  },
  "ride-leave": async (el) => {
    const tokens = store.get("rideTokens", []);
    const entry = tokens.find((t) => t.id === el.dataset.id);
    if (!entry) return;
    await postJSON("/api/rides/leave", { id: entry.id, token: entry.token }).catch(() => {});
    store.set("rideTokens", tokens.filter((t) => t.id !== entry.id));
    if (state.plan?.rides) state.plan.rides = state.plan.rides.filter((r) => r.id !== entry.id);
    await loadMyRides();
    rerender();
  },
};

function rideFormValues() {
  const root = sheetEl?.querySelector("#ride-form");
  if (!root) return {};
  return Object.fromEntries([...root.querySelectorAll("input, select")].map((i) => [i.name, i.value]));
}
function restoreRideForm(values) {
  const root = sheetEl?.querySelector("#ride-form");
  if (!root) return;
  Object.entries(values).forEach(([name, value]) => { const i = root.querySelector(`[name="${name}"]`); if (i && name !== "trip_cost" && value) i.value = value; });
}

document.addEventListener("click", (event) => {
  const el = event.target.closest("[data-action]");
  if (!el || transitioning) return;
  const action = actions[el.dataset.action];
  if (action) action(el, event);
});

document.addEventListener("input", (event) => {
  const t = event.target;
  if (t.dataset.field && state.form) { state.form[t.dataset.field] = t.value; state.form[`${t.dataset.field}PlaceId`] = null; state.error = null; }
  if (t.dataset.panic) { state.panic[t.dataset.panic] = t.value; state.panic[`${t.dataset.panic}PlaceId`] = null; }
  if (t.dataset.settingText) {
    setPath(settings, t.dataset.settingText, t.value.slice(0, 200));
    if (t.dataset.settingText.startsWith("places.")) settings.place_ids[t.dataset.settingText.slice(7)] = null;
    saveSettings();
  }
  if (t.dataset.ac) autocomplete.onInput(t);
  if (t.dataset.settingNumber) {
    const v = t.value === "" ? null : Number(t.value);
    if (v === null || Number.isFinite(v)) { setPath(settings, t.dataset.settingNumber, v); saveSettings(); }
  }
  if (t.matches("[data-alert-query]")) {
    state.alertQuery = t.value;
    sheetEl.querySelector("[data-alert-results]").innerHTML = alertsBody();
  }
});

document.addEventListener("change", (event) => {
  const t = event.target;
  if (t.dataset.setting) {
    const name = t.dataset.setting;
    if (name === "bg.watch") return bgWatchToggle(t);
    if (name.startsWith("demo.")) return demoToggle(name.slice(5), t.checked);
    if (name === "form.leave_now") { state.form.leave_now = t.checked; return setTimeout(rerender, 220); }
    if (name === "motion_reduced") settings.motion = t.checked ? "reduced" : "full";
    else setPath(settings, name, t.checked);
    if (name.startsWith("modes.") && !Object.values(settings.modes).some(Boolean)) { settings.modes.transit = true; toast("At least one way to travel must stay on."); }
    saveSettings();
    applyTheme();
    if (name === "watch" && state.screen === "next") return;
    setTimeout(rerenderSettings, 260);
  }
  if (t.dataset.settingSelect) { settings[t.dataset.settingSelect] = t.value; state.fuelPreview = null; saveSettings(); if (settings.fuel_price_mode === "auto") previewFuel(); rerenderSettings(); }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  const expanded = viewport.querySelector(".map-wrap.expanded [data-action='map-expand']");
  if (expanded) return actions["map-expand"](expanded);
  if (sheetEl) closeSheet(); else if (settingsEl) closeSettings();
});

matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => { if (settings.theme === "system") applyTheme(); });

// ── Live status polling (every 15 s while a screen with transit legs is visible) ─────

const liveQueries = (o) => (o.nav || []).flatMap((n, i) => (n.transit?.live_query ? [[i, n.transit.live_query]] : [])).slice(0, 8);
function liveTarget() {
  if (state.screen === "nav") return state.nav && findOption(state.nav.optionId);
  if (sheetEl?.dataset.option) return findOption(sheetEl.dataset.option);
  if (state.screen === "next") return findOption(state.chosenId);
  if (state.screen === "panic" && state.panic.phase === "answer" && state.plan) return findOption(state.plan.recommended_id);
  return null;
}
async function pollLive(o) {
  const qs = liveQueries(o);
  if (!qs.length) return;
  live.polledAt = Date.now();
  try {
    const data = await postJSON("/api/live", { queries: qs.map(([, q]) => q), demo: demoBody() });
    qs.forEach(([i], k) => { if (data.results[k]) live.results[liveKey(o, i)] = data.results[k]; });
    live.at = Date.now();
    live.failed = false;
  } catch { live.failed = true; }
  paintLive();
}
// Patches the status chips, vehicle markers and the "updated" line in place, so nothing re-renders or loses its scroll position.
function paintLive() {
  const o = liveTarget();
  if (!o) return;
  document.querySelectorAll("[data-live]").forEach((el) => {
    const [id, i, flag] = el.dataset.live.split(":");
    if (id !== o.id) return;
    const html = liveLine(o, Number(i), flag === "p");
    if (el.__h !== html) { el.innerHTML = html; el.__h = html; }
  });
  maps.forEach((entry) => { if (!entry.nav) syncVehicles(entry); });
  if (state.screen === "nav") navPaint();
  renderLiveAge();
}
function renderLiveAge() {
  document.querySelectorAll("[data-live-age]").forEach((el) => { el.classList.toggle("stale", live.failed); el.lastElementChild.textContent = liveAgeText(); });
}
setInterval(() => {
  const o = document.hidden ? null : liveTarget();
  if (!o || !hasLive(o)) { live.id = null; return; }
  const id = `${state.plan?.queried_at}|${o.id}`;
  if (live.id !== id) { live.id = id; pollLive(o); } else if (Date.now() - live.polledAt >= 15000) pollLive(o);
  renderLiveAge();
}, 1000);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) return;
  live.polledAt = 0;
  if (state.screen === "nav" && state.nav) { state.nav.lock = null; lockScreen(); }
});

// ── Weather ──────────────────────────────────────────────────────────────────

async function weatherCoords() {
  if (demoOn() && state.demo.start === "preset") return { c: [-27.4931, 152.9821], place: "Taringa" };
  if (state.biasCoords) return { c: state.biasCoords, place: "Near you" };
  try {
    const perm = await navigator.permissions?.query({ name: "geolocation" });
    if (perm?.state === "granted") { const c = await new Promise(locate); if (c) { state.biasCoords = c; return { c, place: "Near you" }; } }
  } catch { /* fall back to Brisbane */ }
  return { c: BRISBANE, place: "Brisbane" };
}
async function loadWeather() {
  const { c, place } = await weatherCoords();
  state.weatherPlace = place;
  const demo = demoOn() && state.demo.weather !== "live" ? `&demo=${state.demo.weather}` : "";
  try {
    const r = await fetch(`/api/weather?lat=${c[0]}&lng=${c[1]}${demo}`);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || "Weather is unavailable right now.");
    state.weather = data;
    state.weatherError = null;
  } catch (error) { if (!state.weather) state.weatherError = error.message; }
  renderWeather();
}

// ── Demo mode ────────────────────────────────────────────────────────────────

const DEMO_CHOICES = {
  weather: [["live", "Live"], ["clear", "Clear"], ["rain", "Rain"], ["storm", "Storm"], ["heat", "Heatwave"]],
  disrupted: [["none", "None"], ["train", "Train"], ["bus", "Bus"], ["ferry", "Ferry"], ["tram", "Light rail"], ["all", "All public transport"]],
  traffic: [["live", "Live"], ["heavy", "Heavy"], ["crash", "Crash on route"]],
  late_min: [[0, "On time"], [5, "5 min"], [10, "10 min"], [20, "20 min"]],
  start: [["preset", "Taringa Station to UQ"], ["current", "Current location"]],
};
function demoSheet() {
  const d = state.demo;
  const group = (name, label, hint = "") => `<div class="opt-group"><p>${label}</p><div class="opt-chips" role="group" aria-label="${label}">${DEMO_CHOICES[name].map(([v, l]) => `<button class="chip" data-action="demo-set" data-name="${name}" data-value="${v}" aria-pressed="${String(d[name]) === String(v)}">${esc(l)}</button>`).join("")}</div>${hint ? `<p class="fine" style="margin-top:8px">${hint}</p>` : ""}</div>`;
  const push = state.demoPush;
  return `<div class="grabber"><span></span></div>
    <div class="sheet-head"><h3 id="sheet-title">Demo mode</h3><button class="icon-btn" data-action="close-sheet" aria-label="Close">${I.x(18)}</button></div>
    <div class="sheet-scroll">
      <div class="group demo-master"><div class="group-card"><div class="row"><span class="row-icon" style="--tone:var(--accent)">${I.flask(18)}</span><span class="row-label">Demo mode<small>Simulate conditions for a walkthrough. Every simulated value is labelled "Simulated".</small></span>${toggle("demo.on", d.on, "Demo mode")}</div></div></div>
      ${d.on ? `
        ${state.plan ? notice("Changes apply to the next search. Search again to see them in your results.", "info") : ""}
        ${group("weather", "Weather", "Replaces the live forecast with a simulated one.")}
        ${group("disrupted", "Disrupted service", "Marks the first matching public transport option as disrupted.")}
        ${group("traffic", "Traffic", "Replaces QLDTraffic events on driving routes.")}
        ${group("late_min", "Running late", "Minutes added to the disrupted line's delay.")}
        ${group("start", "Start point", "Used for new searches and Panic mode.")}
        <div class="opt-group"><p>Live directions</p><div class="group-card" style="background:var(--bg-card)"><div class="row"><span class="row-label">Simulate journey<small>Move a fake position along the route at 25 times speed instead of using GPS.</small></span>${toggle("demo.simulate", d.simulate, "Simulate journey")}</div></div></div>
        <div class="opt-group"><p>Background alerts</p><div class="demo-test">
          <button class="btn btn-secondary${push?.busy ? " is-loading" : ""}" data-action="demo-push" ${push?.busy ? "disabled aria-busy=\"true\"" : ""}>${push?.busy ? skelBar("Sending test push", 140) : `${I.bell(16)}Send test disruption push in 10 s`}</button>
          ${push?.text ? notice(esc(push.text), push.kind) : ""}</div>
          <p class="fine" style="margin-top:8px">Asks for notification permission, then the server sends a simulated disruption 10 seconds later. Minimise Plan B to watch it arrive.</p></div>
        <button class="btn btn-text" data-action="demo-exit">Exit demo mode</button>` : `<p class="hint">Turn on demo mode to simulate bad weather, a disrupted line or traffic, and to see what each search costs in Google API requests.</p>`}
    </div>`;
}
function refreshDemoSheet() {
  const sheet = sheetEl?.querySelector(".sheet");
  if (!sheet || !sheetEl.dataset.demo) return;
  const scroller = sheet.querySelector(".sheet-scroll"), top = scroller ? scroller.scrollTop : 0;
  sheet.innerHTML = demoSheet();
  sheet.querySelector(".sheet-scroll").scrollTop = top;
}
function openDemoSheet() { openSheet(demoSheet()); sheetEl.dataset.demo = "1"; }
function renderDemoPill() {
  document.getElementById("demo-pill").hidden = !demoOn();
  document.querySelector('.icon-btn[data-action="open-demo"]')?.classList.toggle("on", demoOn());
}
function demoToggle(key, checked) {
  state.demo[key] = checked;
  saveDemo();
  renderDemoPill();
  if (key === "on") { state.costOpen = false; loadWeather(); }
  setTimeout(() => { refreshDemoSheet(); rerenderSettings(); }, 260);
}
async function demoPush() {
  state.demoPush = { busy: true };
  refreshDemoSheet();
  try {
    let b = store.get("bgwatch", null);
    if (!b) {
      const o = findOption(state.chosenId);
      const watch = o ? watchBody(o) : { label: "Demo trip", lines: ["412"], route_ids: [], origin: DEMO_PRESET.origin, destination: DEMO_PRESET.destination, destination_place_id: null, deadline: null };
      const r = await subscribePush(watch);
      b = { ref: "demo", id: r.id, endpoint: r.endpoint, title: watch.label, expires: new Date(Date.now() + 3 * 3600000).toISOString() };
      store.set("bgwatch", b);
      rememberWatch(r.id, watch);
    }
    const res = await postJSON("/api/push/test", { endpoint: b.endpoint, delay_s: 10 });
    state.demoPush = { kind: "success", text: `Test sent. It arrives in about ${res.sent_in_s ?? 10} seconds. Minimise Plan B to see the notification.` };
  } catch (error) { state.demoPush = { kind: "error", text: error.message }; }
  refreshDemoSheet();
}

// ── Share, install and background alerts ─────────────────────────────────────

function shareSheet() {
  const url = state.status?.public_url || location.origin;
  const local = /^(localhost|127\.|\[::1\])/.test(location.hostname) && !state.status?.public_url;
  return `<div class="grabber"><span></span></div>
    <div class="sheet-head"><h3 id="sheet-title">Share Plan B</h3><button class="icon-btn" data-action="close-sheet" aria-label="Close">${I.x(18)}</button></div>
    <div class="sheet-scroll">
      <p class="hint" style="margin-bottom:20px">Scan with a phone camera to open Plan B, then add it to the home screen.</p>
      <div class="qr-card"><img src="/qr.svg" alt="QR code that opens Plan B at ${esc(url)}" loading="lazy" width="244" height="244" onload="this.parentElement.classList.add('ready')" onerror="this.parentElement.classList.add('ready')"></div>
      <div class="share-url"><code>${esc(url)}</code><button class="btn btn-primary" data-action="copy-link" data-url="${esc(url)}">${I.copy(16)}Copy link</button></div>
      <div data-share-fb></div>
      ${navigator.share ? `<button class="btn btn-secondary" data-action="share-native" data-url="${esc(url)}">${I.share(16)}Share with other apps</button>` : ""}
      ${local ? notice("This address only works on this computer. Deploy Plan B, or set PUBLIC_URL, so the QR code points to a public address.", "info") : ""}
    </div>`;
}
async function copyLink(el) {
  const url = el.dataset.url;
  let ok = false;
  try { await navigator.clipboard.writeText(url); ok = true; } catch {
    try { const t = Object.assign(document.createElement("textarea"), { value: url }); t.style.cssText = "position:fixed;opacity:0"; document.body.appendChild(t); t.select(); ok = document.execCommand("copy"); t.remove(); } catch { /* manual copy */ }
  }
  const fb = sheetEl?.querySelector("[data-share-fb]");
  if (fb) {
    fb.innerHTML = notice(ok ? "Link copied to the clipboard." : "Couldn't copy automatically. Select the address and copy it by hand.", ok ? "success" : "error");
    setTimeout(() => { fb.firstElementChild?.classList.add("is-leaving"); setTimeout(() => { fb.innerHTML = ""; }, 200); }, 3000);
  }
  if (ok) { el.innerHTML = `${I.check(16)}Copied`; setTimeout(() => { if (el.isConnected) el.innerHTML = `${I.copy(16)}Copy link`; }, 2500); }
}

const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const canInstall = () => !standalone() && (!!state.installEvent || isIos());
function installSheet() {
  return `<div class="grabber"><span></span></div>
    <div class="sheet-head"><h3 id="sheet-title">Install Plan B</h3><button class="icon-btn" data-action="close-sheet" aria-label="Close">${I.x(18)}</button></div>
    <div class="sheet-scroll">
      <p class="hint" style="margin-bottom:20px">Add Plan B to your Home Screen to open it like an app and to get background disruption alerts.</p>
      <ol class="install-steps">
        <li><span>Tap the Share button ${I.share(18)} in Safari's toolbar.</span></li>
        <li><span>Scroll down and tap <b>Add to Home Screen</b> ${I.plus(18)}.</span></li>
        <li><span>Open Plan B from your Home Screen, then turn on <b>Watch this trip in the background</b>.</span></li>
      </ol>
      ${notice("On iPhone, background alerts only work for the installed app (iOS 16.4 or later) and need an HTTPS address.", "info")}
    </div>`;
}
async function installApp() {
  const ev = state.installEvent;
  if (!ev) return openSheet(installSheet());
  state.installEvent = null;
  try { await ev.prompt(); } catch { return openSheet(installSheet()); }
  const choice = await ev.userChoice.catch(() => null);
  if (choice?.outcome === "accepted") toast("Plan B is installing.");
  if (state.screen === "home") rerender();
  rerenderSettings();
}
window.addEventListener("beforeinstallprompt", (event) => { event.preventDefault(); state.installEvent = event; if (state.screen === "home" && !transitioning) rerender(); });
window.addEventListener("appinstalled", () => { state.installEvent = null; if (state.screen === "home") rerender(); });

const b64ToBytes = (b64) => Uint8Array.from(atob(b64.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (b64.length % 4)) % 4)), (c) => c.charCodeAt(0));
function pushSupport() {
  if (!window.isSecureContext) return "Background alerts need HTTPS. Open the secure (https://) address of this app.";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return isIos() && !standalone() ? "On iPhone, add Plan B to your Home Screen first (Share, then Add to Home Screen), open it from there and try again." : "This browser doesn't support background notifications.";
  if (state.status && state.status.push === false) return "This Plan B server isn't set up for push notifications.";
  if (Notification.permission === "denied") return "Notifications are blocked for Plan B. Allow them in your browser settings, then try again.";
  return null;
}
async function subscribePush(watch) {
  const problem = pushSupport();
  if (problem) throw new Error(problem);
  const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notifications weren't allowed, so background alerts stay off.");
  const reg = await navigator.serviceWorker.ready;
  const keyRes = await fetch("/api/push/key");
  const keyData = await keyRes.json().catch(() => ({}));
  if (!keyRes.ok) throw new Error(keyData.error || "Push notifications are unavailable on this server.");
  const key = b64ToBytes(keyData.publicKey);
  let sub = await reg.pushManager.getSubscription();
  const current = sub?.options?.applicationServerKey && new Uint8Array(sub.options.applicationServerKey);
  if (sub && current && (current.length !== key.length || current.some((b, i) => b !== key[i]))) { await sub.unsubscribe(); sub = null; }
  sub ||= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  const data = await postJSON("/api/push/subscribe", { subscription: sub.toJSON(), watch });
  return { id: data.id, endpoint: sub.endpoint };
}
function watchBody(o) {
  const p = state.plan;
  return { label: o.title, lines: (o.lines || []).map((l) => l.name), route_ids: [...new Set((o.nav || []).flatMap((n) => n.transit?.route_ids || []))].slice(0, 40),
    origin: p.origin, destination: p.destination, destination_place_id: state.form?.destinationPlaceId || null, deadline: p.deadline || null };
}
// The server only holds the watch; the trip details needed to re-plan stay on this device, keyed by the watch id in the notification link.
function rememberWatch(id, w) {
  const all = store.get("watches", {});
  all[id] = { ...w, budget: state.form?.budget, walking: state.form?.walking, at: Date.now() };
  const keep = Object.entries(all).sort((a, b) => b[1].at - a[1].at).slice(0, 5);
  store.set("watches", Object.fromEntries(keep));
}
const bgWatchActive = (o) => { const b = store.get("bgwatch", null); return !!b && b.ref === tripRef(o) && (!b.expires || Date.parse(b.expires) > Date.now()); };
function bgSlotInner() {
  const bg = state.bg;
  if (bg?.busy) return `<div class="skel-stack" role="status" aria-label="Setting up background alerts"><div class="skeleton skel-line w-60"></div><div class="skeleton skel-line sm w-80"></div></div>`;
  return bg?.msg ? notice(esc(bg.msg.text), bg.msg.kind) : "";
}
const renderBg = () => { const el = currentPage?.querySelector("[data-bg-slot]"); if (el) el.innerHTML = bgSlotInner(); };
async function bgWatchToggle(box) {
  const o = findOption(state.chosenId), on = box.checked;
  if (!o) return;
  state.bg = { busy: true };
  renderBg();
  try {
    if (on) {
      const watch = watchBody(o), r = await subscribePush(watch);
      const ends = watch.deadline ? Date.parse(`${watch.deadline.slice(0, 16)}:00+10:00`) + 30 * 60000 : Date.now() + 3 * 3600000;
      store.set("bgwatch", { ref: tripRef(o), id: r.id, endpoint: r.endpoint, title: o.title, expires: new Date(ends).toISOString() });
      rememberWatch(r.id, watch);
      state.bg = { msg: { kind: "success", text: "Watching this trip. You'll get a notification if Translink posts a disruption on your lines, even with Plan B closed." } };
    } else {
      await endBgWatch();
      state.bg = { msg: { kind: "info", text: "Background alerts are off for this trip." } };
    }
  } catch (error) {
    box.checked = !on;
    state.bg = { msg: { kind: "error", text: error.message } };
  }
  renderBg();
}
async function endBgWatch() {
  const b = store.get("bgwatch", null);
  if (!b) return;
  store.set("bgwatch", null);
  await postJSON("/api/push/unsubscribe", { endpoint: b.endpoint }).catch(() => {});
  try { await (await navigator.serviceWorker.ready).pushManager.getSubscription().then((sub) => sub?.unsubscribe()); } catch { /* nothing to remove */ }
}

// A notification opened the app at /?alternatives=<watch id>: re-plan the stored trip avoiding the disrupted lines.
function openAlternatives(id) {
  const w = store.get("watches", {})[id];
  if (!w) return toast("That alert is from another device. Start a new Plan B search.", "warning");
  const now = brisbaneNowLocal(), deadline = w.deadline && w.deadline.slice(0, 16) > now ? w.deadline.slice(0, 16) : addMinutes(now, 60);
  state.purpose = "planb";
  state.form = { ...freshForm(), origin: w.origin, originPlaceId: null, destination: w.destination, destinationPlaceId: w.destination_place_id || null, leave_now: true, deadline,
    budget: w.budget ?? settings.budget, walking: w.walking ?? settings.walking, avoid: w.lines.join(" ") };
  state.error = null;
  if (state.screen !== "journey") navigate("journey");
  search({ avoid_lines: w.lines, purpose: "planb", leave_now: true });
}

// ── Boot ─────────────────────────────────────────────────────────────────────

async function boot() {
  applyTheme();
  renderDemoPill();
  rerender();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    navigator.serviceWorker.addEventListener("message", (event) => {
      const id = event.data?.type === "open" && new URL(event.data.url, location.origin).searchParams.get("alternatives");
      if (id) openAlternatives(id);
    });
  }
  try {
    const response = await fetch("/api/status");
    state.status = await response.json();
  } catch {
    state.status = { live_available: false };
  }
  await loadMyRides();
  rerender();
  loadWeather();
  loadAlerts();
  setInterval(loadAlerts, 60000);
  const bg = store.get("bgwatch", null);
  if (bg?.expires && Date.parse(bg.expires) < Date.now()) endBgWatch();
  const params = new URLSearchParams(location.search);
  if (params.has("alternatives") || params.has("panic")) history.replaceState(null, "", location.pathname);
  if (params.get("alternatives")) openAlternatives(params.get("alternatives"));
  else if (params.has("panic")) navigate("panic", "up");
}

// ── Address suggestions (Places API Autocomplete) ────────────────────────────

const autocomplete = (() => {
  let input = null, list = null, items = [], active = -1, timer = null, session = null, requestId = 0;
  const newSession = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`).replace(/[^A-Za-z0-9-]/g, "").slice(0, 64);
  const recent = () => store.get("recentPlaces", []);
  const isOrigin = (el) => /origin$/.test(el.dataset.ac);

  function bias() {
    const c = state.panic.coords || state.biasCoords || state.plan?.start;
    return c ? `&lat=${c[0]}&lng=${c[1]}` : "";
  }

  // Current location, saved places and recent choices shown before (and alongside) Google's suggestions.
  function local(text) {
    const q = text.trim().toLowerCase();
    const entries = [];
    if (input && isOrigin(input) && !q) entries.push({ kind: "location", main: "Current location", secondary: "Use this device's location" });
    [["home", "Home"], ["work", "Work/Uni"]].forEach(([k, label]) => {
      const saved = settings.places[k];
      if (saved && input && !input.dataset.ac.startsWith("places.") && (!q || saved.toLowerCase().includes(q) || label.toLowerCase().startsWith(q))) {
        entries.push({ kind: "saved", main: label, secondary: saved, text: saved, place_id: settings.place_ids[k] });
      }
    });
    recent().filter((r) => !q || r.text.toLowerCase().includes(q)).slice(0, q ? 2 : 4)
      .forEach((r) => { if (!entries.some((e) => e.text === r.text)) entries.push({ ...r, kind: "recent" }); });
    return entries;
  }

  function bolded(item) {
    if (!item.matches?.length) return esc(item.main);
    let out = "", last = 0;
    item.matches.forEach(([a, b]) => { out += esc(item.main.slice(last, a)) + `<b>${esc(item.main.slice(a, b))}</b>`; last = b; });
    return out + esc(item.main.slice(last));
  }

  const ICON = { transit: () => I.bus(16), street: () => I.route(16), place: () => I.pin(16), saved: () => I.home(16), recent: () => I.clock(16), location: () => I.locate(16) };

  function render(loading = false) {
    if (!input) return;
    if (!list) {
      list = document.createElement("div");
      list.className = "ac-list";
      list.id = "ac-list";
      list.setAttribute("role", "listbox");
      list.addEventListener("mousedown", (e) => e.preventDefault());
      list.addEventListener("click", (e) => { const opt = e.target.closest("[data-ac-index]"); if (opt) choose(Number(opt.dataset.acIndex)); });
      viewport.appendChild(list);
    }
    const hasGoogle = items.some((i) => !["saved", "recent", "location"].includes(i.kind));
    list.innerHTML = `${items.map((item, i) => `
      <div class="ac-item${i === active ? " active" : ""}" id="ac-opt-${i}" role="option" aria-selected="${i === active}" data-ac-index="${i}" style="animation-delay:${i * 28}ms">
        <span class="ac-icon ${item.kind}">${(ICON[item.kind] || ICON.place)()}</span>
        <span class="ac-text"><span class="ac-main">${bolded(item)}</span>${item.secondary ? `<span class="ac-sub">${esc(item.secondary)}</span>` : ""}</span>
      </div>`).join("")}
      ${loading ? `<div role="status" aria-label="Loading suggestions">${[0, 1].map(() => `<div class="ac-skel" aria-hidden="true"><div class="skeleton skel-tile" style="width:32px;height:32px;border-radius:10px"></div><div><div class="skeleton skel-line w-80"></div><div class="skeleton skel-line sm w-40"></div></div></div>`).join("")}</div>` : ""}
      ${hasGoogle ? `<div class="ac-foot">Suggestions by <span translate="no">Google</span></div>` : ""}`;
    list.hidden = !(items.length || loading);
    position();
    input.setAttribute("aria-expanded", String(!list.hidden));
    if (active >= 0) input.setAttribute("aria-activedescendant", `ac-opt-${active}`); else input.removeAttribute("aria-activedescendant");
  }

  function position() {
    if (!list || !input) return;
    const host = viewport.getBoundingClientRect();
    const anchor = (input.closest(".row") || input).getBoundingClientRect();
    const below = host.bottom - anchor.bottom;
    list.style.left = `${anchor.left - host.left + 6}px`;
    list.style.width = `${anchor.width - 12}px`;
    if (below < 240 && anchor.top - host.top > below) {
      list.style.top = ""; list.style.bottom = `${host.bottom - anchor.top + 4}px`; list.classList.add("above");
    } else {
      list.style.bottom = ""; list.style.top = `${anchor.bottom - host.top + 4}px`; list.classList.remove("above");
    }
  }

  async function fetchSuggestions(text) {
    const id = ++requestId;
    try {
      const r = await fetch(`/api/autocomplete?q=${encodeURIComponent(text)}&session=${session}${bias()}`);
      const data = await r.json();
      if (r.status === 429 && Date.now() - (state.acToast || 0) > 60000) { state.acToast = Date.now(); toast(data.error || "Too many address lookups. Type the full address instead.", "warning"); }
      if (id !== requestId || !input) return;
      const mine = local(text);
      const google = r.ok ? data.suggestions : [];
      items = [...mine, ...google.filter((g) => !mine.some((l) => l.text === g.text))].slice(0, 7);
      active = -1;
      render();
    } catch {
      if (id === requestId && input) { items = local(text); render(); }
    }
  }

  function open(el) {
    if (input !== el) { input = el; session = newSession(); }
    if (el.value.trim().length >= 3) return onInput(el);
    items = local(el.value);
    active = -1;
    render();
  }

  function onInput(el) {
    if (input !== el) { input = el; session = newSession(); }
    clearTimeout(timer);
    const text = el.value.trim();
    items = local(text);
    active = -1;
    if (text.length < 3 || !state.status?.live_available) return render();
    render(true);
    timer = setTimeout(() => fetchSuggestions(text), 220);
  }

  function close() {
    clearTimeout(timer);
    requestId++;
    if (input) { input.setAttribute("aria-expanded", "false"); input.removeAttribute("aria-activedescendant"); }
    if (list) { const old = list; list = null; old.classList.add("closing"); setTimeout(() => old.remove(), 160); }
    input = null; items = []; active = -1;
  }

  function apply(path, text, placeId) {
    const [scope, field] = path.split(".");
    if (scope === "form") { state.form[field] = text; state.form[`${field}PlaceId`] = placeId || null; state.error = null; }
    else if (scope === "panic") { state.panic[field] = text; state.panic[`${field}PlaceId`] = placeId || null; }
    else { settings.places[field] = text; settings.place_ids[field] = placeId || null; saveSettings(); }
  }

  function choose(index) {
    const item = items[index];
    const el = input;
    if (!item || !el) return;
    const path = el.dataset.ac;
    if (item.kind === "location") {
      close();
      el.value = "";
      (el.closest(".row, .panic-field") || el).classList.add("is-loading");
      locate((coords) => {
        if (coords) {
          state.biasCoords = coords;
          apply(path, `${coords[0].toFixed(6)},${coords[1].toFixed(6)}`, null);
          if (path.startsWith("panic")) state.panic.coords = coords;
        } else { apply(path, "", null); toast("Location is unavailable. Type the address instead."); }
        rerender();
      });
      return;
    }
    el.value = item.text;
    apply(path, item.text, item.place_id);
    if (item.place_id) store.set("recentPlaces", [{ text: item.text, main: item.main, secondary: item.secondary, place_id: item.place_id }, ...recent().filter((r) => r.text !== item.text)].slice(0, 6));
    close();
    const inputs = [...(el.closest(".scroll, .settings-scroll")?.querySelectorAll("[data-ac]") || [])];
    const after = inputs[inputs.indexOf(el) + 1];
    if (after && !after.value.trim()) after.focus(); else el.blur();
  }

  function onKey(event) {
    if (!input || event.target !== input || !list || list.hidden || !items.length) {
      if (input && event.target === input && event.key === "Escape") close();
      return;
    }
    if (event.key === "ArrowDown") { active = (active + 1) % items.length; render(); event.preventDefault(); }
    else if (event.key === "ArrowUp") { active = (active - 1 + items.length) % items.length; render(); event.preventDefault(); }
    else if (event.key === "Enter" && active >= 0) { choose(active); event.preventDefault(); }
    else if (event.key === "Escape") { close(); event.stopPropagation(); }
  }

  document.addEventListener("focusin", (e) => { if (e.target.dataset?.ac) open(e.target); });
  document.addEventListener("focusout", (e) => { if (e.target === input) setTimeout(() => { if (document.activeElement !== input) close(); }, 120); });
  document.addEventListener("keydown", onKey, true);
  viewport.addEventListener("scroll", position, true);
  window.addEventListener("resize", position);
  return { onInput, close };
})();

function acAttrs(path) {
  return `data-ac="${path}" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="ac-list" autocomplete="off" spellcheck="false"`;
}

boot();
