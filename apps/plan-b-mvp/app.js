/* Reroute (formerly Plan B MVP v3) — mobile-first front end. Plain JavaScript, no build step. */
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
  scooter: (s) => svg('<circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/><path d="M8 18h7l-2-8h4l2 8M13 10h-2l-1-4h4M17 6h2"/>', s),
  bike: (s) => svg('<circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="m6 17 4-8 4 8H6l4-8h5l3 8M12 6h3"/>', s),
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
  // Saved places, impact
  star: (s) => svg('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>', s),
  edit: (s) => svg('<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>', s),
  trash: (s) => svg('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>', s),
  flame: (s) => svg('<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>', s),
  // Menu, profile, map picker and the weather page
  chevronDown: (s = 14) => svg('<polyline points="6 9 12 15 18 9"/>', s),
  user: (s) => svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>', s),
  info: (s) => svg('<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>', s),
  shield: (s) => svg('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>', s),
  file: (s) => svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/>', s),
  map: (s) => svg('<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>', s),
  droplet: (s) => svg('<path d="M12 2.7 6.3 8.4a8 8 0 1 0 11.4 0z"/>', s),
  sunrise: (s) => svg('<path d="M17 18a5 5 0 0 0-10 0M12 2v7M4.22 10.22l1.42 1.42M1 18h2M21 18h2M18.36 11.64l1.42-1.42M23 22H1M8 6l4-4 4 4"/>', s),
  sunset: (s) => svg('<path d="M17 18a5 5 0 0 0-10 0M12 9V2M4.22 10.22l1.42 1.42M1 18h2M21 18h2M18.36 11.64l1.42-1.42M23 22H1M16 5l-4 4-4-4"/>', s),
  pause: (s) => svg('<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>', s),
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
const KIND_ICON = { bus: I.bus, rail: I.train, tram: I.tram, ferry: I.ferry, mixed: I.route, rideshare: I.rideshare, car: I.car, walk: I.walk, carpool: I.users, scooter: I.scooter, ebike: I.bike, bicycle: I.bike };
const SEGMENT_COLOUR = { walk: "var(--seg-walk)", bus: "var(--seg-bus)", rail: "var(--seg-rail)", tram: "var(--seg-tram)", ferry: "var(--seg-ferry)", car: "var(--seg-car)", rideshare: "var(--seg-rideshare)", scooter: "var(--seg-scooter)", ebike: "var(--seg-bike)", bicycle: "var(--seg-bike)" };
const KIND_NAME = { walk: "Walk", bus: "Bus", rail: "Train", tram: "Light rail", ferry: "Ferry", car: "Drive", rideshare: "Uber", scooter: "E-scooter", ebike: "E-bike", bicycle: "Push bike" };
const cssColour = (value) => { const m = /var\((--[\w-]+)\)/.exec(value || ""); return m ? getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() : value; };

// ── Persistent preferences (this browser only) ───────────────────────────────

const store = {
  get(name, fallback) { try { const v = localStorage.getItem(`planb.${name}`); return v === null ? fallback : JSON.parse(v); } catch { return fallback; } },
  set(name, value) { try { localStorage.setItem(`planb.${name}`, JSON.stringify(value)); } catch { /* storage unavailable: keep in memory */ } },
};

const DEFAULT_SETTINGS = {
  theme: "dark", motion: "full",
  modes: { transit: true, drive: true, rideshare: true, scooter: false, ebike: false, bicycle: false },
  transit_modes: { bus: true, train: true, tram: true, ferry: true },
  fuel_l_per_100km: 8, fuel_type: "SP91", fuel_price_mode: "auto", fuel_price: 2.3,
  parking_cost: null, use_flat_fare: true, flat_fare: 0.5,
  budget: 10, walking: 15,
  show: { buffer: true, cost: true, walking: true, transfers: true, elevation: true, co2: true, parking: true, realtime: true },
  watch: true, voice: false,
  factors: { bus: 0.105, rail: 0.035, tram: 0.029, ferry: 0.019 },
  co2_goal_kg: 10,
  // Assumed shared-hire prices (unlock fee and per minute). Lime and Neuron show the real Brisbane price only in their apps; keep in step with HIRE_DEFAULTS in live_routes.py.
  hire: { scooter: { unlock: 1, per_min: 0.45 }, ebike: { unlock: 1, per_min: 0.45 } },
};

// Saved places: Home and Work/Uni always exist (edit the address, cannot be deleted); up to MAX_CUSTOM_PLACES more can be added.
// The storage keys stay "planb.*" so existing saved data keeps working.
const FIXED_PLACES = [["home", "Home"], ["work", "Work/Uni"]];
const DEFAULT_WORK = "The University of Queensland, St Lucia QLD 4072";
const PUSH_BIKE_MAX_KM = 5; // keep in step with PUSH_BIKE_MAX_KM in live_routes.py; used in the legal text only
const MAX_CUSTOM_PLACES = 10;
const PLACE_NAME_MAX = 30;
const PLACE_ADDRESS_MAX = 200;

// Builds settings.saved_places. Older versions stored settings.places and settings.place_ids (Home and Work only); those values are carried over, nothing is dropped.
function migratePlaces(saved) {
  const clean = (p) => ({ id: String(p.id).slice(0, 40), name: String(p.name ?? "").slice(0, PLACE_NAME_MAX), address: String(p.address ?? "").slice(0, PLACE_ADDRESS_MAX), place_id: typeof p.place_id === "string" ? p.place_id : null });
  const list = (Array.isArray(saved.saved_places) ? saved.saved_places : []).filter((p) => p && p.id).map(clean);
  const fixed = FIXED_PLACES.map(([id, name]) => {
    const kept = list.find((p) => p.id === id);
    if (kept) return { ...kept, name };
    const legacy = saved.places?.[id];
    return { id, name, address: typeof legacy === "string" ? legacy.slice(0, PLACE_ADDRESS_MAX) : id === "work" ? DEFAULT_WORK : "", place_id: saved.place_ids?.[id] || null };
  });
  return [...fixed, ...list.filter((p) => !FIXED_PLACES.some(([id]) => id === p.id) && p.name.trim()).slice(0, MAX_CUSTOM_PLACES)];
}

function loadSettings() {
  const saved = store.get("settings", {});
  const merged = { ...DEFAULT_SETTINGS, ...saved };
  for (const key of ["modes", "transit_modes", "show", "factors"]) merged[key] = { ...DEFAULT_SETTINGS[key], ...(saved[key] || {}) };
  merged.hire = Object.fromEntries(Object.entries(DEFAULT_SETTINGS.hire).map(([mode, price]) => [mode, { ...price, ...(saved.hire?.[mode] || {}) }]));
  merged.saved_places = migratePlaces(saved);
  delete merged.places;
  delete merged.place_ids;
  return merged;
}
const savedPlace = (id) => settings.saved_places.find((p) => p.id === id);
const customPlaces = () => settings.saved_places.filter((p) => !FIXED_PLACES.some(([id]) => id === p.id));
const placeGlyph = (p) => (p.id === "home" ? "home" : p.id === "work" ? "pin" : "star");

const DEMO_DEFAULT = { on: false, weather: "live", disrupted: "none", traffic: "live", late_min: 0, start: "preset", simulate: true };
const settings = loadSettings();
const saveSettings = () => store.set("settings", settings);

// ── App state ────────────────────────────────────────────────────────────────

const INITIAL_SCREEN = ({ "/terms": "terms", "/privacy": "privacy", "/about": "sources" })[window.location.pathname] || "home";
const state = {
  screen: INITIAL_SCREEN, stack: [INITIAL_SCREEN],
  status: null, alerts: null, alertsError: null, weather: null, weatherError: null, weatherPlace: "Brisbane", installEvent: null,
  demo: { ...DEMO_DEFAULT, ...store.get("demo", {}) }, costOpen: false, errorKind: "error",
  nav: null,
  sync: { loading: false, feedback: null, at: null },
  purpose: "regular", form: null, plan: null, loading: false, error: null,
  sort: "best", chosenId: null,
  watch: { lines: [], seen: new Set(), alert: null },
  panic: { phase: "ask", coords: null, locating: false, dest: "", by: "", error: null },
  rides: { mine: [], loading: false, error: null, joining: null },
  dashTable: false, fuelPreview: null, fuelLoading: false, placeDraft: null,
};

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const googleMapsAttribution = () => `<span class="gmp-attribution" translate="no">Google Maps</span>`;
const money = (v) => (v === null || v === undefined ? "Unknown" : `$${Number(v).toFixed(2).replace(/\.00$/, "")}`);
const kg = (v) => (v === 0 ? "0 kg" : Math.abs(v) < 1 ? `${Math.round(v * 1000)} g` : `${v.toFixed(1)} kg`);
// Header and goal figures read better in kilograms throughout ("0.4 kg", "0 kg").
const kgShort = (v) => (v > 0 ? `${v < 0.1 ? "<0.1" : +v.toFixed(1)} kg` : "0 kg");
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
// Trip fields can hold coordinates behind a readable label ("Current location", a dropped pin); the server receives "lat,lng".
const CURRENT_PLACE = "Current location";
const coordText = (c) => `${Number(c[0]).toFixed(6)},${Number(c[1]).toFixed(6)}`;
const pinLabel = (c) => `Dropped pin (${Number(c[0]).toFixed(5)}, ${Number(c[1]).toFixed(5)})`;

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

