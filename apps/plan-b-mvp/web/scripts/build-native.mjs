// npm run build:native            -> vite build (VITE_API_BASE baked in) + legacy assets + cap sync
// npm run android:build-debug     -> the above + gradle assembleDebug (needs JDK 21 and the Android SDK; skipped with a message if missing)
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
const win = process.platform === "win32";
const run = (cmd, args, opts = {}) => { const r = spawnSync(cmd, args, { stdio: "inherit", shell: win, ...opts }); if (r.status) process.exit(r.status); };
if (!process.env.VITE_API_BASE) { console.error("Set VITE_API_BASE to the deployed origin first, e.g. VITE_API_BASE=https://reroute.example npm run build:native"); process.exit(1); }
run("npx", ["vite", "build"]);
run("node", ["scripts/prepare-native.mjs"]);
run("npx", ["cap", "sync"]);
if (process.argv.includes("--debug")) {
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  const jdk = spawnSync("java", ["-version"], { shell: win }).status === 0;
  if (!sdk || !jdk) { console.error(`Cannot assemble: ${!jdk ? "JDK not found. " : ""}${!sdk ? "ANDROID_HOME not set." : ""} See NATIVE.md.`); process.exit(2); }
  run(win ? "gradlew.bat" : "./gradlew", ["assembleDebug"], { cwd: resolve(import.meta.dirname, "..", "android") });
  console.log("APK: android/app/build/outputs/apk/debug/app-debug.apk");
}
