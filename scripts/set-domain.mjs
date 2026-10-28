#!/usr/bin/env node
// Rewrites the native files that carry the public domain from ONE argument.
//   node scripts/set-domain.mjs --domain app.example.org [--dry-run]
// Files: Android App Links host, iOS associated domain, capacitor.config.ts API host default. Safe to run again with a new domain.
// The web build and server read env (VITE_SITE_DOMAIN, VITE_*_EMAIL, PUBLIC_URL, PLANB_*_EMAIL); the script prints them.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..", "apps", "plan-b-mvp", "web");
export const TARGETS = [
  ["android/app/src/main/AndroidManifest.xml", /(<data android:scheme="https" android:host=")[^"]+(")/, (d) => `$1${d}$2`],
  ["ios/App/App/App.entitlements", /(<string>applinks:)[^<]+(<\/string>)/, (d) => `$1${d}$2`],
  ["capacitor.config.ts", /(process\.env\.VITE_API_BASE \|\| "https:\/\/)[^"]+(")/, (d) => `$1${d}$2`],
];

export function plan(domain, read = (f) => readFileSync(resolve(root, f), "utf8")) {
  return TARGETS.map(([file, pattern, replacement]) => {
    const before = read(file);
    if (!pattern.test(before)) throw new Error(`${file}: expected pattern not found; file changed shape?`);
    return { file, before, after: before.replace(pattern, replacement(domain)) };
  });
}

export function validDomain(domain) {
  return /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(domain || "");
}

if (process.argv[1]?.endsWith("set-domain.mjs")) {
  const args = process.argv.slice(2);
  const domain = args[args.indexOf("--domain") + 1];
  const dry = args.includes("--dry-run");
  if (!args.includes("--domain") || !validDomain(domain)) {
    console.error("usage: node scripts/set-domain.mjs --domain app.example.org [--dry-run]   (bare host name, no https://, no path)");
    process.exit(2);
  }
  for (const { file, before, after } of plan(domain)) {
    console.log(`${before === after ? "unchanged" : dry ? "would change" : "changed"}: ${file}`);
    if (!dry && before !== after) writeFileSync(resolve(root, file), after);
  }
  console.log(`\nStill to do (not files in the repo):
  - Web build / Docker build args: VITE_SITE_DOMAIN=${domain} VITE_API_BASE=https://${domain} VITE_SUPPORT_EMAIL=support@${domain} VITE_ABUSE_EMAIL=abuse@${domain} VITE_PRIVACY_EMAIL=privacy@${domain}
  - Server env (reroute.env): PUBLIC_URL=https://${domain} PLANB_SUPPORT_EMAIL=support@${domain} PLANB_ABUSE_EMAIL=abuse@${domain} PLANB_PRIVACY_EMAIL=privacy@${domain}
  - Serve https://${domain}/.well-known/assetlinks.json (env ANDROID_ASSETLINKS_JSON) and apple-app-site-association (env APPLE_APP_SITE_ASSOCIATION_JSON); see docs/engineering/native-wrapper.md
  - Check: cd apps/plan-b-mvp && python placeholders.py --strict`);
}
