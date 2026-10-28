// Status bar, splash, keyboard: match the theme colours already set in index.html (no visual change from the web app).
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";
import { Keyboard } from "@capacitor/keyboard";
import { platform } from "./platform.js";

export async function install(theme, DARK, LIGHT) {
  const apply = () => {
    const light = theme() === "light";
    StatusBar.setStyle({ style: light ? Style.Light : Style.Dark }).catch(() => {});
    if (platform() === "android") StatusBar.setBackgroundColor({ color: light ? LIGHT : DARK }).catch(() => {});
  };
  // Draw under the status bar (Android 15+ is edge-to-edge anyway); app.css already pads with env(safe-area-inset-*).
  if (platform() === "android") await StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
  apply();
  new MutationObserver(apply).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  if (platform() === "ios") Keyboard.setAccessoryBarVisible({ isVisible: false }).catch(() => {});
  // The React splash (#splash) removes itself; drop the native one once the page has loaded.
  const hide = () => SplashScreen.hide({ fadeOutDuration: 150 }).catch(() => {});
  document.readyState === "complete" ? setTimeout(hide, 300) : window.addEventListener("load", () => setTimeout(hide, 300), { once: true });
}