// Every page with a Back button also gets the Home button, so it slides with the page instead of floating above it.
// The Back button always says "Back" (naming the previous screen read oddly next to Home). Settings is reached from the home screen's side menu.
function navbar(back, right = "") {
  const backBtn = back ? `<button class="nav-back" data-action="back" aria-label="Back">${I.chevronLeft(20)}<span>Back</span></button>` : "";
  return `<header class="navbar"><div class="side">${backBtn}</div><div class="side end">${back ? homeButton() : ""}${right}</div></header>`;
}
const homeButton = () => `<button class="home-btn" data-action="go-home" aria-label="Go straight to the home screen" title="Home">${I.home(18)}<span>Home</span></button>`;
// Sheets and Settings sit over the current screen, so they show the Home button only away from the home screen.
const homeIfAway = () => (state.screen !== "home" ? homeButton() : "");
const sheetClose = () => `${homeIfAway()}<button class="icon-btn" data-action="close-sheet" aria-label="Close">${I.x(18)}</button>`;
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
function stepper(field, value, display, min, max, label = field) {
  return `<div class="stepper" role="group" aria-label="${esc(label)}">
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

// ── Clear (x) buttons on text inputs ─────────────────────────────────────────
// One helper covers every text, search and address input. enhanceClear(root) wraps each such input once and adds the button right after the HTML is
// inserted (before focus is restored, so nothing loses focus). CSS shows the button only while the input has text (:placeholder-shown), so typing,
// autocomplete picks and re-renders need no extra code. The click is handled by the delegated "clear-input" action.

const CLEARABLE = 'input[type="text"], input[type="search"], input:not([type])';
function enhanceClear(root) {
  root.querySelectorAll(CLEARABLE).forEach((input) => {
    if (input.dataset.clr || input.readOnly || input.disabled) return;
    input.dataset.clr = "1";
    input.classList.add("clr-input");
    if (!input.placeholder) input.placeholder = " ";
    const name = (input.getAttribute("aria-label") || input.labels?.[0]?.textContent || input.placeholder || "text").trim() || "text";
    const wrap = document.createElement("span");
    wrap.className = "clr-wrap";
    input.replaceWith(wrap);
    wrap.append(input);
    wrap.insertAdjacentHTML("beforeend", `<button type="button" class="clr" data-action="clear-input" aria-label="Clear ${esc(name)}"><span class="clr-dot">${I.x(12)}</span></button>`);
  });
}
// Empties the field, tells the app (the shared input handler resets stored place IDs and state), keeps focus in the field and closes the suggestions.
function clearInput(button) {
  const input = button.closest(".clr-wrap")?.querySelector("input");
  if (!input) return;
  input.focus({ preventScroll: true });
  input.value = "";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  autocomplete.close();
}
document.addEventListener("mousedown", (event) => { if (event.target.closest?.(".clr")) event.preventDefault(); });

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
  return `<div class="wx-head"><p class="eyebrow">${I.cloud(14)}Weather · ${esc(state.weatherPlace)}</p><span class="wx-more">${w.simulated ? `<span class="badge info">Simulated</span>` : ""}<span class="wx-open">Details${I.chevronRight(14)}</span></span></div>
    <div class="wx-main"><div class="wx-temp">${Math.round(c.temp_c)}<sup>°</sup></div>
      <div class="wx-now"><strong>${esc(c.label)}</strong><span>Feels like ${Math.round(c.apparent_c)}° · Wind ${Math.round(c.wind_kmh)} km/h${c.gust_kmh > c.wind_kmh + 10 ? `, gusts ${Math.round(c.gust_kmh)}` : ""}${c.precip_mm > 0 ? ` · ${c.precip_mm} mm rain` : ""}</span></div>
      <span class="wx-icon" style="--tone:${WX_TONE[c.icon] || "var(--accent)"}">${wxIcon(c.icon, 28)}</span></div>
    ${warn}${hours ? `<div class="wx-hours" aria-label="Next hours">${hours}</div>` : ""}
    <p class="fine wx-foot">${esc(w.source)}${w.simulated ? "" : ` · updated ${timeOf(w.fetched_at)}`}${state.offline || !offline.online ? " · saved copy, not live" : ""}</p>`;
}
// The whole widget opens the weather page (week ahead, wind, rain radar).
const weatherCard = () => `<button class="wx wx-btn" data-wx data-action="go" data-screen="weather" aria-describedby="wx-hint">${weatherInner()}</button><span class="visually-hidden" id="wx-hint">Opens the weather page with the week ahead, wind and the rain radar.</span>`;
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

// The Reroute mark: the direct route is broken, and the route curves around it.
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

function homeHero(alertCount) {
  const live = state.alertsError ? `<span class="banner-chip">${I.signal(14)}Live alerts unavailable</span>`
    : !state.alerts ? `<span class="skeleton skel-chip" role="status" aria-label="Checking Translink alerts"></span>`
    : state.offline ? `<span class="banner-chip">${I.signal(14)}Offline · scheduled times only</span>`
    : `<button class="banner-chip" data-action="open-alerts"><span class="live-dot"></span>Translink live · ${plural(alertCount, "alert")}</button>`;
  return `
    <section class="hero" aria-labelledby="hero-title">
      ${heroArt()}
      <div class="hero-copy">
        <p class="eyebrow">${greeting()}</p>
        <h1 id="hero-title">Go greener. <em>Reroute</em> when plans break.</h1>
      </div>
      <div class="hero-chips">${live}</div>
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

// Header Impact button: this month's CO₂ avoided, straight to the dashboard.
function impactButton(impact) {
  return `<button class="impact-btn" data-action="go" data-screen="dashboard" aria-label="Impact Dashboard: ${kgShort(impact.co2)} CO₂ avoided this month">${I.leaf(18)}<span>${kgShort(impact.co2)}</span></button>`;
}

// Header profile button: a blank default picture. Accounts are not built yet, so both items only say so (a template for later work).
function profileButton() {
  return `<div class="profile-wrap"><button class="avatar-btn" data-action="toggle-profile" aria-label="Profile" aria-haspopup="menu" aria-expanded="false" aria-controls="profile-menu">
      <svg class="avatar" width="36" height="36" viewBox="0 0 36 36" aria-hidden="true"><defs><clipPath id="avatar-clip"><circle cx="18" cy="18" r="18"/></clipPath></defs>
        <g clip-path="url(#avatar-clip)"><rect width="36" height="36" class="avatar-bg"/><circle cx="18" cy="14" r="6.5" class="avatar-fg"/><circle cx="18" cy="37" r="13.5" class="avatar-fg"/></g></svg></button>
    <div class="profile-menu" id="profile-menu" role="menu" aria-label="Profile" hidden>
      <button role="menuitem" data-action="account-feature">${I.user(18)}Account details</button>
      <button role="menuitem" data-action="account-feature">${I.edit(18)}Edit profile</button>
    </div></div>`;
}
function toggleProfileMenu(force) {
  const wrap = currentPage?.querySelector(".profile-wrap");
  if (!wrap) return;
  const menu = wrap.querySelector(".profile-menu"), open = force ?? menu.hidden;
  if (open) { menu.hidden = false; requestAnimationFrame(() => menu.classList.add("open")); }
  else { menu.classList.remove("open"); setTimeout(() => { if (!menu.classList.contains("open")) menu.hidden = true; }, 180); }
  wrap.querySelector(".avatar-btn").setAttribute("aria-expanded", String(open));
  if (open) menu.querySelector("button")?.focus({ preventScroll: true });
}
const profileOpen = () => !!currentPage?.querySelector(".profile-menu.open");

// Side menu: opened by tapping the logo on the home screen. It slides in from the left like Settings slides in from the right,
// and closes with the backdrop, Escape, the close button or a swipe to the left.
let menuEl = null;
function menuContent() {
  const impact = impactTotals(thisMonthTrips());
  const item = (attrs, icon, tone, label, hint = "", value = "") => `<button class="row" ${attrs}><span class="row-icon" style="--tone:${tone}">${icon}</span><span class="row-label">${label}${hint ? `<small>${hint}</small>` : ""}</span>${value}<span class="chev">${I.chevronRight()}</span></button>`;
  const go = (screen) => `data-action="menu-go" data-screen="${screen}"`, open = (what) => `data-action="menu-open" data-open="${what}"`;
  return `
    <div class="menu-head"><span class="brand">${logo(36, "lg-menu")}<span class="wordmark"><span>Re</span>route</span></span><button class="icon-btn" data-action="close-menu" aria-label="Close menu">${I.x(18)}</button></div>
    <div class="menu-scroll">
      <p class="section-header">Go to</p>
      <div class="group"><div class="group-card">
        ${item(go("dashboard"), I.leaf(18), "var(--success)", "Impact Dashboard", `${kgShort(impact.co2)} CO₂ avoided this month`)}
        ${item(go("weather"), I.cloud(18), "var(--accent)", "Weather", "The week ahead, wind and the rain radar")}
        ${item(open("alerts"), I.signal(18), "var(--error)", "Translink alerts", "Live disruptions, searchable by line")}
        ${item(go("rides"), I.users(18), "var(--teal)", "Shared rides", "Share a car or split an Uber")}
      </div></div>
      <p class="section-header">App</p>
      <div class="group"><div class="group-card">
        ${item(open("settings"), I.gear(18), "var(--text-muted)", "Settings", "Ways to travel, your car, saved places and more")}
        ${item(open("demo"), I.flask(18), "var(--violet)", "Demo mode", "Simulate weather, disruptions and traffic", valueSpan(demoOn() ? "On" : "Off"))}
        ${item(open("share"), I.qr(18), "var(--teal)", "Share this app", "QR code and link")}
        ${canInstall() ? item(open("install"), I.download(18), "var(--accent)", "Install Reroute", "Add it to your home screen") : ""}
      </div></div>
      <p class="section-header">Information</p>
      <div class="group"><div class="group-card">
        ${item(go("sources"), I.info(18), "var(--accent)", "About / Data Sources")}
        ${item(go("terms"), I.file(18), "var(--text-muted)", "Terms of Use")}
        ${item(go("privacy"), I.shield(18), "var(--text-muted)", "Privacy Policy")}
      </div></div>
      <p class="fine">Reroute is a student prototype. Estimates only, always check before you travel.</p>
    </div>`;
}
function openMenu() {
  if (menuEl) return;
  toggleProfileMenu(false);
  menuEl = document.createElement("div");
  menuEl.className = "menu-backdrop";
  menuEl.dataset.action = "menu-backdrop";
  menuEl.innerHTML = `<div class="menu-panel" role="dialog" aria-modal="true" aria-label="Reroute menu">${menuContent()}</div>`;
  viewport.appendChild(menuEl);
  dragToClose(menuEl, ".menu-panel", ".menu-panel", "x", () => closeMenu());
  currentPage?.querySelector('[data-action="open-menu"]')?.setAttribute("aria-expanded", "true");
  requestAnimationFrame(() => requestAnimationFrame(() => menuEl?.classList.add("open")));
  menuEl.querySelector('[data-action="close-menu"]').focus({ preventScroll: true });
}
// Closes the menu; `then` runs once it has mostly slid away, so Settings or a sheet does not open on top of it.
function closeMenu(then, restoreFocus = !then) {
  if (!menuEl) return then?.();
  const el = menuEl;
  menuEl = null;
  el.classList.remove("open");
  setTimeout(() => el.remove(), 360);
  const brand = currentPage?.querySelector('[data-action="open-menu"]');
  brand?.setAttribute("aria-expanded", "false");
  if (restoreFocus) brand?.focus({ preventScroll: true });
  if (then) setTimeout(then, 240);
}

// A small centred message box (used for template features that are not built yet).
let dialogEl = null;
function showDialog(title, text, returnTo = document.activeElement) {
  closeDialog();
  const before = returnTo;
  dialogEl = document.createElement("div");
  dialogEl.className = "dialog-backdrop";
  dialogEl.dataset.action = "dialog-backdrop";
  dialogEl.innerHTML = `<div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby="dialog-text"><span class="dialog-icon">${I.info(22)}</span><h3 id="dialog-title">${esc(title)}</h3><p id="dialog-text">${esc(text)}</p><button class="btn btn-primary" data-action="close-dialog">OK</button></div>`;
  dialogEl._before = before;
  viewport.appendChild(dialogEl);
  requestAnimationFrame(() => requestAnimationFrame(() => dialogEl?.classList.add("open")));
  dialogEl.querySelector("button").focus({ preventScroll: true });
}
function closeDialog() {
  if (!dialogEl) return;
  const el = dialogEl;
  dialogEl = null;
  el.classList.remove("open");
  setTimeout(() => el.remove(), 220);
  el._before?.focus?.({ preventScroll: true });
}

function homeScreen() {
  const live = state.status?.live_available;
  const alerts = (state.alerts?.alerts || []).filter((a) => a.disruptive);
  const impact = impactTotals(thisMonthTrips());
  const myRides = state.rides.mine.length;
  return `
    <div class="scroll tight">
      <div class="home-top">
        <button class="brand brand-btn" data-action="open-menu" aria-label="Open the Reroute menu" aria-haspopup="dialog" aria-expanded="false">${logo(36, "lg-home")}<span class="wordmark"><span>Re</span>route</span><span class="brand-chev">${I.chevronDown(14)}</span></button>
        ${impactButton(impact)}
        <div class="home-actions">${profileButton()}</div>
      </div>
      ${homeHero(alerts.length)}
      <button class="interactive-element primary trip-btn" data-action="start" data-purpose="regular">
        <span class="trip-icon">${I.route(24)}</span>
        <span class="trip-text"><strong>Plan a trip</strong><small>Everyday routes, public transport first</small></span>
        <span class="chev">${I.arrowRight(18)}</span>
      </button>
      <button class="panic-btn" data-action="go" data-screen="panic" aria-label="Journey disrupted? Get the best working way there now. On time first, no decisions.">
        <span class="panic-icon">${I.bolt(24)}</span>
        <span><strong>Journey disrupted?</strong><small>Get the best working way there now — on time first, no decisions.</small></span>
      </button>
      <p class="section-header">Right now</p>
      ${weatherCard()}
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
        ${canInstall() ? `<button class="row" data-action="install"><span class="row-icon" style="--tone:var(--accent)">${I.download(18)}</span><span class="row-label">Install Reroute<small>Add it to your home screen for background alerts</small></span><span class="chev">${I.chevronRight()}</span></button>` : ""}
        <button class="row" data-action="open-share"><span class="row-icon" style="--tone:var(--teal)">${I.qr(18)}</span><span class="row-label">Share this app<small>QR code and link for friends and testers</small></span><span class="chev">${I.chevronRight()}</span></button>
      </div></div>
      ${live === false ? notice("Live search is off: no Google Maps API key was found on the server. See the README.", "error") : ""}
      <p class="fine" style="margin-top:24px"><a href="demo.html">Fictional interview scenario</a> · Estimates only, always check before you travel</p>
      <nav class="home-legal-links" aria-label="App information">
        <button class="text-link" data-action="go" data-screen="terms">Terms of Use</button>
        <button class="text-link" data-action="go" data-screen="privacy">Privacy Policy</button>
        <button class="text-link" data-action="go" data-screen="sources">About / Data Sources</button>
      </nav>
    </div>`;
}

function termsScreen() {
  return `${navbar(true)}<div class="scroll legal-content">
    <p class="eyebrow">Reroute</p><h1 class="large-title">Terms of Use</h1>
    <p class="subtitle">A student prototype for exploring journey options. It is not an official transport service or a substitute for your own judgement.</p>
    <h2>Estimates, not guarantees</h2>
    <p>Route times, fares, parking availability, fuel costs, weather, live vehicle positions and disruption information can be incomplete, delayed or wrong. E-scooter and e-bike times use a Google Maps cycling route with an assumed average speed (15 and 20 km/h), not a measured one, and their hire cost is an estimate from assumed prices (an unlock fee plus a price per minute, editable in Settings), not a quote from Lime or Neuron. Push-bike times use Google's own cycling estimate, and the push bike is only offered for trips up to ${PUSH_BIKE_MAX_KM} km. The app does not check hire availability, real hire prices, local access rules or safe paths for any of them. The rain radar shows the last two hours of radar and is not a forecast. The CO₂ shown for them counts tailpipe emissions only, so charging and manufacturing are not counted. Check current signs, services, fares, prices and conditions before leaving.</p>
    <p>Offline maps use an area you downloaded earlier. Offline routes and times are estimates from that saved OpenStreetMap map and Translink's published timetables: they do not include live delays, cancellations, disruptions, road closures or traffic, and the timetables only cover the days you downloaded. Check signs, services and conditions when you can.</p>
    <p>Do not use the app while driving, riding or crossing a road. In-app directions and location readings may be inaccurate. Follow road rules and use your own judgement.</p>
    <h2>Third-party services</h2>
    <p>Route search and maps use Google Maps Platform, and route results are shown on a Google map. Use is also subject to the <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer">Google Terms of Service</a>, the <a href="https://www.google.com/intl/en-US_US/help/terms_maps/" target="_blank" rel="noopener noreferrer">Google Maps Additional Terms</a> and Google's <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>. Public-transport alerts and schedules come from Translink; traffic events come from QLDTraffic; weather and fallback elevation come from Open-Meteo; the rain radar comes from RainViewer. The Lime and Neuron buttons open those companies' app store listings or websites, which have their own terms. Their services may change or be unavailable.</p>
    <h2>Shared rides and notifications</h2>
    <p>Ride-board posts are visible to people using the same Reroute server. Use a nickname and broad areas, not contact details or sensitive information. Posts expire automatically. Background alerts require a browser push subscription and may be delivered by your browser's push provider.</p>
    <h2>Prototype availability</h2>
    <p>This prototype is provided as-is for evaluation. No account, transport booking, payment, scooter hire or emergency response is provided. The profile button is a placeholder: it has no account behind it. The team may change or stop the prototype at any time.</p>
    <p class="fine">Review before public release: confirm the team's hosting terms, support contact and legal requirements. This page is plain-language product information, not legal advice.</p>
    <button class="btn btn-secondary" data-action="go" data-screen="privacy">Read the Privacy Policy</button>
  </div>`;
}

function privacyScreen() {
  return `${navbar(true)}<div class="scroll legal-content">
    <p class="eyebrow">Your information</p><h1 class="large-title">Privacy Policy</h1>
    <p class="subtitle">This prototype has no accounts or sign-in (the profile button is a placeholder that stores nothing). This page describes what the current code stores and sends; it is not a promise about third-party services or the hosting provider.</p>
    <h2>On your device</h2>
    <p>Reroute saves settings (including travel modes, budget and walking limits, fuel and parking estimates, theme and accessibility choices), saved places and their Google place IDs, recent places, the last entered trip places, demo preferences, trip and CO₂ history, ride-board membership tokens, and disruption-watch details in this browser's local storage. This information is not synced to an account. Anyone with access to this browser profile may be able to see it. You can clear browser storage to remove it; clearing it may also stop local watch and ride-board controls from working. The app's service worker also keeps copies on this device of the app files and of recent read-only server answers (live alerts, weather, fuel prices, the address suggestions you asked for, app status and map settings) so the app can open offline.</p>
    <p>If you download an area for offline use (Settings → Offline info), the map, place names, road and path network and Translink timetables for that area are stored in this browser's IndexedDB storage, together with the names, addresses and coordinates of your saved places inside the area. The download asks the Reroute server only for the area's corners and the number of days; for saved places that have a Google place ID, the app asks the server for their position (Google Place Details). Delete offline data in Settings, or clear browser storage, to remove it. While you have no internet, Reroute notices that its live data could not be reached and offers offline maps. In offline mode, routes are worked out on this device from the downloaded data; the app still checks for live alerts every minute (without trip details) so it can tell you when you are back online.</p>
    <p>The app asks for device location when a feature needs it: opening Plan a trip (the From field starts at your current location), current-location routing, Journey disrupted?, the map picker's locate button, live directions and a nearby weather forecast (the weather widget and weather page only use it if you have already allowed it). The browser controls that permission; if you block it, type your start or choose it on the map. Your position is not stored by Reroute. When it is used it is sent to the Reroute server as a starting point, to bias address suggestions or for weather, and from there to Google or Open-Meteo as described below. Live-directions positions stay on the device unless you tap Re-plan from here, which sends your position as a new starting point. A pin you drop on the map is sent the same way, as coordinates, only when you search.</p>
    <h2>Sent to Reroute</h2>
    <p>For route searches, the server receives the entered origin, destination, optional place IDs, departure time and deadline, selected modes and limits, your vehicle and fare settings, avoided lines and the ride-board tokens needed for matching. It processes the route request and does not save a route-search history. The server keeps visitor IP addresses in memory for hourly abuse limits and counts the day's searches (a number only), and it keeps recent Google and weather answers in memory for a few minutes.</p>
    <p>Unless the operator switches on quiet logging (PLANB_QUIET=1), the server's console log records each request with its time, IP address and web address. For read requests that address includes what you typed into address suggestions and the coordinates used for weather and fuel lookups. The app does not log request bodies such as route searches. A hosting provider may separately keep connection or error logs.</p>
    <p>If you post or join a shared ride, the server stores a nickname, broad start and destination labels, coordinates rounded to about 100 metres, departure time, meeting point, optional note, seat and cost details, and random membership tokens. Posts are visible to users of the same server and are removed about 30 minutes after their departure time; people who join a post add a nickname. If you enable background disruption alerts, the server stores your browser push endpoint and encryption keys with the watched trip: its start and destination text, the destination place ID, the deadline, line names, route IDs, a label and an expiry (at most 24 hours). These records are stored in the server's data directory; the server operator can access them. Unsubscribe in the app to remove a push subscription.</p>
    <h2>Third-party services</h2>
    <ul>
      <li><b>Google Maps Platform:</b> the server sends route endpoints, the departure time and the travel mode (public transport, driving, cycling) to the Routes API; toll estimates are only requested when your own car is switched on. It sends partial typed addresses, a random autocomplete session token and an approximate location bias to Places, the Google place ID of a place you tap on the map (to look up its name, address and category icon), coordinates near the trip endpoints for fuel and car-park searches, and sampled walking coordinates to Google Elevation when enabled.</li>
      <li><b>Google Maps JavaScript (the map):</b> your browser loads the map script and map tiles directly from Google using a browser map key that the Reroute server hands to every visitor. Google receives your IP address, browser details, this site's address and the area of the map you view, and may use its own cookies or similar technologies. When you tap a place in Choose on map, your browser also loads that place's category icon from Google (maps.gstatic.com). Opening a Google Maps or Uber link sends the relevant trip places or coordinates to that service.</li>
      <li><b>RainViewer (rain radar):</b> on the weather page your browser downloads radar images directly from RainViewer (api.rainviewer.com and tilecache.rainviewer.com). RainViewer receives your IP address, browser details and which map area you view. Reroute sends it nothing else.</li>
      <li><b>Lime and Neuron:</b> the hire buttons open the Apple App Store, Google Play or the operator's website. Reroute sends no trip details to Lime or Neuron; those sites and apps have their own privacy policies.</li>
      <li><b>Translink:</b> the server downloads public schedule and live alert, delay and vehicle feeds. It does not send your trip details to Translink.</li>
      <li><b>OpenStreetMap (Overpass API):</b> when you download an offline area, the Reroute server sends the area's corners to the Overpass API to fetch its map data. No trip details or location are sent.</li>
      <li><b>QLDTraffic:</b> the server requests public road-event data without sending your trip details.</li>
      <li><b>Open-Meteo:</b> the server sends the location used for weather (your device location if allowed, the trip start or Brisbane) rounded to three decimal places, or sampled walking-route coordinates for fallback elevation.</li>
      <li><b>Browser push provider:</b> when you opt in, an encrypted disruption notification is sent to the browser's subscription endpoint, which may be operated by Google, Mozilla, Apple or another provider.</li>
      <li><b>Google Fonts:</b> your browser requests the Inter typeface from Google, which receives your IP address and browser details. The app itself loads no third-party analytics.</li>
    </ul>
    <h2>Cookies, analytics and logs</h2>
    <p>The app code does not create analytics profiles or set its own tracking cookies. It uses browser local storage and a service worker for saved preferences, offline app files and push notifications. Google Maps and other third parties may use their own technologies and receive technical data under their own privacy terms. Reroute's server uses IP addresses transiently for rate limiting; hosting and infrastructure logs depend on where the app is run.</p>
    <h2>Questions and review</h2>
    <p>This is a student prototype with no in-app account or privacy request workflow. Before public release, the team must add a monitored contact, confirm hosting-provider retention, review third-party terms and verify the disclosures against the actual deployment.</p>
    <button class="btn btn-secondary" data-action="go" data-screen="sources">About and data sources</button>
  </div>`;
}

function sourcesScreen() {
  return `${navbar(true)}<div class="scroll legal-content">
    <p class="eyebrow">About this prototype</p><h1 class="large-title">About / Data Sources</h1>
    <p class="subtitle">Reroute is a student prototype for comparing journey options and responding to disruptions. It is not an official Translink or Queensland Government service.</p>
    <div class="group"><div class="group-card">
      <div class="row"><span class="row-label"><b>Google Maps Platform</b><small>Routes (public transport, driving and cycling), places/autocomplete, the name, address and category icon and colour of a place you tap when choosing on the map (Place Details), fuel and car-park listings, optional elevation, and the interactive maps (Maps JavaScript API). Google route content is shown on a Google map so Google's own logo and attribution stay visible.</small><a href="https://developers.google.com/maps/documentation/routes/policies" target="_blank" rel="noopener noreferrer">Routes API policies</a> · <a href="https://developers.google.com/maps/documentation/places/web-service/policies" target="_blank" rel="noopener noreferrer">Places policies</a></span></div>
      <div class="row"><span class="row-label"><b>Translink</b><small>South East Queensland static GTFS schedules and GTFS-Realtime alerts, trip updates and vehicle positions, used to identify route stops and show live disruption/vehicle information. Data is licensed under Creative Commons Attribution 4.0 International (CC BY 4.0).</small><a href="https://translink.com.au/about-translink/open-data" target="_blank" rel="noopener noreferrer">Translink open data and feed links</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a></span></div>
      <div class="row"><span class="row-label"><b>QLDTraffic / Queensland Government</b><small>Public road events are used to flag incidents and estimate additional driving delay. Contains information from the QLDTraffic GeoJSON API dataset, Transport and Main Roads, Queensland Government, licensed under Creative Commons Attribution 4.0 International (CC BY 4.0). The data is provided “as is”. The app requests events from the server without sending trip details.</small><a href="https://www.data.qld.gov.au/dataset/131940-traffic-and-travel-information-geojson-api" target="_blank" rel="noopener noreferrer">QLDTraffic GeoJSON API dataset</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a> · <a href="https://qldtraffic.qld.gov.au/more/Disclaimer/index.html" target="_blank" rel="noopener noreferrer">QLDTraffic disclaimer</a></span></div>
      <div class="row"><span class="row-label"><b>Open-Meteo</b><small>Weather forecasts for the home widget, the weather page (the next 24 hours and 7 days), the next hour's predicted rain shown after the radar (a model forecast in 15-minute steps that Open-Meteo interpolates from hourly data for Australia, not radar) and walking warnings; elevation is a fallback when Google Elevation is unavailable. Weather and elevation data are attributed to Open-Meteo and are subject to its applicable terms and CC BY 4.0 attribution requirements.</small><a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a> · <a href="https://open-meteo.com/en/licence" target="_blank" rel="noopener noreferrer">Licence and attribution</a></span></div>
      <div class="row"><span class="row-label"><b>RainViewer</b><small>The rain radar on the weather page: composite radar for the last two hours, one image every 10 minutes, loaded by your browser. RainViewer no longer offers future radar frames on its free API, so the next hour after the radar is Open-Meteo's forecast instead. RainViewer's free API is for personal and educational use, serves map zoom levels up to 7 (closer zooms enlarge those images) and does not guarantee availability.</small><a href="https://www.rainviewer.com/" target="_blank" rel="noopener noreferrer">RainViewer</a> · <a href="https://www.rainviewer.com/api.html" target="_blank" rel="noopener noreferrer">API terms</a></span></div>
      <div class="row"><span class="row-label"><b>Lime and Neuron (shared e-scooters and e-bikes)</b><small>Brisbane City Council's shared e-mobility scheme is run by Lime and Neuron. Neither publishes a vehicle or price feed for Brisbane, so Reroute does not show vehicle locations. E-scooter and e-bike hire costs are estimates from assumed prices you can change in Settings, on a Google cycling route at assumed speeds; push-bike time is Google's cycling estimate and the push bike is only offered up to ${PUSH_BIKE_MAX_KM} km. The buttons open each operator's app store listing or website. Check availability, the real price and safe access in their app. The CO₂ shown counts tailpipe emissions only. Reroute is not affiliated with Lime or Neuron.</small><a href="https://www.brisbane.qld.gov.au/transport-and-parking/public-transport/e-mobility" target="_blank" rel="noopener noreferrer">Brisbane City Council e-mobility</a></span></div>
      <div class="row"><span class="row-label"><b>Uber</b><small>The app can open Uber with pickup and drop-off details when you choose that option. It does not query Uber for a fare or availability before opening the link.</small><a href="https://m.uber.com/ul/" target="_blank" rel="noopener noreferrer">Uber universal link</a></span></div>
      <div class="row"><span class="row-label"><b>OpenStreetMap</b><small>Offline maps: the base map, suburb and major place names and the road and path network used for offline walking, cycling and driving routes in a downloaded area, fetched by the server through the Overpass API. © OpenStreetMap contributors, available under the Open Database Licence (ODbL). Translink timetables for the offline area come from the same static GTFS feed credited above.</small><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a> · <a href="https://opendatacommons.org/licenses/odbl/" target="_blank" rel="noopener noreferrer">ODbL</a></span></div>
      <div class="row"><span class="row-label"><b>Google Fonts</b><small>Inter typeface used in the interface.</small><a href="https://fonts.google.com/specimen/Inter" target="_blank" rel="noopener noreferrer">Inter</a></span></div>
      <div class="row"><span class="row-label"><b>Web Push providers</b><small>Browser vendors deliver opt-in background notifications. No separate analytics provider is used by the app.</small></span></div>
    </div></div>
    <p class="fine">Google Places does not publish parking prices in the fields this app requests. Parking price data therefore cannot be estimated from the Google response; the closest alternative is an optional typical-cost estimate you enter in Settings, shown separately from listed car-park availability. The QLDTraffic dataset is licensed CC BY 4.0 and supplied “as is”; check the linked dataset and disclaimer before public release.</p>
    <button class="btn btn-secondary" data-action="go" data-screen="terms">Read the Terms of Use</button>
  </div>`;
}

function placeChips(field) {
  const chips = [];
  if (field === "origin" && !(state.form.origin === CURRENT_PLACE && (state.form.originCoords || state.form.originLocating))) chips.push(`<button class="chip" data-action="use-location">${I.locate(14)}Current location</button>`);
  chips.push(`<button class="chip" data-action="pick-map" data-path="form.${field}">${I.map(14)}Choose on map</button>`);
  settings.saved_places.filter((p) => p.address).forEach((p) => chips.push(`<button class="chip" data-action="fill-place" data-field="${field}" data-place="${esc(p.id)}">${I[placeGlyph(p)](14)}${esc(p.name)}</button>`));
  return `<div class="place-chips">${chips.join("")}</div>`;
}
// The From row while Plan a trip opens: "Current location" with a shimmer until the position arrives, or a note when it is unavailable.
const originRowClass = () => { const f = state.form; return f.origin === CURRENT_PLACE && f.originLocating ? " locating" : f.origin === CURRENT_PLACE && f.originCoords ? " is-current" : ""; };
const originNote = () => (state.form.originNote ? `<p class="field-note" data-origin-note>${esc(state.form.originNote)}</p>` : `<p class="field-note" data-origin-note hidden></p>`);

function journeyScreen() {
  const f = state.form;
  const modes = [settings.modes.transit && "Public transport", settings.modes.drive && "My car", settings.modes.rideshare && "Uber", settings.modes.scooter && "E-scooter", settings.modes.ebike && "E-bike", settings.modes.bicycle && "Push bike"].filter(Boolean).join(", ") || "None";
  return `
    ${navbar(true)}
    <div class="scroll">
      <p class="eyebrow">Plan a trip</p>
      <h2 class="large-title">Where are you going?</h2>
      <p class="subtitle">Public transport options come first, with the true cost of driving and the CO₂ you avoid alongside.</p>
      <p class="section-header">Journey</p>
      <div class="group"><div class="group-card">
        <div class="row field-row${originRowClass()}" data-origin-row><span class="row-icon" style="--tone:var(--success)">${f.origin === CURRENT_PLACE ? I.locate(18) : I.walk(18)}</span><div class="place-input"><label for="f-origin">From</label><input id="f-origin" type="text" data-field="origin" ${acAttrs("form.origin")} value="${esc(f.origin)}" placeholder="Address, stop or place" autocomplete="off"></div></div>
        ${originNote()}
        ${placeChips("origin")}
        <div class="row field-row"><span class="row-icon" style="--tone:var(--error)">${I.pin(18)}</span><div class="place-input"><label for="f-destination">To</label><input id="f-destination" type="text" data-field="destination" ${acAttrs("form.destination")} value="${esc(f.destination)}" placeholder="Address or place" autocomplete="off"></div></div>
        ${placeChips("destination")}
      </div></div>
      <p class="section-header">When</p>
      <div class="group"><div class="group-card">
        <div class="row"><span class="row-icon" style="--tone:var(--accent)">${I.clock(18)}</span><span class="row-label">Leave now</span>${toggle("form.leave_now", f.leave_now, "Leave now")}</div>
        ${f.leave_now ? "" : row(I.clock(18), "var(--violet)", "Leave at", `<input type="datetime-local" data-field="departure" value="${esc(f.departure)}" aria-label="Departure time">`)}
        ${row(I.hourglass(18), "var(--warning)", "Arrive by <small>Optional</small>", `<input type="datetime-local" data-field="deadline" value="${esc(f.deadline)}" aria-label="Arrival deadline">`)}
      </div>
      <p class="group-footer">Brisbane time. Leave the deadline empty to just see the options.</p></div>
      <p class="section-header">Limits</p>
      <div class="group"><div class="group-card">
        ${row(I.dollar(18), "var(--success)", "Max cost", stepper("budget", f.budget, `$${f.budget}`, 0, 200))}
        ${row(I.walk(18), "var(--accent)", "Max walking", stepper("walking", f.walking, `${f.walking} min`, 0, 60))}
      </div></div>
      <div class="group"><div class="group-card">
        <button class="row" data-action="open-settings"><span class="row-icon" style="--tone:var(--violet)">${I.route(18)}</span><span class="row-label">Ways to travel<small>${esc(modes)}</small></span><span class="chev">${I.chevronRight()}</span></button>
      </div></div>
      ${state.error ? notice(esc(state.error), state.errorKind) : ""}
    </div>
    <footer class="sticky">
      <button class="btn btn-primary${state.loading ? " is-loading" : ""}" data-action="search" ${state.loading || (!state.offline && !state.status?.live_available) ? "disabled" : ""} ${state.loading ? 'aria-busy="true"' : ""}>
        ${state.loading ? skelBar("Checking routes and live services", 120) : "Show routes"}
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

// ── CO₂ on results ───────────────────────────────────────────────────────────
// Every figure comes from the option's own estimate (co2_kg), the same journey driven alone (the plan's baseline) and the factors in Settings.

const co2Known = (o) => o.co2_kg !== undefined && o.co2_kg !== null;
// The option(s) with the lowest CO₂. Needs two or more estimates that are not all equal, so a badge always means something.
function lowestCo2(options) {
  const pool = options.filter(co2Known);
  if (!pool.length) return null;
  const min = Math.min(...pool.map((o) => o.co2_kg));
  const ids = new Set(pool.filter((o) => o.co2_kg <= min + 0.005).map((o) => o.id));
  const best = pool.filter((o) => ids.has(o.id)).sort((a, b) => new Date(a.arrival) - new Date(b.arrival))[0];
  return { ids, best, badge: pool.length > 1 && ids.size < pool.length };
}

function co2Line(o) {
  if (!co2Known(o)) return null;
  const base = state.plan?.baseline;
  const saved = o.vs_drive?.co2_saved_kg;
  if (!base || saved === undefined || saved === null) return { tone: "", main: o.co2_note ? "0 kg tailpipe CO₂" : `${kg(o.co2_kg)} CO₂`, sub: o.co2_note ? `${o.co2_note}.` : o.mode === "drive" ? "Driving alone: the baseline the other options are compared with" : "" };
  // Scooter and bike options have no tailpipe emissions; the note says what is not counted, so the figure is not read as a full life-cycle number.
  const sub = o.co2_note ? `${o.co2_note}. Driving alone: ${kg(base.co2_kg)}.` : `${kg(o.co2_kg)} for this trip, against ${kg(base.co2_kg)} driving alone`;
  if (saved > 0.05) return { tone: "good", main: `${kg(saved)} ${o.co2_note ? "less tailpipe CO₂ than driving" : "CO₂ less than driving"}`, sub };
  if (saved < -0.05) return { tone: "warn", main: `${kg(-saved)} CO₂ more than driving`, sub };
  return { tone: "", main: "About the same CO₂ as driving", sub };
}

function co2Block(o, lowest) {
  const line = co2Line(o);
  if (!line) return "";
  return `<div class="co2-line ${line.tone}"><span class="co2-ic">${I.leaf(18)}</span><div class="co2-text"><b>${esc(line.main)}</b>${line.sub ? `<small>${esc(line.sub)}</small>` : ""}</div>${lowest?.badge && lowest.ids.has(o.id) ? `<span class="badge success solid">Lowest CO₂</span>` : ""}</div>`;
}

// One sentence above the cards: how much the greenest option saves compared with driving.
function co2Summary(options) {
  const base = state.plan?.baseline, lowest = lowestCo2(options);
  if (!base || !lowest) return "";
  const best = lowest.best, saved = base.co2_kg - best.co2_kg;
  const text = best.mode === "drive" || saved <= 0.05
    ? `Driving alone is already the lowest-CO₂ option for this trip (about ${kg(base.co2_kg)}).`
    : `The greenest option, <b>${esc(best.title)}</b>, saves about ${kg(saved)} ${best.co2_note ? "tailpipe " : ""}CO₂ compared with driving the same trip alone (${Math.round((saved / base.co2_kg) * 100)}% less).${best.co2_note ? ` ${esc(best.co2_note)}.` : ""}`;
  return `<div class="co2-summary">${I.leaf(18)}<p>${text}</p></div>`;
}

function tradeoff(o) {
  if (o.mode === "rideshare") return "Open Uber for the live price and pickup time. It's door to door, but costs more than public transport.";
  if (o.cost_estimated) return `Estimated hire cost and time on ${o.offline ? "an OpenStreetMap" : "a Google Maps"} cycling route at an assumed speed. Check that a vehicle is nearby, its real price and local rules in the Lime or Neuron app.`;
  if (["scooter", "ebike", "bicycle"].includes(o.mode)) return `Illustrative time on ${o.offline ? "an OpenStreetMap" : "a Google Maps"} cycling route. Check vehicle access, local rules, availability and conditions; hire costs are not checked.`;
  const parts = [];
  if (o.buffer_minutes !== undefined) parts.push(`Arrives ${bufferInfo(o).text}`);
  else parts.push(`About ${plural(o.duration_minutes, "minute")}`);
  if (o.mode === "transit") {
    parts.push(o.transfers ? plural(o.transfers, "change") : "no changes");
    if (o.walking_minutes !== null) parts.push(`${o.walking_minutes} min walking${o.elevation && o.elevation.gain_m >= 30 ? " with a climb" : ""}`);
  }
  if (o.vs_drive?.cost_saved > 0.5) parts.push(`saves ${money(o.vs_drive.cost_saved)} on driving`);
  if (o.mode === "drive" && o.parking?.any_paid) parts.push("plus paid parking at the other end");
  let text = parts.join(", ") + ".";
  if (!o.fits && o.reasons.length) text += ` ${o.reasons[0].text}.`;
  else if (!o.cost_known && o.cost_unknown_text) text += ` ${o.cost_unknown_text}.`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Lime and Neuron run Brisbane's shared e-scooters and e-bikes. These open the official app store listing (it shows "Open" when the app is
// installed) on a phone, or the operator's Brisbane page on a computer. Store links and app IDs checked 2026-10-23.
const HIRE_APPS = {
  Lime: { ios: "https://apps.apple.com/au/app/lime-ridegreen/id1199780189", android: "https://play.google.com/store/apps/details?id=com.limebike", web: "https://www.li.me/en-au/locations/brisbane" },
  Neuron: { ios: "https://apps.apple.com/au/app/neuron-e-scooters-and-e-bikes/id1240649186", android: "https://play.google.com/store/apps/details?id=com.hhyu.neuron", web: "https://www.rideneuron.com/australia/" },
};
const isAndroid = () => /android/i.test(navigator.userAgent);
const hireLink = (name) => { const app = HIRE_APPS[name]; return isIos() ? app.ios : isAndroid() ? app.android : app.web; };
function hireButtons(o) {
  return `<div class="hire-links" role="group" aria-label="Hire apps">${o.hire_providers.filter((name) => HIRE_APPS[name]).map((name) => `<a class="btn hire-btn ${name.toLowerCase()}" href="${esc(hireLink(name))}" target="_blank" rel="noopener noreferrer"><span class="hire-mark" aria-hidden="true">${name[0]}</span><span>Open ${esc(name)}</span>${I.external(15)}</a>`).join("")}</div>
    <p class="fine hire-note">See nearby vehicles and the real price in the app. Reroute isn't affiliated with Lime or Neuron.</p>`;
}

function badge(o) {
  if (o.fits) return o.buffer_minutes !== undefined && o.buffer_minutes < 5 ? `<span class="badge tight">${I.alert(12)}Tight</span>`
    : o.cost_known ? `<span class="badge success">${I.checkCircle(12)}Fits</span>` : `<span class="badge info">${I.dollar(12)}Price unknown</span>`;
  const hard = o.reasons.some((r) => ["deadline", "disruption"].includes(r.limit));
  return `<span class="badge ${hard ? "error" : "warning"}">${hard ? I.xCircle(12) : I.alert(12)}${hard ? (o.reasons[0].limit === "disruption" ? "Disrupted" : "Late") : "Check"}</span>`;
}

function optionCard(o, index, highlight, lowest) {
  const show = settings.show;
  const icon = (KIND_ICON[o.kind] || I.route)(20);
  const b = bufferInfo(o);
  const costOver = o.reasons.some((r) => r.limit === "cost");
  const walkOver = o.reasons.some((r) => r.limit === "walking");
  const facts = [
    show.realtime ? realtimeFact(o) : "", weatherFact(o), trafficFact(o), show.elevation ? climbFact(o) : "",
    show.parking ? parkingFact(o) : "",
    o.vs_drive?.cost_saved > 0.5 && show.cost ? `<span class="fact good">${I.dollar(14)}Saves ${money(o.vs_drive.cost_saved)} vs driving</span>` : "",
  ].filter(Boolean).join("");
  const sub = [o.subtitle, o.mode === "transit" ? leaveLabel(o) : `${o.duration_minutes} min`, show.transfers && o.transfers ? plural(o.transfers, "transfer") : ""].filter(Boolean).join(" · ");
  const stats = [
    show.cost ? `<span class="${costOver ? "over" : ""}"><b>${o.cost_known ? `${o.cost_estimated ? "~" : ""}${money(o.cost)}` : o.mode === "rideshare" ? "In Uber" : isCycle(o) ? "Not checked" : o.cost !== null && o.cost !== undefined ? `${money(o.cost)}+` : "?"}</b> ${o.mode === "transit" ? "fare" : o.cost_estimated ? "est. hire" : "cost"}</span>` : "",
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
        ${show.co2 ? co2Block(o, lowest) : ""}
        ${facts ? `<div class="facts">${facts}</div>` : ""}
        <p class="tradeoff">${esc(tradeoff(o))}</p>
      </button>
      ${o.mode === "rideshare"
        ? `<a class="card-action" href="${esc(o.uber_url)}" target="_blank" rel="noopener noreferrer">Open in Uber ${I.external(16)}</a>`
        : `<button class="card-action ${o.fits ? "" : "quiet"}" data-action="${o.fits ? "choose" : "open-sheet"}" data-id="${esc(o.id)}">${o.fits ? "Choose this option" : isCycle(o) ? "Check details before choosing" : "See why it doesn't fit"}</button>`}
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
const SORT_WHY_DEADLINE = {
  best: "Options inside every limit come first, then others that arrive on time with no disruption, then the earliest arrival.",
  pt: "Options that arrive on time with no disruption come first, public transport first among them, then the earliest arrival.",
};
const makesIt = (o) => !o.reasons.some((r) => r.limit === "deadline" || r.limit === "disruption");

function sortedOptions() {
  const list = [...state.plan.options];
  const arrival = (a, b) => new Date(a.arrival) - new Date(b.arrival);
  const known = (o, key) => (o[key] === null || o[key] === undefined ? Infinity : o[key]);
  // With a deadline, options that make it come first, and "Public transport first" only reorders those (both are then in one group).
  const deadline = Boolean(state.plan.deadline);
  const onTime = (a, b) => (deadline ? Number(makesIt(b)) - Number(makesIt(a)) : 0);
  const transit = (a, b) => (deadline && !makesIt(a) ? 0 : Number(b.mode === "transit") - Number(a.mode === "transit"));
  const by = {
    best: (a, b) => onTime(a, b) || Number(b.fits) - Number(a.fits) || arrival(a, b),
    pt: (a, b) => onTime(a, b) || transit(a, b) || Number(b.fits) - Number(a.fits) || arrival(a, b),
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
  const avoiding = (f.avoid || "").trim();
  const options = sortedOptions();
  const fit = options.filter((o) => o.fits).length;
  const unpriced = options.filter((o) => o.fits && !o.cost_known).length;
  const chips = `<div class="chips">
      ${p.deadline ? `<span class="chip">${I.clock(14)}By ${timeOf(p.deadline)}</span>` : ""}
      <span class="chip">${I.dollar(14)}$${f.budget} max</span>
      <span class="chip">${I.walk(14)}${f.walking} min walk</span>
      ${p.offline ? `<span class="chip">${I.signal(14)}Offline estimate</span>` : state.alerts ? `<span class="chip live"><span class="live-dot"></span>Translink live</span>` : ""}
    </div>`;
  const sortChips = `<div class="chips" role="group" aria-label="Sort options">${SORTS.map(([v, label]) => `<button class="chip" data-action="sort" data-value="${v}" aria-pressed="${state.sort === v}">${esc(label)}</button>`).join("")}</div>`;
  const lowest = lowestCo2(p.options);
  let body;
  if (state.loading) {
    body = `<div class="cards" role="status" aria-label="Finding options">${skeletonCard()}${skeletonCard()}${skeletonCard()}</div>`;
  } else if (!options.length) {
    body = `<div class="empty-card"><div class="empty-icon">${I.alert(24)}</div><h3>No routes found</h3><p>${p.errors.length ? esc(p.errors.join(" ")) : "Try another time, place or travel mode."}</p></div>`;
  } else {
    const noneFit = !fit && p.deadline;
    body = (noneFit ? `<div class="empty-card"><div class="empty-icon">${I.alert(24)}</div><h3>No option meets all your limits</h3><p>Every option misses at least one limit. Each card says which one. Change a limit deliberately, or choose and verify.</p></div>` : "")
      + `<p class="why-rank">${esc((p.deadline && SORT_WHY_DEADLINE[state.sort]) || SORT_WHY[state.sort])}</p>`
      + (settings.show.co2 ? co2Summary(p.options) : "")
      + `<div class="cards">${options.map((o, i) => optionCard(o, i, i === 0 && o.fits ? "best" : "", lowest)).join("")}</div>`;
  }
  const rides = p.offline ? "" : p.rides?.length ? ridesTile(`${plural(p.rides.length, "shared ride")} heading your way`, "Share a car or split an Uber. It costs less for everyone and means fewer cars.")
    : ridesTile("Going this way with others?", "Offer spare seats or start a split Uber on the shared ride board.");
  const fuel = p.fuel?.price ? `Driving cost uses ${p.fuel.manual ? "your fuel price of" : `the average ${esc(p.fuel.fuel_type)} price near your start (${p.fuel.stations} stations, Google Places):`} $${p.fuel.price.toFixed(2)}/L at ${settings.fuel_l_per_100km} L/100 km.` : "Fuel price unavailable. Driving cost is incomplete.";
  return `
    ${navbar(true)}
    <div class="scroll tight">
      ${chips}
      <div class="heading-row"><div><p class="eyebrow">Routes</p><h2>Your options</h2>
        ${state.loading ? `<div class="skeleton skel-line sm w-60" role="status" aria-label="Updating options" style="margin-top:8px"></div>` : `<p>${fit} of ${options.length} fit your limits${unpriced ? ` · price unknown for ${unpriced}` : ""}</p>`}</div>
        <button class="icon-btn" data-action="map-overview" aria-label="Show all routes on a map">${I.route(20)}</button></div>
      ${sortChips}
      <div style="height:16px"></div>
      ${state.error ? notice(esc(state.error), state.errorKind) : ""}
      ${avoiding ? notice(`Routes that use ${esc(avoiding)} are flagged because of the disruption.`, "info") : ""}
      ${costLine()}
      ${body}
      ${rides}
      ${p.errors.length && options.length ? notice(esc(p.errors.join(" ")), "error") : ""}
      ${p.notes.map((n) => notice(esc(n), "info")).join("")}
      ${p.offline ? `<p class="fine" style="margin:16px 4px 0">Offline estimate from your downloaded area, worked out ${timeOf(p.queried_at)}: scheduled Translink times and an OpenStreetMap route, with no live delays, disruptions or traffic. Map data © OpenStreetMap contributors; timetables from Translink. CO₂ figures are estimates (see Settings).</p>`
        : `<p class="fine results-attribution" style="margin:16px 4px 0">${googleMapsAttribution()}<span>Route times checked ${timeOf(p.queried_at)}. ${fuel} CO₂ figures are estimates (see Settings). Always check services before you travel.</span></p>`}
    </div>`;
}

// ── Detail sheet ─────────────────────────────────────────────────────────────

function limitCheck(label, ok, detail) {
  const cls = ok === null ? "na" : ok ? "ok" : "no";
  const icon = ok === null ? I.minus(12) : ok ? I.check(13) : I.x(12);
  return `<div class="row"><span class="check ${cls}">${icon}</span><span class="row-label">${label}</span><span class="row-value">${esc(detail)}</span></div>`;
}

// The map slot shows a shimmer until Google Maps has loaded (see mountMaps).
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
    + `<span><i class="dot" style="background:var(--success)"></i>Start</span><span><i class="dot" style="background:var(--error)"></i>${o.offline ? "Destination" : "Destination found by Google"}</span>`;
}

function sheetContent(o) {
  const f = state.form;
  const lim = Object.fromEntries(o.reasons.map((r) => [r.limit, r]));
  const b = bufferInfo(o);
  const rt = o.realtime;
  const explain = o.fits
    ? `<div class="explain success"><h4>${o.buffer_minutes !== undefined && o.buffer_minutes < 5 ? "Fits, but with little spare time" : o.cost_known ? "Meets every limit" : "Fits your other limits · price unknown"}</h4><p>${esc(tradeoff(o))}</p></div>`
    : `<div class="explain ${o.reasons.some((r) => ["deadline", "disruption"].includes(r.limit)) ? "error" : "warning"}"><h4>Check before choosing${anySimulated(o) ? simTag(true) : ""}</h4>${o.reasons.map((r) => `<p>${esc(r.text)}</p>`).join("")}</div>`;
  const alerts = rt?.alerts?.length ? `<p class="section-header">Translink alerts</p><div class="group"><div class="group-card">${rt.alerts.map((a) => alertRow(a, false)).join("")}</div></div>` : "";
  const breakdown = (o.cost_breakdown || []).map((item) => row(I.dollar(16), "var(--success)", esc(item.label), valueSpan(money(item.amount), true))).join("");
  const parking = o.mode === "drive" && o.parking ? `<p class="section-header">Parking near the destination</p><div class="group"><div class="group-card">
      ${o.parking.parks.length ? o.parking.parks.map((pk) => row(I.parking(16), "var(--accent)", `${esc(pk.name)}<small>${pk.distance_m} m from destination${pk.paid ? " · paid" : ""}${pk.free ? " · free option" : ""}</small>`)).join("")
        : `<div class="row"><span class="row-label">No car parks listed within ${o.parking.radius_m} m. Parking may be hard to find.</span></div>`}
  </div><p class="group-footer">${googleMapsAttribution()} ${settings.parking_cost !== null ? `Your typical parking-cost estimate is ${money(settings.parking_cost)} for this trip; it is not a price quote for any listed car park.` : "Google Places lists nearby car parks but does not return their prices. Add your typical parking cost in Settings for a personal trip estimate."} Car parks from Google Places.</p></div>` : "";
  const stepOf = stepNav(o);
  const steps = o.steps.slice(0, 12).map((s) => { const ni = stepOf(s); return row((KIND_ICON[s.kind] || I.route)(16), SEGMENT_COLOUR[s.kind] || "var(--accent)", `${esc(s.title)}${s.board_time ? `<small>Board at ${esc(s.board_time)}${s.stops ? ` · ${plural(s.stops, "stop")}` : ""}</small>` : ""}${s.directions?.length > 1 ? `<small>${s.directions.map(esc).join(" · ")}</small>` : ""}${ni >= 0 ? liveSlot(o, ni) : ""}`, s.minutes ? valueSpan(`${s.minutes} min`) : ""); }).join("");
  const weather = o.weather_warning ? `<div class="explain warning"><h4>Weather${simTag(state.plan.weather?.simulated)}</h4><p>${esc(o.weather_warning)}</p></div>` : "";
  const elevation = o.elevation ? row(I.mountain(16), "var(--teal)", "Walking climb", valueSpan(`+${o.elevation.gain_m} m / −${o.elevation.loss_m} m`, true)) : "";
  return `
    <div class="grabber"><span></span></div>
    <div class="sheet-head"><h3 id="sheet-title">${esc(o.title)}</h3>${sheetClose()}</div>
    <div class="sheet-scroll">
      <div class="big-arrival">
        <div><div class="t">${timeOf(o.arrival)}</div><div class="buffer ${b.cls}">${b.text}</div></div>
        <div class="d">${leaveLabel(o)}${state.plan.deadline ? `<br>Deadline ${timeOf(state.plan.deadline)}` : ""}${o.scheduled_arrival ? `<br>Timetable ${timeOf(o.scheduled_arrival)}` : ""}</div>
      </div>
      ${explain}
      ${weather}
      ${o.notice ? notice(esc(o.notice), "info") : ""}
      ${settings.show.co2 ? co2Block(o, lowestCo2(state.plan.options)) : ""}
      ${o.segments?.length ? mapBlock(o.id, legendFor(o)) : ""}
      <p class="section-header">Your limits</p>
      <div class="group"><div class="group-card">
        ${state.plan.deadline ? limitCheck("Deadline", !lim.deadline, b.text) : ""}
        ${limitCheck(`Cost ($${f.budget})`, lim.cost ? false : o.cost_known ? true : null, o.cost_known ? `${o.cost_estimated ? "About " : ""}${money(o.cost)}` : o.cost !== null && o.cost !== undefined ? `${money(o.cost)}+` : "Unknown")}
        ${limitCheck(`Walking (${f.walking} min)`, o.walking_minutes === null ? null : !lim.walking, o.walking_minutes === null ? "Unknown" : `${o.walking_minutes} min`)}
        ${o.mode === "transit" ? limitCheck("Live service status", rt ? (rt.checked ? !lim.disruption : null) : null, rt?.checked ? (lim.disruption ? "Alert" : rt.delay > 2 ? `~${rt.delay} min late` : "No alerts") : "Not checked") : ""}
      </div></div>
      <p class="section-header">Journey</p>
      <div class="group"><div class="group-card">
        ${row(I.clock(16), "var(--violet)", "Travel time", valueSpan(`${o.duration_minutes} min`, true))}
        ${o.mode === "transit" ? row(I.transfer(16), "var(--warning)", "Transfers", valueSpan(String(o.transfers), true)) : ""}
        ${elevation}
        ${o.distance_km ? row(I.route(16), "var(--teal)", "Distance", valueSpan(`${o.distance_km} km`, true)) : ""}
        ${co2Known(o) ? row(I.leaf(16), "var(--success)", o.co2_note ? "Tailpipe CO₂" : "Estimated CO₂", valueSpan(kg(o.co2_kg), true)) : ""}
        ${o.traffic?.added_delay_min ? row(I.cone(16), "var(--warning)", "Traffic incidents", valueSpan(`+${o.traffic.added_delay_min} min${o.traffic.source === "Simulated" ? " · Simulated" : ""}`, true)) : ""}
        ${o.vs_drive ? row(I.car(16), "var(--text-muted)", "Compared with driving", valueSpan(`${o.vs_drive.minutes >= 0 ? "+" : ""}${o.vs_drive.minutes} min${o.vs_drive.co2_saved_kg == null ? "" : ` · ${o.vs_drive.co2_saved_kg >= 0 ? "−" : "+"}${kg(Math.abs(o.vs_drive.co2_saved_kg))}`}${o.vs_drive.cost_saved != null ? ` · ${o.vs_drive.cost_saved >= 0 ? "saves" : "costs"} ${money(Math.abs(o.vs_drive.cost_saved))}` : ""}`)) : ""}
      </div><p class="group-footer">${esc(o.cost_label || "")}${o.co2_note ? ` · ${esc(o.co2_note)}` : ""}${o.elevation?.source ? ` · Elevation: ${esc(o.elevation.source)}` : ""}</p></div>
      ${breakdown ? `<p class="section-header">Cost breakdown</p><div class="group"><div class="group-card">${breakdown}</div></div>` : ""}
      ${trafficSection(o)}
      ${parking}
      ${alerts}
      <div class="section-live"><p class="section-header">Steps</p>${hasLive(o) ? liveAge() : ""}</div>
      <div class="group"><div class="group-card">${steps}</div></div>
    </div>
    <div class="sheet-foot">
      ${o.hire_providers?.length ? hireButtons(o) : ""}
      ${o.mode === "rideshare"
        ? `<a class="btn btn-inverse" href="${esc(o.uber_url)}" target="_blank" rel="noopener noreferrer">Open in Uber for the live price ${I.external()}</a>`
        : `<button class="btn ${o.fits ? "btn-primary" : "btn-secondary"}" data-action="choose" data-id="${esc(o.id)}">${o.fits ? "Choose this option" : "Choose anyway"}</button>`}
    </div>`;
}

// ── Next steps ───────────────────────────────────────────────────────────────

// The trip's CO₂ saving, before logging (what you would add) and after (what you added and the new monthly total against the goal).
const progressBar = (fraction) => `<div class="progress" role="progressbar" aria-label="Monthly CO₂ goal" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(Math.min(1, fraction) * 100)}"><span style="transform:scaleX(${Math.max(0.02, Math.min(1, fraction))})"></span></div>`;
function impactPanel(o, logged) {
  const month = impactTotals(thisMonthTrips()), goal = settings.co2_goal_kg;
  const saved = o.vs_drive ? Math.max(0, o.vs_drive.co2_saved_kg) : 0;
  if (logged) {
    const entry = store.get("trips", []).find((t) => t.ref === tripRef(o));
    const added = entry ? entry.co2_saved : saved;
    return `<div class="impact-card done" role="status"><span class="impact-ic">${I.checkCircle(22)}</span><div>
      <b>${added > 0.005 ? `${kg(added)} ${o.co2_note ? "tailpipe " : ""}CO₂ avoided, added to your month` : "Trip added to your history"}</b>
      <small>New total this month: <strong>${kg(month.co2)}</strong> of your ${goal} kg goal</small>${progressBar(month.co2 / goal)}</div></div>`;
  }
  if (saved > 0.05) {
    return `<div class="impact-card"><span class="impact-ic">${I.leaf(22)}</span><div><b>Saves ${kg(saved)} ${o.co2_note ? "tailpipe " : ""}CO₂ compared with driving</b>
      <small>${o.co2_note ? `${esc(o.co2_note)}. ` : ""}Add it to your month with “I'm taking this trip”. This month so far: ${kg(month.co2)} of your ${goal} kg goal.</small></div></div>`;
  }
  return `<div class="impact-card neutral"><span class="impact-ic">${I.leaf(22)}</span><div><b>${o.mode === "drive" ? "This is the driving baseline" : "No CO₂ saving compared with driving"}</b>
    <small>${o.mode === "drive" ? "Logging it counts as a driving trip and does not add to your CO₂ total." : "Logging it records the trip without adding to your CO₂ total."}</small></div></div>`;
}

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
  const sure = o.fits && o.cost_known;
  const chosen = !o.fits ? "Chosen, but outside your limits" : isCycle(o) && !o.cost_known ? "Chosen, cost and access not checked"
    : !o.cost_known ? "Route chosen · price unknown" : o.cost_estimated ? "Route chosen · check a vehicle is nearby" : "Route confirmed";
  return `
    ${navbar(true)}
    <div class="scroll">
      ${watchAlert ? `<div class="watch-banner" role="alert">${I.alert(20)}<div><p><b>New disruption on ${esc(watchAlert.lines.join(", "))}:</b> ${esc(watchAlert.header)}</p><button class="btn btn-primary" data-action="replan">See my alternatives</button></div></div>` : ""}
      <div class="confirm ${sure ? "" : "warn"}">
        <p class="eyebrow">${sure ? I.checkCircle(16) : I.alert(16)}${chosen}</p>
        <h2>${esc(o.title)}</h2>
        <div class="confirm-grid">
          <div><span>Arrival</span><b>${timeOf(o.arrival)}</b></div>
          <div><span>${state.plan.deadline ? "Buffer" : "Trip"}</span><b>${b.text}</b></div>
          <div><span>${o.cost_estimated ? "Est. hire" : "Cost"}</span><b>${o.cost_known ? `${o.cost_estimated ? "~" : ""}${money(o.cost)}` : "Unknown"}</b></div>
          <div><span>Distance</span><b>${o.distance_km ? `${o.distance_km} km` : "–"}</b></div>
        </div>
      </div>
      ${impactPanel(o, logged)}
      ${o.weather_warning ? notice(`<b>Weather:</b> ${esc(o.weather_warning)}${state.plan.weather?.simulated ? " (Simulated)" : ""}`) : ""}
      ${o.traffic?.closure ? notice("<b>Road closure on this route.</b> Check the closure before you leave.", "error") : o.traffic?.added_delay_min ? notice(`<b>Traffic incidents:</b> about ${o.traffic.added_delay_min} min added${o.traffic.source === "Simulated" ? " (Simulated)" : ""}.`) : ""}
      <div class="actions">
        ${o.nav?.length ? `<button class="btn btn-primary" data-action="start-nav" data-id="${esc(o.id)}">${I.navArrow(18)}Start directions</button>` : ""}
        ${o.hire_providers?.length ? hireButtons(o) : ""}
        <button class="btn ${logged ? "btn-secondary" : "btn-success"}" data-action="log-trip" ${logged ? "disabled" : ""}>${logged ? `${I.check(16)}Added to your impact` : `${I.leaf(18)}I'm taking this trip`}</button>
        ${o.offline ? "" : `<div class="btn-row">
          <a class="btn btn-secondary" href="${esc(o.maps_url)}" target="_blank" rel="noopener noreferrer" aria-label="Open in Google Maps">Google Maps ${I.external(16)}</a>
          <a class="btn btn-secondary" href="https://jp.translink.com.au/plan-your-journey/journey-planner" target="_blank" rel="noopener noreferrer">Translink ${I.external(16)}</a>
        </div>`}
      </div>
      ${o.mode === "transit" && !o.offline ? `<div class="group"><div class="group-card">
        <div class="row"><span class="row-icon" style="--tone:var(--error)">${I.signal(18)}</span><span class="row-label">Watch for disruptions<small>Checks Translink every minute while this app is open</small></span>${toggle("watch", settings.watch, "Watch for disruptions")}</div>
        <div class="row"><span class="row-icon" style="--tone:var(--accent)">${I.bell(18)}</span><span class="row-label">Watch this trip in the background<small>Get a notification even when Reroute is closed</small></span>${toggle("bg.watch", bgWatchActive(o), "Watch this trip in the background")}</div>
        <div class="bg-slot" data-bg-slot>${bgSlotInner()}</div>
      </div><p class="group-footer">Background alerts need HTTPS${isIos() ? ", and on iPhone Reroute must be added to your Home Screen first" : ""}. They are sent by this Reroute server.</p></div>` : ""}
      <div class="section-live"><p class="section-header">Step-by-step</p>${hasLive(o) ? liveAge() : ""}</div>
      <div class="timeline">${steps}</div>
      ${o.segments?.length ? `<p class="section-header">Route map</p>${mapBlock(o.id, legendFor(o))}` : ""}
      ${o.offline ? "" : ridesTile("Share this trip", "Have spare seats, or want to split an Uber? Post it to the shared ride board.")}
      ${notice("Estimates only. Check the service, stops and walking path before you travel.")}
    </div>
    <footer class="sticky"><button class="btn btn-primary" data-action="done">Done</button></footer>`;
}

// ── Panic mode ───────────────────────────────────────────────────────────────

function panicScreen() {
  const pm = state.panic;
  const top = `<div class="panic-top"><span class="panic-label">${I.bolt(14)}BEST WAY NOW</span><div class="panic-actions">${homeButton()}<button class="panic-exit" data-action="exit-panic">Exit</button></div></div>`;
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
          ${o.offline ? "" : `<a class="btn btn-secondary" href="${esc(o.maps_url)}" target="_blank" rel="noopener noreferrer">Open in Google Maps ${I.external(16)}</a>`}
          <button class="btn btn-secondary" data-action="panic-others">See other options</button>
        </div>
        ${notice(o.offline ? "Offline estimate from Translink's timetable and an OpenStreetMap route, not live. Check signs at the stop." : "Estimate from Google and Translink. Check signs at the stop.")}
      </div>`;
    }
  }
  const chips = [...settings.saved_places.filter((p) => p.address).map((p) => [p.id, p.name]), store.get("lastDestination", "") && ["last", "Last place"]].filter(Boolean);
  return `${top}<div class="scroll">
    <h1>Journey disrupted?<span>Where do you need to be?</span></h1>
    ${pm.locating ? `<div class="lead">${skelLines("Finding your location", 60)}</div>` : `<p class="lead">${pm.coords ? "Using your current location." : demoOn() && state.demo.start === "preset" ? "Demo start point: Taringa Station." : "Location unavailable. Type where you are."}</p>`}
    ${pm.coords || pm.locating ? "" : `<div class="panic-field"><input class="panic-input" data-panic="origin" ${acAttrs("panic.origin")} placeholder="Where are you now?" value="${esc(pm.origin || "")}" aria-label="Where are you now"></div>`}
    <div class="panic-field"><input class="panic-input" data-panic="dest" ${acAttrs("panic.dest")} placeholder="Destination" value="${esc(pm.dest)}" aria-label="Destination"></div>
    <div class="panic-chips">${chips.map(([k, l]) => `<button class="panic-chip" data-action="panic-place" data-place="${esc(k)}">${esc(l)}</button>`).join("")}<button class="panic-chip" data-action="pick-map" data-path="panic.dest">${I.map(16)}Choose on map</button></div>
    <label class="panic-by">Need to be there by <input class="panic-input" type="time" data-panic="by" value="${esc(pm.by)}" aria-label="Deadline (optional)"></label>
    ${pm.error ? notice(esc(pm.error), pm.errorKind || "error") : ""}
    <button class="panic-go${pm.phase === "loading" ? " is-loading" : ""}" data-action="panic-go" ${pm.phase === "loading" ? 'disabled aria-busy="true"' : ""}>${pm.phase === "loading" ? skelBar("Finding the best working option", 140) : "Get me there"}</button>
  </div>`;
}

