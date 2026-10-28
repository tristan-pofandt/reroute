// The event allow-list from docs/product/analytics-and-metrics-2026-10-28.md section 4. An event not listed here is dropped; a property
// not listed for it is dropped; a value that fails its check is dropped. No free text: only booleans, numbers and short enum strings.
export const SCHEMA_VERSION = 1;
const bool = (v) => typeof v === "boolean";
const num = (v) => Number.isFinite(v);
const oneOf = (...a) => (v) => a.includes(v);
const band = (v) => typeof v === "string" && /^[0-9a-z+_.<>-]{1,16}$/.test(v); // "0-2", "20+", "small": a bucket label, never a raw value
const KIND = oneOf("home", "work", "saved", "gps", "typed", "map");
const MODE = oneOf("transit", "bus", "train", "tram", "ferry", "drive", "walk", "rideshare", "scooter", "ebike", "bicycle", "other");
const SORT = oneOf("fastest", "cheapest", "co2", "best");

export const EVENTS = {
  app_opened: { source: oneOf("qr", "link", "home_screen", "push"), first_open: bool },
  consent_set: { analytics: bool },
  account_created: { provider: oneOf("google", "apple") },
  sign_in_completed: { provider: oneOf("google", "apple") },
  pwa_installed: { platform: oneOf("ios", "android", "desktop") },
  trip_planned: { origin_kind: KIND, dest_kind: KIND, distance_band: band, depart_when: oneOf("now", "later"), deadline_set: bool, results_count: num, latency_ms: num, google_calls: num },
  option_viewed: { rank: num, mode: MODE, disrupted: bool, sort: SORT },
  option_selected: { rank: num, mode: MODE, sort: SORT, is_lowest_co2: bool, is_cheapest: bool, is_fastest: bool, co2_saved_g_band: band, cost_band: band },
  sort_changed: { sort: SORT },
  trip_logged: { mode: MODE, distance_band: band, co2_saved_g_band: band, baseline_was_driving: bool, planned_not_travelled_confirmed: bool },
  impact_dashboard_opened: { trips_in_month: band },
  co2_goal_set: { goal_kg_band: band },
  panic_opened: { entry: oneOf("button", "push", "watch_alert"), minutes_to_deadline_band: band },
  panic_option_chosen: { mode: MODE, seconds_from_open: num },
  disruption_alert_shown: { kind: oneOf("cancel", "delay", "alert"), matched_trip: bool },
  watch_started: { trip_kind: band },
  push_enabled: { platform: oneOf("ios", "android", "desktop"), granted: bool },
  push_opened: { kind: band },
  offline_area_downloaded: { area_km2_band: band, size_mb_band: band, duration_s_band: band, success: bool },
  offline_trip_planned: { used_offline: bool },
  ride_viewed: { count_bucket: band },
  ride_offered: { seats: num, kind: oneOf("seat", "split_uber") },
  ride_joined: { kind: oneOf("seat", "split_uber") },
  invite_shared: { channel: oneOf("qr", "link", "share_sheet") },
  referral_signup: { channel: oneOf("qr", "link", "share_sheet") },
  external_handoff: { target: oneOf("uber", "lime", "neuron", "google_maps") },
  driving_cost_viewed: { visible: bool },
  settings_changed: { key: oneOf("theme", "motion_reduced", "analytics_consent", "modes", "fuel", "units", "other") },
  survey_prompt_shown: { kind: oneOf("sus", "nps", "wtp", "diary") },
  survey_completed: { kind: oneOf("sus", "nps", "wtp", "diary") },
  error_shown: { code: band, screen: band },
};

// Returns the cleaned properties, or null when the event name is not allowed.
export function clean(event, props = {}) {
  const spec = Object.hasOwn(EVENTS, event) ? EVENTS[event] : null;
  if (!spec) return null;
  const out = {};
  for (const [k, v] of Object.entries(props || {})) if (Object.hasOwn(spec, k) && spec[k](v)) out[k] = v;
  return out;
}
