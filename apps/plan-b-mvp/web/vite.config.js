import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const FLASK = process.env.FLASK_URL || "http://127.0.0.1:8000"; // FLASK_URL=http://127.0.0.1:8601 npm run dev, when Flask is not on 8000
// Legacy files that the React shell still loads as classic scripts / plain assets. In dev they come straight from Flask.
const legacy = ["/api", "/app.js", "/offline.js", "/app.css", "/favicon.svg", "/manifest.webmanifest", "/sw.js", "/icons", "/vendor", "/qr.svg"];

// three's own shader tables hold GLSL for every lit material; the shell draws one ShaderMaterial and MeshBasicMaterial, so three's internal
// imports of ShaderChunk / ShaderLib resolve to a generated trimmed pair (scripts/trim-shaders.mjs).
const trimShaders = {
  name: "reroute-trim-three-shaders",
  enforce: "pre",
  resolveId(source, importer) {
    if (!importer || !/[\/]three[\/]src[\/]/.test(importer) || !/(^|\/)Shader(Chunk|Lib)\.js$/.test(source)) return null;
    return fileURLToPath(new URL("./src/fx/three-shaders.js", import.meta.url));
  },
};

export default defineConfig({
  base: "/",
  plugins: [trimShaders, react()],
  // `three` resolves to a hand-picked export list: see src/fx/three-lite.js for why.
  resolve: { alias: [{ find: /^three$/, replacement: fileURLToPath(new URL("./src/fx/three-lite.js", import.meta.url)) }] },
  build: { outDir: "dist", emptyOutDir: true, chunkSizeWarningLimit: 700 },
  server: { host: "127.0.0.1", proxy: Object.fromEntries(legacy.map((p) => [p, FLASK])) },
});