// ── Live directions ──────────────────────────────────────────────────────────

const modeKind = (s) => (s.transit ? s.transit.vehicle : s.mode === "drive" ? "car" : CYCLE_MODES.includes(s.mode) ? s.mode : "walk");
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
  if (n.error === "denied") cards.push(`<div class="nav-card nav-notice">${notice("<b>Location is blocked.</b> Allow location for Reroute in your browser settings to follow your position. The steps below still work: tap Next step as you go.", "error")}${next}</div>`);
  else if (n.error === "unsupported") cards.push(`<div class="nav-card nav-notice">${notice("This browser can't share its location, so Reroute can't follow you. The steps below still work.", "error")}${next}</div>`);
  else if (n.error === "weak") cards.push(`<div class="nav-card nav-notice">${notice("GPS signal is weak. Reroute will keep trying.")}</div>`);
  else if (!n.pos) cards.push(`<div class="nav-card nav-skel" role="status" aria-label="Finding your location"><div class="skeleton skel-tile" style="width:48px;height:48px;border-radius:14px"></div><div><div class="skeleton skel-line w-60"></div><div class="skeleton skel-line sm w-40"></div></div></div>`);
  if (n.off) cards.push(`<div class="nav-card nav-notice">${notice("<b>You're off the route.</b> Reroute can find a new way from where you are.")}<button class="btn btn-primary" data-action="nav-replan">${I.route(16)}Re-plan from here</button></div>`);
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
  if (!o) return `${navbar(true)}<div class="scroll"><div class="empty-card"><div class="empty-icon">${I.route(24)}</div><h3>No route to follow</h3><p>Choose an option with directions first.</p></div></div>`;
  return `<div class="nav-map" data-map="__nav"><div class="skeleton map-skeleton" role="status" aria-label="Loading map"></div></div>
    <div class="nav-top"><div class="nav-top-row"><div data-nav-banner>${navBannerHtml()}</div>${homeButton()}</div><div class="nav-stack" data-nav-notices>${navNoticesHtml()}</div></div>
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
    line.setOptions({ strokeColor: done ? cssColour("var(--text-faint)") : step.transit?.colour || cssColour(SEGMENT_COLOUR[kind] || "var(--accent)"),
      strokeWeight: cur ? 8 : kind === "walk" ? 4 : 6, strokeOpacity: done ? 0.45 : cur ? 1 : 0.85, zIndex: cur ? 2 : 1 });
  });
}
function buildNavMap(el) {
  const n = state.nav;
  if (!n) return;
  el.replaceChildren();
  const map = makeGoogleMap(el);
  const entry = { map, bounds: new GM.LatLngBounds(), lines: [], markers: [], optionId: n.optionId, vehicles: new Map(), nav: true, me: null, zoomIdx: -1 };
  entry.restyle = () => { map.setOptions({ styles: mapStyles() }); navLines(entry); };
  n.steps.forEach((s) => {
    if (s.arrive) return;
    entry.lines.push({ line: new GM.Polyline({ path: s.poly.map(toLatLng), map, geodesic: true }), step: s });
    s.poly.forEach((point) => entry.bounds.extend(toLatLng(point)));
  });
  entry.markers.push(new GM.Marker({ position: toLatLng(n.steps[0].start), map, icon: mapIcon("start"), clickable: false }));
  entry.markers.push(new GM.Marker({ position: toLatLng(n.steps.at(-1).end), map, icon: mapIcon("end"), clickable: false }));
  fitMap(entry, { top: 48, right: 48, bottom: 48, left: 48 });
  map.addListener("dragstart", () => { if (state.nav?.following) { state.nav.following = false; navPaint(); } });
  maps.set(el, entry);
  navLines(entry);
  navMap();
  setTimeout(() => { if (maps.get(el) === entry && !state.nav?.pos) fitMap(entry, { top: 48, right: 48, bottom: 48, left: 48 }); }, 420);
}
function navMap() {
  const n = state.nav, entry = navEntry();
  if (!n || !entry) return;
  if (entry.lineIdx !== n.idx) { entry.lineIdx = n.idx; navLines(entry); }
  if (n.pos) {
    if (!entry.me) {
      entry.me = new GM.Marker({ position: toLatLng(n.pos), map: entry.map, icon: mapIcon("me", n.heading), clickable: false, zIndex: 1000 });
    } else {
      entry.me.setPosition(toLatLng(n.pos));
      entry.me.setIcon(mapIcon("me", n.heading));
    }
    if (n.following) {
      const s = n.steps[n.idx], animate = !prefersReducedMotion(), riding = s?.transit && navRiding(n, s);
      const v = s?.transit && !riding ? rtOf(findOption(n.optionId), s.i).vehicle : null;
      if (v) {
        // Waiting at the stop: frame you and the approaching vehicle together.
        const sig = `${n.idx}|${v.lat},${v.lng}`;
        if (entry.fitSig !== sig) {
          entry.fitSig = sig;
          entry.zoomIdx = null;
          const bounds = new GM.LatLngBounds().extend(toLatLng(n.pos)).extend({ lat: v.lat, lng: v.lng });
          entry.map.fitBounds(bounds, { top: 210, right: 48, bottom: 170, left: 48 });
          GM.event.addListenerOnce(entry.map, "idle", () => { if (entry.map.getZoom() > 16) entry.map.setZoom(16); });
        }
      } else {
        const key = `${n.idx}${riding ? "r" : ""}`, zoom = s?.transit ? 15 : s?.mode === "drive" ? 16 : 17;
        entry.fitSig = null;
        if (entry.zoomIdx !== key) { entry.zoomIdx = key; entry.map.setCenter(toLatLng(n.pos)); entry.map.setZoom(zoom); } else entry.map.panTo(toLatLng(n.pos));
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
    const plan = await requestPlan(payload({ origin, origin_place_id: null, leave_now: true }));
    const pool = plan.options.filter((x) => x.nav?.length);
    const pick = pool.find((x) => x.mode === o.mode && x.fits) || pool.find((x) => x.mode === o.mode) || pool.find((x) => x.id === plan.recommended_id) || pool[0];
    if (!pick) throw new Error("No route was found from here. Try again in a moment.");
    const keepSim = n.sim;
    navHalt();
    state.plan = plan;
    state.form.origin = origin;
    state.form.originPlaceId = null;
    state.form.originCoords = null;
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

// Months and weeks use Brisbane time (UTC+10, no daylight saving). Reading a shifted Date with the UTC getters gives the Brisbane wall-clock fields.
const bneDate = (iso) => new Date(Date.parse(iso) + 10 * 3600000);
const monthKeyOf = (iso) => bneDate(iso).toISOString().slice(0, 7);
const thisMonthTrips = () => { const m = monthKeyOf(new Date().toISOString()); return store.get("trips", []).filter((t) => monthKeyOf(t.date) === m); };
// Weeks run Monday to Sunday. 1 January 1970 was a Thursday, so (days + 3) / 7 starts a new week every Monday.
const weekOf = (iso) => Math.floor((Math.floor(bneDate(iso).getTime() / 86400000) + 3) / 7);
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
  const now = bneDate(new Date().toISOString());
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = d.toISOString().slice(0, 7);
    const totals = impactTotals(trips.filter((t) => monthKeyOf(t.date) === key));
    months.push({ key, label: d.toLocaleDateString("en-AU", { month: "short", timeZone: "UTC" }), ...totals });
  }
  return months;
}

// Weekly streak: consecutive weeks (Monday to Sunday) with at least one logged trip and no logged trip by your own car. An empty current week
// does not break the streak, but a driving trip logged this week does. Only trips logged in the app count.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function weeklyStreak(trips) {
  const weeks = new Map();
  trips.forEach((t) => { const w = weekOf(t.date), e = weeks.get(w) || { n: 0, drove: 0 }; e.n++; if (t.mode === "drive") e.drove++; weeks.set(w, e); });
  const current = weekOf(new Date().toISOString());
  const clean = (w) => weeks.get(w)?.n > 0 && !weeks.get(w).drove;
  let streak = 0, w = weeks.get(current)?.drove ? null : clean(current) ? current : current - 1;
  while (w !== null && clean(w)) { streak++; w--; }
  const recent = Array.from({ length: 8 }, (_, i) => {
    const wk = current - 7 + i, e = weeks.get(wk);
    const monday = new Date((wk * 7 - 3) * 86400000);
    const label = `${monday.getUTCDate()} ${MONTHS[monday.getUTCMonth()]}`;
    return { wk, label, state: !e ? "empty" : e.drove ? "drove" : "clean", n: e?.n || 0, now: wk === current };
  });
  return { streak, recent };
}

// Car emissions per km from the user's own Settings: litres per km times kg CO₂ per litre (the same factors the server uses for driving).
const FUEL_CO2_PER_L = { DIESEL: 2.68, LPG: 1.51 };
const PETROL_CO2_PER_L = 2.31;
const carKgPerKm = () => (settings.fuel_l_per_100km / 100) * (FUEL_CO2_PER_L[settings.fuel_type] ?? PETROL_CO2_PER_L);
const kmText = (km) => `${km >= 10 ? Math.round(km) : km > 0 ? km.toFixed(1) : 0} km`;

const KIND_LABEL = { bus: "Bus", rail: "Train", tram: "Light rail", ferry: "Ferry", mixed: "Mixed public transport", rideshare: "Uber", car: "Driving", carpool: "Shared ride", walk: "Walking", scooter: "E-scooter", ebike: "E-bike", bicycle: "Push bike" };
const CYCLE_MODES = ["scooter", "ebike", "bicycle"];
const isCycle = (o) => CYCLE_MODES.includes(o.mode);
function modeBreakdown(trips) {
  const by = new Map();
  trips.forEach((t) => { const kind = t.kind || "mixed", e = by.get(kind) || { kind, trips: 0, co2: 0 }; e.trips++; e.co2 += Math.max(0, t.co2_saved || 0); by.set(kind, e); });
  return [...by.values()].sort((a, b) => b.co2 - a.co2 || b.trips - a.trips);
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

// Goal ring: a stroke-dasharray arc, drawn once (no looping or animated stroke).
function goalRing(value, goal) {
  const frac = goal > 0 ? Math.min(1, value / goal) : 0, R = 52, C = 2 * Math.PI * R;
  return `<div class="ring-wrap"><svg class="ring" viewBox="0 0 128 128" role="img" aria-label="${kgShort(value)} of your ${goal} kg monthly goal">
      <circle class="ring-track" cx="64" cy="64" r="${R}"/>
      ${frac > 0 ? `<circle class="ring-bar${frac >= 1 ? " done" : ""}" cx="64" cy="64" r="${R}" stroke-dasharray="${(C * frac).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 64 64)"/>` : ""}</svg>
    <div class="ring-center"><b>${Math.round(frac * 100)}%</b><span>of ${goal} kg</span></div></div>`;
}

function goalCard(monthCo2) {
  const goal = settings.co2_goal_kg, left = Math.max(0, goal - monthCo2), reached = monthCo2 >= goal;
  return `<section class="goal-card${reached ? " reached" : ""}" aria-labelledby="goal-title">
    ${goalRing(monthCo2, goal)}
    <div class="goal-text"><p class="eyebrow" id="goal-title">Monthly CO₂ goal</p>
      <h3>${reached ? "Goal reached" : `${kgShort(left)} to go`}</h3>
      <p>${kgShort(monthCo2)} avoided this month, against a goal of ${goal} kg.</p>
      <button class="btn btn-text" data-action="open-settings">${I.gear(16)}Change goal</button></div></section>`;
}

function equivalentCard(monthCo2, allCo2) {
  const perKm = carKgPerKm(), fuel = (state.status?.fuel_types || {})[settings.fuel_type] || settings.fuel_type;
  return `<section class="equiv-card"><span class="equiv-ic">${I.car(22)}</span><div>
    <p class="equiv-big">Equivalent to <b>${kmText(monthCo2 / perKm)}</b> not driven this month</p>
    <p class="fine">${kmText(allCo2 / perKm)} not driven in total. Assumption: your car uses ${settings.fuel_l_per_100km} L/100 km of ${esc(fuel)} and each litre burned gives ${(FUEL_CO2_PER_L[settings.fuel_type] ?? PETROL_CO2_PER_L).toFixed(2)} kg of CO₂, so each km driven is about ${perKm.toFixed(3)} kg. This is an estimate from your Settings, not a measurement.</p></div></section>`;
}

function streakCard(trips) {
  const { streak, recent } = weeklyStreak(trips);
  const weekLabel = (w) => `Week of ${w.label}: ${w.state === "empty" ? "no trips logged" : w.state === "drove" ? `${plural(w.n, "trip")}, including driving` : `${plural(w.n, "trip")}, none by car`}`;
  return `<section class="streak-card"><div class="streak-head"><span class="streak-ic${streak ? " on" : ""}">${I.flame(22)}</span>
      <div><p class="eyebrow">Weekly streak</p><h3>${streak ? plural(streak, "week") : "No streak yet"}</h3></div></div>
    <p class="hint">${streak ? `You have logged trips without driving your own car for ${plural(streak, "week")} in a row.` : "Log a trip that is not by your own car to start a streak. A week counts when you log at least one trip and none of them are by car."}</p>
    <div class="streak-weeks" role="list" aria-label="Last eight weeks">${recent.map((w, i) => `<span class="wk ${w.state}${w.now ? " now" : ""}" role="listitem" aria-label="${esc(weekLabel(w))}"><i></i><small>${w.now ? "Now" : i % 2 ? w.label : ""}</small></span>`).join("")}</div>
    <p class="fine">Only trips you log count. Uber and shared rides are counted as not driving your own car.</p></section>`;
}

function breakdownCard(trips) {
  const rows = modeBreakdown(trips), total = rows.reduce((s, r) => s + r.co2, 0);
  return `<p class="section-header">CO₂ avoided by mode</p><div class="group"><div class="group-card">${rows.map((r) => row((KIND_ICON[r.kind] || I.route)(16), SEGMENT_COLOUR[r.kind] || "var(--accent)",
    `${esc(KIND_LABEL[r.kind] || r.kind)}<small>${plural(r.trips, "trip")} · ${total > 0 ? `${Math.round((r.co2 / total) * 100)}% of your CO₂ avoided` : "no CO₂ avoided"}</small><span class="share" aria-hidden="true"><i style="transform:scaleX(${total > 0 ? Math.max(0.02, r.co2 / total) : 0.02})"></i></span>`,
    valueSpan(kgShort(r.co2), true))).join("")}</div><p class="group-footer">Each logged trip is compared with driving the same journey alone in your car.${rows.some((r) => CYCLE_MODES.includes(r.kind)) ? " Scooter and bike trips count tailpipe emissions only; charging and manufacturing are not counted." : ""}</p></div>`;
}

function dashboardScreen() {
  const all = store.get("trips", []);
  const t = impactTotals(all), month = impactTotals(thisMonthTrips());
  const months = monthSeries();
  const share = t.trips ? Math.round((t.greenTrips / t.trips) * 100) : 0;
  const table = state.dashTable ? `<table class="data-table"><thead><tr><th>Month</th><th>Trips</th><th>CO₂ avoided</th><th>Saved</th></tr></thead><tbody>${months.map((m) => `<tr><td>${m.label}</td><td>${m.trips}</td><td>${kg(m.co2)}</td><td>${money(m.saved)}</td></tr>`).join("")}</tbody></table>` : "";
  const recent = all.slice(-8).reverse();
  return `
    ${navbar(true)}
    <div class="scroll">
      <p class="eyebrow">Impact</p>
      <h2 class="large-title">Your impact</h2>
      <p class="subtitle">Each trip you log is compared with driving the same journey alone in your car (fuel, tolls and parking where known).</p>
      <div class="kpis">
        <div class="kpi lead"><span>CO₂ avoided</span><b>${kg(t.co2)}</b><small>all time · ${kgShort(month.co2)} this month</small></div>
        <div class="kpi-row">
          <div class="kpi"><span>Saved</span><b>${money(t.saved)}</b><small>vs driving</small></div>
          <div class="kpi"><span>Low-car</span><b>${t.greenTrips}</b><small>of ${t.trips} logged</small></div>
          <div class="kpi"><span>Not driving</span><b>${share}%</b><small>of trips</small></div>
        </div>
      </div>
      ${goalCard(month.co2)}
      ${equivalentCard(month.co2, t.co2)}
      ${streakCard(all)}
      ${all.length ? `
        ${breakdownCard(all)}
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

// ── Weather page ─────────────────────────────────────────────────────────────
// Opened from the home widget or the side menu: now, the next 24 hours, 7 days and an interactive rain radar. The forecast comes from
// Open-Meteo through the server; the radar tiles come straight from RainViewer to the browser (free for personal and educational use).

const dayName = (date, i) => (i === 0 ? "Today" : new Intl.DateTimeFormat("en-AU", { weekday: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`)));
const localClock = (local) => (local ? timeOf(`${local.slice(0, 16)}:00+10:00`) : "–");
const uvLabel = (uv) => (uv < 3 ? "Low" : uv < 6 ? "Moderate" : uv < 8 ? "High" : uv < 11 ? "Very high" : "Extreme");
// Wind direction is where the wind comes from; the arrow points where it blows.
const windArrow = (deg) => (deg === null || deg === undefined ? "" : `<span class="wind-arrow" style="transform:rotate(${(deg + 180) % 360}deg)" aria-hidden="true">${I.arrowUp(12)}</span>`);
// The compass direction and its arrow get their own line in the Wind card, so a narrow card never pushes the arrow outside it.
const windDir = (c) => (c.wind_from ? `<span class="wind-dir">${windArrow(c.wind_dir)}From ${esc(c.wind_from)}</span>` : "");
const wxStat = (icon, label, value, sub = "") => `<div class="wxp-stat"><span class="wxp-stat-label">${icon}${label}</span><b>${value}</b>${sub ? `<small>${sub}</small>` : ""}</div>`;

