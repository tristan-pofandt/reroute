// Dev-only accessibility harness (never shipped): screenshots every screen and runs axe-core over it in a real Chrome.
//   node scripts/a11y-audit.mjs --out ../../../tmp/shots [--base http://127.0.0.1:9455/] [--text 100|130|200] [--axe] [--theme dark|light]
//        [--contrast more] [--shots store] [--size 390x844]
// Needs playwright-core + axe-core (devDependencies) and a system Chrome/Edge (CHROME env var overrides). Serves nothing itself:
// start Flask (python server.py) with web/dist built. --text sets html{font-size} to emulate the system font size (px->rem makes it scale).
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i < 0 ? d : process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : true; };
const BASE = arg("base", "http://127.0.0.1:9455/"), OUT = path.resolve(arg("out", "shots")), TEXT = Number(arg("text", 100)), AXE = !!arg("axe", false);
const [W, H] = String(arg("size", "390x844")).split("x").map(Number), THEME = arg("theme", "dark"), ONLY = arg("only", "");
const FIXTURE = path.resolve(import.meta.dirname, "plan.fixture.json");
const chrome = process.env.CHROME || ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "/usr/bin/google-chrome", "/usr/bin/chromium"].find((p) => fs.existsSync(p));
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: chrome, headless: true });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, reducedMotion: "reduce", colorScheme: THEME, forcedColors: arg("forced", false) ? "active" : "none", serviceWorkers: "block", bypassCSP: true });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
const sleep = (ms) => page.waitForTimeout(ms);
const idle = async () => { for (let i = 0; i < 60; i++) { if (await page.evaluate(() => !RerouteLegacy.isTransitioning())) break; await sleep(50); } await sleep(300); };
const go = async (s, d = "forward") => { await page.evaluate(([s, d]) => RerouteLegacy.navigate(s, d), [s, d]); await idle(); };
const click = async (sel) => { await page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) throw new Error("missing " + sel); e.click(); }, sel); await sleep(700); };
const trip = { ref: "t1", date: new Date().toISOString(), mode: "transit", kind: "transit", title: "Bus 412", co2_kg: 1, co2_saved: 2.4, cost: 3, cost_saved: 4 };

await page.route("**/api/plan", (r) => r.fulfill({ path: FIXTURE, contentType: "application/json" }));
await page.route("**/api/status", async (r) => { const resp = await r.fetch(); const j = await resp.json(); j.live_available = true; await r.fulfill({ response: resp, json: j }); });
await page.goto(BASE);
await page.evaluate((trips) => {
  localStorage.clear();
  localStorage.setItem("planb.demo", JSON.stringify({ on: true, weather: "clear", disrupted: "none", traffic: "live", late_min: 0, start: "preset", simulate: true }));
  localStorage.setItem("planb.trips", JSON.stringify(trips));
}, [trip]);
await page.goto(BASE);
await page.waitForFunction(() => window.RerouteLegacy?.state && document.querySelector("#viewport .page"), null, { timeout: 20000 });
await sleep(2500);
if (TEXT !== 100) await page.addStyleTag({ content: `html{font-size:${TEXT}% !important}` });
  await page.evaluate(() => dispatchEvent(new Event("resize")));

const axeSrc = AXE ? fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8") : "";
const results = [];
async function shoot(name, extra = "") {
  if (ONLY && !name.includes(ONLY)) return;
  await page.evaluate(() => document.activeElement?.blur?.());
  await sleep(250);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  const overflow = await page.evaluate(() => ({ x: document.documentElement.scrollWidth > innerWidth + 1, bodyX: document.body.scrollWidth > innerWidth + 1 }));
  if (overflow.x || overflow.bodyX) results.push({ name, overflow: true });
  if (AXE) {
    await page.evaluate(axeSrc);
    const r = await page.evaluate(async () => {
      const res = await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] } });
      return res.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help, sample: v.nodes.slice(0, 3).map((n) => n.target.join(" ") + " :: " + (n.failureSummary || "").split("\n")[1]) }));
    });
    results.push({ name, violations: r });
  }
}

await shoot("home");
await click('[data-action="open-menu"]'); await shoot("menu");
await click('[data-open="settings"]'); await shoot("settings");
await page.evaluate(() => { document.querySelector(".settings-scroll").scrollTop = 99999; }); await sleep(300); await shoot("settings-bottom");
await click('[data-action="close-settings"]'); await sleep(600);
await page.evaluate(() => { document.querySelector('[data-action="close-menu"]')?.click(); }); await sleep(600);
await click('[data-action="start"]'); await idle(); await shoot("journey");
await click('[data-action="search"]'); await sleep(1500); await idle(); await shoot("results");
await page.evaluate(() => { const c = document.querySelector('[data-action="open-sheet"]'); c?.click(); }); await sleep(900); await shoot("results-sheet");
await page.evaluate(() => document.querySelector('[data-action="close-sheet"]')?.click()); await sleep(700);
for (const s of ["next", "dashboard", "rides", "weather", "offline-area", "terms", "privacy", "sources"]) { await go(s); await sleep(500); await shoot(s); }
await go("panic", "up"); await sleep(500); await shoot("panic");
await go("home", "back"); await sleep(400);
await click('[data-action="open-demo"]').catch(() => {}); await shoot("demo-sheet");

fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify({ text: TEXT, results, errors }, null, 1));
if (AXE) {
  const all = results.flatMap((r) => (r.violations || []).map((v) => ({ ...v, screen: r.name })));
  console.log(`axe: ${all.length} violation groups, ${all.reduce((n, v) => n + v.nodes, 0)} nodes`);
  const byId = {};
  for (const v of all) (byId[v.id] ||= { impact: v.impact, help: v.help, nodes: 0, screens: [], sample: v.sample[0] }).nodes += v.nodes, byId[v.id].screens.push(v.screen);
  for (const [id, v] of Object.entries(byId)) console.log(` ${id} [${v.impact}] x${v.nodes} on ${[...new Set(v.screens)].join(",")} :: ${v.sample}`);
}
console.log(`overflow: ${results.filter((r) => r.overflow).map((r) => r.name).join(",") || "none"}; console errors: ${errors.length}`);
errors.slice(0, 8).forEach((e) => console.log("  " + e));
await browser.close();
