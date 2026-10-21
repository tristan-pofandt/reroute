/* Plan B MVP v2 — mobile-style front end. Plain JavaScript, no build step. */
"use strict";

// ── Icons ────────────────────────────────────────────────────────────────────

const svg = (body, size = 20, width = 1.75) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

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
  chevronLeft: (s = 22) => svg('<polyline points="15 18 9 12 15 6"/>', s, 2.5),
  chevronRight: (s = 16) => svg('<polyline points="9 18 15 12 9 6"/>', s, 2.2),
  alert: (s) => svg('<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>', s),
  checkCircle: (s) => svg('<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>', s),
  xCircle: (s) => svg('<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>', s),
  pin: (s) => svg('<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>', s),
  transfer: (s) => svg('<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>', s),
  route: (s) => svg('<circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H16a3.5 3.5 0 0 0 0-7H8a3.5 3.5 0 0 1 0-7h7.5"/>', s),
  signal: (s) => svg('<path d="M2 20h.01M7 20v-4M12 20v-8M17 20V8M22 4v16"/>', s),
  minus: (s = 16) => svg('<line x1="5" y1="12" x2="19" y2="12"/>', s, 2.5),
  plus: (s = 16) => svg('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>', s, 2.5),
  x: (s = 14) => svg('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>', s, 2.5),
  check: (s = 13) => svg('<polyline points="20 6 9 17 4 12"/>', s, 3),
  hourglass: (s) => svg('<path d="M6 2h12M6 22h12M7 2v4.5a5 5 0 0 0 10 0V2M7 22v-4.5a5 5 0 0 1 10 0V22"/>', s),
  gear: (s = 20) => svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>', s),
  leaf: (s) => svg('<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>', s),
  mountain: (s) => svg('<path d="M8 3l4 8 5-5 5 15H2L8 3z"/>', s),
  parking: (s) => svg('<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>', s),
  users: (s) => svg('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>', s),
  bolt: (s) => svg('<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>', s, 2),
  locate: (s) => svg('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="7"/>', s),
  chart: (s) => svg('<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>', s),
  expand: (s = 18) => svg('<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>', s),
  shrink: (s = 18) => svg('<polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/>', s),
  fit: (s = 18) => svg('<path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3"/>', s),
  search: (s) => svg('<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>', s),
  eye: (s) => svg('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>', s),
  external: (s = 16) => svg('<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>', s),
  moon: (s) => svg('<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>', s),
  home: (s) => svg('<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>', s),
};
const KIND_ICON = { bus: I.bus, rail: I.train, tram: I.tram, ferry: I.ferry, mixed: I.route, rideshare: I.rideshare, car: I.car, walk: I.walk, carpool: I.users };
const SEGMENT_COLOUR = { walk: "#8E8E93", bus: "#007AFF", rail: "#E8590C", tram: "#AF52DE", ferry: "#0FA3B1", car: "#3A3A3C", rideshare: "#AF52DE" };
const KIND_NAME = { walk: "Walk", bus: "Bus", rail: "Train", tram: "Light rail", ferry: "Ferry", car: "Drive", rideshare: "Uber" };

// ── Persistent preferences (this browser only) ───────────────────────────────

const store = {
  get(name, fallback) { try { const v = localStorage.getItem(`planb.${name}`); return v === null ? fallback : JSON.parse(v); } catch { return fallback; } },
  set(name, value) { try { localStorage.setItem(`planb.${name}`, JSON.stringify(value)); } catch { /* storage unavailable: keep in memory */ } },
};

const DEFAULT_SETTINGS = {
  theme: "system", motion: "full",
  modes: { transit: true, drive: true, rideshare: true },
  transit_modes: { bus: true, train: true, tram: true, ferry: true },
  fuel_l_per_100km: 8, fuel_type: "SP91", fuel_price_mode: "auto", fuel_price: 2.3,
  parking_cost: null, use_flat_fare: true, flat_fare: 0.5,
  budget: 10, walking: 15,
  show: { buffer: true, cost: true, walking: true, transfers: true, elevation: true, co2: true, parking: true, realtime: true },
  places: { home: "", work: "The University of Queensland, St Lucia QLD 4072" },
  watch: true,
  factors: { bus: 0.105, rail: 0.035, tram: 0.029, ferry: 0.019 },
};

function loadSettings() {
  const saved = store.get("settings", {});
  const merged = { ...DEFAULT_SETTINGS, ...saved };
  for (const key of ["modes", "transit_modes", "show", "places", "factors"]) merged[key] = { ...DEFAULT_SETTINGS[key], ...(saved[key] || {}) };
  return merged;
}

const settings = loadSettings();
const saveSettings = () => store.set("settings", settings);

// ── App state ────────────────────────────────────────────────────────────────

const state = {
  screen: "home", stack: ["home"],
  status: null, alerts: null, alertsError: null,
  purpose: "planb", form: null, plan: null, loading: false, error: null,
  sort: "best", chosenId: null, sheetId: null,
  watch: { lines: [], seen: new Set(), alert: null, timer: null },
  panic: { phase: "ask", coords: null, locating: false, dest: "", by: "", error: null },
  rides: { mine: [], loading: false, error: null, joining: null },
  dashTable: false,
};

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const money = (v) => (v === null || v === undefined ? "Unknown" : `$${Number(v).toFixed(2).replace(/\.00$/, "")}`);
const kg = (v) => (Math.abs(v) < 1 ? `${Math.round(v * 1000)} g` : `${v.toFixed(1)} kg`);
const timeOf = (iso) => new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Brisbane", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso)).replace(" ", " ");
const dateLabel = (iso) => new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Brisbane", weekday: "short", day: "numeric", month: "short" }).format(new Date(iso));
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const findOption = (id) => state.plan?.options.find((o) => o.id === id);
const brisbaneNowLocal = () => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Brisbane", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date()).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour === "24" ? "00" : parts.hour}:${parts.minute}`;
};
const addMinutes = (local, minutes) => {
  const d = new Date(`${local}:00+10:00`);
  d.setMinutes(d.getMinutes() + minutes);
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Brisbane", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour === "24" ? "00" : parts.hour}:${parts.minute}`;
};

// ── Shared components ────────────────────────────────────────────────────────

function navbar(title, back, right = "") {
  const backBtn = back ? `<button class="nav-back" data-action="back" aria-label="Back to ${esc(back)}">${I.chevronLeft()}<span>${esc(back)}</span></button>` : "";
  return `<header class="navbar"><div class="side">${backBtn}</div><span class="title">${esc(title)}</span><div class="side end">${right}</div></header>`;
}
const gearButton = () => `<button class="icon-btn spin-on-hover" data-action="open-settings" aria-label="Settings">${I.gear(19)}</button>`;
const row = (icon, bg, label, value = "", extra = "") =>
  `<div class="row ${extra}"><span class="row-icon" style="background:${bg}">${icon}</span><span class="row-label">${label}</span>${value}</div>`;