function weatherTopInner() {
  const d = state.weatherDetail;
  if (!d) {
    return state.weatherDetailError ? `<div class="empty-card"><div class="empty-icon">${I.cloud(24)}</div><h3>Weather is unavailable</h3><p>${esc(state.weatherDetailError)}</p></div>`
      : `<div class="wx-skel" role="status" aria-label="Loading the weather"><div class="skeleton skel-block" style="height:96px"></div><div class="skeleton skel-block" style="height:150px"></div></div>`;
  }
  const c = d.current, today = d.days?.[0], now = d.hourly?.[0];
  const warn = d.bad && d.warning ? `<div class="wx-warn" role="alert">${I.alert(18)}<div><b>${esc(d.warning)}${simTag(d.simulated)}</b><span>Allow extra time if your trip includes walking between stops.</span></div></div>` : "";
  return `<section class="wxp-now">
      <div class="wx-temp">${Math.round(c.temp_c)}<sup>°</sup></div>
      <div class="wx-now"><strong>${esc(c.label)}</strong><span>Feels like ${Math.round(c.apparent_c)}°${today ? ` · High ${Math.round(today.max_c)}° · Low ${Math.round(today.min_c)}°` : ""}</span></div>
      <span class="wx-icon" style="--tone:${WX_TONE[c.icon] || "var(--accent)"}">${wxIcon(c.icon, 30)}</span>
    </section>
    ${warn}
    <div class="wxp-stats">
      ${wxStat(I.wind(14), "Wind", `${Math.round(c.wind_kmh)} km/h`, `${windDir(c)}Gusts ${Math.round(c.gust_kmh)} km/h`)}
      ${wxStat(I.droplet(14), "Humidity", c.humidity === null || c.humidity === undefined ? "–" : `${Math.round(c.humidity)}%`)}
      ${wxStat(I.rain(14), "Rain chance", now?.precip_prob === null || now?.precip_prob === undefined ? "–" : `${now.precip_prob}%`, today?.precip_mm ? `${today.precip_mm} mm today` : "No rain expected today")}
      ${wxStat(I.sun(14), "UV index", today?.uv === null || today?.uv === undefined ? "–" : `${Math.round(today.uv)}`, today?.uv === null || today?.uv === undefined ? "" : `${uvLabel(today.uv)} today`)}
      ${wxStat(I.sunrise(14), "Sunrise", localClock(today?.sunrise))}
      ${wxStat(I.sunset(14), "Sunset", localClock(today?.sunset))}
    </div>`;
}

function weatherRestInner() {
  const d = state.weatherDetail;
  if (!d) return "";
  const hours = (d.hourly || []).map((h, i) => `<div class="wxp-hour" role="listitem"><span>${i ? hourOf(h.time) : "Now"}</span>${wxIcon(h.icon, 22)}<b>${Math.round(h.temp_c)}°</b><i>${h.precip_prob >= 20 ? `${h.precip_prob}%` : ""}</i><small>${Math.round(h.wind_kmh)} km/h</small></div>`).join("");
  const days = d.days || [];
  const lo = Math.min(...days.map((x) => x.min_c)), hi = Math.max(...days.map((x) => x.max_c)), span = Math.max(1, hi - lo);
  const dayRows = days.map((x, i) => `<div class="wxp-day">
      <div class="wxp-day-main" aria-hidden="true"><span class="wxp-day-name">${dayName(x.date, i)}</span><span class="wxp-day-icon" style="color:${WX_TONE[x.icon] || "var(--text-main)"}">${wxIcon(x.icon, 20)}</span>
        <span class="wxp-day-rain">${x.precip_prob >= 20 ? `${x.precip_prob}%` : ""}</span>
        <span class="wxp-day-temps"><small>${Math.round(x.min_c)}°</small><span class="wxp-range"><i style="left:${((x.min_c - lo) / span) * 100}%;right:${100 - ((x.max_c - lo) / span) * 100}%"></i></span><b>${Math.round(x.max_c)}°</b></span></div>
      <div class="wxp-day-sub" aria-hidden="true">${esc(x.label)}${x.precip_mm ? ` · ${x.precip_mm} mm` : ""} · wind ${Math.round(x.wind_kmh)} km/h${x.wind_from ? ` ${esc(x.wind_from)}` : ""}${x.gust_kmh >= GUST_WARN_KMH ? `, gusts ${Math.round(x.gust_kmh)}` : ""}</div>
      <span class="visually-hidden">${dayName(x.date, i)}: ${esc(x.label)}, low ${Math.round(x.min_c)}, high ${Math.round(x.max_c)} degrees${x.precip_prob ? `, ${x.precip_prob}% chance of rain` : ""}, wind up to ${Math.round(x.wind_kmh)} km/h${x.wind_from ? ` from the ${x.wind_from}` : ""}.</span></div>`).join("");
  return `<p class="section-header">Next 24 hours</p>
    <div class="wxp-hours" role="list" aria-label="Next 24 hours">${hours}</div>
    <p class="section-header">Next 7 days</p>
    <div class="group"><div class="group-card">${dayRows}</div></div>
    <p class="fine">Forecast and next-hour rain by <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a> (CC BY 4.0)${d.simulated ? " · Simulated for demo mode" : ` · updated ${timeOf(d.fetched_at)}`}. Rain radar (the past two hours only) by <a href="https://www.rainviewer.com/" target="_blank" rel="noopener noreferrer">RainViewer</a>${demoOn() && d.simulated ? ", which stays live in demo mode" : ""}.</p>`;
}
const GUST_WARN_KMH = 50; // the same gust limit the server uses for bad-weather warnings

function weatherScreen() {
  return `${navbar(true)}<div class="scroll">
      <p class="eyebrow">${I.cloud(14)}Weather · ${esc(state.weatherPlace)}${state.weatherDetail?.simulated ? simTag(true) : ""}</p>
      <h2 class="large-title">Weather</h2>
      <div data-wxp-top>${weatherTopInner()}</div>
      <p class="section-header">Rain radar</p>
      ${radarBlock()}
      <div data-wxp-rest>${weatherRestInner()}</div>
    </div>`;
}
// Patches the forecast parts in place so the radar map is not rebuilt when the forecast arrives.
function renderWeatherPage() {
  if (state.screen !== "weather" || !currentPage) return;
  const eyebrow = currentPage.querySelector(".scroll > .eyebrow");
  if (eyebrow) eyebrow.innerHTML = `${I.cloud(14)}Weather · ${esc(state.weatherPlace)}${state.weatherDetail?.simulated ? simTag(true) : ""}`;
  setHTML(currentPage.querySelector("[data-wxp-top]"), weatherTopInner());
  setHTML(currentPage.querySelector("[data-wxp-rest]"), weatherRestInner());
  // The next-hour steps arrive with the forecast, so the time slider gains its forecast steps here (unless it is playing).
  setHTML(currentPage.querySelector("[data-radar-next]"), nextHourInner());
  const bar = currentPage.querySelector("[data-radar-bar]");
  if (bar && !radar.playing && radar.frames.length) bar.innerHTML = radarBarInner();
  if (radar.frames.length) showRadarFrame(radar.index);
  const entry = radarEntry();
  if (entry && state.weatherAt) { entry.here?.setPosition(toLatLng(state.weatherAt)); if (!entry.moved) entry.map.setCenter(toLatLng(state.weatherAt)); }
}
async function loadWeatherDetail() {
  state.weatherDetailError = null;
  const { c, place } = await weatherCoords();
  state.weatherPlace = place;
  state.weatherAt = c;
  const demo = demoOn() && state.demo.weather !== "live" ? `&demo=${state.demo.weather}` : "";
  try {
    const r = await fetch(`/api/weather?lat=${c[0]}&lng=${c[1]}&detail=1${demo}`);
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.current) throw new Error(data.error || "Weather is unavailable right now.");
    state.weatherDetail = data;
  } catch (error) { if (!state.weatherDetail) state.weatherDetailError = error.message; }
  renderWeatherPage();
}

// Rain radar: RainViewer's last two hours of composite radar, one frame every 10 minutes. Since 1 January 2026 RainViewer serves tiles
// only up to zoom 7 and in one colour scheme (Universal Blue), so closer zooms enlarge the zoom-7 tile instead of asking for a missing one.
// The newest frame shows first; Play loads the older frames (RainViewer allows about 100 tile requests a minute from one address).
// RainViewer stopped serving future (nowcast) frames to free users on 1 January 2026, so the next hour comes from Open-Meteo instead: its
// predicted rain in 15-minute steps (a model forecast, interpolated from hourly data for Australia) follows "Latest" on the time slider.
// During those steps the map keeps the latest radar frame and the bar and the chart below say "Forecast"; model data is never drawn as radar.
const RADAR_API = "https://api.rainviewer.com/public/weather-maps.json";
const RADAR_MAX_ZOOM = 7;
const radar = { host: "", frames: [], index: 0, playing: false, timer: null, error: null, loadedAt: 0 };
// The next hour's steps that have not ended yet (a forecast kept after a failed refresh, or served offline, can be old).
const upcomingSteps = () => (state.weatherDetail?.next_hour?.steps || []).filter((s) => Date.parse(s.end) > Date.now())
  .map((s) => ({ ...s, precip_mm: Number(s.precip_mm) || 0, precip_prob: Number.isFinite(Number(s.precip_prob)) && s.precip_prob !== null ? Math.round(Number(s.precip_prob)) : null }));
const radarForecast = () => (radar.frames.length ? upcomingSteps() : []);
const radarCount = () => radar.frames.length + radarForecast().length;
const radarStep = (i = radar.index) => radarForecast()[i - radar.frames.length] || null;
const radarPlayLabel = () => (radar.playing ? "Pause the radar" : radarForecast().length ? "Play the last two hours of radar and the next hour's forecast" : "Play the last two hours of radar");
function radarBlock() {
  return `<div class="map-wrap radar-wrap" data-map-wrap="__radar"><div class="map radar-map" data-map="__radar"><div class="skeleton map-skeleton" role="status" aria-label="Loading the rain radar"></div></div>
      <span class="radar-fc-tag" data-radar-tag ${radarStep() ? "" : "hidden"}>${I.clock(14)}Forecast · map shows the latest radar</span>
      <div class="map-controls">
        <button data-action="map-zoom" data-delta="1" aria-label="Zoom in">${I.plus(18)}</button>
        <button data-action="map-zoom" data-delta="-1" aria-label="Zoom out">${I.minus(18)}</button>
        <button data-action="map-expand" aria-label="Expand map">${I.expand()}</button>
      </div>
      <div class="radar-bar" data-radar-bar>${radarBarInner()}</div></div>
    <div class="map-legend radar-legend"><span><i class="radar-scale"></i>Light to heavy rain</span><span>Past 2 hours</span><span>Radar: <a href="https://www.rainviewer.com/" target="_blank" rel="noopener noreferrer">RainViewer</a></span></div>
    <div data-radar-next>${nextHourInner()}</div>`;
}
// [kind, clock] for the time label: "Latest" or "Forecast" sits above the clock time, so the slider keeps its width on a phone.
function radarTimeParts() {
  const s = radarStep();
  if (s) return ["Forecast", timeOf(s.end)];
  const f = radar.frames[radar.index];
  return f ? [radar.index === radar.frames.length - 1 ? "Latest" : "", timeOf(new Date(f.time * 1000).toISOString())] : ["", ""];
}
const radarTime = () => radarTimeParts().filter(Boolean).join(" · ");
const radarTimeInner = () => { const [kind, clock] = radarTimeParts(); return `${kind ? `<small>${kind}</small>` : ""}${clock}`; };
const radarValueText = () => { const s = radarStep(); return s ? `Forecast rain from ${timeOf(s.start)} to ${timeOf(s.end)}: ${rainAmount(s.precip_mm)}. A model forecast, not radar.` : radarTime(); };
function radarBarInner() {
  if (radar.error) return `<span class="radar-time">${esc(radar.error)}</span>`;
  if (!radar.frames.length) return skelBar("Loading the radar frames", 140);
  return `<button class="radar-play" data-action="radar-play" aria-pressed="${radar.playing}" aria-label="${radarPlayLabel()}">${radar.playing ? I.pause(16) : I.play(16)}</button>
    <input type="range" class="radar-slider" min="0" max="${radarCount() - 1}" step="1" value="${radar.index}" data-radar-slider aria-label="Radar time" aria-valuetext="${esc(radarValueText())}">
    <span class="radar-time${radarStep() ? " is-forecast" : ""}" data-radar-time>${radarTimeInner()}</span>`;
}

