// Instruments the legacy app without editing its logic: one delegated click listener on [data-action], a watcher on #app[data-screen],
// and a few platform events. Installed only when the build is configured for analytics at all (otherwise nothing here even runs);
// every track() call is still consent-gated. Event names and allowed properties are in schema.js.
import { track } from "./index.js";
import { consent, onConsent, setConsent, sendsUsage, configured } from "./consent.js";

// data-action -> [event, props from the element]
const CLICK = {
  "log-trip": () => ["trip_logged", {}],
  choose: (el) => ["option_selected", { mode: el.dataset.mode }],
  "open-sheet": (el) => ["option_viewed", { mode: el.dataset.mode }],
  sort: (el) => ["sort_changed", { sort: el.dataset.value }],
  "ride-join": () => ["ride_joined", {}],
  "ride-create": () => ["ride_offered", {}],
  "panic-go": (el) => ["panic_option_chosen", { mode: el.dataset.mode }],
  "offline-download": () => ["offline_area_downloaded", {}], // fired when the download is requested, not when it finishes (documented)
  "copy-link": () => ["invite_shared", { channel: "link" }],
  "share-native": () => ["invite_shared", { channel: "share_sheet" }],
  "toggle-cost": (el) => ["driving_cost_viewed", { visible: el.getAttribute("aria-pressed") !== "true" }],
};
const SCREEN = {
  results: () => ["trip_planned", {}],
  panic: () => ["panic_opened", { entry: "button" }],
  dashboard: () => ["impact_dashboard_opened", {}],
  rides: () => ["ride_viewed", {}],
};
const HANDOFF = [[/(^|\.)uber\.com$/, "uber"], [/(^|\.)li\.me$|(^|\.)limebike\.com$/, "lime"], [/neuron/, "neuron"], [/^(www\.)?google\.com$|^maps\.app\.goo\.gl$/, "google_maps"]];

let installed = false;
export function installAnalytics() {
  if (installed || !configured()) return;
  installed = true;
  const done = (pair) => pair && track(pair[0], pair[1]);

  document.addEventListener("click", (e) => {
    const el = e.target.closest?.("[data-action]");
    if (el && CLICK[el.dataset.action]) done(CLICK[el.dataset.action](el));
    const a = e.target.closest?.("a[href]");
    if (a) { try { const h = new URL(a.href).hostname; const t = HANDOFF.find(([re]) => re.test(h)); if (t) track("external_handoff", { target: t[1] }); } catch { /* bad url */ } }
  }, true);

  document.addEventListener("change", (e) => {
    const input = e.target.closest?.("[data-analytics-consent]");
    if (input) { setConsent(input.checked); if (input.checked) track("consent_set", { analytics: true }); return; }
    const key = e.target.closest?.("[data-setting]")?.dataset.setting;
    if (key) track("settings_changed", { key });
  });

  const app = document.getElementById("app");
  if (app) {
    let last = app.dataset.screen;
    new MutationObserver(() => {
      const now = app.dataset.screen;
      if (now !== last) { last = now; done(SCREEN[now]?.()); }
    }).observe(app, { attributes: true, attributeFilter: ["data-screen"] });
  }

  addEventListener("appinstalled", () => track("pwa_installed", { platform: /android/i.test(navigator.userAgent) ? "android" : /iphone|ipad/i.test(navigator.userAgent) ? "ios" : "desktop" }));
  // Push permission: wrap the one call the legacy code makes, report the answer only.
  if ("Notification" in window && Notification.requestPermission) {
    const ask = Notification.requestPermission.bind(Notification);
    Notification.requestPermission = (...args) => {
      const result = ask(...args);
      Promise.resolve(result).then((p) => track("push_enabled", { platform: "desktop", granted: p === "granted" }), () => {});
      return result;
    };
  }
  // Other modules (accounts) announce: document.dispatchEvent(new CustomEvent("reroute:account", { detail: { type: "created" | "signed_in", provider: "google" | "apple" } }))
  document.addEventListener("reroute:account", (e) => {
    const { type, provider } = e.detail || {};
    track(type === "created" ? "account_created" : "sign_in_completed", { provider });
  });
  // Any module can add an event with document.dispatchEvent(new CustomEvent("reroute:track", { detail: { event, props } })); the allow-list still applies.
  document.addEventListener("reroute:track", (e) => track(e.detail?.event, e.detail?.props));

  if (sendsUsage()) onConsent((allow) => { if (allow) track("app_opened", { source: new URLSearchParams(location.search).has("panic") ? "home_screen" : "link" }); });
  if (consent() === "granted") track("app_opened", { source: matchMedia?.("(display-mode: standalone)").matches ? "home_screen" : "link" });
}

// HTML for the Settings screen (called by app.js settingsContent): empty unless this build can send anything.
export function settingsGroup() {
  if (!configured()) return "";
  const on = consent() === "granted" ? "checked" : "";
  return `
      <div class="group"><div class="group-card">
        <div class="row"><span class="row-label">Share anonymous usage data<small>Counts of features used and crash reports. No names, places or locations. Off by default.</small></span><label class="switch"><input type="checkbox" data-analytics-consent ${on} aria-label="Share anonymous usage data"><span class="track"></span><span class="knob"></span></label></div>
      </div></div>`;
}

window.RerouteAnalytics = { settingsGroup }; // read by app.js settingsContent