const valueSpan = (text, strong = false) => `<span class="row-value${strong ? " strong" : ""}">${esc(text)}</span>`;
function notice(text, kind = "") {
  const icon = kind === "info" ? I.signal(14) : kind === "good" ? I.leaf(14) : I.alert(14);
  return `<div class="notice ${kind}" role="${kind === "error" ? "alert" : "note"}">${icon}<span>${text}</span></div>`;
}
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
  return `<div class="segmented" role="group" style="--n:${choices.length}">
    <span class="thumb" style="width:calc((100% - 4px) / ${choices.length});transform:translateX(${index * 100}%)"></span>
    ${choices.map(([v, label]) => `<button data-action="${action}" data-name="${name}" data-value="${v}" aria-pressed="${v === value}">${esc(label)}</button>`).join("")}</div>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// Screens
// ══════════════════════════════════════════════════════════════════════════════

function homeScreen() {
  const live = state.status?.live_available;
  const alerts = (state.alerts?.alerts || []).filter((a) => a.disruptive);
  const impact = impactTotals(thisMonthTrips());
  const myRides = state.rides.mine.length;
  return `
    ${navbar("", null, gearButton())}
    <div class="scroll" style="padding-top:6px">
      <div class="hero">
        <div class="app-icon">${I.bus(38)}</div>
        <h1 class="brand">Plan B</h1>
        <p class="tagline">When your journey goes wrong, what now?</p>
      </div>
      <button class="panic-btn" data-action="go" data-screen="panic">
        <span class="panic-icon">${I.bolt(24)}</span>
        <span><strong>Panic mode</strong><small>Get me there now. One answer, no decisions.</small></span>
      </button>
      <div class="entry-grid">
        <button class="entry" data-action="start" data-purpose="planb">
          <span class="entry-icon" style="background:var(--orange)">${I.alert(18)}</span>
          <span><strong>My journey is disrupted</strong><small>Compare alternatives against your deadline</small></span>
        </button>
        <button class="entry" data-action="start" data-purpose="regular">
          <span class="entry-icon" style="background:var(--green)">${I.leaf(18)}</span>
          <span><strong>Plan a trip</strong><small>Everyday routes, public transport first</small></span>
        </button>
      </div>
      <button class="tile-card" data-action="open-alerts">
        <div class="tile-head"><h3>${state.alerts ? `<span class="live-dot"></span>` : ""}Translink right now</h3>${I.chevronRight()}</div>
        ${state.alertsError ? `<p class="muted" style="font-size:13px">${esc(state.alertsError)}</p>`
          : !state.alerts ? `<p class="muted" style="font-size:13px">Checking live service alerts…</p>`
          : alerts.length ? `<div class="alert-list-mini">${alerts.slice(0, 3).map((a) => `<p>${a.lines.slice(0, 2).map((l) => `<span class="line-tag">${esc(l)}</span>`).join("")}<span>${esc(a.header)}</span></p>`).join("")}</div>
            <p class="muted" style="font-size:12px;margin-top:8px">${plural(alerts.length, "active disruption alert")} from Translink GTFS-Realtime</p>`
          : `<p class="muted" style="font-size:13px">No disruption alerts reported.</p>`}
      </button>
      <button class="tile-card" data-action="go" data-screen="dashboard">
        <div class="tile-head"><h3>${I.leaf(16)} Your impact this month</h3>${I.chevronRight()}</div>
        <div class="stat-row">
          <div class="stat"><b>${kg(impact.co2)}</b><span>CO₂ avoided</span></div>
          <div class="stat"><b>${money(impact.saved)}</b><span>saved vs driving</span></div>
          <div class="stat"><b>${impact.greenTrips}</b><span>low-car trips</span></div>
        </div>
      </button>
      <button class="tile-card" data-action="go" data-screen="rides">
        <div class="tile-head"><h3>${I.users(16)} Shared rides</h3>${I.chevronRight()}</div>
        <p class="muted" style="font-size:13px;line-height:1.4">${myRides ? `You're in ${plural(myRides, "shared ride")}.` : "Disrupted with lots of others? Share a car or split an Uber with people heading your way."}</p>
      </button>
      ${live === false ? notice("Live search is off: no Google Maps API key was found on the server. See the README.", "error") : ""}
      <p class="muted" style="font-size:12px;text-align:center;margin:16px 0 6px"><a href="demo.html" style="color:var(--blue)">Fictional interview scenario</a> · Estimates only, always check before you travel</p>
    </div>`;
}

function placeChips(field) {
  const chips = [];
  if (field === "origin") chips.push(`<button class="chip quiet" data-action="use-location">${I.locate(13)}Current location</button>`);
  if (settings.places.home) chips.push(`<button class="chip quiet" data-action="fill-place" data-field="${field}" data-place="home">${I.home(13)}Home</button>`);
  if (settings.places.work) chips.push(`<button class="chip quiet" data-action="fill-place" data-field="${field}" data-place="work">${I.pin(13)}Work/Uni</button>`);
  return chips.length ? `<div class="place-chips">${chips.join("")}</div>` : "";
}

function journeyScreen() {
  const f = state.form;
  const planB = state.purpose === "planb";
  const modes = [settings.modes.transit && "Public transport", settings.modes.drive && "My car", settings.modes.rideshare && "Uber"].filter(Boolean).join(", ") || "None";
  return `
    ${navbar(planB ? "Disrupted journey" : "Plan a trip", "Home", gearButton())}
    <div class="scroll">
      <h2 class="large-title">${planB ? "Where do you need to be?" : "Where are you going?"}</h2>
      <p class="subtitle">${planB ? "Tell us your deadline. We'll find what still gets you there, using live Translink alerts." : "Public transport options come first, with the true cost of driving alongside."}</p>
      <p class="section-header">Journey</p>
      <div class="group"><div class="group-card">
        <div class="row field-row"><span class="row-icon" style="background:var(--green)">${I.walk(15)}</span><div class="place-input"><label for="f-origin">From</label><input id="f-origin" type="text" data-field="origin" value="${esc(f.origin)}" placeholder="Address, stop or place" autocomplete="off"></div></div>
        ${placeChips("origin")}
        <div class="row field-row"><span class="row-icon" style="background:var(--red)">${I.pin(15)}</span><div class="place-input"><label for="f-destination">To</label><input id="f-destination" type="text" data-field="destination" value="${esc(f.destination)}" placeholder="Address or place" autocomplete="off"></div></div>
        ${placeChips("destination")}
      </div></div>
      <p class="section-header">When</p>
      <div class="group"><div class="group-card">
        <div class="row toggle-row"><span class="row-icon" style="background:var(--blue)">${I.clock(15)}</span><span class="row-label">Leave now</span>${toggle("form.leave_now", f.leave_now, "Leave now")}</div>
        ${f.leave_now ? "" : row(I.clock(15), "var(--indigo)", "Leave at", `<input type="datetime-local" data-field="departure" value="${esc(f.departure)}" aria-label="Departure time">`)}
        ${row(I.hourglass(15), "var(--orange)", planB ? "Arrive by" : "Arrive by <small>Optional</small>", `<input type="datetime-local" data-field="deadline" value="${esc(f.deadline)}" aria-label="Arrival deadline">`)}
      </div>
      <p class="group-footer">Brisbane time.${planB ? "" : " Leave the deadline empty to just see the options."}</p></div>
      <p class="section-header">Limits</p>
      <div class="group"><div class="group-card">
        ${row(I.dollar(15), "var(--green)", "Max cost", stepper("budget", f.budget, `$${f.budget}`, 0, 200))}
        ${row(I.walk(15), "var(--blue)", "Max walking", stepper("walking", f.walking, `${f.walking} min`, 0, 60))}
      </div></div>
      ${planB ? `<p class="section-header">What was disrupted? (optional)</p>
      <div class="group"><div class="group-card">
        <div class="row field-row"><span class="row-icon" style="background:var(--red)">${I.alert(15)}</span><div class="place-input"><input type="text" data-field="avoid" value="${esc(f.avoid)}" placeholder="Bus or train line, e.g. 412" aria-label="Disrupted service"></div></div>
      </div><p class="group-footer">Routes using this service are flagged. Live Translink alerts are checked automatically.</p></div>` : ""}
      <button class="row" style="border-radius:12px;margin-bottom:22px" data-action="open-settings"><span class="row-icon" style="background:var(--purple)">${I.route(15)}</span><span class="row-label">Ways to travel<small>${esc(modes)}</small></span><span class="chev">${I.chevronRight()}</span></button>
      ${state.error ? notice(esc(state.error), "error") : ""}
      <div style="height:8px"></div>
    </div>
    <footer class="sticky">
      <button class="btn btn-primary" data-action="search" ${state.loading || !state.status?.live_available ? "disabled" : ""}>
        ${state.loading ? `<span class="spinner"></span>Checking routes and live services…` : planB ? "Find my Plan B" : "Show routes"}
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
  if (g < 10) return `<span class="fact good">${I.mountain(12)}Flat walk</span>`;
  if (g < 30) return `<span class="fact">${I.mountain(12)}Gentle climb +${g} m</span>`;
  return `<span class="fact warn">${I.mountain(12)}Uphill walk +${g} m</span>`;
}

function realtimeFact(o) {
  const rt = o.realtime;
  if (!rt) return "";
  const disruptive = rt.alerts.filter((a) => a.disruptive);
  if (disruptive.length) return `<span class="fact bad">${I.alert(12)}Translink alert</span>`;
  if (!rt.checked) return rt.error ? `<span class="fact">${I.signal(12)}Live status unavailable</span>` : "";
  if (rt.delay > 2) return `<span class="fact warn">${I.signal(12)}Running ~${rt.delay} min late</span>`;
  if (rt.cancelled) return `<span class="fact warn">${I.signal(12)}${plural(rt.cancelled, "cancelled trip")} today</span>`;
  return `<span class="fact good">${I.signal(12)}Running to schedule</span>`;
}

function parkingFact(o) {
  if (o.mode !== "drive" || !o.parking_note) return "";
  const p = o.parking;
  const cls = !p ? "" : !p.count ? "bad" : p.any_paid ? "warn" : "good";
  return `<span class="fact ${cls}">${I.parking(12)}${esc(o.parking_note)}</span>`;
}

function ecoFact(o) {
  if (!state.plan?.baseline || o.co2_kg === undefined) return "";
  const saved = o.vs_drive?.co2_saved_kg;
  if (o.mode !== "transit") return `<span class="fact">${I.leaf(12)}${kg(o.co2_kg)} CO₂</span>`;
  return `<span class="fact ${saved > 0 ? "good" : ""}">${I.leaf(12)}${kg(o.co2_kg)} CO₂${saved > 0.05 ? ` · ${kg(saved)} less than driving` : ""}</span>`;
}