// The next hour's predicted rain under the radar: one bar per step (rain in that step, on a scale of at least 1 mm), with the chance of
// rain beneath. The step chosen on the time slider is highlighted. A sentence and a hidden list give the same numbers as text.
const rainAmount = (mm) => (mm >= 0.1 ? `${mm.toFixed(1)} mm` : "no rain");
const chanceText = (p) => (p === null ? "" : `${p}%`);
function nextHourInner() {
  const nh = state.weatherDetail?.next_hour, steps = upcomingSteps();
  if (!steps.length) return "";
  const top = Math.max(1, ...steps.map((s) => s.precip_mm)), chosen = radarStep(), simulated = nh.source === "Simulated";
  const wet = steps.find((s) => s.precip_mm >= 0.1), total = steps.reduce((sum, s) => sum + s.precip_mm, 0);
  const summary = wet ? `Rain forecast ${Date.parse(wet.start) <= Date.now() ? "now" : `from ${timeOf(wet.start)}`}, about ${total.toFixed(1)} mm in the next hour.` : "No rain forecast for the next hour.";
  const bars = steps.map((s, n) => `<div class="nh-step${chosen && n === radar.index - radar.frames.length ? " on" : ""}">
      <span class="nh-mm">${s.precip_mm >= 0.1 ? s.precip_mm.toFixed(1) : ""}</span>
      <span class="nh-track"><i style="height:${s.precip_mm >= 0.1 ? Math.max(6, (s.precip_mm / top) * 100) : 0}%"></i></span>
      <span class="nh-time">${timeOf(s.end)}</span><small>${chanceText(s.precip_prob) || "–"}</small></div>`).join("");
  const list = steps.map((s) => `<li>${timeOf(s.start)} to ${timeOf(s.end)}: ${rainAmount(s.precip_mm)}${s.precip_prob === null ? "" : `, ${s.precip_prob}% chance`}</li>`).join("");
  const how = simulated ? "Simulated for demo mode, not a forecast."
    : `A model forecast from <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a>, not radar. For Australia ${nh.step_minutes === 15 ? "its 15-minute steps are interpolated from hourly model data" : "only an hourly value is available"} (native 15-minute data covers only Central Europe and North America), so the timing within the hour is approximate.`;
  return `<section class="nh-card" aria-labelledby="nh-title">
      <div class="nh-head"><h3 id="nh-title">Next hour · forecast${simTag(simulated)}</h3><span>Rain, mm</span></div>
      <p class="nh-summary">${summary}</p>
      <div class="nh-chart" aria-hidden="true">${bars}</div>
      <ul class="visually-hidden">${list}</ul>
      <p class="nh-foot">Bars end at the time shown; the percentage is the chance of rain. ${how}</p>
    </section>`;
}
function radarEntry() { for (const entry of maps.values()) if (entry.radar) return entry; return null; }
async function loadRadarFrames() {
  if (radar.frames.length && Date.now() - radar.loadedAt < 5 * 60000) return;
  radar.error = null;
  try {
    const r = await fetch(RADAR_API, { cache: "no-store" });
    const data = await r.json();
    const host = typeof data.host === "string" && /^https:\/\/[a-z0-9.-]+\.rainviewer\.com$/i.test(data.host) ? data.host : null;
    const frames = (data.radar?.past || []).filter((f) => Number.isFinite(f.time) && /^\/v2\/radar\/[A-Za-z0-9]+$/.test(f.path || ""));
    if (!host || !frames.length) throw new Error("bad response");
    Object.assign(radar, { host, frames: frames.slice(-13), index: Math.min(frames.length, 13) - 1, error: null, loadedAt: Date.now() });
  } catch { radar.error = "The rain radar is unavailable right now."; }
}
// A custom map type rather than ImageMapType, so a tile above zoom 7 can show the right part of its enlarged zoom-7 parent.
function radarLayer(frame, i) {
  return {
    tileSize: new GM.Size(256, 256), maxZoom: 12, name: "Rain radar", alt: "Rain radar",
    getTile(coord, zoom, doc) {
      const tile = doc.createElement("div");
      tile.className = "radar-tile";
      tile.dataset.f = String(i);
      const n = 2 ** zoom;
      if (coord.y < 0 || coord.y >= n) return tile;
      const z = Math.min(zoom, RADAR_MAX_ZOOM), f = 2 ** (zoom - z), x = ((coord.x % n) + n) % n;
      const img = doc.createElement("img");
      img.alt = "";
      img.decoding = "async";
      img.src = `${radar.host}${frame.path}/256/${z}/${Math.floor(x / f)}/${Math.floor(coord.y / f)}/2/1_1.png`;
      img.style.cssText = `width:${256 * f}px;height:${256 * f}px;left:${-(x % f) * 256}px;top:${-(coord.y % f) * 256}px`;
      img.onerror = () => img.remove();
      tile.appendChild(img);
      return tile;
    },
    releaseTile() {},
  };
}
function addRadarFrame(entry, i) {
  if (entry.layers.has(i) || !radar.frames[i]) return;
  const layer = radarLayer(radar.frames[i], i);
  entry.layers.set(i, layer);
  entry.map.overlayMapTypes.push(layer);
}
// A forecast step keeps the latest radar frame on the map and shows the "Forecast" tag, so model rain is never drawn as radar.
function showRadarFrame(i) {
  const entry = radarEntry();
  radar.index = Math.max(0, Math.min(radarCount() - 1, i));
  const frame = Math.min(radar.index, radar.frames.length - 1), forecast = !!radarStep();
  if (entry && frame >= 0) { addRadarFrame(entry, frame); entry.map.getDiv().dataset.frame = String(frame); }
  const tag = currentPage?.querySelector("[data-radar-tag]");
  if (tag) tag.hidden = !forecast;
  const bar = currentPage?.querySelector("[data-radar-bar]");
  const time = bar?.querySelector("[data-radar-time]"), slider = bar?.querySelector("[data-radar-slider]");
  if (time) { time.innerHTML = radarTimeInner(); time.classList.toggle("is-forecast", forecast); }
  if (slider) { slider.max = String(radarCount() - 1); if (Number(slider.value) !== radar.index) slider.value = String(radar.index); slider.setAttribute("aria-valuetext", radarValueText()); }
  currentPage?.querySelectorAll("[data-radar-next] .nh-step").forEach((el, n) => el.classList.toggle("on", n === radar.index - radar.frames.length));
}
function radarPlay(on = !radar.playing) {
  const entry = radarEntry();
  clearInterval(radar.timer);
  radar.playing = on && !!entry && radarCount() > 1;
  if (radar.playing) {
    radar.frames.forEach((_, i) => addRadarFrame(entry, i));
    if (radar.index >= radarCount() - 1) showRadarFrame(0);
    let hold = 0;
    radar.timer = setInterval(() => {
      if (document.hidden) return;
      if (radar.index >= radarCount() - 1) { if (++hold < 3) return; hold = 0; showRadarFrame(0); } else showRadarFrame(radar.index + 1);
    }, 600);
  }
  const bar = currentPage?.querySelector("[data-radar-bar]");
  if (bar) { bar.innerHTML = radarBarInner(); showRadarFrame(radar.index); }
}
function buildRadarMap(el) {
  el.replaceChildren();
  const map = makeGoogleMap(el);
  const c = state.weatherAt || state.biasCoords || BRISBANE;
  map.setOptions({ center: toLatLng(c), zoom: 8, minZoom: 4, maxZoom: 11 });
  const entry = { map, bounds: new GM.LatLngBounds(), lines: [], markers: [], vehicles: new Map(), optionId: null, radar: true, layers: new Map(), moved: false };
  entry.restyle = () => map.setOptions({ styles: mapStyles() });
  entry.here = new GM.Marker({ position: toLatLng(c), map, icon: mapIcon("here"), clickable: false, title: "Weather location" });
  entry.markers.push(entry.here);
  entry.dispose = () => { clearInterval(radar.timer); radar.playing = false; };
  map.addListener("dragstart", () => { entry.moved = true; });
  maps.set(el, entry);
  loadRadarFrames().then(() => {
    if (maps.get(el) !== entry) return;
    if (!radar.error) showRadarFrame(radar.frames.length - 1);
    const bar = el.closest(".map-wrap")?.querySelector("[data-radar-bar]");
    if (bar) bar.innerHTML = radarBarInner();
  });
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
    ${navbar(true)}
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
        : `<div class="empty-card"><div class="empty-icon" style="--tone:var(--accent)">${I.users(24)}</div><h3>No shared rides yet</h3><p>Be the first. Anyone searching a similar trip on this Reroute server will see your post.</p></div>`}
      ${p?.start && p?.end ? `<button class="btn btn-primary" data-action="open-ride-form" style="margin:8px 0 24px">Offer seats or start a split Uber</button>` : ""}
      ${notice("Prototype: posts are visible to everyone using this Reroute server and expire 30 minutes after departure. Don't post phone numbers or exact addresses. Meet somewhere public and trust your judgement.")}
    </div>`;
}

function rideFormSheet() {
  const p = state.plan;
  const driveCost = p?.baseline?.cost;
  return `<div class="grabber"><span></span></div>
    <div class="sheet-head"><h3 id="sheet-title">Share a ride</h3>${sheetClose()}</div>
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

// ── Saved place editor (opens above Settings) ────────────────────────────────

function placeFoot() {
  const d = state.placeDraft;
  return `<button class="btn btn-primary" data-action="save-place">${d.isNew ? "Add place" : "Save changes"}</button>
    ${d.isNew ? "" : `<button class="btn btn-secondary delete-btn${d.confirmDelete ? " confirm" : ""}" data-action="delete-place">${I.trash(16)}${d.confirmDelete ? "Tap again to delete" : "Delete place"}</button>`}`;
}
function placeSheet() {
  const d = state.placeDraft;
  return `<div class="grabber"><span></span></div>
    <div class="sheet-head"><h3 id="sheet-title">${d.isNew ? "Add a place" : "Edit place"}</h3>${sheetClose()}</div>
    <div class="sheet-scroll">
      <p class="hint" style="margin-bottom:16px">Give it a short name, like Gym or Mum's, and find its address. It will sit next to Home and Work/Uni when you plan a trip or tap Journey disrupted?.</p>
      <div class="group"><div class="group-card">
        <div class="row field-row"><span class="row-icon" style="--tone:var(--teal)">${I.star(18)}</span><input type="text" data-draft="name" maxlength="${PLACE_NAME_MAX}" value="${esc(d.name)}" placeholder="Name, e.g. Gym or Mum's" aria-label="Place name" autocomplete="off"></div>
        <div class="row field-row"><span class="row-icon" style="--tone:var(--error)">${I.pin(18)}</span><input type="text" data-draft="address" ${acAttrs("draft.address")} value="${esc(d.address)}" placeholder="Address" aria-label="Place address"></div>
      </div></div>
      <div data-place-msg>${d.error ? notice(esc(d.error), "error") : ""}</div>
    </div>
    <div class="sheet-foot" data-place-foot>${placeFoot()}</div>`;
}
function openPlaceSheet() {
  openSheet(placeSheet());
  sheetEl.dataset.place = "1";
  sheetEl.classList.add("above-settings");
  if (state.placeDraft.isNew) sheetEl.querySelector('[data-draft="name"]')?.focus({ preventScroll: true });
}
const newPlaceId = () => `p${(crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}${Math.random().toString(16).slice(2)}`).replace(/[^A-Za-z0-9]/g, "").slice(0, 10)}`;
function savePlace() {
  const d = state.placeDraft;
  if (!d) return;
  const name = d.name.trim().slice(0, PLACE_NAME_MAX), address = d.address.trim().slice(0, PLACE_ADDRESS_MAX), key = name.toLowerCase();
  const problem = !name ? "Give the place a name."
    : address.length < 3 ? "Enter an address for this place."
    : FIXED_PLACES.some(([, fixed]) => fixed.toLowerCase() === key) ? "Home and Work/Uni already exist. Choose a different name."
    : customPlaces().some((p) => p.id !== d.id && p.name.toLowerCase() === key) ? "You already have a place with that name."
    : d.isNew && customPlaces().length >= MAX_CUSTOM_PLACES ? `You can add up to ${MAX_CUSTOM_PLACES} places. Delete one first.` : null;
  if (problem) {
    d.error = problem;
    const slot = sheetEl?.querySelector("[data-place-msg]");
    if (slot) slot.innerHTML = notice(esc(problem), "error");
    return;
  }
  const isNew = d.isNew;
  if (isNew) settings.saved_places.push({ id: newPlaceId(), name, address, place_id: d.place_id || null });
  else { const p = savedPlace(d.id); if (p) Object.assign(p, { name, address, place_id: d.place_id || null }); }
  saveSettings();
  closeSheet();
  rerenderSettings();
  toast(isNew ? `Added ${name}.` : `Saved ${name}.`);
}
// Two taps to delete: the first arms the button, the second removes the place.
function deletePlace() {
  const d = state.placeDraft;
  if (!d || d.isNew) return;
  if (!d.confirmDelete) {
    d.confirmDelete = true;
    const foot = sheetEl?.querySelector("[data-place-foot]");
    if (foot) foot.innerHTML = placeFoot();
    return;
  }
  settings.saved_places = settings.saved_places.filter((p) => p.id !== d.id);
  saveSettings();
  const name = d.name;
  closeSheet();
  rerenderSettings();
  toast(`Deleted ${name}.`);
}

// ── Alerts sheet ─────────────────────────────────────────────────────────────

function alertsBody() {
  const q = (state.alertQuery || "").trim().toUpperCase();
  const list = (state.alerts?.alerts || []).filter((a) => a.disruptive && (!q || a.lines.some((l) => l.includes(q)) || a.header.toUpperCase().includes(q)));
  if (state.alertsError && !state.alerts) return notice(esc(state.alertsError), "error");
  if (!state.alerts) return `<div class="group" role="status" aria-label="Loading alerts"><div class="group-card">${[0, 1, 2].map(() => `<div class="row top" aria-hidden="true"><div class="skel-stack" style="flex:1"><div class="skeleton skel-line w-30"></div><div class="skeleton skel-line w-100"></div><div class="skeleton skel-line sm w-60"></div></div></div>`).join("")}</div></div>`;
  if (!list.length) return `<div class="empty-card"><div class="empty-icon" style="--tone:var(--success)">${I.checkCircle(24)}</div><h3>No matching alerts</h3><p>Nothing disruptive is reported for that line right now.</p></div>`;
  return `<div class="group"><div class="group-card">${list.slice(0, 40).map((a) => alertRow(a)).join("")}</div></div>`;
}

// One alert: line tags, effect and headline, and the description clamped to a few lines. "Show more" appears only when
// the text is actually cut off (revealMore measures it once the row is on screen) and opens the full alert in a pop-up.
function alertRow(a, tags = true) {
  const lines = tags && a.lines.length ? `<span class="alert-tags">${a.lines.slice(0, 6).map((l) => `<span class="line-tag">${esc(l)}</span>`).join("")}${a.lines.length > 6 ? `<span class="line-tag">+${a.lines.length - 6}</span>` : ""}</span>` : "";
  return `<div class="row top alert-row"><span class="row-label">${lines}<span class="alert-head"><b>${esc(a.effect)}:</b> ${esc(a.header)}${a.simulated ? `<span class="tag">Simulated</span>` : ""}</span>${a.description ? `<small class="alert-desc">${esc(a.description)}</small>` : ""}<button class="more-link" data-action="alert-more" data-id="${esc(a.id)}" hidden>Show more</button></span></div>`;
}
function revealMore(root) {
  root?.querySelectorAll(".alert-row").forEach((rowEl) => {
    const cut = [...rowEl.querySelectorAll(".alert-head, .alert-desc")].some((el) => el.scrollHeight > el.clientHeight + 1);
    rowEl.querySelector(".more-link").hidden = !cut;
  });
}
// Live alerts and the alerts attached to route options (which include simulated demo alerts).
const findAlert = (id) => (state.alerts?.alerts || []).find((a) => a.id === id) || (state.plan?.options || []).flatMap((o) => o.realtime?.alerts || []).find((a) => a.id === id);
function alertPopup(a) {
  const link = /^https:\/\/[^\s"'<>]+$/i.test(a.url || "") ? a.url : "";
  return `<div class="grabber"><span></span></div>
    <div class="sheet-head"><h3 id="popup-title">${esc(a.effect)}</h3><button class="icon-btn" data-action="close-popup" aria-label="Close">${I.x(18)}</button></div>
    <div class="sheet-scroll alert-full">
      ${a.lines.length ? `<div class="alert-tags">${a.lines.map((l) => `<span class="line-tag">${esc(l)}</span>`).join("")}</div>` : ""}
      <h4>${esc(a.header)}${a.simulated ? `<span class="sim-tag">Simulated</span>` : ""}</h4>
      ${a.cause ? `<p class="fine">Cause: ${esc(a.cause)}</p>` : ""}
      ${a.description ? `<p>${esc(a.description).replace(/\n+/g, "<br>")}${a.description.length >= 600 ? "…" : ""}</p>` : `<p class="hint">Translink gave no further details for this alert.</p>`}
      ${a.description.length >= 600 ? `<p class="fine">Long alerts are shortened to 600 characters. The full notice is on Translink.</p>` : ""}
      ${link ? `<a class="btn btn-secondary" href="${esc(link)}" target="_blank" rel="noopener noreferrer">More on Translink ${I.external(16)}</a>` : ""}
      <p class="fine">Source: ${a.simulated ? "simulated for demo mode" : "Translink SEQ GTFS-Realtime"}. Check signs at the stop and Translink before you travel.</p>
    </div>`;
}

function alertsSheet() {
  return `<div class="grabber"><span></span></div>
    <div class="sheet-head"><h3 id="sheet-title">Translink alerts</h3>${sheetClose()}</div>
    <div class="sheet-scroll">
      <div class="group"><div class="group-card"><div class="row field-row"><span class="chev">${I.search(18)}</span><input type="text" data-alert-query value="${esc(state.alertQuery || "")}" placeholder="Search for a specific line, e.g. 412" aria-label="Search alerts for a specific line"></div></div></div>
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
    : `<div class="row"><span class="row-label">${state.fuelPreview ? `Now about <b>$${state.fuelPreview.price.toFixed(2)}/L</b><small>Average of ${state.fuelPreview.stations} stations nearby · ${googleMapsAttribution()}</small>` : "Checked near your start point when you search"}</span></div>`;
  return `
    ${navbar(null, `${homeIfAway()}<button class="nav-action" data-action="close-settings">Done</button>`)}
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
        ${modeRow("modes.scooter", I.scooter(18), "var(--seg-scooter)", "E-scooter", "Off by default · Google cycling route at an assumed 15 km/h · access and hire prices are not checked", s.modes.scooter)}
        ${modeRow("modes.ebike", I.bike(18), "var(--seg-bike)", "E-bike", "Off by default · Google cycling route at an assumed 20 km/h · access and hire prices are not checked", s.modes.ebike)}
        ${modeRow("modes.bicycle", I.bike(18), "var(--seg-bike)", "Push bike", `Off by default · Google's cycling time, only for trips up to ${PUSH_BIKE_MAX_KM} km`, s.modes.bicycle)}
      </div>${s.modes.scooter || s.modes.ebike ? "" : `<p class="group-footer">E-scooter and e-bike options show an estimated hire cost and buttons to open Lime or Neuron.</p>`}</div>
      ${s.modes.scooter || s.modes.ebike ? `<p class="section-header">Shared hire prices (assumed)</p>
      <div class="group"><div class="group-card">
        ${[["scooter", "E-scooter"], ["ebike", "E-bike"]].filter(([k]) => s.modes[k]).map(([k, l]) => `
        <div class="row"><span class="row-label">${l} unlock fee ($)</span><input type="number" min="0" max="10" step="0.05" data-setting-number="hire.${k}.unlock" value="${s.hire[k].unlock}" aria-label="${l} unlock fee in dollars"></div>
        <div class="row"><span class="row-label">${l} price per minute ($)</span><input type="number" min="0" max="3" step="0.01" data-setting-number="hire.${k}.per_min" value="${s.hire[k].per_min}" aria-label="${l} price per minute in dollars"></div>`).join("")}
      </div><p class="group-footer">Used for the estimated hire cost: the unlock fee plus the price per minute times the riding time at the assumed speed. Lime and Neuron show their current Brisbane prices only in their apps, so the defaults ($1 to unlock and 45c a minute) are assumptions; check the apps and enter what they show. Passes and discounts are not included.</p></div>` : ""}

      <p class="section-header">Your car</p>
      <div class="group"><div class="group-card">
        ${row(I.car(18), "var(--text-muted)", "Fuel use", stepper("fuel_l_per_100km", s.fuel_l_per_100km, `${s.fuel_l_per_100km} L/100 km`, 3, 25))}
        <div class="row"><span class="row-icon" style="--tone:var(--warning)">${I.dollar(18)}</span><span class="row-label">Fuel type</span><select data-setting-select="fuel_type" aria-label="Fuel type">${Object.entries(fuelTypes).map(([k, l]) => `<option value="${k}" ${k === s.fuel_type ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></div>
        <div class="row"><span class="row-label">Fuel price</span>${segmented("fuel_price_mode", s.fuel_price_mode, [["auto", "Live average"], ["manual", "My price"]])}</div>
        ${s.fuel_price_mode === "manual" ? `<div class="row"><span class="row-label">My price ($/L)</span><input type="number" min="0.5" max="5" step="0.01" data-setting-number="fuel_price" value="${s.fuel_price}" aria-label="Fuel price in dollars per litre"></div>` : fuelPreview}
        <div class="row"><span class="row-icon" style="--tone:var(--accent)">${I.parking(18)}</span><span class="row-label">Typical parking cost estimate<small>Per trip · leave empty if unknown</small></span><input type="number" min="0" max="200" step="0.5" data-setting-number="parking_cost" value="${s.parking_cost ?? ""}" placeholder="$" aria-label="Typical parking cost estimate"></div>
      </div><p class="group-footer">Google Places does not return car-park prices. This personal estimate is added to driving costs; it is not a quote for a listed car park.</p></div>

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
        ${FIXED_PLACES.map(([id, name]) => `<div class="row field-row"><span class="row-icon" style="--tone:${id === "home" ? "var(--accent)" : "var(--warning)"}">${I[placeGlyph({ id })](18)}</span><span class="place-field"><span class="place-name" aria-hidden="true">${name}</span><input type="text" data-place-text="${id}" ${acAttrs(`places.${id}`)} value="${esc(savedPlace(id).address)}" placeholder="${id === "home" ? "Home address" : "Work or uni address"}" aria-label="${id === "home" ? "Home address" : "Work or uni address"}"></span></div>`).join("")}
        ${customPlaces().map((p) => `<button class="row" data-action="edit-place" data-id="${esc(p.id)}" aria-label="Edit ${esc(p.name)}"><span class="row-icon" style="--tone:var(--teal)">${I.star(18)}</span><span class="row-label">${esc(p.name)}<small>${esc(p.address)}</small></span><span class="chev">${I.edit(16)}</span></button>`).join("")}
        <button class="row" data-action="add-place" ${customPlaces().length >= MAX_CUSTOM_PLACES ? "disabled" : ""}><span class="row-icon" style="--tone:var(--success)">${I.plus(18)}</span><span class="row-label">Add a place<small>${customPlaces().length >= MAX_CUSTOM_PLACES ? `You have added the most you can (${MAX_CUSTOM_PLACES})` : "A gym, a friend's home or anywhere you go often"}</small></span></button>
      </div><p class="group-footer">Used by Journey disrupted?, the quick-fill buttons when planning a trip, and address suggestions. Tap an added place to edit or delete it. Stored only on this device.</p></div>

      <p class="section-header">Live disruptions</p>
      <div class="group"><div class="group-card">
        <div class="row"><span class="row-icon" style="--tone:var(--error)">${I.signal(18)}</span><span class="row-label">Watch my chosen trip<small>Alerts you in the app if Translink posts a disruption</small></span>${toggle("watch", s.watch, "Watch my chosen trip")}</div>
      </div></div>

      ${offlineSettings()}

      <p class="section-header">Directions</p>
      <div class="group"><div class="group-card">
        <div class="row"><span class="row-icon" style="--tone:var(--accent)">${I.volume(18)}</span><span class="row-label">Voice prompts<small>Speak each turn aloud during live directions</small></span>${toggle("voice", s.voice, "Voice prompts")}</div>
      </div></div>

      <p class="section-header">App</p>
      <div class="group"><div class="group-card">
        ${canInstall() ? `<button class="row" data-action="settings-install"><span class="row-icon" style="--tone:var(--accent)">${I.download(18)}</span><span class="row-label">Install Reroute<small>${standalone() ? "" : "Add it to your home screen"}</small></span><span class="chev">${I.chevronRight()}</span></button>` : standalone() ? `<div class="row"><span class="row-icon" style="--tone:var(--success)">${I.checkCircle(18)}</span><span class="row-label">Installed<small>Reroute is running as an app</small></span></div>` : ""}
        <button class="row" data-action="settings-share"><span class="row-icon" style="--tone:var(--teal)">${I.qr(18)}</span><span class="row-label">Share this app<small>QR code and link</small></span><span class="chev">${I.chevronRight()}</span></button>
        <button class="row" data-action="settings-demo"><span class="row-icon" style="--tone:var(--violet)">${I.flask(18)}</span><span class="row-label">Demo mode<small>Simulate weather, disruptions and traffic for a walkthrough</small></span>${valueSpan(demoOn() ? "On" : "Off")}<span class="chev">${I.chevronRight()}</span></button>
      </div><p class="group-footer">Background alerts need HTTPS${isIos() ? ". On iPhone, add Reroute to your Home Screen first" : ""}.</p></div>

      <p class="section-header">Impact goal</p>
      <div class="group"><div class="group-card">
        ${row(I.leaf(18), "var(--success)", "Monthly CO₂ goal<small>CO₂ avoided by the trips you log</small>", stepper("co2_goal_kg", s.co2_goal_kg, `${s.co2_goal_kg} kg`, 1, 200, "Monthly CO₂ goal in kilograms"))}
      </div><p class="group-footer">Drives the progress ring on the Impact Dashboard. The default of 10 kg a month is a starting point the team chose, not a recommended target.</p></div>

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
  enhanceClear(settingsEl);
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
  enhanceClear(settingsEl);
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



const SCREENS = { "offline-area": offlineAreaScreen, home: homeScreen, journey: journeyScreen, results: resultsScreen, next: nextScreen, panic: panicScreen, nav: navScreen, dashboard: dashboardScreen, rides: ridesScreen, weather: weatherScreen, terms: termsScreen, privacy: privacyScreen, sources: sourcesScreen };
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
  enhanceClear(page);
  return page;
}

function navigate(screen, direction = "forward", syncUrl = true) {
  if (transitioning || screen === state.screen) return;
  const legalPath = { terms: "/terms", privacy: "/privacy", sources: "/about" }[screen];
  // Legal pages get their own address and history entry; leaving one adds an entry for "/" so the browser Back button returns to it.
  if (syncUrl && legalPath) history.pushState({ screen }, "", legalPath);
  else if (syncUrl && location.pathname !== "/") history.pushState({ screen }, "", "/");
  if (state.screen === "nav") navStop();
  if (screen === "panic") startPanicLocate();
  if (screen === "weather") loadWeatherDetail();
  if (state.screen === "offline-area") disposeAreaMap();
  collapseExpanded();
  closeSheet(true);
  closeDialog();
  if (menuEl) closeMenu(null, false);
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
  if (screen === "offline-area") buildAreaMap();
  bindCharts(incoming);
  setTimeout(() => {
    outgoing?.remove();
    incoming.classList.remove(inCls);
    transitioning = false;
    maps.forEach(resizeMap);
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
  // A legal page this app opened has its own history entry: use the browser's Back so Back and Forward stay in step.
  if (({ terms: 1, privacy: 1, sources: 1 })[state.screen] && history.state?.screen === state.screen) return history.back();
  if (state.stack.length < 2) return navigate("home", "back");
  const target = state.stack[state.stack.length - 2];
  navigate(target, state.screen === "panic" || state.screen === "nav" ? "down" : "back");
}

window.addEventListener("popstate", () => {
  const target = ({ "/terms": "terms", "/privacy": "privacy", "/about": "sources" })[location.pathname] || "home";
  if (target !== state.screen) navigate(target, "back", false);
});

function rerender() {
  if (!currentPage) { currentPage = makePage(state.screen); viewport.appendChild(currentPage); }
  else {
    const scroller = currentPage.querySelector(".scroll");
    const top = scroller ? scroller.scrollTop : 0;
    const focused = document.activeElement?.dataset?.field;
    currentPage.className = pageClass(state.screen);
    currentPage.innerHTML = SCREENS[state.screen]();
    enhanceClear(currentPage);
    const next = currentPage.querySelector(".scroll");
    if (next) next.scrollTop = top;
    if (focused) currentPage.querySelector(`[data-field="${focused}"]`)?.focus({ preventScroll: true });
  }
  mountMaps(currentPage);
  bindCharts(currentPage);
  cleanMaps();
}

// Google Maps is loaded only when a map is opened, with the separate browser key from /api/config (the server key is never sent to the browser).
// Any failure (no key, no connection, a rejected key) leaves a calm message in the map slot; the steps, results and directions text keep working.
// A failed load is not retried for 30 seconds so re-renders do not hammer the server; a rejected key is not retried until the page reloads.
// Every map call goes through GM: Google Maps online, or the offline map in offline.js (the same subset of the API, drawn from the
// downloaded OpenStreetMap area) while "Use Offline Maps" is on. Google map content is never stored for offline use.
let GM = null;
let googleMapsPromise = null;
let mapsFailure = null;
const MAPS_LOAD_TIMEOUT_MS = 15000;
function loadGoogleMaps() {
  if (state.offline) {
    if (!window.RerouteOffline) return Promise.reject(new Error("The offline map could not start."));
    GM = RerouteOffline.maps;
    return Promise.resolve();
  }
  if (mapsFailure && (mapsFailure.permanent || Date.now() - mapsFailure.at < 30000)) return Promise.reject(new Error(mapsFailure.message));
  if (window.google?.maps?.Map && window.google.maps.Marker) { GM = window.google.maps; return Promise.resolve(); }
  if (!googleMapsPromise) {
    googleMapsPromise = fetch("/api/config").then(async (response) => {
      const config = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(config.error || "The map settings could not be loaded.");
      if (!config.maps_browser_key) throw new Error("This server has no browser map key (MAPS_BROWSER_API_KEY), so maps are switched off.");
      return config.maps_browser_key;
    }, () => { throw new Error("The map settings could not be loaded. Check your connection."); }).then((key) => new Promise((resolve, reject) => {
      const script = document.createElement("script");
      const fail = (message) => { clearTimeout(timer); script.remove(); delete window.__rerouteMapsReady; reject(new Error(message)); };
      const timer = setTimeout(() => fail("Google Maps took too long to load."), MAPS_LOAD_TIMEOUT_MS);
      window.__rerouteMapsReady = () => { clearTimeout(timer); Promise.all([google.maps.importLibrary("maps"), google.maps.importLibrary("marker")]).then(() => { if (!state.offline) GM = window.google.maps; resolve(); }, (error) => fail(error.message || "Google Maps could not start.")); };
      window.gm_authFailure = () => failMaps("Google rejected the map key. Check that the Maps JavaScript API is enabled for it and that this address is an allowed referrer.", true);
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async&callback=__rerouteMapsReady`;
      script.async = true;
      script.onerror = () => fail("Google Maps could not be loaded. Check your connection.");
      document.head.appendChild(script);
    })).catch((error) => { googleMapsPromise = null; mapsFailure = { message: error.message, at: Date.now(), permanent: false }; throw error; });
  }
  return googleMapsPromise;
}

