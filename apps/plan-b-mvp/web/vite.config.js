import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const FLASK = "http://127.0.0.1:8000";
// Legacy files that the React shell still loads as classic scripts / plain assets. In dev they come straight from Flask.
const legacy = ["/api", "/app.js", "/offline.js", "/app.css", "/favicon.svg", "/manifest.webmanifest", "/sw.js", "/icons", "/vendor", "/qr.svg"];

export default defineConfig({
  base: "/",
  plugins: [react()],
  build: { outDir: "dist", emptyOutDir: true, chunkSizeWarningLimit: 1200 },
  server: { host: "127.0.0.1", proxy: Object.fromEntries(legacy.map((p) => [p, FLASK])) },
});