function tradeoff(o) {
  if (o.mode === "rideshare") return "Open Uber for the live price and pickup time. It's door to door, but costs more than public transport.";
  const parts = [];
  const b = bufferInfo(o);
  if (o.buffer_minutes !== undefined) parts.push(o.buffer_minutes >= 0 ? `Arrives ${b.text}` : `Arrives ${b.text}`);
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
    ? `<span class="badge tight">${I.alert(11)}Tight</span>` : `<span class="badge success">${I.checkCircle(11)}Fits</span>`;
  const hard = o.reasons.some((r) => ["deadline", "disruption"].includes(r.limit));
  return `<span class="badge ${hard ? "error" : "warning"}">${hard ? I.xCircle(11) : I.alert(11)}${hard ? (o.reasons[0].limit === "disruption" ? "Disrupted" : "Late") : "Check"}</span>`;
}

function optionCard(o, index, highlight) {
  const show = settings.show;
  const icon = (KIND_ICON[o.kind] || I.route)(18);
  const b = bufferInfo(o);
  const costOver = o.reasons.some((r) => r.limit === "cost" && o.cost_known);
  const walkOver = o.reasons.some((r) => r.limit === "walking");
  const facts = [
    show.realtime ? realtimeFact(o) : "", show.elevation ? climbFact(o) : "",
    show.parking ? parkingFact(o) : "", show.co2 ? ecoFact(o) : "",
    o.vs_drive?.cost_saved > 0.5 && show.cost ? `<span class="fact good">${I.dollar(12)}Saves ${money(o.vs_drive.cost_saved)} vs driving</span>` : "",
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
        ? `<a class="card-action" href="${esc(o.uber_url)}" target="_blank" rel="noopener noreferrer" data-action="choose-uber" data-id="${esc(o.id)}">Open in Uber ${I.external(15)}</a>`
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

function resultsScreen() {
  const p = state.plan;
  const f = state.form;
  const planB = p.purpose === "planb";
  const options = sortedOptions();
  const fit = options.filter((o) => o.fits).length;
  const chips = `<div class="chips" style="margin-bottom:6px">
      ${p.deadline ? `<span class="chip quiet">${I.clock(12)}By ${timeOf(p.deadline)}</span>` : ""}
      <span class="chip quiet">${I.dollar(12)}$${f.budget} max</span>
      <span class="chip quiet">${I.walk(12)}${f.walking} min walk</span>
      ${state.alerts ? `<span class="chip live"><span class="live-dot"></span>Translink live</span>` : ""}
    </div>`;
  const sortChips = `<div class="chips" role="group" aria-label="Sort options">${SORTS.map(([v, label]) => `<button class="chip" data-action="sort" data-value="${v}" aria-pressed="${state.sort === v}">${esc(label)}</button>`).join("")}</div>`;
  let body;
  if (state.loading) {
    body = `<div class="cards"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>`;
  } else if (!options.length) {
    body = `<div class="empty-card"><div class="empty-icon">${I.alert(24)}</div><h3>No routes found</h3><p>${p.errors.length ? esc(p.errors.join(" ")) : "Try another time, place or travel mode."}</p></div>`;
  } else {
    const noneFit = !fit && p.deadline;
    body = (noneFit ? `<div class="empty-card"><div class="empty-icon">${I.alert(24)}</div><h3>No option meets all your limits</h3><p>Every option misses at least one limit. Each card says which one. Change a limit deliberately, or choose and verify.</p></div>` : "")
      + `<p class="why-rank">${esc(SORT_WHY[state.sort])}</p>`
      + `<div class="cards">${options.map((o, i) => optionCard(o, i, i === 0 && o.fits ? (o.mode === "transit" ? "best" : "best") : "")).join("")}</div>`;
  }
  const rides = p.rides?.length ? `<button class="tile-card" data-action="go" data-screen="rides" style="margin-bottom:14px">
      <div class="tile-head"><h3>${I.users(16)} ${plural(p.rides.length, "shared ride")} heading your way</h3>${I.chevronRight()}</div>
      <p class="muted" style="font-size:13px">Share a car or split an Uber. It costs less for everyone and means fewer cars.</p></button>`
    : `<button class="tile-card" data-action="go" data-screen="rides" style="margin-bottom:14px"><div class="tile-head"><h3>${I.users(16)} Going this way with others?</h3>${I.chevronRight()}</div><p class="muted" style="font-size:13px">Offer spare seats or start a split Uber on the shared ride board.</p></button>`;
  const fuel = p.fuel?.price ? `Driving cost uses ${p.fuel.manual ? "your fuel price of" : `the average ${esc(p.fuel.fuel_type)} price near your start (${p.fuel.stations} stations, Google Places):`} $${p.fuel.price.toFixed(2)}/L at ${settings.fuel_l_per_100km} L/100 km.` : "Fuel price unavailable. Driving cost is incomplete.";
  return `
    ${navbar(planB ? "Plan B options" : "Routes", "Edit", gearButton())}
    <div class="scroll tight">
      ${chips}
      <div class="heading-row"><div><h2>${planB ? "Choose your Plan B" : "Your options"}</h2>
        <p>${state.loading ? "Updating…" : `${fit} of ${options.length} fit your limits${p.start ? "" : ""}`}</p></div>
        <button class="icon-btn" data-action="map-overview" aria-label="Show all routes on a map">${I.route(18)}</button></div>
      ${sortChips}
      <div style="height:10px"></div>
      ${state.error ? notice(esc(state.error), "error") + '<div style="height:10px"></div>' : ""}
      ${body}
      ${rides}
      ${p.errors.length && options.length ? notice(esc(p.errors.join(" ")), "error") + '<div style="height:8px"></div>' : ""}
      ${p.notes.map((n) => notice(esc(n), "info")).join("")}
      <p class="muted" style="font-size:12px;line-height:1.45;margin:10px 4px">Route times from Google Maps, checked ${timeOf(p.queried_at)}. ${fuel} CO₂ figures are estimates (see Settings). Always check services before you travel.</p>
    </div>`;
}

// ── Detail sheet ─────────────────────────────────────────────────────────────

function limitCheck(label, ok, detail) {
  const cls = ok === null ? "na" : ok ? "ok" : "no";
  const icon = ok === null ? "–" : ok ? I.check() : I.x(11);
  return `<div class="row"><span class="check ${cls}">${icon}</span><span class="row-label">${label}</span><span class="row-value">${esc(detail)}</span></div>`;
}

function mapBlock(id, caption = "") {
  return `<div class="map-wrap" data-map-wrap="${esc(id)}"><div class="map" data-map="${esc(id)}"></div>
    <div class="map-controls">
      <button data-action="map-zoom" data-delta="1" aria-label="Zoom in">${I.plus(17)}</button>
      <button data-action="map-zoom" data-delta="-1" aria-label="Zoom out">${I.minus(17)}</button>
      <button data-action="map-fit" aria-label="Fit route">${I.fit()}</button>
      <button data-action="map-expand" aria-label="Expand map">${I.expand()}</button>
    </div></div>
    <div class="map-legend">${caption}</div>`;
}

function legendFor(o) {
  const kinds = [...new Set(o.segments.map((s) => s.kind))];
  return kinds.map((k) => `<span><i class="${k === "walk" ? "dash" : ""}" style="background:${SEGMENT_COLOUR[k] || "#007AFF"}"></i>${KIND_NAME[k] || k}</span>`).join("")
    + `<span><i style="background:#34C759;width:8px;height:8px;border-radius:50%"></i>Start</span><span><i style="background:#FF3B30;width:8px;height:8px;border-radius:50%"></i>Destination found by Google</span>`;
}

function sheetContent(o) {
  const f = state.form;
  const lim = Object.fromEntries(o.reasons.map((r) => [r.limit, r]));
  const b = bufferInfo(o);
  const rt = o.realtime;
  const explain = o.fits
    ? `<div class="explain success"><h4>${o.buffer_minutes !== undefined && o.buffer_minutes < 5 ? "Fits, but with little spare time" : "Meets every limit"}</h4><p>${esc(tradeoff(o))}</p></div>`
    : `<div class="explain ${o.reasons.some((r) => ["deadline", "disruption"].includes(r.limit)) ? "error" : "warning"}"><h4>Check before choosing</h4>${o.reasons.map((r) => `<p>${esc(r.text)}</p>`).join("")}</div>`;
  const alerts = rt?.alerts?.length ? `<p class="section-header">Translink alerts</p><div class="group"><div class="group-card">${rt.alerts.map((a) =>
      `<div class="row plain" style="align-items:flex-start"><span class="row-label" style="font-size:14px"><b>${esc(a.effect)}:</b> ${esc(a.header)}<small>${esc(a.description.slice(0, 220))}${a.description.length > 220 ? "…" : ""}</small></span></div>`).join("")}</div></div>` : "";
  const breakdown = (o.cost_breakdown || []).map((item) => row(I.dollar(14), "var(--green)", `<span style="font-size:14px">${esc(item.label)}</span>`, valueSpan(money(item.amount), true))).join("");
  const parking = o.mode === "drive" && o.parking ? `<p class="section-header">Parking near the destination</p><div class="group"><div class="group-card">
      ${o.parking.parks.length ? o.parking.parks.map((pk) => row(I.parking(14), "var(--indigo)", `<span style="font-size:14px">${esc(pk.name)}<small>${pk.distance_m} m from destination${pk.paid ? " · paid" : ""}${pk.free ? " · free option" : ""}</small></span>`)).join("")
        : `<div class="row plain"><span class="row-label" style="font-size:14px">No car parks listed within ${o.parking.radius_m} m. Parking may be hard to find.</span></div>`}
    </div><p class="group-footer">Car parks from Google Places. Parking prices aren't published there. Set a typical parking cost in Settings to include it.</p></div>` : "";
  const elevation = o.elevation ? row(I.mountain(15), "var(--teal)", "Walking climb", valueSpan(`+${o.elevation.gain_m} m / −${o.elevation.loss_m} m`, true)) : "";
  return `
    <div class="grabber"><span></span></div>
    <div class="sheet-head"><h3 id="sheet-title">${esc(o.title)}</h3><button class="close-btn" data-action="close-sheet" aria-label="Close">${I.x()}</button></div>
    <div class="sheet-scroll">
      <div class="big-arrival">
        <div><div class="t">${timeOf(o.arrival)}</div><div class="buffer ${b.cls}" style="font-size:15px">${b.text}</div></div>
        <div class="d">${leaveLabel(o)}${state.plan.deadline ? `<br>Deadline ${timeOf(state.plan.deadline)}` : ""}${o.scheduled_arrival ? `<br>Timetable ${timeOf(o.scheduled_arrival)}` : ""}</div>
      </div>
      ${explain}
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
        ${row(I.clock(15), "var(--purple)", "Travel time", valueSpan(`${o.duration_minutes} min`, true))}
        ${o.mode === "transit" ? row(I.transfer(15), "var(--orange)", "Transfers", valueSpan(String(o.transfers), true)) : ""}
        ${elevation}
        ${o.distance_km ? row(I.route(15), "var(--teal)", "Distance", valueSpan(`${o.distance_km} km`, true)) : ""}
        ${o.co2_kg !== undefined ? row(I.leaf(15), "var(--green)", "Estimated CO₂", valueSpan(kg(o.co2_kg), true)) : ""}
        ${o.vs_drive ? row(I.car(15), "var(--secondary)", "Compared with driving", valueSpan(`${o.vs_drive.minutes >= 0 ? "+" : ""}${o.vs_drive.minutes} min · ${o.vs_drive.co2_saved_kg >= 0 ? "−" : "+"}${kg(Math.abs(o.vs_drive.co2_saved_kg))}${o.vs_drive.cost_saved !== null ? ` · ${o.vs_drive.cost_saved >= 0 ? "saves" : "costs"} ${money(Math.abs(o.vs_drive.cost_saved))}` : ""}`)) : ""}
      </div><p class="group-footer">${esc(o.cost_label || "")}${o.elevation?.source ? ` · Elevation: ${esc(o.elevation.source)}` : ""}</p></div>
      ${breakdown ? `<p class="section-header">Cost breakdown</p><div class="group"><div class="group-card">${breakdown}</div></div>` : ""}
      ${parking}
      ${alerts}
      <p class="section-header">Steps</p>
      <div class="group"><div class="group-card">${o.steps.slice(0, 12).map((s) => row((KIND_ICON[s.kind] || I.route)(14), SEGMENT_COLOUR[s.kind] || "var(--blue)", `<span style="font-size:14px">${esc(s.title)}${s.board_time ? `<small>Board at ${esc(s.board_time)}${s.stops ? ` · ${plural(s.stops, "stop")}` : ""}</small>` : ""}${s.directions?.length > 1 ? `<small>${s.directions.map(esc).join(" · ")}</small>` : ""}</span>`, s.minutes ? valueSpan(`${s.minutes} min`) : "")).join("")}</div></div>
    </div>
    <div class="sheet-foot">
      ${o.mode === "rideshare"
        ? `<a class="btn btn-uber" href="${esc(o.uber_url)}" target="_blank" rel="noopener noreferrer" data-action="choose-uber" data-id="${esc(o.id)}">Open in Uber for the live price ${I.external()}</a>`
        : `<button class="btn ${o.fits ? "btn-primary" : "btn-secondary"}" data-action="choose" data-id="${esc(o.id)}">${o.fits ? "Choose this option" : "Choose anyway"}</button>`}
    </div>`;
}

// ── Next steps ───────────────────────────────────────────────────────────────

function nextScreen() {
  const o = findOption(state.chosenId);
  if (!o) return resultsScreen();
  const b = bufferInfo(o);
  const steps = o.steps.slice(0, 14).map((s, i, all) => {
    const last = i === all.length - 1;
    return `<div class="step"><div class="step-rail"><span class="step-num ${last ? "arrive" : ""}">${last ? I.check(15) : i + 1}</span>${last ? "" : '<span class="step-line"></span>'}</div>
      <div class="step-body"><span class="ic" style="color:${SEGMENT_COLOUR[s.kind] || "var(--blue)"}">${(KIND_ICON[s.kind] || I.route)(18)}</span><div><p>${esc(s.title)}</p>${s.board_time || s.minutes ? `<small>${[s.board_time && `Board at ${s.board_time}`, s.minutes && `about ${s.minutes} min`].filter(Boolean).join(" · ")}</small>` : ""}</div></div></div>`;
  }).join("");
  const logged = store.get("trips", []).some((t) => t.ref === tripRef(o));
  const watchAlert = state.watch.alert;
  return `
    ${navbar("Next steps", "Options", gearButton())}
    <div class="scroll">
      ${watchAlert ? `<div class="watch-banner" role="alert">${I.alert(20)}<div><p><b>New disruption on ${esc(watchAlert.lines.join(", "))}:</b> ${esc(watchAlert.header)}</p><button class="btn btn-primary" data-action="replan">See my alternatives</button></div></div>` : ""}
      <div class="confirm ${o.fits ? "" : "warn"}">
        <p class="eyebrow">${o.fits ? I.checkCircle(18) : I.alert(18)}${o.fits ? "Plan B confirmed" : "Chosen, but outside your limits"}</p>
        <h2>${esc(o.title)}</h2>
        <div class="confirm-grid">
          <div><span>Arrival</span><b>${timeOf(o.arrival)}</b></div>
          <div><span>${state.plan.deadline ? "Buffer" : "Trip"}</span><b>${b.text}</b></div>
          <div><span>Cost</span><b>${o.cost_known ? money(o.cost) : "Unknown"}</b></div>
          <div><span>CO₂ avoided vs driving</span><b>${o.vs_drive ? kg(Math.max(0, o.vs_drive.co2_saved_kg)) : "–"}</b></div>
        </div>
      </div>
      <button class="btn ${logged ? "btn-secondary" : "btn-green"}" data-action="log-trip" ${logged ? "disabled" : ""} style="margin-bottom:10px">${logged ? `${I.check(16)} Added to your impact` : `${I.leaf(18)} I'm taking this trip`}</button>
      <div class="btn-row" style="margin-bottom:22px">
        <a class="btn btn-secondary" href="${esc(o.maps_url)}" target="_blank" rel="noopener noreferrer">Google Maps ${I.external(14)}</a>
        <a class="btn btn-secondary" href="https://jp.translink.com.au/plan-your-journey/journey-planner" target="_blank" rel="noopener noreferrer">Translink ${I.external(14)}</a>
      </div>
      ${o.mode === "transit" ? `<div class="group"><div class="group-card"><div class="row toggle-row"><span class="row-icon" style="background:var(--red)">${I.signal(15)}</span><span class="row-label">Watch for disruptions<small>Checks Translink every minute while this app is open</small></span>${toggle("watch", settings.watch, "Watch for disruptions")}</div></div></div>` : ""}
      <p class="section-header">Step-by-step</p>
      <div class="timeline">${steps}</div>
      ${o.segments?.length ? `<p class="section-header">Route map</p>${mapBlock(o.id, legendFor(o))}` : ""}
      <button class="tile-card" data-action="go" data-screen="rides">
        <div class="tile-head"><h3>${I.users(16)} Share this trip</h3>${I.chevronRight()}</div>
        <p class="muted" style="font-size:13px">Have spare seats, or want to split an Uber? Post it to the shared ride board.</p>
      </button>
      ${notice("Estimates only. Check the service, stops and walking path before you travel.")}
      <div style="height:8px"></div>
    </div>
    <footer class="sticky"><button class="btn btn-primary" data-action="done">Done</button></footer>`;
}

// ── Panic mode ───────────────────────────────────────────────────────────────

function panicScreen() {
  const pm = state.panic;
  const top = `<div class="panic-top"><span class="panic-label">PANIC MODE</span><button class="panic-exit" data-action="exit-panic">Exit</button></div>`;
  if (pm.phase === "answer" && state.plan) {
    const o = findOption(state.plan.recommended_id);
    if (o) {
      const late = state.plan.deadline && o.buffer_minutes < 0;
      const steps = o.steps.slice(0, 8).map((s) => `<li><span>${esc(s.title)}${s.board_time || s.minutes ? `<small>${[s.board_time && `Board at ${s.board_time}`, s.minutes && `${s.minutes} min`].filter(Boolean).join(" · ")}</small>` : ""}</span></li>`).join("");
      return `${top}<div class="scroll">
        <p class="lead" style="margin-bottom:8px">${leaveLabel(o, true)}. ${esc(o.title)}.</p>
        <div class="panic-answer">
          <div class="when">${timeOf(o.arrival)} <small>arrival</small></div>
          <p class="why ${late ? "bad" : ""}">${esc(state.plan.recommended_reason)}</p>
          ${realtimeFact(o) ? `<div class="facts" style="margin-top:10px">${realtimeFact(o)}</div>` : ""}
        </div>
        <ol class="panic-steps">${steps}</ol>
        <a class="panic-go" style="display:flex;align-items:center;justify-content:center;text-decoration:none;margin-bottom:10px" href="${esc(o.maps_url)}" target="_blank" rel="noopener noreferrer">Start directions</a>
        <button class="btn btn-secondary" data-action="panic-others" style="margin-bottom:10px">See other options</button>
        ${notice("Estimate from Google and Translink. Check signs at the stop.")}
      </div>`;
    }
  }
  const chips = [settings.places.home && ["home", "Home"], settings.places.work && ["work", "Work/Uni"], store.get("lastDestination", "") && ["last", "Last place"]].filter(Boolean);
  return `${top}<div class="scroll">
    <h1>Where do you need to be?</h1>
    <p class="lead">${pm.coords ? "Using your current location." : pm.locating ? "Finding your location…" : "Location unavailable. Type where you are."}</p>
    ${pm.coords ? "" : `<input class="panic-input" data-panic="origin" placeholder="Where are you now?" value="${esc(pm.origin || "")}" aria-label="Where are you now">`}
    <input class="panic-input" data-panic="dest" placeholder="Destination" value="${esc(pm.dest)}" aria-label="Destination">
    ${chips.length ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">${chips.map(([k, l]) => `<button class="panic-chip" data-action="panic-place" data-place="${k}">${esc(l)}</button>`).join("")}</div>` : ""}
    <label style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:18px;font-size:16px;color:rgba(255,255,255,.8)">Need to be there by <input class="panic-input" style="width:140px;margin:0" type="time" data-panic="by" value="${esc(pm.by)}" aria-label="Deadline (optional)"></label>
    ${pm.error ? notice(esc(pm.error), "error") + '<div style="height:12px"></div>' : ""}
    <button class="panic-go" data-action="panic-go" ${pm.phase === "loading" ? "disabled" : ""}>${pm.phase === "loading" ? "Finding the fastest safe option…" : "Get me there"}</button>
  </div>`;
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
      ${path ? `<path class="bar" d="${path}"/>` : ""}
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
    ${navbar("Impact", "Home", gearButton())}
    <div class="scroll">
      <h2 class="large-title">Your impact</h2>
      <p class="subtitle">Each trip you log is compared with driving the same journey alone in your car (fuel, tolls and parking where known).</p>
      <div class="kpis">
        <div class="kpi"><span>CO₂ avoided</span><b>${kg(t.co2)}</b><small>all time</small></div>
        <div class="kpi"><span>Money saved</span><b>${money(t.saved)}</b><small>vs driving</small></div>
        <div class="kpi"><span>Low-car trips</span><b>${t.greenTrips}</b><small>of ${t.trips} logged</small></div>
        <div class="kpi"><span>Not driving</span><b>${share}%</b><small>of your trips</small></div>
      </div>
      ${all.length ? `
        ${barChart("co2", months, "co2", (v, axis) => (axis ? `${v < 1 && v > 0 ? v.toFixed(1) : Math.round(v)}` : kg(v)), "CO₂ avoided per month", "kg CO₂, last six months")}
        ${barChart("saved", months, "saved", (v, axis) => (axis ? `$${Math.round(v)}` : money(v)), "Money saved per month", "Compared with driving, last six months")}
        <button class="btn btn-text" data-action="toggle-table">${state.dashTable ? "Hide table" : "Show as a table"}</button>
        ${table}
        <p class="section-header" style="margin-top:14px">Recent trips</p>
        <div class="group"><div class="group-card">${recent.map((trip) => row((KIND_ICON[trip.kind] || I.route)(14), SEGMENT_COLOUR[trip.kind] || "var(--blue)", `<span style="font-size:15px">${esc(trip.title)}<small>${dateLabel(trip.date)} · ${trip.co2_saved > 0 ? `${kg(trip.co2_saved)} CO₂ avoided` : "no CO₂ saving"}</small></span>`, valueSpan(trip.cost_saved > 0 ? `+${money(trip.cost_saved)}` : ""), "trip-row")).join("")}</div></div>`
      : `<div class="empty-card"><div class="empty-icon" style="background:var(--green-bg);color:var(--green)">${I.leaf(24)}</div><h3>No trips logged yet</h3><p>Choose a route and tap “I'm taking this trip” to start tracking your savings.</p></div>`}
      ${notice("Savings are estimates using the CO₂ factors and car settings in Settings. Your trip history stays on this device.", "info")}
    </div>`;
}

// ── Shared ride board ────────────────────────────────────────────────────────

function rideCard(r) {
  const seats = Array.from({ length: r.seats_total }, (_, i) => `<i class="${i < r.seats_total - r.seats_left ? "taken" : ""}"></i>`).join("");
  const baseline = state.plan?.baseline;
  const groupCo2 = baseline && r.group_size > 1 ? baseline.co2_kg * (r.group_size - 1) : 0;
  return `<div class="ride-card ${r.is_member ? "mine" : ""}">
    <div class="ride-head"><span class="mode-tile ${r.kind === "uber" ? "rideshare" : "car"}">${(r.kind === "uber" ? I.rideshare : I.car)(18)}</span>
      <div style="flex:1;min-width:0"><strong>${esc(r.nickname)} · ${esc(r.kind_label)}</strong><div class="card-sub">Leaves ${timeOf(r.depart_at)} · ${r.seats_left} of ${r.seats_total} seats free <span class="seat-dots">${seats}</span></div></div>
      ${r.is_owner ? `<span class="badge info">Yours</span>` : r.is_member ? `<span class="badge success">Joined</span>` : ""}</div>
    <p class="ride-meta">${esc(r.origin_label)} → <b>${esc(r.destination_label)}</b><br>Meet at <b>${esc(r.meet_point)}</b>${r.note ? `<br>${esc(r.note)}` : ""}
      ${r.trip_cost ? (r.group_size > 1 ? `<br>About <b>${money(r.per_person)} each</b> (${money(r.trip_cost)} split ${r.group_size} ways)` : `<br>Trip cost <b>${money(r.trip_cost)}</b>, split between everyone who joins`) : ""}
      ${r.riders.length ? `<br>Riding: ${r.riders.map(esc).join(", ")}` : ""}
      ${groupCo2 > 0.05 ? `<br>${I.leaf(12)} Sharing avoids about ${kg(groupCo2)} CO₂ compared with everyone driving alone` : ""}</p>
    ${r.is_member ? `<button class="btn btn-secondary" data-action="ride-leave" data-id="${esc(r.id)}">${r.is_owner ? "Cancel this ride" : "Leave this ride"}</button>`
      : state.rides.joining === r.id ? `<div class="form-stack"><label>Your first name or nickname<input data-ride-join="nickname" maxlength="24"></label><button class="btn btn-primary" data-action="ride-join" data-id="${esc(r.id)}" ${r.seats_left ? "" : "disabled"}>Join</button></div>`
      : `<button class="btn btn-primary" data-action="ride-join-start" data-id="${esc(r.id)}" ${r.seats_left ? "" : "disabled"}>${r.seats_left ? "Join this ride" : "Full"}</button>`}
  </div>`;
}

function ridesScreen() {
  const p = state.plan;
  const matches = (p?.rides || []).filter((r) => !state.rides.mine.some((m) => m.id === r.id));
  return `
    ${navbar("Shared rides", "Back", gearButton())}
    <div class="scroll">
      <h2 class="large-title">Travel together</h2>
      <p class="subtitle">When a service fails, hundreds of people need the same thing. Share a car or split an Uber with people heading your way. It costs less for everyone and means fewer cars on the road.</p>
      ${state.rides.error ? notice(esc(state.rides.error), "error") + '<div style="height:10px"></div>' : ""}
      ${state.rides.mine.length ? `<p class="section-header">Your rides</p>${state.rides.mine.map(rideCard).join("")}` : ""}
      <p class="section-header">${p ? `Heading from ${esc(p.origin)} towards ${esc(p.destination)}` : "Heading your way"}</p>
      ${!p ? `<div class="empty-card"><h3>Search a journey first</h3><p>We match rides by where you're starting, where you're going and when.</p></div>`
        : matches.length ? matches.map(rideCard).join("")
        : `<div class="empty-card"><div class="empty-icon" style="background:var(--purple-bg);color:var(--purple)">${I.users(24)}</div><h3>No shared rides yet</h3><p>Be the first. Anyone searching a similar trip on this Plan B server will see your post.</p></div>`}
      ${p?.start && p?.end ? `<button class="btn btn-primary" data-action="open-ride-form" style="margin:6px 0 14px">Offer seats or start a split Uber</button>` : ""}
      ${notice("Prototype: posts are visible to everyone using this Plan B server and expire 30 minutes after departure. Don't post phone numbers or exact addresses. Meet somewhere public and trust your judgement.")}
    </div>`;
}

function rideFormSheet() {
  const p = state.plan;
  const driveCost = p?.baseline?.cost;
  return `<div class="grabber"><span></span></div>
    <div class="sheet-head"><h3 id="sheet-title">Share a ride</h3><button class="close-btn" data-action="close-sheet" aria-label="Close">${I.x()}</button></div>
    <div class="sheet-scroll"><div class="form-stack" id="ride-form">
      ${segmented("ride_kind", state.rideKind || "car", [["car", "I have a car"], ["uber", "Split an Uber"]], "ride-kind")}
      <div class="form-pair"><label>First name or nickname<input name="nickname" maxlength="24" required></label>
        <label>${(state.rideKind || "car") === "car" ? "Spare seats" : "Others wanted"}<select name="seats">${[1, 2, 3, 4, 5, 6].map((n) => `<option ${n === 3 ? "selected" : ""}>${n}</option>`).join("")}</select></label></div>
      <label>Public meeting point<input name="meet_point" maxlength="80" placeholder="e.g. Taringa Station main entrance" required></label>
      <div class="form-pair"><label>Leaving at<input name="depart_at" type="datetime-local" value="${esc(p.departure.slice(0, 16))}"></label>
        <label>${(state.rideKind || "car") === "car" ? "Trip cost to share ($)" : "Uber estimate ($)"}<input name="trip_cost" type="number" min="0" max="500" step="0.5" value="${(state.rideKind || "car") === "car" && driveCost ? driveCost.toFixed(2) : ""}" placeholder="${(state.rideKind || "car") === "uber" ? "From the Uber app" : "Optional"}"></label></div>
      <label>Note (optional)<input name="note" maxlength="140" placeholder="e.g. Heading to the Great Court"></label>
      <p class="muted" style="font-size:12px;line-height:1.4">Shared from your search: ${esc(p.origin)} → ${esc(p.destination)}. Only rounded start and end points (about 100 m) are stored.</p>
    </div></div>
    <div class="sheet-foot"><button class="btn btn-primary" data-action="ride-create">Post to the ride board</button></div>`;
}

// ── Alerts sheet ─────────────────────────────────────────────────────────────

function alertsSheet() {
  const q = (state.alertQuery || "").trim().toUpperCase();
  const list = (state.alerts?.alerts || []).filter((a) => a.disruptive && (!q || a.lines.some((l) => l.includes(q)) || a.header.toUpperCase().includes(q)));
  return `<div class="grabber"><span></span></div>
    <div class="sheet-head"><h3 id="sheet-title">Translink alerts</h3><button class="close-btn" data-action="close-sheet" aria-label="Close">${I.x()}</button></div>
    <div class="sheet-scroll">
      <div class="row" style="border-radius:10px;margin-bottom:12px">${I.search(16)}<input type="text" data-alert-query value="${esc(state.alertQuery || "")}" placeholder="Filter by line, e.g. 412" aria-label="Filter alerts by line" style="flex:1;border:none;background:none;font-size:16px"></div>
      ${list.length ? `<div class="group"><div class="group-card">${list.slice(0, 40).map((a) => `<div class="row plain" style="align-items:flex-start"><span class="row-label" style="font-size:14px">${a.lines.slice(0, 6).map((l) => `<span class="line-tag">${esc(l)}</span> `).join("")}<br><b>${esc(a.effect)}:</b> ${esc(a.header)}<small>${esc(a.description.slice(0, 260))}${a.description.length > 260 ? "…" : ""}</small></span></div>`).join("")}</div></div>`
        : `<p class="muted" style="text-align:center;padding:20px 0">No matching disruption alerts.</p>`}
      <p class="muted" style="font-size:12px;margin:4px 4px 12px">Source: Translink SEQ GTFS-Realtime, refreshed every minute${state.alerts ? `, last checked ${timeOf(state.alerts.fetched_at)}` : ""}.</p>
    </div>`;
}

// ── Settings panel ───────────────────────────────────────────────────────────

function settingsContent() {
  const s = settings;
  const fuelTypes = state.status?.fuel_types || { SP91: "Unleaded 91" };
  const showRow = (key, label, hint) => `<div class="row toggle-row"><span class="row-label">${label}${hint ? `<small>${hint}</small>` : ""}</span>${toggle(`show.${key}`, s.show[key], label)}</div>`;
  const modeRow = (path, icon, bg, label, hint, checked) => `<div class="row toggle-row"><span class="row-icon" style="background:${bg}">${icon}</span><span class="row-label">${label}${hint ? `<small>${hint}</small>` : ""}</span>${toggle(path, checked, label)}</div>`;
  return `
    ${navbar("Settings", null, `<button class="nav-action" data-action="close-settings" style="font-weight:600">Done</button>`)}
    <div class="settings-scroll">
      <p class="section-header">Appearance</p>
      <div class="group"><div class="group-card">
        <div class="row"><span class="row-icon" style="background:var(--indigo)">${I.moon(15)}</span><span class="row-label">Theme</span>${segmented("theme", s.theme, [["system", "Auto"], ["light", "Light"], ["dark", "Dark"]])}</div>
        <div class="row toggle-row"><span class="row-icon" style="background:var(--pink)">${I.bolt(15)}</span><span class="row-label">Reduce motion</span>${toggle("motion_reduced", s.motion === "reduced", "Reduce motion")}</div>
      </div></div>

      <p class="section-header">Ways to travel</p>
      <div class="group"><div class="group-card">
        ${modeRow("modes.transit", I.bus(15), "var(--blue)", "Public transport", "", s.modes.transit)}
        ${s.modes.transit ? `<div class="chips" style="margin:0;padding:4px 16px 12px 58px;background:var(--card);flex-wrap:wrap">${[["bus", "Bus"], ["train", "Train"], ["tram", "Light rail"], ["ferry", "Ferry"]].map(([k, l]) => `<button class="chip" data-action="toggle-transit" data-value="${k}" aria-pressed="${s.transit_modes[k]}">${l}</button>`).join("")}</div>` : ""}
        ${modeRow("modes.drive", I.car(15), "var(--secondary)", "My own car", "Driving is always used to show what you save", s.modes.drive)}
        ${modeRow("modes.rideshare", I.rideshare(15), "var(--purple)", "Uber", "Opens Uber for the live price", s.modes.rideshare)}
      </div></div>

      <p class="section-header">Your car</p>
      <div class="group"><div class="group-card">
        ${row(I.car(15), "var(--secondary)", "Fuel use", stepper("fuel_l_per_100km", s.fuel_l_per_100km, `${s.fuel_l_per_100km} L/100 km`, 3, 25))}
        <div class="row"><span class="row-icon" style="background:var(--orange)">${I.dollar(15)}</span><span class="row-label">Fuel type</span><select data-setting-select="fuel_type" aria-label="Fuel type">${Object.entries(fuelTypes).map(([k, l]) => `<option value="${k}" ${k === s.fuel_type ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></div>
        <div class="row"><span class="row-label">Fuel price</span>${segmented("fuel_price_mode", s.fuel_price_mode, [["auto", "Live average"], ["manual", "My price"]])}</div>
        ${s.fuel_price_mode === "manual" ? `<div class="row"><span class="row-label">My price ($/L)</span><input type="number" min="0.5" max="5" step="0.01" data-setting-number="fuel_price" value="${s.fuel_price}"></div>` : `<div class="row"><span class="row-label" style="font-size:14px">${state.fuelPreview ? `Now about <b>$${state.fuelPreview.price.toFixed(2)}/L</b><small>Average of ${state.fuelPreview.stations} stations nearby · Google Places</small>` : "Checked near your start point when you search"}</span></div>`}
        <div class="row"><span class="row-icon" style="background:var(--indigo)">${I.parking(15)}</span><span class="row-label">Typical parking cost<small>Leave empty if unknown</small></span><input type="number" min="0" max="200" step="0.5" data-setting-number="parking_cost" value="${s.parking_cost ?? ""}" placeholder="$"></div>
      </div><p class="group-footer">Car parks near your destination are found automatically, but prices aren't published, so add what you usually pay.</p></div>

      <p class="section-header">Public transport fares</p>
      <div class="group"><div class="group-card">
        <div class="row toggle-row"><span class="row-label">Use a flat fare when Google has none<small>Translink fares are currently a flat 50c a trip. Check current fares.</small></span>${toggle("use_flat_fare", s.use_flat_fare, "Use flat fare")}</div>
        ${s.use_flat_fare ? `<div class="row"><span class="row-label">Flat fare ($)</span><input type="number" min="0" max="50" step="0.05" data-setting-number="flat_fare" value="${s.flat_fare}"></div>` : ""}
      </div></div>

      <p class="section-header">Default limits</p>
      <div class="group"><div class="group-card">
        ${row(I.dollar(15), "var(--green)", "Max cost", stepper("set.budget", s.budget, `$${s.budget}`, 0, 200))}
        ${row(I.walk(15), "var(--blue)", "Max walking", stepper("set.walking", s.walking, `${s.walking} min`, 0, 60))}
      </div></div>

      <p class="section-header">Show on route cards</p>
      <div class="group"><div class="group-card">
        ${showRow("buffer", "Deadline buffer")}${showRow("cost", "Cost and savings")}${showRow("walking", "Walking time")}
        ${showRow("transfers", "Transfers")}${showRow("elevation", "Elevation gain", "Uphill metres on the walking parts")}
        ${showRow("co2", "CO₂ emissions")}${showRow("parking", "Parking availability")}${showRow("realtime", "Live Translink status")}
      </div></div>

      <p class="section-header">Saved places</p>
      <div class="group"><div class="group-card">
        <div class="row"><span class="row-icon" style="background:var(--blue)">${I.home(15)}</span><input type="text" data-setting-text="places.home" value="${esc(s.places.home)}" placeholder="Home address" aria-label="Home address"></div>
        <div class="row"><span class="row-icon" style="background:var(--orange)">${I.pin(15)}</span><input type="text" data-setting-text="places.work" value="${esc(s.places.work)}" placeholder="Work or uni" aria-label="Work or uni address"></div>
      </div><p class="group-footer">Used by Panic mode and the quick-fill buttons. Stored only on this device.</p></div>

      <p class="section-header">Live disruptions</p>
      <div class="group"><div class="group-card">
        <div class="row toggle-row"><span class="row-icon" style="background:var(--red)">${I.signal(15)}</span><span class="row-label">Watch my chosen trip<small>Alerts you in the app if Translink posts a disruption</small></span>${toggle("watch", s.watch, "Watch my chosen trip")}</div>
      </div></div>

      <p class="section-header">CO₂ factors (kg per passenger-km)</p>
      <div class="group"><div class="group-card">
        ${[["bus", "Bus"], ["rail", "Train"], ["tram", "Light rail"], ["ferry", "Ferry"]].map(([k, l]) => `<div class="row"><span class="row-label">${l}</span><input type="number" min="0" max="1" step="0.001" data-setting-number="factors.${k}" value="${s.factors[k]}"></div>`).join("")}
      </div><p class="group-footer">Approximate defaults adapted from UK government averages. Brisbane's real values differ. Car CO₂ uses your fuel use × 2.31 kg per litre of petrol (2.68 for diesel).</p></div>

      <p class="section-header">Data</p>
      <div class="group"><div class="group-card">
        <button class="row plain" data-action="clear-trips"><span class="row-label" style="color:var(--red)">Clear impact history</span></button>
        <a class="row plain" href="demo.html"><span class="row-label">Fictional interview scenario</span><span class="chev">${I.chevronRight()}</span></a>
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
  if (state.screen === "journey") { state.form.budget = state.form.budget ?? settings.budget; }
  rerender();
}
async function previewFuel() {
  const start = state.plan?.start || [-27.4975, 152.9786];
  try {
    const r = await fetch(`/api/fuel?lat=${start[0]}&lng=${start[1]}&type=${settings.fuel_type}`);
    const data = await r.json();
    if (r.ok && data.price) { state.fuelPreview = data; rerenderSettings(); }
  } catch { /* preview is optional */ }
}

function applyTheme() {
  const theme = settings.theme === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : settings.theme;
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]').content = theme === "dark" ? "#000000" : "#F2F2F7";
  if (settings.motion === "reduced") document.documentElement.dataset.motion = "reduced"; else delete document.documentElement.dataset.motion;
  maps.forEach((entry) => entry.setTiles?.());
}

// ══════════════════════════════════════════════════════════════════════════════
// Rendering, navigation, sheets and maps
// ══════════════════════════════════════════════════════════════════════════════

const SCREENS = { home: homeScreen, journey: journeyScreen, results: resultsScreen, next: nextScreen, panic: panicScreen, dashboard: dashboardScreen, rides: ridesScreen };
const viewport = document.getElementById("viewport");
let currentPage = null;
let transitioning = false;
const maps = new Map();

function makePage(screen) {
  const page = document.createElement("section");
  page.className = `page${screen === "panic" ? " panic" : ""}`;
  page.dataset.screen = screen;
  page.innerHTML = SCREENS[screen]();
  return page;
}

function navigate(screen, direction = "forward") {
  if (transitioning || screen === state.screen) return;
  closeSheet(true);
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
  updateChrome();
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

function goBack() {
  if (state.stack.length < 2) return navigate("home", "back");
  const target = state.stack[state.stack.length - 2];
  navigate(target, state.screen === "panic" ? "down" : "back");
}

function rerender() {
  if (!currentPage) { currentPage = makePage(state.screen); viewport.appendChild(currentPage); }
  else {
    const scroller = currentPage.querySelector(".scroll");
    const top = scroller ? scroller.scrollTop : 0;
    const focused = document.activeElement?.dataset?.field;
    currentPage.className = `page${state.screen === "panic" ? " panic" : ""}`;
    currentPage.innerHTML = SCREENS[state.screen]();
    const next = currentPage.querySelector(".scroll");
    if (next) next.scrollTop = top;
    if (focused) currentPage.querySelector(`[data-field="${focused}"]`)?.focus({ preventScroll: true });
  }
  updateChrome();
  mountMaps(currentPage);
  bindCharts(currentPage);
  cleanMaps();
}

function updateChrome() {
  const el = document.getElementById("status-time");
  const now = new Date();
  el.textContent = `${now.getHours() % 12 || 12}:${String(now.getMinutes()).padStart(2, "0")}`;
  document.querySelector(".status-bar").style.color = state.screen === "panic" ? "#fff" : "";
  document.querySelector(".home-indicator").style.background = state.screen === "panic" ? "#120406" : "";
}

// Maps ------------------------------------------------------------------------

function tileLayer() {
  // OpenStreetMap tiles (as in Prototype 6). Dark mode darkens them with a CSS filter.
  return L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  });
}

function mountMaps(root) {
  if (!window.L) return;
  root.querySelectorAll("[data-map]").forEach((el) => {
    if (maps.has(el)) return;
    const id = el.dataset.map;
    const options = id === "__all" ? state.plan.options : [findOption(id)].filter(Boolean);
    if (!options.length) return;
    const map = L.map(el, { zoomControl: false, attributionControl: true, scrollWheelZoom: true, zoomSnap: 0.5 });
    const entry = { map, tiles: tileLayer().addTo(map), bounds: null };
    entry.setTiles = () => { entry.tiles.remove(); entry.tiles = tileLayer().addTo(map); };
    const group = [];
    options.forEach((o, index) => {
      const faded = id === "__all" && index > 0;
      (o.segments || []).forEach((s) => {
        if (!s.points?.length) return;
        const line = L.polyline(s.points, {
          color: SEGMENT_COLOUR[s.kind] || "#007AFF", weight: s.kind === "walk" ? 4 : 6, opacity: faded ? 0.35 : 0.92,
          dashArray: s.kind === "walk" ? "2 9" : null, lineCap: "round", lineJoin: "round",
        }).addTo(map);
        if (s.label) line.bindTooltip(`${KIND_NAME[s.kind] || ""} ${s.label}`, { sticky: true });
        if (id === "__all") line.bindPopup(`<b>${esc(o.title)}</b><br>Arrive ${timeOf(o.arrival)}`);
        group.push(line);
      });
    });
    const pin = (cls) => L.divIcon({ className: "", html: `<div class="pin ${cls}"></div>`, iconSize: [22, 22], iconAnchor: [11, 11] });
    const first = options[0];
    const pts = (first.segments || []).flatMap((s) => s.points || []);
    if (pts.length) {
      L.marker(pts[0], { icon: pin("start"), title: "Start" }).addTo(map);
      L.marker(pts[pts.length - 1], { icon: pin("end"), title: "Destination" }).addTo(map);
    }
    if (first.mode === "drive" && first.parking?.parks) {
      first.parking.parks.forEach((pk) => L.marker(pk.location, { icon: pin("park"), title: pk.name }).bindTooltip(`${esc(pk.name)} · ${pk.distance_m} m`).addTo(map));
    }
    if (group.length) {
      entry.bounds = L.featureGroup(group).getBounds();
      map.fitBounds(entry.bounds, { padding: [24, 24] });
    } else if (state.plan.end) map.setView(state.plan.end, 14);
    maps.set(el, entry);
    setTimeout(() => { map.invalidateSize(); if (entry.bounds) map.fitBounds(entry.bounds, { padding: [24, 24] }); }, 420);
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
  sheetEl.querySelector(".close-btn")?.focus({ preventScroll: true });
}
function closeSheet(immediate = false) {
  if (!sheetEl) return;
  const el = sheetEl;
  sheetEl = null;
  state.sheetId = null;
  if (immediate) { el.remove(); cleanMaps(); return; }
  el.classList.remove("open");
  setTimeout(() => { el.remove(); cleanMaps(); }, 320);
  lastFocus?.focus?.({ preventScroll: true });
}

function toast(text) {
  const el = document.createElement("div");
  el.className = "toast";
  el.setAttribute("role", "status");
  el.innerHTML = `${I.checkCircle(18)}<span>${esc(text)}</span>`;
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
    leave_now: f.leave_now, departure: f.departure, deadline: f.deadline || null,
    budget: f.budget, walking: f.walking,
    modes: settings.modes, transit_modes: settings.transit_modes,
    vehicle: { fuel_l_per_100km: settings.fuel_l_per_100km, fuel_type: settings.fuel_type, fuel_price: settings.fuel_price_mode === "manual" ? settings.fuel_price : null },
    parking_cost: settings.parking_cost, transit_flat_fare: settings.use_flat_fare ? settings.flat_fare : null,
    emission_factors: settings.factors, want_elevation: settings.show.elevation,
    avoid_lines: f.avoid ? f.avoid.split(/[,\s]+/).filter(Boolean).slice(0, 10) : [],
    ride_tokens: store.get("rideTokens", []).map((t) => t.token),
    ...extra,
  };
}

async function postJSON(url, body) {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({ error: "The server returned an unreadable response." }));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

async function search(extra = {}) {
  if (state.loading) return;
  const f = state.form;
  if (f.origin.trim().length < 3 || f.destination.trim().length < 3) { state.error = "Enter where you're starting and where you're going."; return rerender(); }
  if (state.purpose === "planb" && !f.deadline) { state.error = "Enter the time you need to arrive by."; return rerender(); }
  state.loading = true;
  state.error = null;
  rerender();
  try {
    state.plan = await postJSON("/api/plan", payload(extra));
    store.set("lastDestination", f.destination.trim());
    state.sort = state.purpose === "regular" ? "pt" : "best";
    state.loading = false;
    if (state.screen === "results") rerender(); else { rerender(); navigate("results"); }
  } catch (error) {
    state.loading = false;
    state.error = error.message;
    rerender();
  }
}

async function loadAlerts() {
  try {
    const r = await fetch("/api/alerts");
    const data = await r.json();
    if (!r.ok) throw new Error(data.error);
    state.alerts = data;
    state.alertsError = null;
  } catch (error) {
    state.alertsError = error.message || "Live Translink alerts are unavailable.";
  }
  checkWatch();
  if (["home", "results"].includes(state.screen) && !transitioning && !settingsEl && !document.activeElement?.matches?.("input")) rerender();
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
  try {
    const data = await postJSON("/api/rides/mine", { tokens: tokens.map((t) => t.token) });
    state.rides.mine = data.rides;
    const live = new Set(data.rides.map((r) => r.id));
    store.set("rideTokens", tokens.filter((t) => live.has(t.id)));
  } catch { /* the ride board is optional */ }
}

function freshForm() {
  const now = brisbaneNowLocal();
  return {
    origin: store.get("lastOrigin", "Taringa Station, Brisbane QLD"),
    destination: store.get("lastDestination", "") || settings.places.work || "",
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
  search: () => { store.set("lastOrigin", state.form.origin.trim()); search(); },
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
    el.innerHTML = `${I.locate(13)}Locating…`;
    locate((coords) => {
      if (coords) state.form.origin = `${coords[0].toFixed(6)},${coords[1].toFixed(6)}`;
      else state.error = "Location is unavailable. Type your starting point instead.";
      rerender();
    });
  },
  "fill-place": (el) => { state.form[el.dataset.field] = settings.places[el.dataset.place]; rerender(); },
  sort: (el) => { state.sort = el.dataset.value; rerender(); currentPage.querySelector(`[data-action="sort"][data-value="${state.sort}"]`)?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" }); },
  "open-sheet": (el) => { const o = findOption(el.dataset.id); if (o) { state.sheetId = o.id; openSheet(sheetContent(o)); } },
  "close-sheet": () => closeSheet(),
  backdrop: (el, event) => { if (event.target === el) closeSheet(); },
  "map-overview": () => openSheet(`<div class="grabber"><span></span></div><div class="sheet-head"><h3 id="sheet-title">All routes</h3><button class="close-btn" data-action="close-sheet" aria-label="Close">${I.x()}</button></div><div class="sheet-scroll">${mapBlock("__all", "The first option in the list is drawn strongest. Tap a line for details.")}</div>`),
  choose: (el) => {
    state.chosenId = el.dataset.id;
    const o = findOption(state.chosenId);
    state.watch = { lines: (o?.lines || []).map((l) => l.name), seen: new Set((o?.realtime?.alerts || []).map((a) => a.id)), alert: null };
    closeSheet(true);
    navigate("next");
  },
  "choose-uber": () => { /* the link opens Uber; nothing else to do */ },
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
  done: () => { state.chosenId = null; state.stack = ["home"]; navigate("home", "back"); },
  "open-alerts": () => { openSheet(alertsSheet()); },
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
    setTimeout(() => { e?.map.invalidateSize(); if (e?.bounds) e.map.fitBounds(e.bounds, { padding: [30, 30] }); }, 60);
  },
  // Panic mode
  "exit-panic": () => { state.panic.phase = "ask"; navigate(state.stack.length > 1 ? state.stack[state.stack.length - 2] : "home", "down"); },
  "panic-place": (el) => {
    state.panic.dest = el.dataset.place === "last" ? store.get("lastDestination", "") : settings.places[el.dataset.place];
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
    state.form = { ...freshForm(), origin, destination: pm.dest.trim(), leave_now: true, deadline: deadline || "", budget: 200, walking: 60 };
    try {
      state.plan = await postJSON("/api/plan", payload({ purpose: "panic" }));
      store.set("lastDestination", pm.dest.trim());
      pm.phase = state.plan.recommended_id ? "answer" : "ask";
      if (!state.plan.recommended_id) pm.error = state.plan.errors.join(" ") || "No route was found. Try a nearby landmark.";
    } catch (error) {
      pm.phase = "ask";
      pm.error = error.message;
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
  if (t.dataset.field && state.form) { state.form[t.dataset.field] = t.value; state.error = null; }
  if (t.dataset.panic) state.panic[t.dataset.panic] = t.value;
  if (t.dataset.settingText) { setPath(settings, t.dataset.settingText, t.value.slice(0, 200)); saveSettings(); }
  if (t.dataset.settingNumber) {
    const v = t.value === "" ? null : Number(t.value);
    if (v === null || Number.isFinite(v)) { setPath(settings, t.dataset.settingNumber, v); saveSettings(); }
  }
  if (t.matches("[data-alert-query]")) {
    state.alertQuery = t.value;
    const pos = t.selectionStart;
    sheetEl.querySelector(".sheet").innerHTML = alertsSheet();
    const input = sheetEl.querySelector("[data-alert-query]");
    input.focus(); input.setSelectionRange(pos, pos);
  }
});

document.addEventListener("change", (event) => {
  const t = event.target;
  if (t.dataset.setting) {
    const name = t.dataset.setting;
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

// ── Boot ─────────────────────────────────────────────────────────────────────

async function boot() {
  applyTheme();
  rerender();
  try {
    const response = await fetch("/api/status");
    state.status = await response.json();
  } catch {
    state.status = { live_available: false };
  }
  await loadMyRides();
  rerender();
  loadAlerts();
  setInterval(loadAlerts, 60000);
  setInterval(updateChrome, 30000);
}

// Panic mode locates immediately when opened.
const originalNavigate = navigate;
navigate = function (screen, direction) { // eslint-disable-line no-func-assign
  if (screen === "panic" && state.screen !== "panic") {
    state.panic = { ...state.panic, phase: "ask", error: null, locating: true, coords: null };
    locate((coords) => { state.panic.coords = coords; state.panic.locating = false; if (state.screen === "panic") rerender(); });
  }
  return originalNavigate(screen, direction);
};

boot();
