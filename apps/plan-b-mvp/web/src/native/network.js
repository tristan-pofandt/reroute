// WebView online/offline events can lag on mobile. Capacitor's Network plugin is reliable, and app.js already listens to window
// "online"/"offline" (its offline banner), so re-dispatch those events.
import { Network } from "@capacitor/network";

export function install() {
  let last = null;
  Network.addListener("networkStatusChange", ({ connected }) => {
    if (last === connected) return;
    last = connected;
    window.dispatchEvent(new Event(connected ? "online" : "offline"));
  });
}
