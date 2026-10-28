// Native-only startup. main.jsx calls initNative(); on the web it returns at once and every module below is a dynamic import,
// so the browser never downloads native code. Each step is isolated: one failing plugin never blocks the app.
import { isNative, platform } from "./platform.js";

const DARK = "#090A0F", LIGHT = "#EEF0F5";
const theme = () => (document.documentElement.dataset.theme === "light" ? "light" : "dark");
const safe = (p) => Promise.resolve(p).catch((e) => console.warn("[native]", e?.message || e));

export async function initNative() {
  if (!isNative()) return;
  document.documentElement.classList.add("native", `native-${platform()}`);
  (await import("./api.js")).setupApiBase();
  safe(import("./geolocation.js").then((m) => m.install()));
  safe(import("./network.js").then((m) => m.install()));
  safe(import("./deeplinks.js").then((m) => m.install()));
  safe(import("./share.js").then((m) => m.install()));
  safe(import("./chrome.js").then((m) => m.install(theme, DARK, LIGHT)));
}
