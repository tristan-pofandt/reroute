// jsdom has no matchMedia or vibrate; reduced.js reads matchMedia at import time.
import { afterEach, vi } from "vitest";

window.__reduce = false; // what (prefers-reduced-motion: reduce) answers
window.matchMedia = (query) => ({ get matches() { return query.includes("reduce") ? window.__reduce : false; }, media: query, addEventListener() {}, removeEventListener() {} });
navigator.vibrate = vi.fn();

afterEach(() => {
  window.__reduce = false;
  delete window.Capacitor;
  delete window.RerouteBridge;
  delete window.RerouteLegacy;
  delete document.documentElement.dataset.motion;
  localStorage.clear();
  vi.clearAllMocks();
});
