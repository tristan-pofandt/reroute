#!/usr/bin/env node
// One source of truth for the app version: apps/plan-b-mvp/web/package.json ("version" = semver, "buildNumber" = integer that only goes up).
// It feeds: package-lock.json, the Support page and /healthz (they read package.json), Android versionName/versionCode, iOS MARKETING_VERSION/CURRENT_PROJECT_VERSION.
//   node scripts/bump-version.mjs patch|minor|major|1.2.3 [--build N] [--dry-run]    new version; the build number goes up by 1 unless --build is given
//   node scripts/bump-version.mjs --sync                                              rewrite the native files from package.json as it is
//   node scripts/bump-version.mjs --check                                             exit 1 if any file disagrees (scripts/check.sh runs this)
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const web = resolve(import.meta.dirname, "..", "apps", "plan-b-mvp", "web");
const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;
const GRADLE = "android/app/build.gradle";
const PBX = "ios/App/App.xcodeproj/project.pbxproj";

export function next(version, how) {
  const m = SEMVER.exec(version);
  if (SEMVER.test(how)) return how;
  if (!m || !["major", "minor", "patch"].includes(how)) throw new Error(`cannot bump ${version} by "${how}"`);
  const [a, b, c] = m.slice(1).map(Number);
  return how === "major" ? `${a + 1}.0.0` : how === "minor" ? `${a}.${b + 1}.0` : `${a}.${b}.${c + 1}`;
}

// [file, pattern, replacement(version, build)]; every pattern must match at least once.
export const NATIVE = [
  [GRADLE, /versionCode \d+/g, (v, b) => `versionCode ${b}`],
  [GRADLE, /versionName "[^"]*"/g, (v) => `versionName "${v}"`],
  [PBX, /CURRENT_PROJECT_VERSION = [^;]+;/g, (v, b) => `CURRENT_PROJECT_VERSION = ${b};`],
  [PBX, /MARKETING_VERSION = [^;]+;/g, (v) => `MARKETING_VERSION = ${v};`],
];

export function apply(text, file, version, build) {
  return NATIVE.filter(([f]) => f === file).reduce((t, [, re, rep]) => {
    if (!re.test(t)) throw new Error(`${file}: ${re} not found`);
    return t.replace(re, rep(version, build));
  }, text);
}

const read = (f) => readFileSync(resolve(web, f), "utf8");
const write = (f, t) => writeFileSync(resolve(web, f), t);

if (process.argv[1]?.endsWith("bump-version.mjs")) {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry-run");
  const pkg = JSON.parse(read("package.json"));
  let [version, build] = [pkg.version, pkg.buildNumber];
  const files = [GRADLE, PBX];
  if (args.includes("--check")) {
    const bad = files.filter((f) => apply(read(f), f, version, build) !== read(f));
    const lock = JSON.parse(read("package-lock.json"));
    if (lock.version !== version || lock.packages[""].version !== version) bad.push("package-lock.json");
    if (bad.length) { console.error(`version ${version} (build ${build}) disagrees in: ${bad.join(", ")}\nrun: node scripts/bump-version.mjs --sync`); process.exit(1); }
    console.log(`versions agree: ${version} (build ${build})`);
  } else {
    const buildAt = args.indexOf("--build");
    const how = args.find((a, i) => !a.startsWith("--") && (buildAt < 0 || i !== buildAt + 1));
    if (!how && !args.includes("--sync")) { console.error("usage: node scripts/bump-version.mjs patch|minor|major|X.Y.Z [--build N] [--dry-run] | --sync | --check"); process.exit(2); }
    if (how) { version = next(version, how); build = args.includes("--build") ? Number(args[args.indexOf("--build") + 1]) : build + 1; }
    if (!Number.isInteger(build) || build < 1) { console.error("build number must be a positive integer"); process.exit(2); }
    console.log(`${pkg.version} (build ${pkg.buildNumber}) -> ${version} (build ${build})${dry ? " [dry run]" : ""}`);
    const lock = JSON.parse(read("package-lock.json"));
    Object.assign(pkg, { version, buildNumber: build });
    lock.version = lock.packages[""].version = version;
    if (!dry) {
      write("package.json", JSON.stringify(pkg, null, 2) + "\n");
      write("package-lock.json", JSON.stringify(lock, null, 2) + "\n");
      for (const f of files) write(f, apply(read(f), f, version, build));
    }
    console.log("Also: bump CACHE in apps/plan-b-mvp/sw.js if web files changed; commit; tag v" + version);
  }
}
