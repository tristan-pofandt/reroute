// Crash reporting. Sentry (@sentry/browser) is loaded lazily and only when the build has VITE_SENTRY_DSN AND the person has granted
// consent; otherwise errors only go to the console. Reports carry the error type, message and stack, the release, and nothing else:
// no user, no request data, no breadcrumbs, URLs reduced to origin + path, and no default integrations (no automatic network/DOM capture).
import { consent } from "../analytics/consent.js";

const DSN = import.meta.env.VITE_SENTRY_DSN;
let sentry = null;

// Remove query strings and hash from any URL in a string (they can hold place names, tokens or coordinates).
export const scrubUrls = (s) => (typeof s === "string" ? s.replace(/(https?:\/\/[^\s"')]+?)[?#][^\s"')]*/g, "$1") : s);

export function scrub(event) {
  delete event.user;
  delete event.request;
  delete event.breadcrumbs;
  delete event.contexts?.geolocation;
  if (event.message) event.message = scrubUrls(event.message);
  for (const ex of event.exception?.values || []) {
    ex.value = scrubUrls(ex.value);
    for (const f of ex.stacktrace?.frames || []) { f.filename = scrubUrls(f.filename); delete f.vars; }
  }
  return event;
}

async function load() {
  if (sentry) return sentry;
  const S = await import("@sentry/browser");
  S.init({ dsn: DSN, release: __RELEASE__, sendDefaultPii: false, defaultIntegrations: false, maxBreadcrumbs: 0, tracesSampleRate: 0, beforeSend: scrub });
  return (sentry = S);
}

export function report(error, where = "") {
  console.error(where ? `[${where}]` : "", error);
  if (!DSN || consent() !== "granted") return;
  load().then((S) => S.captureException(error instanceof Error ? error : new Error(String(error)), { tags: { where } })).catch(() => {});
}

let hooked = false;
export function installGlobalHandlers() {
  if (hooked) return;
  hooked = true;
  addEventListener("error", (e) => { if (e.error) report(e.error, "window.error"); });
  addEventListener("unhandledrejection", (e) => report(e.reason, "unhandledrejection"));
}
