// The legacy app.js calls fetch("/api/...") with relative URLs. In the bundled app there is no same-origin server, so send those to
// VITE_API_BASE (build-time, e.g. https://reroute.example). The web never loads this file.
const BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

export function setupApiBase() {
  if (!BASE) return console.warn("[native] VITE_API_BASE not set: API calls will fail. Build with npm run build:native.");
  const orig = window.fetch.bind(window);
  window.fetch = (input, init) => {
    if (typeof input === "string" && /^\/(api|auth)\//.test(input)) input = BASE + input; // /auth/native/* is the sign-in call
    return orig(input, init);
  };
  window.__REROUTE_API_BASE__ = BASE;
}
