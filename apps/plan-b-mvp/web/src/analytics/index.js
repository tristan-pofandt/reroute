// track(event, props): the only way an analytics event leaves the app.
//   * returns at once unless the build has VITE_POSTHOG_KEY + VITE_POSTHOG_HOST and the person has granted consent;
//   * drops events and properties that are not in schema.js; never throws; no cookies and no SDK. The only identifier is a random
//     per-install id. An account-linked user_hash would be an HMAC computed by the server (docs/engineering/analytics-implementation.md).
import { SCHEMA_VERSION, clean } from "./schema.js";
import { granted, installId, onConsent, sendsUsage } from "./consent.js";

const session = Math.random().toString(36).slice(2, 12); // new per page load, never stored
let queue = [];
let timer = null;

const platform = () => {
  const p = window.Capacitor?.getPlatform?.();
  if (p === "ios" || p === "android") return p;
  return /android/i.test(navigator.userAgent) ? "android" : /iphone|ipad/i.test(navigator.userAgent) ? "ios" : "desktop";
};
const mode = () => (window.matchMedia?.("(display-mode: standalone)").matches || window.Capacitor?.isNativePlatform?.() ? "standalone" : "browser");

export function flush() {
  timer = null;
  const batch = queue;
  queue = [];
  const key = import.meta.env.VITE_POSTHOG_KEY, host = String(import.meta.env.VITE_POSTHOG_HOST || "").replace(/\/$/, "");
  if (!batch.length || !granted() || !sendsUsage()) return;
  try {
    const body = JSON.stringify({ api_key: key, batch });
    // sendBeacon sends no cookies and survives page close; fall back to fetch with credentials omitted
    if (!(navigator.sendBeacon && navigator.sendBeacon(`${host}/batch/`, new Blob([body], { type: "text/plain" })))) {
      fetch(`${host}/batch/`, { method: "POST", body, keepalive: true, credentials: "omit", headers: { "Content-Type": "text/plain" } }).catch(() => {});
    }
  } catch { /* analytics must never break the app */ }
}

export function track(event, props) {
  try {
    if (!sendsUsage() || !granted()) return;
    const cleaned = clean(event, props);
    const id = installId();
    if (!cleaned || !id) return;
    queue.push({
      event, distinct_id: id, timestamp: new Date().toISOString(),
      properties: { ...cleaned, schema_version: SCHEMA_VERSION, app_version: __RELEASE__, platform: platform(), display_mode: mode(), session_id: session, $process_person_profile: false },
    });
    timer ||= setTimeout(flush, 5000);
  } catch { /* never throw */ }
}

export const pending = () => queue.length;
export const discard = () => { queue = []; clearTimeout(timer); timer = null; };

// Withdrawal drops anything queued, immediately.
onConsent((allow) => { if (!allow) discard(); });
addEventListener("pagehide", () => flush());
