import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const FLASK = process.env.FLASK_URL || "http://127.0.0.1:8000"; // FLASK_URL=http://127.0.0.1:8601 npm run dev, when Flask is not on 8000
// Legacy files that the React shell still loads as classic scripts / plain assets. In dev they come straight from Flask.
const legacy = ["/api", "/app.js", "/offline.js", "/app.css", "/favicon.svg", "/manifest.webmanifest", "/sw.js", "/icons", "/vendor", "/qr.svg"];

export default defineConfig({
  base: "/",
  plugins: [react()],
  test: { environment: "jsdom", setupFiles: ["./src/__tests__/setup.js"], include: ["src/**/*.test.{js,jsx}"] },
  build: { outDir: "dist", emptyOutDir: true },
  server: { host: "127.0.0.1", proxy: Object.fromEntries(legacy.map((p) => [p, FLASK])) },
});