// Replaces one map slot with a design-system warning banner; the controls that only work on a live map are hidden.
function showMapFail(el, message) {
  el.closest(".map-wrap")?.classList.add("map-failed");
  el.classList.remove("google-map");
  el.innerHTML = `<div class="map-fail">${notice(`<b>The map is unavailable.</b> ${esc(message)} The route steps are still shown as text.`, "warning")}</div>`;
}
function failMaps(message, permanent = false) {
  mapsFailure = { message, at: Date.now(), permanent };
  maps.forEach((entry, el) => { disposeMap(entry); maps.delete(el); showMapFail(el, message); });
  document.querySelectorAll("[data-map]").forEach((el) => { if (!el.querySelector(".map-fail")) showMapFail(el, message); });
}

const DARK_MAP_STYLES = [
  { elementType: "geometry", stylers: [{ color: "#202431" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#AAB2C0" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#202431" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#343A49" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#111927" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
];
const toLatLng = ([lat, lng]) => ({ lat: Number(lat), lng: Number(lng) });
const mapStyles = () => (document.documentElement.dataset.theme === "light" ? [] : DARK_MAP_STYLES);
const mapPadding = { top: 24, right: 72, bottom: 24, left: 24 };
function makeGoogleMap(el) {
  el.classList.add("google-map");
  return new GM.Map(el, {
    center: { lat: -27.4698, lng: 153.0251 }, zoom: 13, gestureHandling: "greedy",
    mapTypeControl: false, streetViewControl: false, fullscreenControl: false, zoomControl: false, rotateControl: false, cameraControl: false,
    styles: mapStyles(),
  });
}
function fitMap(entry, padding = mapPadding) {
  if (entry?.bounds && !entry.bounds.isEmpty()) entry.map.fitBounds(entry.bounds, padding);
}
function resizeMap(entry) {
  if (entry?.map) GM.event.trigger(entry.map, "resize");
}
function mapIcon(kind, bearingDeg = null, vehicle = null) {
  const colours = {
    start: "#34D399", end: "#F87171", park: cssColour("var(--accent)"),
    me: cssColour("var(--accent)"), here: cssColour("var(--accent)"), traffic: "#FBBF24", closure: "#F87171",
    vehicle: vehicle?.colour ? cssColour(vehicle.colour) : cssColour(SEGMENT_COLOUR[vehicle?.vehicle] || "var(--seg-bus)"),
  };
  const colour = colours[kind] || colours.end;
  const body = kind === "park" ? '<text x="22" y="28" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" font-weight="700" fill="#fff">P</text>'
    : kind === "me" ? `<path d="M22 8 14 32l8-5 8 5z" fill="#fff" transform="rotate(${bearingDeg ?? 0} 22 22)"/>`
      : kind === "vehicle" ? `<path d="M14 14h16v12H14zM17 11h10v3H17zM17 28a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm10 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" fill="#fff"/><path d="M22 10V4" stroke="#fff" stroke-width="2" transform="rotate(${bearingDeg ?? 0} 22 18)"/>`
        : kind === "traffic" || kind === "closure" ? '<path d="M22 12v12M22 29v1" stroke="#1C1303" stroke-width="3" stroke-linecap="round"/>'
          : '<circle cx="22" cy="22" r="6" fill="#fff"/>';
  const svgText = `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44"><circle cx="22" cy="22" r="16" fill="${colour}" stroke="#F1F5F9" stroke-width="3"/><g>${body}</g></svg>`;
  return { url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgText)}`, scaledSize: new GM.Size(44, 44), anchor: new GM.Point(22, 22) };
}

function mountMaps(root) {
  const slots = [...root.querySelectorAll("[data-map]")].filter((el) => !maps.has(el) && !mounting.has(el));
  if (!slots.length) return;
  slots.forEach((el) => mounting.add(el));
  loadGoogleMaps().then(() => slots.forEach((el) => {
    mounting.delete(el);
    if (!document.body.contains(el) || maps.has(el)) return;
    try { buildMap(el); } catch (error) { console.error(error); showMapFail(el, "Google Maps could not draw this route."); }
  })).catch((error) => slots.forEach((el) => { mounting.delete(el); if (document.body.contains(el)) showMapFail(el, error.message); }));
}

function buildMap(el) {
  const id = el.dataset.map;
  if (id === "__nav") return buildNavMap(el);
  if (id === "__radar") return buildRadarMap(el);
  const options = id === "__all" ? state.plan.options : [findOption(id)].filter(Boolean);
  if (!options.length) return;
  el.replaceChildren();
  const map = makeGoogleMap(el);
  const entry = { map, bounds: new GM.LatLngBounds(), lines: [], markers: [], optionId: id === "__all" ? null : id, vehicles: new Map() };
  entry.restyle = () => {
    map.setOptions({ styles: mapStyles() });
    entry.lines.forEach(({ line, kind, colour }) => line.setOptions({ strokeColor: colour || cssColour(SEGMENT_COLOUR[kind] || "var(--accent)") }));
  };
  const info = entry.info = new GM.InfoWindow();
  options.forEach((o, index) => {
    const faded = id === "__all" && index > 0;
    (o.segments || []).forEach((s) => {
      if (!s.points?.length) return;
      const colour = s.colour || cssColour(SEGMENT_COLOUR[s.kind] || "var(--accent)");
      const path = s.points.map(toLatLng);
      const line = new GM.Polyline({
        path, map, strokeColor: colour, strokeWeight: s.kind === "walk" ? 4 : 6, strokeOpacity: faded ? 0.35 : 0.92,
        clickable: id === "__all", geodesic: true,
      });
      if (id === "__all") line.addListener("click", (event) => {
        info.setContent(`<b>${esc(o.title)}</b><br>Arrive ${timeOf(o.arrival)}`);
        info.setPosition(event.latLng);
        info.open({ map });
      });
      entry.lines.push({ line, kind: s.kind, colour: s.colour });
      path.forEach((point) => entry.bounds.extend(point));
    });
  });
  const first = options[0];
  const pts = (first.segments || []).flatMap((s) => s.points || []);
  if (pts.length) {
    entry.markers.push(new GM.Marker({ position: toLatLng(pts[0]), map, icon: mapIcon("start"), clickable: false }));
    entry.markers.push(new GM.Marker({ position: toLatLng(pts[pts.length - 1]), map, icon: mapIcon("end"), clickable: false }));
  }
  if (id !== "__all") (first.traffic?.events || []).forEach((ev) => {
    const position = { lat: Number(ev.lat), lng: Number(ev.lng) };
    entry.markers.push(new GM.Marker({ position, map, icon: mapIcon(ev.closure ? "closure" : "traffic"),
      title: `${ev.title}${ev.road ? ` · ${ev.road}` : ""}${ev.simulated ? " · Simulated" : ""}` }));
    entry.bounds.extend(position);
  });
  if (first.mode === "drive" && first.parking?.parks) {
    first.parking.parks.forEach((pk) => {
      const position = toLatLng(pk.location);
      entry.markers.push(new GM.Marker({ position, map, icon: mapIcon("park"), title: `${pk.name} · ${pk.distance_m} m` }));
      entry.bounds.extend(position);
    });
  }
  syncVehicles(entry);
  if (!entry.bounds.isEmpty()) fitMap(entry);
  else if (state.plan.end) { map.setCenter(toLatLng(state.plan.end)); map.setZoom(14); }
  maps.set(el, entry);
  setTimeout(() => { if (maps.get(el) === entry) fitMap(entry); }, 420);
}

// Native Google map markers stay attached to geographic coordinates during pinch zoom.
function syncVehicles(entry, fromStep = 0) {
  const o = entry.optionId && findOption(entry.optionId);
  if (!o?.nav || !GM) return;
  const seen = new Set();
  o.nav.forEach((n, i) => {
    const v = n.transit && i >= fromStep ? rtOf(o, i).vehicle : null;
    if (!v) return;
    seen.add(i);
    const text = `${KIND_NAME[n.transit.vehicle] || "Vehicle"} ${n.transit.line}${v.stops_away === null || v.stops_away === undefined ? "" : ` · ${plural(v.stops_away, "stop")} away`}`;
    let marker = entry.vehicles.get(i);
    if (!marker) {
      marker = new GM.Marker({ position: { lat: v.lat, lng: v.lng }, map: entry.map, icon: mapIcon("vehicle", v.bearing, n.transit), title: text, zIndex: 700 });
      entry.vehicles.set(i, marker);
    } else {
      marker.setPosition({ lat: v.lat, lng: v.lng });
      marker.setIcon(mapIcon("vehicle", v.bearing, n.transit));
      marker.setTitle(text);
    }
  });
  entry.vehicles.forEach((marker, i) => { if (!seen.has(i)) { marker.setMap(null); entry.vehicles.delete(i); } });
}

// A map expanded to full screen lives in the viewport, so put it back (or drop it) whenever the page or sheet that owned it goes away.
function collapseExpanded() {
  viewport.querySelectorAll(".map-wrap.expanded").forEach((wrap) => {
    wrap.classList.remove("expanded");
    if (wrap._home && document.body.contains(wrap._home)) wrap._home.insertBefore(wrap, wrap._next?.parentNode === wrap._home ? wrap._next : null); else wrap.remove();
  });
}
// Removes every overlay and listener a map owns, so a closed sheet or left screen leaves nothing running.
function disposeMap(entry) {
  const clear = (item) => { GM.event.clearInstanceListeners(item); item.setMap(null); };
  entry.lines.forEach(({ line }) => clear(line));
  [...(entry.markers || []), ...entry.vehicles.values(), entry.me].forEach((marker) => marker && clear(marker));
  entry.info?.close();
  entry.dispose?.();
  if (entry.layers) entry.map.overlayMapTypes.clear();
  GM.event.clearInstanceListeners(entry.map);
}
function cleanMaps() {
  maps.forEach((entry, el) => {
    if (!document.body.contains(el)) { disposeMap(entry); maps.delete(el); }
  });
}
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

// Drag to dismiss, as in most phone apps: a sheet follows the finger down from its grab line or header (the side menu follows it to the left),
// then closes past about a quarter of its size or after a quick flick, and otherwise springs back. Listeners sit on the backdrop, which
// outlives re-rendered sheet content. Touch pointers stay with the element they started on, so no pointer capture is needed.
let suppressClickUntil = 0;
function dragToClose(container, panelSelector, handleSelector, axis, onClose) {
  const sign = axis === "y" ? 1 : -1;
  const along = (e) => (axis === "y" ? e.clientY : e.clientX), across = (e) => (axis === "y" ? e.clientX : e.clientY);
  container.addEventListener("pointerdown", (start) => {
    const handle = start.target.closest?.(handleSelector);
    if (!handle || !container.contains(handle) || (start.pointerType === "mouse" && start.button !== 0)) return;
    if (start.target.closest("a, input, select, textarea, .clr, [data-picker-map]") || (axis === "y" && start.target.closest("button"))) return;
    const panel = container.querySelector(panelSelector);
    if (!panel) return;
    let active = false, offset = 0, last = along(start), lastT = start.timeStamp, speed = 0;
    const size = axis === "y" ? panel.offsetHeight : panel.offsetWidth;
    const move = (e) => {
      if (e.pointerId !== start.pointerId) return;
      const d = (along(e) - along(start)) * sign;
      if (!active) {
        if (Math.abs(d) < 8 && Math.abs(across(e) - across(start)) < 8) return;
        if (d <= 0 || Math.abs(across(e) - across(start)) > Math.abs(d)) return finish(e, true);
        active = true;
        panel.classList.add("dragging");
        container.classList.add("dragging");
      }
      offset = d > 0 ? d : d / 6;
      speed = ((along(e) - last) * sign) / Math.max(1, e.timeStamp - lastT);
      last = along(e);
      lastT = e.timeStamp;
      panel.style.transform = axis === "y" ? `translateY(${offset}px)` : `translateX(${-offset}px)`;
      container.style.setProperty("--drag", String(Math.max(0, Math.min(1, offset / size))));
      if (e.cancelable) e.preventDefault();
    };
    const finish = (e, abandon = false) => {
      if (e.pointerId !== start.pointerId) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      if (!active || abandon === true) return;
      suppressClickUntil = performance.now() + 350;
      panel.classList.remove("dragging");
      container.classList.remove("dragging");
      panel.style.transform = "";
      container.style.removeProperty("--drag");
      if (e.type !== "pointercancel" && (offset > Math.min(140, size * 0.25) || speed > 0.55)) onClose();
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  });
}
const sheetDrag = (backdrop, onClose) => dragToClose(backdrop, ".sheet", ".grabber, .sheet-head", "y", onClose);

let sheetEl = null;
let lastFocus = null;
function openSheet(html) {
  closeSheet(true);
  lastFocus = document.activeElement;
  sheetEl = document.createElement("div");
  sheetEl.className = "sheet-backdrop";
  sheetEl.dataset.action = "backdrop";
  sheetEl.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">${html}</div>`;
  enhanceClear(sheetEl);
  viewport.appendChild(sheetEl);
  sheetDrag(sheetEl, () => closeSheet());
  requestAnimationFrame(() => requestAnimationFrame(() => sheetEl?.classList.add("open")));
  requestAnimationFrame(() => revealMore(sheetEl));
  mountMaps(sheetEl);
  sheetEl.querySelector(".icon-btn")?.focus({ preventScroll: true });
}

// A second sheet that opens above everything else (a full alert, the map picker) and returns to what was underneath.
let popupEl = null;
let popupFocus = null;
function openPopup(html, kind = "") {
  closePopup(true);
  popupFocus = document.activeElement;
  popupEl = document.createElement("div");
  popupEl.className = `sheet-backdrop popup${kind ? ` ${kind}` : ""}`;
  popupEl.dataset.action = "popup-backdrop";
  popupEl.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="popup-title">${html}</div>`;
  viewport.appendChild(popupEl);
  sheetDrag(popupEl, () => closePopup());
  requestAnimationFrame(() => requestAnimationFrame(() => popupEl?.classList.add("open")));
  popupEl.querySelector(".icon-btn")?.focus({ preventScroll: true });
}
function closePopup(immediate = false) {
  if (!popupEl) return;
  const el = popupEl;
  popupEl = null;
  if (el.classList.contains("picker")) disposePicker();
  if (immediate) return el.remove();
  el.classList.remove("open");
  setTimeout(() => el.remove(), 320);
  popupFocus?.focus?.({ preventScroll: true });
}

function closeSheet(immediate = false) {
  closePopup(true);
  if (!sheetEl) return;
  if (sheetEl.dataset.place) state.placeDraft = null;
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
    origin: f.originCoords ? coordText(f.originCoords) : f.origin.trim(), destination: f.destinationCoords ? coordText(f.destinationCoords) : f.destination.trim(), purpose: state.purpose,
    origin_place_id: f.originCoords ? null : f.originPlaceId || null, destination_place_id: f.destinationCoords ? null : f.destinationPlaceId || null,
    leave_now: f.leave_now, departure: f.departure, deadline: f.deadline || null,
    budget: f.budget, walking: f.walking,
    modes: settings.modes, transit_modes: settings.transit_modes,
    vehicle: { fuel_l_per_100km: settings.fuel_l_per_100km, fuel_type: settings.fuel_type, fuel_price: settings.fuel_price_mode === "manual" ? settings.fuel_price : null },
    parking_cost: settings.parking_cost, transit_flat_fare: settings.use_flat_fare ? settings.flat_fare : null, hire_prices: settings.hire,
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
  if (f.origin === CURRENT_PLACE && !f.originCoords) {
    state.loading = true;
    rerender();
    const coords = await new Promise(locate);
    state.loading = false;
    if (state.form !== f || f.origin !== CURRENT_PLACE) return rerender();
    f.originLocating = false;
    if (!coords) { state.error = "Your location isn't available. Type where you're starting from, or choose it on the map."; return rerender(); }
    f.originCoords = coords;
    state.biasCoords = coords;
  }
  if (f.origin.trim().length < 3 || f.destination.trim().length < 3) { state.error = "Enter where you're starting and where you're going."; return rerender(); }
  state.loading = true;
  state.error = null;
  state.errorKind = "error";
  state.costOpen = false;
  rerender();
  try {
    state.plan = await requestPlan(payload(extra));
    store.set("lastDestination", f.destinationCoords ? coordText(f.destinationCoords) : f.destination.trim());
    store.set("lastDestinationPlaceId", f.destinationPlaceId || null);
    state.sort = f.avoid ? "best" : "pt";
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
  if (r) noteResponse(r); else setOnline(false);
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
  if (sheetEl?.querySelector("[data-alert-results]")) { sheetEl.querySelector("[data-alert-results]").innerHTML = alertsBody(); revealMore(sheetEl); }
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
    toast(`Disruption on ${state.watch.alert.lines.join(", ")}. Open Reroute for alternatives.`);
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

// To starts empty (only the demo preset fills it); saved places are chips under it and recent places are suggestions when it is focused.
// Journey disrupted?, alternatives from a notification and re-planning set their own destination over this.
function freshForm() {
  const now = brisbaneNowLocal();
  const preset = demoOn() && state.demo.start === "preset";
  return {
    origin: preset ? DEMO_PRESET.origin : CURRENT_PLACE, originPlaceId: null, originCoords: null, originLocating: false, originNote: null, destinationCoords: null,
    destination: preset ? DEMO_PRESET.destination : "", destinationPlaceId: null,
    leave_now: true, departure: addMinutes(now, 10), deadline: "",
    budget: settings.budget, walking: settings.walking, avoid: "",
  };
}

function locate(onDone) {
  if (!navigator.geolocation) return onDone(null);
  navigator.geolocation.getCurrentPosition(
    (pos) => onDone([pos.coords.latitude, pos.coords.longitude]),
    () => onDone(null), { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 });
}

// Plan a trip starts from where you are: the From field says "Current location" and the search sends the coordinates. Typing, a saved
// place or the map replaces it. If location is blocked or unavailable, the last start point you used is filled in instead, with a note.
function locateOrigin() {
  const f = state.form;
  f.originLocating = true;
  locate((coords) => {
    if (state.form !== f || f.origin !== CURRENT_PLACE || !f.originLocating) return;
    f.originLocating = false;
    if (coords) { f.originCoords = coords; state.biasCoords = coords; }
    else {
      const last = store.get("lastOrigin", "");
      Object.assign(f, { origin: last, originPlaceId: last ? store.get("lastOriginPlaceId", null) : null, originCoords: null,
        originNote: last ? "Your location isn't available, so your last start point is filled in. Allow location to start from where you are." : "Your location isn't available. Type where you're starting from." });
    }
    paintOrigin();
  });
}
// Updates the From row in place (a full re-render could interrupt typing in the To field).
function paintOrigin() {
  if (state.screen !== "journey" || !currentPage) return;
  const f = state.form, rowEl = currentPage.querySelector("[data-origin-row]"), input = currentPage.querySelector("#f-origin");
  if (!rowEl || !input) return;
  if (document.activeElement !== input) input.value = f.origin;
  rowEl.classList.toggle("locating", f.origin === CURRENT_PLACE && f.originLocating);
  rowEl.classList.toggle("is-current", f.origin === CURRENT_PLACE && !!f.originCoords);
  rowEl.querySelector(".row-icon").innerHTML = f.origin === CURRENT_PLACE ? I.locate(18) : I.walk(18);
  const note = currentPage.querySelector("[data-origin-note]");
  if (note) { note.hidden = !f.originNote; note.textContent = f.originNote || ""; }
  const chips = currentPage.querySelector("[data-origin-note] + .place-chips");
  if (chips) chips.outerHTML = placeChips("origin");
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
  // Straight home from any screen: closes sheets and Settings, stops live directions (watcher, timer, wake lock) and forgets a finished panic answer.
  // Offline area and offline mode
  "use-offline": () => enterOffline(),
  "exit-offline": () => exitOffline(),
  "offline-pick": () => {
    if (state.offline || !offline.online) return toast("Choosing and downloading an area needs internet.", "warning");
    offline.download = null;
    offline.confirmDelete = false;
    const go = () => navigate("offline-area");
    if (settingsEl) { closeSettings(); setTimeout(go, 380); } else go();
  },
  "offline-view": () => openOfflinePreview(),
  "offline-delete": async () => {
    if (!offline.confirmDelete) { offline.confirmDelete = true; return rerenderSettings(); }
    offline.confirmDelete = false;
    await RerouteOffline.deletePack();
    Object.assign(offline, { pack: null, summary: null });
    RerouteOffline.setActivePack(null);
    if (state.offline) exitOffline();
    rerenderSettings();
    toast("Offline data deleted from this device.");
  },
  "offline-download": () => downloadArea(),
  "offline-days": (el) => { offline.days = Number(el.dataset.value); rerenderArea(); },
  "go-home": () => {
    closeSheet(true);
    if (settingsEl) closeSettings();
    state.panic.phase = "ask";
    if (state.screen !== "home") navigate("home", "back");
    else rerender();
  },
  go: (el) => navigate(el.dataset.screen, el.dataset.screen === "panic" ? "up" : "forward"),
  // Side menu, profile and pop-ups
  "open-menu": openMenu,
  "close-menu": () => closeMenu(),
  "menu-backdrop": (el, event) => { if (event.target === el) closeMenu(); },
  "menu-go": (el) => { closeMenu(null, false); navigate(el.dataset.screen); },
  "menu-open": (el) => {
    const open = { settings: openSettings, demo: openDemoSheet, share: () => openSheet(shareSheet()), alerts: () => openSheet(alertsSheet()), install: installApp }[el.dataset.open];
    closeMenu(open);
  },
  "toggle-profile": () => toggleProfileMenu(),
  "account-feature": () => { toggleProfileMenu(false); showDialog("Feature not available", "Accounts aren't part of this prototype yet, so there are no account details or profile to edit.", currentPage?.querySelector(".avatar-btn")); },
  "close-dialog": closeDialog,
  "dialog-backdrop": (el, event) => { if (event.target === el) closeDialog(); },
  "alert-more": (el) => { const a = findAlert(el.dataset.id); if (a) openPopup(alertPopup(a)); },
  "close-popup": () => closePopup(),
  "popup-backdrop": (el, event) => { if (event.target === el) closePopup(); },
  // Choose on map
  "pick-map": (el) => openMapPicker(el.dataset.path),
  "picker-zoom": (el) => { if (picker.map) picker.map.setZoom(picker.map.getZoom() + Number(el.dataset.delta)); },
  "picker-locate": (el) => {
    el.disabled = true;
    locate((coords) => {
      el.disabled = false;
      if (!coords) return toast("Your location isn't available.", "warning");
      state.biasCoords = coords;
      if (!picker.map) return;
      picker.map.panTo(toLatLng(coords));
      picker.map.setZoom(Math.max(picker.map.getZoom(), 16));
      if (picker.me) picker.me.setPosition(toLatLng(coords));
      else picker.me = new GM.Marker({ position: toLatLng(coords), map: picker.map, icon: mapIcon("here"), clickable: false, zIndex: 5, title: "Your location" });
    });
  },
  "picker-use": usePickedPlace,
  "radar-play": () => radarPlay(),
  start: (el) => {
    state.purpose = el.dataset.purpose;
    state.form = freshForm();
    state.error = null;
    if (state.form.origin === CURRENT_PLACE) state.form.originLocating = true;
    navigate("journey");
    if (state.form.origin === CURRENT_PLACE) locateOrigin();
  },
  search: () => { if (!state.form.originCoords && state.form.origin !== CURRENT_PLACE) { store.set("lastOrigin", state.form.origin.trim()); store.set("lastOriginPlaceId", state.form.originPlaceId || null); } search(); },
  step: (el) => {
    const field = el.dataset.field;
    const delta = Number(el.dataset.delta);
    if (field.startsWith("set.")) {
      const key = field.slice(4);
      settings[key] = Math.max(0, settings[key] + delta * (key === "budget" ? 1 : 5));
      saveSettings();
      return rerenderSettings();
    }
    if (field === "co2_goal_kg") {
      const v = settings.co2_goal_kg;
      settings.co2_goal_kg = Math.min(200, Math.max(1, v + delta * ((delta > 0 ? v >= 20 : v > 20) ? 5 : 1)));
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
      if (coords) { applyPlace("form.origin", CURRENT_PLACE, null, coords); state.biasCoords = coords; }
      else state.error = "Location is unavailable. Type your starting point instead.";
      rerender();
    });
  },
  "fill-place": (el) => {
    const place = savedPlace(el.dataset.place);
    if (!place) return;
    applyPlace(`form.${el.dataset.field}`, place.address, place.place_id);
    rerender();
  },
  sort: (el) => { state.sort = el.dataset.value; rerender(); currentPage.querySelector(`[data-action="sort"][data-value="${state.sort}"]`)?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" }); },
  "open-sheet": (el) => { const o = findOption(el.dataset.id); if (o) { openSheet(sheetContent(o)); sheetEl.dataset.option = o.id; } },
  "close-sheet": () => closeSheet(),
  backdrop: (el, event) => { if (event.target === el) closeSheet(); },
  "map-overview": () => openSheet(`<div class="grabber"><span></span></div><div class="sheet-head"><h3 id="sheet-title">All routes</h3>${sheetClose()}</div><div class="sheet-scroll">${mapBlock("__all", "The first option in the list is drawn strongest. Tap a line for details.")}</div>`),
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
    const month = impactTotals(thisMonthTrips());
    toast(o.vs_drive?.co2_saved_kg > 0.005 ? `Logged. ${kg(o.vs_drive.co2_saved_kg)} CO₂ avoided. ${kgShort(month.co2)} so far this month.` : "Logged to your trips.");
    rerender();
  },
  replan: () => {
    const lines = state.watch.alert?.lines || [];
    state.purpose = "regular";
    state.form.avoid = lines.join(" ");
    state.form.leave_now = true;
    state.watch.alert = null;
    navigate("results", "back");
    search({ avoid_lines: lines, purpose: "regular", leave_now: true });
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
  "add-place": () => {
    if (customPlaces().length >= MAX_CUSTOM_PLACES) return;
    state.placeDraft = { isNew: true, id: null, name: "", address: "", place_id: null, error: null, confirmDelete: false };
    openPlaceSheet();
  },
  "edit-place": (el) => {
    const p = savedPlace(el.dataset.id);
    if (!p) return;
    state.placeDraft = { isNew: false, id: p.id, name: p.name, address: p.address, place_id: p.place_id, error: null, confirmDelete: false };
    openPlaceSheet();
  },
  "save-place": savePlace,
  "delete-place": deletePlace,
  "clear-input": clearInput,
  "toggle-transit": (el) => { settings.transit_modes[el.dataset.value] = !settings.transit_modes[el.dataset.value]; saveSettings(); rerenderSettings(); },
  "clear-trips": () => { store.set("trips", []); toast("Impact history cleared."); rerenderSettings(); rerender(); },
  "toggle-table": () => { state.dashTable = !state.dashTable; rerender(); },
  "map-zoom": (el) => { const e = mapEntryFor(el); if (e) e.map.setZoom(e.map.getZoom() + Number(el.dataset.delta)); },
  "map-fit": (el) => { const e = mapEntryFor(el); if (e?.bounds) fitMap(e); },
  "map-expand": (el) => {
    const wrap = el.closest(".map-wrap");
    const expanded = !wrap.classList.contains("expanded");
    if (expanded) { wrap._home = wrap.parentElement; wrap._next = wrap.nextSibling; viewport.appendChild(wrap); }
    else if (wrap._home) wrap._home.insertBefore(wrap, wrap._next);
    wrap.classList.toggle("expanded", expanded);
    el.innerHTML = expanded ? I.shrink() : I.expand();
    el.setAttribute("aria-label", expanded ? "Shrink map" : "Expand map");
    const e = mapEntryFor(el);
    setTimeout(() => { if (!e || !document.body.contains(e.map.getDiv())) return; resizeMap(e); if (e.bounds) fitMap(e, { top: 30, right: 72, bottom: 30, left: 30 }); }, 60);
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
  "nav-recenter": () => { const n = state.nav, entry = navEntry(); n.following = true; if (entry) { entry.zoomIdx = null; entry.fitSig = null; if (!n.pos) fitMap(entry, { top: 48, right: 48, bottom: 48, left: 48 }); } navPaint(); },
  "nav-voice": () => { settings.voice = !settings.voice; saveSettings(); if (settings.voice) speak("Voice prompts on."); else try { speechSynthesis.cancel(); } catch { /* optional */ } navPaint(); },
  "nav-replan": navReplan,
  // Demo mode, sharing, install
  "open-demo": openDemoSheet,
  "demo-set": (el) => { const { name, value } = el.dataset; state.demo[name] = name === "late_min" ? Number(value) : value; saveDemo(); refreshDemoSheet(); if (name === "weather") { loadWeather(); if (state.screen === "weather") loadWeatherDetail(); } },
  "demo-exit": () => { state.demo.on = false; saveDemo(); renderDemoPill(); loadWeather(); if (state.screen === "weather") loadWeatherDetail(); closeSheet(); toast("Demo mode is off."); },
  "demo-push": demoPush,
  "settings-demo": () => { closeSettings(); setTimeout(openDemoSheet, 420); },
  "open-share": () => openSheet(shareSheet()),
  "settings-share": () => { closeSettings(); setTimeout(() => openSheet(shareSheet()), 420); },
  "copy-link": copyLink,
  "share-native": (el) => navigator.share({ title: "Reroute", text: "Reroute finds a way to your destination when public transport is disrupted.", url: el.dataset.url }).catch(() => {}),
  install: installApp,
  "settings-install": () => { if (state.installEvent) installApp(); else { closeSettings(); setTimeout(() => openSheet(installSheet()), 420); } },
  "toggle-cost": () => { state.costOpen = !state.costOpen; const el = currentPage.querySelector(".cost-line"); if (el) el.outerHTML = costLine(); },
  // Panic mode
  "exit-panic": () => { state.panic.phase = "ask"; navigate(state.stack.length > 1 ? state.stack[state.stack.length - 2] : "home", "down"); },
  "panic-place": (el) => {
    const place = savedPlace(el.dataset.place);
    state.panic.dest = el.dataset.place === "last" ? store.get("lastDestination", "") : place?.address || "";
    state.panic.destPlaceId = el.dataset.place === "last" ? store.get("lastDestinationPlaceId", null) : place?.place_id || null;
    state.panic.destCoords = null;
    rerender();
  },
  "panic-go": async () => {
    const pm = state.panic;
    const origin = pm.coords ? coordText(pm.coords) : pm.originCoords ? coordText(pm.originCoords) : (pm.origin || "").trim();
    const dest = pm.destCoords ? coordText(pm.destCoords) : pm.dest.trim();
    if (origin.length < 3 || dest.length < 3) { pm.error = "Enter where you are and where you need to be."; return rerender(); }
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
    state.form = { ...freshForm(), origin, destination: dest, leave_now: true, deadline: deadline || "", budget: 200, walking: 60,
      originPlaceId: pm.coords || pm.originCoords ? null : pm.originPlaceId || null, destinationPlaceId: pm.destCoords ? null : pm.destPlaceId || null };
    try {
      state.plan = await requestPlan(payload({ purpose: "panic" }));
      store.set("lastDestination", dest);
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
  if (performance.now() < suppressClickUntil) return; // the click that ends a drag or swipe
  if (profileOpen() && !event.target.closest(".profile-wrap")) toggleProfileMenu(false);
  const el = event.target.closest("[data-action]");
  if (!el || transitioning) return;
  const action = actions[el.dataset.action];
  if (action) action(el, event);
});

// The live-directions step list: swipe its grab line or ETA up to open it and down to close it (a tap still toggles it).
let navSwipe = null;
document.addEventListener("pointerdown", (event) => { if (state.nav && event.target.closest?.(".nav-grab, .nav-eta-main")) navSwipe = { id: event.pointerId, y: event.clientY }; });
document.addEventListener("pointerup", (event) => {
  if (!navSwipe || event.pointerId !== navSwipe.id) return;
  const dy = event.clientY - navSwipe.y;
  navSwipe = null;
  if (Math.abs(dy) < 30 || !state.nav || state.screen !== "nav") return;
  suppressClickUntil = performance.now() + 350;
  if ((dy < 0) !== state.nav.sheetOpen) actions["nav-sheet"]();
});

document.addEventListener("input", (event) => {
  const t = event.target;
  if (t.dataset.field && state.form) {
    const field = t.dataset.field;
    Object.assign(state.form, { [field]: t.value, [`${field}PlaceId`]: null, [`${field}Coords`]: null });
    if (field === "origin" && (state.form.originLocating || state.form.originNote)) { Object.assign(state.form, { originLocating: false, originNote: null }); paintOrigin(); }
    state.error = null;
  }
  if (t.dataset.panic) { state.panic[t.dataset.panic] = t.value; state.panic[`${t.dataset.panic}PlaceId`] = null; state.panic[`${t.dataset.panic}Coords`] = null; }
  if (t.dataset.placeText) {
    const p = savedPlace(t.dataset.placeText);
    if (p) { p.address = t.value.slice(0, PLACE_ADDRESS_MAX); p.place_id = null; saveSettings(); }
  }
  if (t.dataset.draft && state.placeDraft) {
    state.placeDraft[t.dataset.draft] = t.value;
    if (t.dataset.draft === "address") state.placeDraft.place_id = null;
  }
  if (t.dataset.ac) autocomplete.onInput(t);
  if (t.dataset.settingNumber) {
    const v = t.value === "" ? null : Number(t.value);
    if (v === null || Number.isFinite(v)) { setPath(settings, t.dataset.settingNumber, v); saveSettings(); }
  }
  // Dragging the radar time slider pauses playback; only the button changes, so the slider keeps the finger.
  if (t.matches("[data-radar-slider]")) {
    if (radar.playing) {
      clearInterval(radar.timer);
      radar.playing = false;
      const play = t.parentElement.querySelector(".radar-play");
      if (play) { play.innerHTML = I.play(16); play.setAttribute("aria-pressed", "false"); play.setAttribute("aria-label", radarPlayLabel()); }
    }
    showRadarFrame(Number(t.value));
  }
  if (t.matches("[data-alert-query]")) {
    state.alertQuery = t.value;
    sheetEl.querySelector("[data-alert-results]").innerHTML = alertsBody();
    revealMore(sheetEl);
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
  if (dialogEl) return closeDialog();
  if (profileOpen()) { toggleProfileMenu(false); return currentPage.querySelector(".avatar-btn")?.focus(); }
  if (popupEl) return closePopup();
  const expanded = viewport.querySelector(".map-wrap.expanded [data-action='map-expand']");
  if (expanded) return actions["map-expand"](expanded);
  if (sheetEl) closeSheet(); else if (settingsEl) closeSettings(); else if (menuEl) closeMenu();
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
    <div class="sheet-head"><h3 id="sheet-title">Demo mode</h3>${sheetClose()}</div>
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
          <p class="fine" style="margin-top:8px">Asks for notification permission, then the server sends a simulated disruption 10 seconds later. Minimise Reroute to watch it arrive.</p></div>
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
  if (key === "on") { state.costOpen = false; loadWeather(); if (state.screen === "weather") loadWeatherDetail(); }
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
    state.demoPush = { kind: "success", text: `Test sent. It arrives in about ${res.sent_in_s ?? 10} seconds. Minimise Reroute to see the notification.` };
  } catch (error) { state.demoPush = { kind: "error", text: error.message }; }
  refreshDemoSheet();
}

// ── Share, install and background alerts ─────────────────────────────────────

function shareSheet() {
  const url = state.status?.public_url || location.origin;
  const local = /^(localhost|127\.|\[::1\])/.test(location.hostname) && !state.status?.public_url;
  return `<div class="grabber"><span></span></div>
    <div class="sheet-head"><h3 id="sheet-title">Share Reroute</h3>${sheetClose()}</div>
    <div class="sheet-scroll">
      <p class="hint" style="margin-bottom:20px">Scan with a phone camera to open Reroute, then add it to the home screen.</p>
      <div class="qr-card"><img src="/qr.svg" alt="QR code that opens Reroute at ${esc(url)}" loading="lazy" width="244" height="244" onload="this.parentElement.classList.add('ready')" onerror="this.parentElement.classList.add('ready')"></div>
      <div class="share-url"><code>${esc(url)}</code><button class="btn btn-primary" data-action="copy-link" data-url="${esc(url)}">${I.copy(16)}Copy link</button></div>
      <div data-share-fb></div>
      ${navigator.share ? `<button class="btn btn-secondary" data-action="share-native" data-url="${esc(url)}">${I.share(16)}Share with other apps</button>` : ""}
      ${local ? notice("This address only works on this computer. Deploy Reroute, or set PUBLIC_URL, so the QR code points to a public address.", "info") : ""}
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
    <div class="sheet-head"><h3 id="sheet-title">Install Reroute</h3>${sheetClose()}</div>
    <div class="sheet-scroll">
      <p class="hint" style="margin-bottom:20px">Add Reroute to your Home Screen to open it like an app and to get background disruption alerts.</p>
      <ol class="install-steps">
        <li><span>Tap the Share button ${I.share(18)} in Safari's toolbar.</span></li>
        <li><span>Scroll down and tap <b>Add to Home Screen</b> ${I.plus(18)}.</span></li>
        <li><span>Open Reroute from your Home Screen, then turn on <b>Watch this trip in the background</b>.</span></li>
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
  if (choice?.outcome === "accepted") toast("Reroute is installing.");
  if (state.screen === "home") rerender();
  rerenderSettings();
}
window.addEventListener("beforeinstallprompt", (event) => { event.preventDefault(); state.installEvent = event; if (state.screen === "home" && !transitioning) rerender(); });
window.addEventListener("appinstalled", () => { state.installEvent = null; if (state.screen === "home") rerender(); });

const b64ToBytes = (b64) => Uint8Array.from(atob(b64.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (b64.length % 4)) % 4)), (c) => c.charCodeAt(0));
function pushSupport() {
  if (!window.isSecureContext) return "Background alerts need HTTPS. Open the secure (https://) address of this app.";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return isIos() && !standalone() ? "On iPhone, add Reroute to your Home Screen first (Share, then Add to Home Screen), open it from there and try again." : "This browser doesn't support background notifications.";
  if (state.status && state.status.push === false) return "This Reroute server isn't set up for push notifications.";
  if (Notification.permission === "denied") return "Notifications are blocked for Reroute. Allow them in your browser settings, then try again.";
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
      state.bg = { msg: { kind: "success", text: "Watching this trip. You'll get a notification if Translink posts a disruption on your lines, even with Reroute closed." } };
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
  if (!w) return toast("That alert is from another device. Start a new search.", "warning");
  const now = brisbaneNowLocal(), deadline = w.deadline && w.deadline.slice(0, 16) > now ? w.deadline.slice(0, 16) : "";
  state.purpose = "regular";
  state.form = { ...freshForm(), origin: w.origin, originPlaceId: null, destination: w.destination, destinationPlaceId: w.destination_place_id || null, leave_now: true, deadline,
    budget: w.budget ?? settings.budget, walking: w.walking ?? settings.walking, avoid: w.lines.join(" ") };
  state.error = null;
  if (state.screen !== "journey") navigate("journey");
  search({ avoid_lines: w.lines, purpose: "regular", leave_now: true });
}

