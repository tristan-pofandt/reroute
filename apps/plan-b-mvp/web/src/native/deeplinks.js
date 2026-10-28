// App Links / Universal Links (https://<domain>/...) and the custom scheme (reroute://...) open the matching in-app route.
// The OAuth return goes through the same path: the in-app browser is closed first. Android hardware back is handled here too.
import { App } from "@capacitor/app";
import { platform } from "./platform.js";

const HOSTS = (import.meta.env.VITE_APP_HOSTS || (import.meta.env.VITE_API_BASE ? new URL(import.meta.env.VITE_API_BASE).host : "")).split(",").filter(Boolean);

export function toRoute(url) {
  try {
    const u = new URL(url);
    if (u.protocol === "reroute:") return (u.host && u.host !== "localhost" ? "/" + u.host : "") + (u.pathname === "/" && u.host && u.host !== "localhost" ? "" : u.pathname) + u.search + u.hash;
    if (HOSTS.includes(u.host)) return u.pathname + u.search + u.hash;
  } catch { /* not a URL */ }
  return null;
}

export function install() {
  App.addListener("appUrlOpen", ({ url }) => {
    const route = toRoute(url);
    if (!route) return;
    import("@capacitor/browser").then((m) => m.Browser.close()).catch(() => {});
    history.pushState({}, "", route);
    window.dispatchEvent(new PopStateEvent("popstate")); // react-router listens to popstate
    window.dispatchEvent(new CustomEvent("reroute:deeplink", { detail: { url, route } }));
  });
  if (platform() === "android") App.addListener("backButton", ({ canGoBack }) => (canGoBack ? history.back() : App.minimizeApp()));
}
