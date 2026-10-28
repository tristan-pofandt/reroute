// Flask serves the legacy files (app.js, offline.js, app.css, icons...) next to dist; a bundled app has no Flask, so copy them in.
// Run after `vite build`. sw.js is skipped on purpose: WKWebView custom schemes cannot register service workers (registration is wrapped in .catch).
import { cpSync, existsSync } from "node:fs";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "..", "..");
const dist = resolve(import.meta.dirname, "..", "dist");
for (const f of ["app.js", "offline.js", "app.css", "favicon.svg", "manifest.webmanifest", "icons", "vendor"]) {
  if (existsSync(resolve(root, f))) cpSync(resolve(root, f), resolve(dist, f), { recursive: true });
  else console.warn("missing", f);
}
console.log("legacy assets copied into dist");