// ── Boot ─────────────────────────────────────────────────────────────────────

// ── Offline area: download (Settings → Offline info), the connection banner and offline mode ───────────────
// One rectangular area can be saved on this device: an OpenStreetMap extract (the base map and the walking, cycling and driving
// network) and Translink's scheduled services for a few days, both prepared by the server (offline.js stores and uses them).
// Offline mode only starts when the traveller taps "Use Offline Maps", so it is always clear that results are not live.

const offline = { pack: null, summary: null, loaded: false, online: navigator.onLine !== false, download: null, days: 3, confirmDelete: false };
const offlineLimits = () => ({ max_side_km: 8, max_area_km2: 40, min_side_km: 0.5, max_days: 7, default_days: 3, ...(state.status?.offline_limits || {}) });
async function loadOfflinePack() {
  if (!window.RerouteOffline) { offline.loaded = true; return null; }
  offline.pack = await RerouteOffline.loadPack().catch(() => null);
  offline.summary = offline.pack ? RerouteOffline.packSummary(offline.pack) : null;
  offline.loaded = true;
  if (offline.pack) RerouteOffline.setActivePack(offline.pack);
  return offline.pack;
}

// The service worker answers API reads from its cache when the network fails and marks them, so a cached answer means no internet.
function setOnline(online) {
  if (offline.online === online) return;
  offline.online = online;
  renderNetBanner();
}
const noteResponse = (response) => setOnline(!(response && response.headers.get("X-Reroute-Offline") === "1"));
function netBannerInner() {
  if (state.offline) {
    return `<span class="net-dot off"></span><span class="net-text"><b>Offline maps · not live</b><small>${offline.online ? "You're back online." : "Routes and times are estimates from your downloaded area."}</small></span>
      <button class="net-btn${offline.online ? " primary" : ""}" data-action="exit-offline">${offline.online ? "Use live data" : "Exit offline"}</button>`;
  }
  return `<span class="net-dot"></span><span class="net-text"><b>You're offline</b><small>Live routes, maps and alerts need internet.</small></span>
    <button class="net-btn primary" data-action="use-offline">Use Offline Maps</button>`;
}
function renderNetBanner() {
  const el = document.getElementById("net-banner");
  if (!el) return;
  const show = state.offline || !offline.online;
  el.hidden = !show;
  el.classList.toggle("mode", state.offline);
  if (show) el.innerHTML = netBannerInner();
}

// Switching map provider rebuilds every map: Google maps are disposed with Google's API before the offline map takes over, and back.
function resetMaps() {
  disposeAreaMap();
  closeSheet(true);
  closePopup(true);
  if (settingsEl) closeSettings();
  collapseExpanded();
  maps.forEach((entry, el) => { try { disposeMap(entry); } catch { /* already gone */ } maps.delete(el); });
  mounting.clear();
}
async function enterOffline() {
  if (!offline.loaded) await loadOfflinePack();
  if (!offline.pack) return showDialog("No offline area downloaded", "Download an area in Settings → Offline info while you have internet. Then you can view its map, timetables and routes here without a connection.");
  resetMaps();
  if (state.screen === "nav") navStop();
  state.offline = true;
  GM = window.RerouteOffline.maps;
  RerouteOffline.setActivePack(offline.pack);
  state.plan = state.plan?.offline ? state.plan : null;
  renderNetBanner();
  state.stack = ["home"];
  if (state.screen !== "home") navigate("home", "back"); else rerender();
  toast("Offline maps are on. Routes are estimates from your downloaded area, not live.", "warning");
}
function exitOffline() {
  resetMaps();
  if (state.screen === "nav") navStop();
  state.offline = false;
  GM = window.google?.maps || null;
  if (state.plan?.offline) state.plan = null;
  renderNetBanner();
  state.stack = ["home"];
  if (state.screen !== "home") navigate("home", "back"); else rerender();
  loadAlerts();
  loadWeather();
}

