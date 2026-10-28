// Native push (FCM on Android and iOS). The Settings alerts toggle in app.js calls window.rerouteNativePush.enable(watch, prime) from a user action,
// never at launch. The flow (pure, unit tested in __tests__/push.test.js):
//   granted -> register | denied -> tell the user to open system settings | prompt -> show our own sheet first ("Not now" never reaches the OS,
//   so the one-time iOS prompt is not burned) -> OS prompt -> register. The token goes to POST /api/push/native-register (docs/engineering/native-wrapper.md).
import { platform } from "./platform.js";

const SETTINGS_HINT = "Notifications are off for Reroute. Open your phone's Settings, choose Reroute, turn on Notifications, then try again.";
const TOKEN_KEY = "planb.pushtoken", DEVICE_KEY = "planb.device";

// What to do for a permission state; `accepted` is the answer to our own sheet (undefined = not asked yet).
export const nextStep = (perm, accepted) => (perm === "granted" ? "register" : perm === "denied" ? "settings" : accepted === undefined ? "prime" : accepted ? "ask-os" : "later");

// deps: { check(): "granted"|"denied"|"prompt", request(): same, register(): Promise<token>, send(token, watch): Promise<{ok,id}>, prime(): Promise<boolean>, track(granted) }
export async function runEnable(deps, watch) {
  let perm = await deps.check(), accepted;
  if (nextStep(perm) === "prime") {
    accepted = await deps.prime();
    if (nextStep(perm, accepted) === "later") return { ok: false, reason: "later", message: "Alerts stay off. You can turn them on any time." };
    perm = await deps.request();
    deps.track(perm === "granted");
  }
  if (nextStep(perm) === "settings") return { ok: false, reason: "denied", message: SETTINGS_HINT };
  if (perm !== "granted") return { ok: false, reason: "later", message: "Notifications weren't allowed, so alerts stay off." };
  const token = await deps.register();
  const res = await deps.send(token, watch);
  return res.ok ? { ok: true, id: res.id, token } : { ok: false, reason: "server", message: res.status === 503 ? "This Reroute server isn't set up for app notifications yet." : "Couldn't turn on alerts. Try again." };
}

const level = (r) => (r === "granted" ? "granted" : r === "denied" ? "denied" : "prompt"); // prompt-with-rationale counts as prompt
const base = () => window.__REROUTE_API_BASE__ || "";
function deviceId() {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) localStorage.setItem(DEVICE_KEY, (id = crypto.randomUUID()));
    return id;
  } catch { return "unavailable-device-id"; }
}
const post = (path, body) => fetch(`${base()}${path}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "X-Reroute-Device": deviceId() }, body: JSON.stringify(body) });

async function realDeps(prime) {
  const { PushNotifications: P } = await import("@capacitor/push-notifications");
  return {
    check: async () => level((await P.checkPermissions()).receive),
    request: async () => level((await P.requestPermissions()).receive), // Android 13+: this is the POST_NOTIFICATIONS prompt
    prime,
    track: (granted) => document.dispatchEvent(new CustomEvent("reroute:track", { detail: { event: "push_enabled", props: { platform: platform(), granted } } })),
    register: async () => {
      const token = new Promise((resolve, reject) => {
        P.addListener("registration", (t) => resolve(t.value));
        P.addListener("registrationError", (e) => reject(new Error(e.error)));
      });
      await P.register();
      return token;
    },
    send: async (token, watch) => {
      const res = await post("/api/push/native-register", { token, platform: platform(), app_version: String(window.__RELEASE__ || ""), locale: navigator.language || "", watch });
      const data = await res.json().catch(() => ({}));
      try { localStorage.setItem(TOKEN_KEY, token); } catch { /* the token is re-sent on the next enable */ }
      return { ok: res.ok, status: res.status, id: data.id };
    },
  };
}

export const enablePush = async (watch = null, prime = async () => true) => runEnable(await realDeps(prime), watch);

export async function disablePush() {
  let token = null;
  try { token = localStorage.getItem(TOKEN_KEY); localStorage.removeItem(TOKEN_KEY); } catch { /* nothing stored */ }
  if (token) await post("/api/push/native-unregister", { token }).catch(() => {});
}

// Tapping a notification opens its url (same mapping as deep links); /?alternatives=<id> re-plans the stored trip.
export function onNotificationOpen(handler) {
  return import("@capacitor/push-notifications").then(({ PushNotifications: P }) => P.addListener("pushNotificationActionPerformed", (a) => handler(a.notification?.data?.url || null)));
}

export async function install() {
  const [{ PushNotifications: P }, { App }, deeplinks] = await Promise.all([import("@capacitor/push-notifications"), import("@capacitor/app"), import("./deeplinks.js")]);
  window.rerouteNativePush = { enable: enablePush, disable: disablePush };
  if (platform() === "android") P.createChannel({ id: "alerts", name: "Disruption alerts", importance: 4 }).catch(() => {});
  // Android does not draw notifications while the app is open (iOS does, via presentationOptions): show it in-app instead.
  P.addListener("pushNotificationReceived", (n) => window.dispatchEvent(new CustomEvent("reroute:push-received", { detail: { title: n.title || "Reroute", body: n.body || "" } })));
  P.addListener("pushNotificationActionPerformed", (a) => {
    const url = a.notification?.data?.url || "/";
    document.dispatchEvent(new CustomEvent("reroute:track", { detail: { event: "app_opened", props: { source: "push", first_open: false } } }));
    const id = new URL(url, "https://x.invalid").searchParams.get("alternatives");
    if (id) window.dispatchEvent(new CustomEvent("reroute:open-alternatives", { detail: id }));
    else deeplinks.openRoute(url);
  });
  const clear = () => P.removeAllDeliveredNotifications().catch(() => {}); // also resets the iOS badge
  clear();
  App.addListener("appStateChange", ({ isActive }) => isActive && clear());
}
