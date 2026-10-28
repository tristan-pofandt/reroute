// Native push (FCM on Android, APNs on iOS). Call enablePush() from a user action (e.g. the existing "turn on notifications" button),
// never at launch. The token goes to POST /api/push/native-register (contract in docs/engineering/native-wrapper.md).
import { PushNotifications } from "@capacitor/push-notifications";
import { platform } from "./platform.js";

export async function enablePush(watch = null) {
  let perm = await PushNotifications.checkPermissions();
  if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") perm = await PushNotifications.requestPermissions();
  if (perm.receive !== "granted") return { ok: false, reason: "denied" };
  const token = new Promise((resolve, reject) => {
    PushNotifications.addListener("registration", (t) => resolve(t.value));
    PushNotifications.addListener("registrationError", (e) => reject(new Error(e.error)));
  });
  await PushNotifications.register();
  const value = await token;
  const base = window.__REROUTE_API_BASE__ || "";
  const res = await fetch(`${base}/api/push/native-register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: value, platform: platform(), watch }) });
  return { ok: res.ok, status: res.status };
}

// Tapping a notification opens its url (same mapping as deep links).
export function onNotificationOpen(handler) {
  return PushNotifications.addListener("pushNotificationActionPerformed", (a) => handler(a.notification?.data?.url || null));
}