// Plans come from the server online and from offline.js in offline mode, in the same shape.
async function requestPlan(body) {
  if (!state.offline) return postJSON("/api/plan", body);
  const pack = offline.pack;
  if (!pack) throw new Error("No offline area is downloaded.");
  const point = (text, label) => {
    const match = LATLNG_TEXT.exec(text || "");
    if (match) return { lat: Number(match[1]), lng: Number(match[2]), label };
    const saved = (pack.saved || []).find((p) => p.address === text || p.name.toLowerCase() === String(text).toLowerCase());
    if (saved) return { lat: saved.lat, lng: saved.lng, label: saved.name };
    const hit = RerouteOffline.search(pack, text || "", pack.saved || [])[0];
    if (hit && hit.main.toLowerCase() === String(text).split(",")[0].trim().toLowerCase()) return { lat: hit.lat, lng: hit.lng, label: hit.main };
    throw Object.assign(new Error(`“${text}” isn't in your downloaded area. Choose a suggestion or pick the place on the map.`), { status: 400 });
  };
  const local = (value) => (value ? new Date(`${value}:00+10:00`) : null);
  const f = state.form || {};
  return RerouteOffline.plan(pack, {
    from: point(body.origin, f.origin === CURRENT_PLACE ? "Your location" : f.origin), to: point(body.destination, f.destination),
    departure: body.leave_now ? new Date() : local(body.departure), deadline: local(body.deadline),
    modes: body.modes, transit_modes: body.transit_modes, walking: body.walking, budget: body.budget, factors: body.emission_factors,
    fuel_l_per_100km: body.vehicle?.fuel_l_per_100km, fuel_type: body.vehicle?.fuel_type, fuel_price: body.vehicle?.fuel_price,
    fuel_price_fallback: pack.fuel?.price && pack.fuel.fuel_type === body.vehicle?.fuel_type ? { price: pack.fuel.price, source: "the local average when you downloaded the area" } : { price: settings.fuel_price, source: "your Settings price" },
    parking_cost: body.parking_cost, flat_fare: body.transit_flat_fare, hire: body.hire_prices, purpose: body.purpose, saved: pack.saved || [],
  });
}
const LATLNG_TEXT = /^\s*(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$/;
// Offline address suggestions: suburbs, significant places, stops and streets in the downloaded area, with their coordinates.
const offlineSuggestions = (text) => (offline.pack ? RerouteOffline.search(offline.pack, text, offline.pack.saved || []) : [])
  .map((s) => ({ kind: s.kind === "stop" ? "transit" : s.kind === "street" ? "street" : s.kind === "saved" ? "saved" : "place", glyph: "star", main: s.main, secondary: s.secondary || "", text: [s.main, s.secondary].filter(Boolean).join(", "), coords: [s.lat, s.lng] }));

// Settings → Offline info.
const mb = (bytes) => `${(bytes / 1048576).toFixed(bytes < 10485760 ? 1 : 0)} MB`;
const dayRange = (days) => (days?.length ? (days.length === 1 ? dateLabel(`${days[0]}T12:00:00+10:00`) : `${dateLabel(`${days[0]}T12:00:00+10:00`)} to ${dateLabel(`${days.at(-1)}T12:00:00+10:00`)}`) : "no days");
function offlineSettings() {
  const s = offline.summary, pack = offline.pack;
  const rowBtn = (action, icon, tone, label, hint, extra = "") => `<button class="row" data-action="${action}" ${extra}><span class="row-icon" style="--tone:${tone}">${icon}</span><span class="row-label">${label}${hint ? `<small>${hint}</small>` : ""}</span><span class="chev">${I.chevronRight()}</span></button>`;
  const expired = pack?.transit?.days?.length && pack.transit.days.at(-1) < brisbaneNowLocal().slice(0, 10);
  return `<p class="section-header">Offline info</p>
    <div class="group"><div class="group-card">
      ${s ? `<div class="row"><span class="row-icon" style="--tone:var(--teal)">${I.map(18)}</span><span class="row-label">${esc(s.label || "Downloaded area")}<small>${mb(s.bytes)} · ${plural(s.stops, "stop")} · timetables for ${esc(dayRange(pack.transit?.days))}${expired ? " (out of date)" : ""} · saved ${dateLabel(s.saved_at)}</small></span></div>
        ${rowBtn("offline-view", I.route(18), "var(--accent)", "View the offline map", "See exactly what is saved")}
        ${rowBtn("offline-pick", I.download(18), "var(--success)", "Download a new area", "Replaces the area above")}
        <button class="row" data-action="offline-delete"><span class="row-icon" style="--tone:var(--error)">${I.trash(18)}</span><span class="row-label" style="color:var(--error-text)">${offline.confirmDelete ? "Tap again to delete the offline area" : "Delete offline data"}</span></button>`
      : rowBtn("offline-pick", I.download(18), "var(--success)", "Download an area for offline use", "Choose an area on the map. Its map, Translink timetables and walking, cycling and driving routes are saved on this device.")}
    </div><p class="group-footer">For when you have no internet: tap “Use Offline Maps” on the banner that appears. Offline routes and times are estimates from the downloaded timetables and map, not live. One area of up to ${offlineLimits().max_side_km} km across can be saved. Map data © OpenStreetMap contributors; timetables from Translink.</p></div>`;
}

// Choosing the area: a Google map (online only) under a fixed rounded box; everything outside the box is dimmed.
const area = { map: null, overlay: null, bbox: null, sizeKm: null };
function offlineAreaScreen() {
  return `${navbar(true)}<div class="area-page">
    <div class="area-map" data-area-map><div class="skeleton map-skeleton" role="status" aria-label="Loading map"></div></div>
    <div class="area-mask" aria-hidden="true"><div class="area-box" data-area-box><span class="area-size" data-area-size></span></div></div>
    <div class="area-hint">${I.map(16)}<span>Move and zoom the map so the box covers the area you need.</span></div>
    <div class="area-sheet" data-area-sheet>${areaSheetInner()}</div></div>`;
}
function areaSheetInner() {
  const d = offline.download, lim = offlineLimits();
  return `<div data-area-status>${areaStatusInner()}</div>
      <div class="area-days"><span>Timetables for</span>${segmented("offline_days", String(offline.days), [["1", "1 day"], ["3", "3 days"], [String(lim.max_days), `${lim.max_days} days`]], "offline-days")}</div>
      ${d?.error ? notice(esc(d.error), "error") : ""}
      <div data-area-progress>${d?.busy ? areaProgressInner() : ""}</div>
      <button class="btn btn-primary" data-action="offline-download" ${d?.busy ? 'disabled aria-busy="true"' : area.failed || !area.bbox ? "disabled" : ""}>${d?.busy ? "Downloading…" : "Download Information"}</button>
      <p class="fine">Saves the map, suburb and major place names, Translink timetables and the road and path network inside the box, plus your saved places in it. ${offline.online ? "" : "You're offline, so the map and download need internet."}</p>`;
}
function areaStatusInner() {
  const lim = offlineLimits(), z = area.sizeKm;
  if (area.failed) return `<p class="area-readout bad">Choosing an area needs the map, which couldn't load. Try again with a connection, or check the server's browser map key.</p>`;
  if (!z) return `<p class="area-readout">Finding the area…</p>`;
  const tooBig = z.w > lim.max_side_km || z.h > lim.max_side_km || z.w * z.h > lim.max_area_km2, tooSmall = z.w < lim.min_side_km || z.h < lim.min_side_km;
  return `<p class="area-readout${tooBig || tooSmall ? " bad" : ""}"><b>${z.w.toFixed(1)} × ${z.h.toFixed(1)} km</b> · ${(z.w * z.h).toFixed(0)} km²${tooBig ? ` · too large, zoom in (up to ${lim.max_side_km} km across)` : tooSmall ? " · too small, zoom out" : ""}</p>`;
}
function areaProgressInner() {
  const p = offline.download?.progress || { step: "map" };
  const steps = [["map", "Map and routes (OpenStreetMap)"], ["transit", "Translink timetables"], ["saving", "Saving on this device"]];
  const at = Math.max(0, steps.findIndex(([k]) => k === p.step));
  // The server prepares large areas in the background and asks the app to try again; say so rather than look stuck.
  const wait = p.waiting ? `<small class="area-wait">The server is still preparing this area. Trying again in about ${Math.round(p.waiting)} seconds.</small>` : "";
  return `<div class="area-progress" role="status">${steps.map(([k, label], i) => `<span class="${i < at ? "done" : i === at ? "now" : ""}">${i < at ? I.check(14) : ""}${label}</span>${i === at ? wait : ""}`).join("")}
    <div class="progress"><span style="transform:scaleX(${Math.max(0.05, (at + (p.total ? Math.min(1, p.done / p.total) : 0.4)) / steps.length)})"></span></div></div>`;
}
function measureArea() {
  const sheet = currentPage?.querySelector("[data-area-sheet]");
  if (sheet) currentPage.style.setProperty("--area-sheet", `${sheet.offsetHeight}px`);
  const box = currentPage?.querySelector("[data-area-box]"), el = area.map?.getDiv();
  const proj = area.overlay?.getProjection();
  if (!box || !el || !proj) return;
  const m = el.getBoundingClientRect(), b = box.getBoundingClientRect();
  const nw = proj.fromContainerPixelToLatLng(new GM.Point(b.left - m.left, b.top - m.top));
  const se = proj.fromContainerPixelToLatLng(new GM.Point(b.right - m.left, b.bottom - m.top));
  if (!nw || !se) return;
  area.bbox = [se.lat(), nw.lng(), nw.lat(), se.lng()].map((v) => Number(v.toFixed(5)));
  area.sizeKm = { w: dist([area.bbox[0], area.bbox[1]], [area.bbox[0], area.bbox[3]]) / 1000, h: dist([area.bbox[0], area.bbox[1]], [area.bbox[2], area.bbox[1]]) / 1000 };
  setHTML(currentPage.querySelector("[data-area-status]"), areaStatusInner());
  const size = currentPage.querySelector("[data-area-size]");
  if (size) size.textContent = `${area.sizeKm.w.toFixed(1)} × ${area.sizeKm.h.toFixed(1)} km`;
}
function buildAreaMap() {
  const el = currentPage?.querySelector("[data-area-map]");
  measureArea();
  if (!el || state.offline) return;
  loadGoogleMaps().then(() => {
    if (!document.body.contains(el)) return;
    el.replaceChildren();
    const c = offline.pack?.bbox ? [(offline.pack.bbox[0] + offline.pack.bbox[2]) / 2, (offline.pack.bbox[1] + offline.pack.bbox[3]) / 2] : state.biasCoords || BRISBANE;
    const map = area.map = makeGoogleMap(el);
    map.setOptions({ center: toLatLng(c), zoom: 13, minZoom: 10, clickableIcons: false });
    area.overlay = Object.assign(new GM.OverlayView(), { onAdd() {}, draw() {}, onRemove() {} });
    area.overlay.setMap(map);
    map.addListener("idle", measureArea);
    map.addListener("bounds_changed", () => requestAnimationFrame(measureArea));
  }).catch((error) => {
    if (!document.body.contains(el)) return;
    area.failed = error.message;
    currentPage?.querySelector(".area-mask")?.setAttribute("hidden", "");
    showMapFail(el, error.message);
    rerenderArea();
  });
}
function disposeAreaMap() {
  if (!area.map) return;
  area.overlay?.setMap(null);
  GM?.event?.clearInstanceListeners(area.map);
  Object.assign(area, { map: null, overlay: null, bbox: null, sizeKm: null, failed: null });
}
// Saved places come along with the area (only those inside it). Coordinates come from a dropped pin, or from the place's Google ID
// via the server's place lookup; text-only addresses without either cannot be placed offline.
async function savedPlacesFor(bbox) {
  const inBox = (lat, lng) => lat >= bbox[0] && lat <= bbox[2] && lng >= bbox[1] && lng <= bbox[3];
  const out = [];
  for (const p of settings.saved_places.filter((place) => place.address)) {
    let c = null;
    const m = LATLNG_TEXT.exec(p.address);
    if (m) c = [Number(m[1]), Number(m[2])];
    else if (p.place_id) {
      const r = await fetch(`/api/place?id=${encodeURIComponent(p.place_id)}`).catch(() => null);
      const data = r?.ok ? await r.json().catch(() => null) : null;
      if (data?.location) c = data.location;
    }
    if (c && inBox(c[0], c[1])) out.push({ name: p.name, address: p.address, lat: c[0], lng: c[1] });
  }
  return out;
}
async function downloadArea() {
  const lim = offlineLimits(), z = area.sizeKm, bbox = area.bbox;
  if (!bbox || !z) return;
  if (z.w > lim.max_side_km || z.h > lim.max_side_km || z.w * z.h > lim.max_area_km2) return toast(`Zoom in: the area can be up to ${lim.max_side_km} km across.`, "warning");
  if (z.w < lim.min_side_km || z.h < lim.min_side_km) return toast("Zoom out a little: the area is too small.", "warning");
  try { const r = await fetch("/api/status"); if (r.ok) state.status = await r.json(); } catch { /* the download itself reports a connection problem */ }
  if (state.status?.offline_transit && state.status.offline_transit !== "ready") {
    offline.download = { busy: false, error: state.status.offline_transit === "loading" ? "Translink's timetables are still being prepared on the server. Try again in a few minutes." : "Translink's timetables aren't available on the server right now, so an offline area can't be downloaded." };
    return rerenderArea();
  }
  offline.download = { busy: true, progress: { step: "map" }, error: null };
  rerenderArea();
  try {
    const pack = await RerouteOffline.download(bbox, { days: offline.days, onProgress: (p) => { offline.download.progress = p; setHTML(currentPage?.querySelector("[data-area-progress]"), areaProgressInner()); } });
    offline.download.progress = { step: "saving" };
    setHTML(currentPage?.querySelector("[data-area-progress]"), areaProgressInner());
    pack.saved = await savedPlacesFor(bbox);
    // The local average fuel price is saved with the area so offline driving costs are not left incomplete.
    try { const r = await fetch(`/api/fuel?lat=${((bbox[0] + bbox[2]) / 2).toFixed(4)}&lng=${((bbox[1] + bbox[3]) / 2).toFixed(4)}&type=${settings.fuel_type}`); const f = r.ok ? await r.json() : null; if (f?.price) pack.fuel = { price: f.price, fuel_type: settings.fuel_type, fetched_at: new Date().toISOString() }; } catch { /* optional */ }
    const centre = [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2];
    const near = (pack.map?.places || []).filter((p) => ["suburb", "neighbourhood", "quarter", "town", "city"].includes(p.k)).sort((a, b) => dist(centre, [a.lat, a.lng]) - dist(centre, [b.lat, b.lng]));
    pack.label = pack.label || (near.length ? `Around ${near.slice(0, 2).map((p) => p.n).join(" and ")}` : "Downloaded area");
    if (!(await RerouteOffline.savePack(pack))) throw new Error("This browser couldn't store the offline data (it may be in private mode or out of space).");
    offline.pack = pack;
    offline.summary = RerouteOffline.packSummary(pack);
    RerouteOffline.setActivePack(pack);
    offline.download = null;
    toast(`Saved for offline use: ${pack.label} (${mb(offline.summary.bytes)}).`);
    goBack();
  } catch (error) {
    offline.download = { busy: false, error: error.message || "The download failed. Try again." };
    rerenderArea();
  }
}
const rerenderArea = () => { const sheet = state.screen === "offline-area" && currentPage?.querySelector("[data-area-sheet]"); if (sheet) { sheet.innerHTML = areaSheetInner(); measureArea(); } };
// A full-height preview of what is saved, drawn by the offline map whether or not there is internet.
function openOfflinePreview() {
  if (!offline.pack || !window.RerouteOffline) return;
  openPopup(`<div class="grabber"><span></span></div>
    <div class="sheet-head"><h3 id="popup-title">${esc(offline.summary?.label || "Offline map")}</h3><button class="icon-btn" data-action="close-popup" aria-label="Close">${I.x(18)}</button></div>
    <div class="picker-body"><div class="map-wrap picker-wrap"><div class="map picker-map" data-offline-preview></div></div>
      <p class="fine">${esc(dayRange(offline.pack.transit?.days))} timetables · ${plural(offline.summary?.stops || 0, "stop")} · ${mb(offline.summary?.bytes || 0)} · Map data © OpenStreetMap contributors</p></div>`, "picker offline-preview");
  const el = popupEl.querySelector("[data-offline-preview]");
  RerouteOffline.setActivePack(offline.pack);
  const OM = RerouteOffline.maps, b = offline.pack.bbox;
  const map = new OM.Map(el, { center: { lat: (b[0] + b[2]) / 2, lng: (b[1] + b[3]) / 2 }, zoom: 13, gestureHandling: "greedy" });
  map.setOptions({ offlineExtras: { places: (offline.pack.saved || []).map((p) => ({ name: p.name, lat: p.lat, lng: p.lng })) } });
  const bounds = new OM.LatLngBounds();
  bounds.extend({ lat: b[0], lng: b[1] });
  bounds.extend({ lat: b[2], lng: b[3] });
  map.fitBounds(bounds, 16);
}

async function boot() {
  applyTheme();
  renderDemoPill();
  rerender();
  renderNetBanner();
  window.addEventListener("online", () => setOnline(true));
  window.addEventListener("offline", () => setOnline(false));
  loadOfflinePack().then(() => { if (settingsEl) rerenderSettings(); });
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
    noteResponse(response);
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
    const editing = input && /^(places|draft)\./.test(input.dataset.ac);
    if (!editing) {
      settings.saved_places.filter((p) => p.address && (!q || p.address.toLowerCase().includes(q) || p.name.toLowerCase().startsWith(q))).slice(0, q ? 3 : 4)
        .forEach((p) => entries.push({ kind: "saved", glyph: placeGlyph(p), main: p.name, secondary: p.address, text: p.address, place_id: p.place_id }));
    }
    // Offline, recent Google places are left out: they have a place ID but no coordinates, so they cannot be routed from the download.
    (state.offline ? [] : recent()).filter((r) => !q || r.text.toLowerCase().includes(q)).slice(0, q ? 2 : 4)
      .forEach((r) => { if (!entries.some((e) => e.text === r.text)) entries.push({ ...r, kind: "recent" }); });
    return entries;
  }
  // Every location field ends its list with "Choose on map".
  const withMap = (list) => [...list, { kind: "map", main: "Choose on map", secondary: state.offline ? "Press and hold to drop a pin" : "Tap a place, or press and hold to drop a pin" }];

  function bolded(item) {
    if (!item.matches?.length) return esc(item.main);
    let out = "", last = 0;
    item.matches.forEach(([a, b]) => { out += esc(item.main.slice(last, a)) + `<b>${esc(item.main.slice(a, b))}</b>`; last = b; });
    return out + esc(item.main.slice(last));
  }

  const ICON = { transit: () => I.bus(16), street: () => I.route(16), place: () => I.pin(16), recent: () => I.clock(16), location: () => I.locate(16), map: () => I.map(16) };

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
    const hasGoogle = !state.offline && items.some((i) => !["saved", "recent", "location", "map"].includes(i.kind));
    list.innerHTML = `${items.map((item, i) => `
      <div class="ac-item${i === active ? " active" : ""}" id="ac-opt-${i}" role="option" aria-selected="${i === active}" data-ac-index="${i}" style="animation-delay:${i * 28}ms">
        <span class="ac-icon ${item.kind === "map" ? "pick" : item.kind}">${item.kind === "saved" ? I[item.glyph || "star"](16) : (ICON[item.kind] || ICON.place)()}</span>
        <span class="ac-text"><span class="ac-main">${bolded(item)}</span>${item.secondary ? `<span class="ac-sub">${esc(item.secondary)}</span>` : ""}</span>
      </div>`).join("")}
      ${loading ? `<div role="status" aria-label="Loading suggestions">${[0, 1].map(() => `<div class="ac-skel" aria-hidden="true"><div class="skeleton skel-tile" style="width:32px;height:32px;border-radius:10px"></div><div><div class="skeleton skel-line w-80"></div><div class="skeleton skel-line sm w-40"></div></div></div>`).join("")}</div>` : ""}
      ${hasGoogle ? `<div class="ac-foot">Suggestions by ${googleMapsAttribution()}</div>` : ""}`;
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
      items = withMap([...mine, ...google.filter((g) => !mine.some((l) => l.text === g.text))].slice(0, 7));
      active = -1;
      render();
    } catch {
      if (id === requestId && input) { items = withMap(local(text)); render(); }
    }
  }

  function open(el) {
    if (input !== el) { input = el; session = newSession(); }
    if (el.value.trim().length >= 3 && el.value !== CURRENT_PLACE && !/^Dropped pin/.test(el.value)) return onInput(el);
    items = withMap(local(el.value === CURRENT_PLACE || /^Dropped pin/.test(el.value) ? "" : el.value));
    active = -1;
    render();
  }

  function onInput(el) {
    if (input !== el) { input = el; session = newSession(); }
    clearTimeout(timer);
    const text = el.value.trim();
    items = withMap(local(text));
    active = -1;
    if (state.offline) {
      if (text.length >= 2) items = withMap([...local(text), ...offlineSuggestions(text)].slice(0, 7));
      return render();
    }
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

  function choose(index) {
    const item = items[index];
    const el = input;
    if (!item || !el) return;
    const path = el.dataset.ac;
    if (item.kind === "map") {
      close();
      openMapPicker(path);
      return;
    }
    if (item.kind === "location") {
      close();
      el.value = "";
      (el.closest(".row, .panic-field") || el).classList.add("is-loading");
      locate((coords) => {
        if (coords) {
          state.biasCoords = coords;
          applyPlace(path, storesText(path) ? coordText(coords) : CURRENT_PLACE, null, storesText(path) ? null : coords);
          if (path === "panic.origin") state.panic.coords = coords;
        } else { applyPlace(path, "", null); toast("Location is unavailable. Type the address instead."); }
        if (storesText(path)) { rerenderSettings(); const d = sheetEl?.querySelector('[data-draft="address"]'); if (d) { d.value = state.placeDraft?.address || ""; d.closest(".row")?.classList.remove("is-loading"); } }
        else rerender();
      });
      return;
    }
    el.value = item.text;
    if (item.coords) applyPlace(path, storesText(path) ? coordText(item.coords) : item.text, null, storesText(path) ? null : item.coords);
    else applyPlace(path, item.text, item.place_id);
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

  document.addEventListener("focusin", (e) => {
    if (!e.target.dataset?.ac) return;
    const t = e.target;
    // "Current location" and "Dropped pin (...)" stand in for coordinates: select them so typing replaces the whole label.
    if (t.value === CURRENT_PLACE || /^Dropped pin \(/.test(t.value)) requestAnimationFrame(() => { if (document.activeElement === t) t.setSelectionRange(0, t.value.length); });
    open(t);
  });
  document.addEventListener("focusout", (e) => { if (e.target === input) setTimeout(() => { if (document.activeElement !== input) close(); }, 120); });
  document.addEventListener("keydown", onKey, true);
  viewport.addEventListener("scroll", position, true);
  window.addEventListener("resize", position);
  return { onInput, close };
})();

// Writes a chosen place into the field named by `path` (form.origin, panic.dest, places.home, draft.address, ...). Trip fields (form, panic)
// keep coordinates beside a readable label; saved places store plain text, so a pin is saved as its "lat,lng" coordinates.
function applyPlace(path, text, placeId, coords = null) {
  const [scope, field] = path.split(".");
  if (scope === "form") { Object.assign(state.form, { [field]: text, [`${field}PlaceId`]: placeId || null, [`${field}Coords`]: coords }); if (field === "origin") Object.assign(state.form, { originLocating: false, originNote: null }); state.error = null; }
  else if (scope === "panic") { Object.assign(state.panic, { [field]: text, [`${field}PlaceId`]: placeId || null, [`${field}Coords`]: coords }); }
  else if (scope === "draft") { if (state.placeDraft) Object.assign(state.placeDraft, { [field]: text, place_id: placeId || null }); }
  else { const p = savedPlace(field); if (p) { p.address = text.slice(0, PLACE_ADDRESS_MAX); p.place_id = placeId || null; saveSettings(); } }
}
const storesText = (path) => /^(places|draft)\./.test(path);

// ── Choose on map ────────────────────────────────────────────────────────────
// A tall pop-up with a Google map that shows places. Tap a place icon to choose it (its Google place ID is used for routing and the
// server looks up its name), or press and hold anywhere to drop a pin (its coordinates are used). The pin can be dragged to adjust it.
// Maps JavaScript has no long-press event and iOS Safari never fires contextmenu, so a press timer on the map's own element detects it.
const picker = { path: null, map: null, me: null, overlay: null, choice: null, lastPress: 0, req: 0 };
const PICKER_FOR = { "form.origin": "your start", "form.destination": "your destination", "panic.origin": "where you are", "panic.dest": "your destination", "places.home": "Home", "places.work": "Work/Uni", "draft.address": "this place" };
function pickerCardInner() {
  const c = picker.choice;
  // Offline maps have no Google places to tap, so only the pin is offered there.
  if (!c) return `<div class="picker-hint"><span class="row-icon" style="--tone:var(--accent)">${I.pin(18)}</span><p>${state.offline ? "<b>Press and hold</b> anywhere on the offline map to drop a pin." : "<b>Tap a place</b> on the map to choose it, or <b>press and hold</b> anywhere to drop a pin."}</p></div>`;
  if (c.kind === "loading") return skelLines("Looking up this place", 60, 80);
  if (c.kind === "place") return `<div class="picker-choice"><span class="row-icon" style="--tone:var(--error)">${I.pin(18)}</span><div><b>${esc(c.name)}</b><small>${esc(c.address)}</small><span class="picker-attr">${googleMapsAttribution()}</span></div></div>`;
  return `<div class="picker-choice"><span class="row-icon" style="--tone:var(--error)">${I.pin(18)}</span><div><b>Dropped pin</b><small>${c.lat.toFixed(5)}, ${c.lng.toFixed(5)} · drag the pin to adjust it</small>${c.note ? `<small class="warn-text">${esc(c.note)}</small>` : ""}</div></div>`;
}
function pickerSheet(path) {
  return `<div class="grabber"><span></span></div>
    <div class="sheet-head"><h3 id="popup-title">Choose ${esc(PICKER_FOR[path] || "a place")} on the map</h3><button class="icon-btn" data-action="close-popup" aria-label="Close">${I.x(18)}</button></div>
    <div class="picker-body">
      <div class="map-wrap picker-wrap"><div class="map picker-map" data-picker-map><div class="skeleton map-skeleton" role="status" aria-label="Loading map"></div></div>
        <div class="map-controls">
          <button data-action="picker-zoom" data-delta="1" aria-label="Zoom in">${I.plus(18)}</button>
          <button data-action="picker-zoom" data-delta="-1" aria-label="Zoom out">${I.minus(18)}</button>
          <button data-action="picker-locate" aria-label="Go to my location">${I.locate(18)}</button>
        </div></div>
      <div class="picker-card" data-picker-card aria-live="polite">${pickerCardInner()}</div>
    </div>
    <div class="sheet-foot"><button class="btn btn-primary" data-action="picker-use" disabled>Use this place</button></div>`;
}
function paintPicker() {
  const card = popupEl?.querySelector("[data-picker-card]");
  if (card) card.innerHTML = pickerCardInner();
  const use = popupEl?.querySelector('[data-action="picker-use"]');
  if (use) use.disabled = !picker.choice || picker.choice.kind === "loading";
}
// Where the map opens: the field's current pin or location, then your position, then the trip start, then central Brisbane.
function pickerStart(path) {
  const [scope, field] = path.split(".");
  const own = scope === "form" ? state.form?.[`${field}Coords`] : scope === "panic" ? (field === "origin" ? state.panic.coords || state.panic.originCoords : state.panic.destCoords) : null;
  const c = own || state.biasCoords || state.panic.coords || state.plan?.start;
  return c ? { c, zoom: own ? 17 : 15 } : { c: BRISBANE, zoom: 13 };
}
// Places stay visible here (the route maps hide them); the dark style keeps their labels readable.
const PICKER_DARK_STYLES = [...DARK_MAP_STYLES.filter((s) => s.featureType !== "poi"),
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#C7CEDB" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#1C2A2A" }] }];
const pickerStyles = () => (document.documentElement.dataset.theme === "light" ? [] : PICKER_DARK_STYLES);

function openMapPicker(path) {
  autocomplete.close();
  document.activeElement?.blur?.();
  Object.assign(picker, { path, choice: null, lastPress: 0, req: picker.req + 1 });
  openPopup(pickerSheet(path), "picker");
  const el = popupEl.querySelector("[data-picker-map]");
  loadGoogleMaps().then(() => {
    if (!popupEl?.contains(el)) return;
    el.replaceChildren();
    el.classList.add("google-map");
    const start = pickerStart(path);
    const map = picker.map = new GM.Map(el, {
      center: toLatLng(start.c), zoom: start.zoom, gestureHandling: "greedy", clickableIcons: true,
      mapTypeControl: false, streetViewControl: false, fullscreenControl: false, zoomControl: false, rotateControl: false, cameraControl: false, styles: pickerStyles(),
    });
    picker.overlay = pickerOverlay(map);
    picker.overlay.onDragStart = () => { picker.req++; }; // a place lookup still on its way is now out of date
    picker.overlay.onDrop = (latLng) => { picker.req++; picker.choice = { kind: "pin", lat: latLng.lat(), lng: latLng.lng() }; paintPicker(); };
    picker.overlay.setMap(map);
    if (state.biasCoords) picker.me = new GM.Marker({ position: toLatLng(state.biasCoords), map, icon: mapIcon("here"), clickable: false, zIndex: 5, title: "Your location" });
    map.addListener("click", (event) => {
      const justPressed = picker.pressing || performance.now() - picker.lastPress < 800;
      if (event.placeId) { event.stop(); if (!justPressed) choosePoi(event.placeId, event.latLng); }
    });
    // Right-click on a computer (and long-press on Android) drops a pin too; skip it when the press timer already did.
    map.addListener("contextmenu", (event) => { if (performance.now() - picker.lastPress > 800) dropPin(event.latLng); });
    bindLongPress(el);
  }).catch((error) => { if (document.body.contains(el)) showMapFail(el, error.message); });
}
function bindLongPress(el) {
  let press = null;
  const cancel = () => { if (press) clearTimeout(press.timer); press = null; };
  el.addEventListener("pointerdown", (e) => {
    if (press) return cancel(); // a second finger means a pinch, not a press
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (e.target.closest?.(".pick-marker") || picker.overlay?.dragging?.()) return; // pressing the pin drags it instead
    const box = el.getBoundingClientRect(), x = e.clientX, y = e.clientY;
    press = { id: e.pointerId, x, y, timer: setTimeout(() => {
      press = null;
      const latLng = picker.overlay?.getProjection()?.fromContainerPixelToLatLng(new GM.Point(x - box.left, y - box.top));
      if (latLng) { picker.lastPress = performance.now(); picker.pressing = true; dropPin(latLng); }
    }, 550) };
  }, true);
  el.addEventListener("pointermove", (e) => { if (press && e.pointerId === press.id && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 10) cancel(); }, true);
  ["pointerup", "pointercancel"].forEach((type) => el.addEventListener(type, (e) => {
    if (press && e.pointerId === press.id) cancel();
    if (picker.pressing) setTimeout(() => { picker.pressing = false; }, 300); // the click that follows a long press is ignored
  }, true));
}
// The chosen spot, drawn as HTML in a custom overlay (it works without a Map ID) so it can change shape, which a Marker icon cannot.
// A tapped place grows from its own icon into a large pin in the place's Google colour with its own glyph. A dropped pin has the shape of
// a Google Maps pin, with its tip exactly on the spot. While it is dragged it turns into a plain circle and the map stops panning; when it
// is put down it bounces back into a pin. The animations are CSS, so the reduced-motion setting shortens them like every other animation.
const PLACE_LOADING_COLOUR = "#7B9EB0"; // Google's neutral place colour, shown while a tapped place is looked up
function pickerOverlay(map) {
  const view = new GM.OverlayView();
  const el = document.createElement("div");
  el.className = "pick-marker";
  el.hidden = true;
  el.innerHTML = `<span class="pick-shadow"></span><span class="pick-lift" role="img" aria-label="Chosen place"><span class="pick-shape"><i class="pick-dot"></i></span></span>`;
  GM.OverlayView.preventMapHitsAndGesturesFrom(el);
  const lift = el.querySelector(".pick-lift"), shape = el.querySelector(".pick-shape");
  let pos = null, drag = null;
  const draw = () => { const p = pos && view.getProjection()?.fromLatLngToDivPixel(pos); if (p) { el.style.left = `${p.x}px`; el.style.top = `${p.y}px`; } };
  const replay = (name) => { el.classList.remove("pop", "drop", "land"); void el.offsetWidth; if (name) el.classList.add(name); };
  // look: { kind: "pin" } or { kind: "place", colour, glyph }. The glyph and colour come from the server, which only passes a Google
  // gstatic icon address and a #RRGGBB colour, and they are set as properties rather than as HTML.
  const setLook = (look) => {
    el.classList.toggle("is-place", look.kind === "place");
    if (look.colour) el.style.setProperty("--pin", look.colour); else el.style.removeProperty("--pin");
    if (look.glyph) { const img = document.createElement("img"); img.alt = ""; img.decoding = "async"; img.src = look.glyph; img.onerror = () => { img.replaceWith(dot()); }; shape.replaceChildren(img); }
    else if (!shape.querySelector(".pick-dot")) shape.replaceChildren(dot());
    lift.setAttribute("aria-label", look.kind === "place" ? "Chosen place" : "Dropped pin");
  };
  const dot = () => Object.assign(document.createElement("i"), { className: "pick-dot" });
  view.place = (latLng, look, motion = "") => { if (drag?.moved) return; pos = latLng; el.hidden = false; setLook(look); draw(); if (motion) replay(motion); };
  view.dragging = () => !!drag;
  Object.assign(view, { onAdd() { view.getPanes().overlayMouseTarget.appendChild(el); }, draw, onRemove() { el.remove(); } });
  // Dragging: pointer capture keeps the moves coming to the pin, and pixel moves are turned into positions with the overlay's projection.
  lift.addEventListener("pointerdown", (e) => {
    if (drag || (e.pointerType === "mouse" && e.button !== 0)) return;
    const start = view.getProjection()?.fromLatLngToDivPixel(pos);
    if (!start) return;
    e.preventDefault();
    e.stopPropagation();
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, start, moved: false, gestures: map.get("gestureHandling") || "greedy" };
    try { lift.setPointerCapture(e.pointerId); } catch { /* the pointer already ended */ }
    map.setOptions({ gestureHandling: "none" });
  });
  lift.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    if (!drag.moved) { drag.moved = true; view.onDragStart?.(); replay(); setLook({ kind: "pin" }); el.classList.add("dragging"); }
    pos = view.getProjection()?.fromDivPixelToLatLng(new GM.Point(drag.start.x + dx, drag.start.y + dy)) || pos;
    draw();
  });
  const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const moved = drag.moved;
    map.setOptions({ gestureHandling: drag.gestures });
    drag = null;
    if (!moved) return;
    el.classList.remove("dragging");
    replay("land");
    try { navigator.vibrate?.(8); } catch { /* optional */ }
    view.onDrop?.(pos);
  };
  ["pointerup", "pointercancel", "lostpointercapture"].forEach((type) => lift.addEventListener(type, end));
  return view;
}
function dropPin(latLng) {
  if (!picker.overlay) return;
  try { navigator.vibrate?.(12); } catch { /* optional */ }
  picker.req++;
  picker.overlay.place(latLng, { kind: "pin" }, "drop");
  picker.choice = { kind: "pin", lat: latLng.lat(), lng: latLng.lng() };
  paintPicker();
}
async function choosePoi(placeId, latLng) {
  if (!picker.overlay) return;
  const req = ++picker.req;
  picker.overlay.place(latLng, { kind: "place", colour: PLACE_LOADING_COLOUR }, "pop");
  picker.choice = { kind: "loading" };
  paintPicker();
  try {
    const r = await fetch(`/api/place?id=${encodeURIComponent(placeId)}`);
    const data = await r.json().catch(() => ({}));
    if (req !== picker.req) return;
    if (!r.ok || !data.name) throw new Error(data.error || "That place's name isn't available right now.");
    picker.choice = { kind: "place", placeId, name: data.name, address: data.address || "", lat: data.location?.[0] ?? latLng.lat(), lng: data.location?.[1] ?? latLng.lng() };
    picker.overlay?.place(latLng, { kind: "place", colour: data.icon?.background || null, glyph: data.icon?.mask || null });
  } catch (error) {
    if (req !== picker.req) return;
    picker.choice = { kind: "pin", lat: latLng.lat(), lng: latLng.lng(), note: `${error.message} The pin's position will be used instead.` };
    picker.overlay?.place(latLng, { kind: "pin" }, "land");
  }
  paintPicker();
}
function usePickedPlace() {
  const c = picker.choice, path = picker.path;
  if (!c || c.kind === "loading" || !path) return;
  const coords = [Number(c.lat.toFixed(6)), Number(c.lng.toFixed(6))];
  if (c.kind === "place") {
    const text = c.address && !c.address.toLowerCase().startsWith(c.name.toLowerCase()) ? `${c.name}, ${c.address}` : c.address || c.name;
    applyPlace(path, text, c.placeId, null);
  } else applyPlace(path, storesText(path) ? coordText(coords) : pinLabel(coords), null, storesText(path) ? null : coords);
  closePopup();
  if (path.startsWith("places.")) rerenderSettings();
  else if (path.startsWith("draft.")) { const input = sheetEl?.querySelector('[data-draft="address"]'); if (input) input.value = state.placeDraft?.address || ""; }
  else rerender();
}
function disposePicker() {
  if (picker.me) { GM.event.clearInstanceListeners(picker.me); picker.me.setMap(null); }
  picker.overlay?.setMap(null);
  if (picker.map) GM.event.clearInstanceListeners(picker.map);
  Object.assign(picker, { map: null, me: null, overlay: null, choice: null, path: null, req: picker.req + 1 });
}

function acAttrs(path) {
  return `data-ac="${path}" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="ac-list" autocomplete="off" spellcheck="false"`;
}

boot();
