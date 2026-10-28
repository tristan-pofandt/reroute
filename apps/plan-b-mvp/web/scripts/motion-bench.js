// Repeatable motion benchmark for the Reroute shell. Not a module: it is ONE async function `(page) => result`, meant for the playwright MCP
// `browser_run_code_unsafe` (`filename`) or any runner that calls it with a playwright `page`. No fs/require is used, so it also runs
// inside that sandbox. Prerequisites: `npm run build`, then `PORT=90xx python server.py` (demo mode is switched on by this script; /api/plan
// is answered from scripts/plan.fixture.json via route.fulfill, so no Google API is ever called). See scripts/README in web/README.md.
//
// Edit the CFG line (or sed it) before a run: base URL, CPU throttle (1 = none, 4 = phone-ish), and `only` (substring filter of the names).
// For every transition it records, in the page:
//   * requestAnimationFrame deltas -> frames over 20 ms / 33 ms, max, p95   (pass 1: no sampling, so the numbers are clean)
//   * PerformanceObserver `longtask` and `layout-shift`
//   * pass 2 additionally samples getComputedStyle(opacity / translate / transform) of the moving elements EVERY frame and reports
//     non-monotonic paths: a direction reversal of > 2.5 px (position) or > 0.08 (opacity) = a visible snap-back or flash.
//   * pageMounted / pageSettled / rerender durations and the time of every `reroute:rerender`

async (page) => {
  const CFG = { base: "http://127.0.0.1:9031/", cpu: 1, only: "", fixture: "C:/Users/tpofa/OneDrive/UQ/Semester 2 2026/COMP1100/COMP1100-45_Kai/apps/plan-b-mvp/web/scripts/plan.fixture.json", raw: "", css: "" };
  Object.assign(CFG, globalThis.BENCH_CFG || {}); // the wrapper sets e.g. globalThis.BENCH_CFG = { cpu: 4, only: "menu", raw: "results:2" }
  const REC = () => {
    const B = (window.__mb = {});
    const tgt = ":scope > header > *, :scope > .panic-top, :scope > .nav-top > *, :scope > .scroll > *, :scope > footer > *, :scope > .nav-fabs, :scope > .nav-sheet";
    const num = (s) => { const m = String(s).match(/-?\d+(\.\d+)?/g); return m ? m.map(Number) : []; };
    B.start = (sample) => {
      B.frames = []; B.lt = []; B.ls = []; B.marks = []; B.series = new Map(); B.ids = new WeakMap(); B.t0 = performance.now(); B.on = true;
      B.po1 = new PerformanceObserver((l) => l.getEntries().forEach((e) => B.lt.push([+(e.startTime - B.t0).toFixed(1), +e.duration.toFixed(1)])));
      B.po2 = new PerformanceObserver((l) => l.getEntries().forEach((e) => B.ls.push([+(e.startTime - B.t0).toFixed(1), +e.value.toFixed(4), e.sources?.[0]?.node ? (e.sources[0].node.className || e.sources[0].node.nodeName) : ""])));
      try { B.po1.observe({ type: "longtask" }); } catch {}
      try { B.po2.observe({ type: "layout-shift" }); } catch {}
      B.rer = () => B.marks.push(["rerender", +(performance.now() - B.t0).toFixed(1)]);
      document.addEventListener("reroute:rerender", B.rer);
      const L = window.RerouteBridge?.legacy;
      if (L && !L.__wrapped) {
        L.__wrapped = true;
        for (const k of ["pageMounted", "pageSettled", "rerender"]) { const f = L[k]; if (!f) continue; L[k] = function (...a) { const s = performance.now(); const r = f.apply(this, a); B.on && B.marks.push([k, +(s - B.t0).toFixed(1), +(performance.now() - s).toFixed(1)]); return r; }; }
      }
      let n = 0;
      // Sampling happens in a task posted from the rAF callback: that runs AFTER the frame was rendered, so it sees what was painted, not
      // a mid-frame state (framer renders in its own rAF callback; reading styles from ours could see a value it is about to fix).
      const mc = new MessageChannel();
      const take = (t) => {
        if (!B.on) return;
        if (n++ % 3 === 0) {
          B.els = [];
          document.querySelectorAll("#viewport .page").forEach((p) => {
            [...p.querySelectorAll(tgt)].slice(0, 8).forEach((e, i) => B.els.push([e, `${p.dataset.screen}:${i}:${(e.className + "").split(" ")[0] || e.tagName}`]));
          });
          document.querySelectorAll(".menu-panel, .settings-panel, .sheet, .profile-menu").forEach((e) => B.els.push([e, `panel:${(e.className + "").split(" ")[0]}`]));
          document.querySelectorAll(".menu-backdrop, .settings-backdrop, .sheet-backdrop").forEach((e) => B.els.push([e, `scrim:${(e.className + "").split(" ")[0]}`, "::before"]));
          document.querySelectorAll(".menu-scroll .row, .menu-head > *, .settings-scroll > *, .sheet-scroll > *, .profile-menu button").forEach((e, i) => { if (i < 10) B.els.push([e, `line:${i}:${(e.className + "").split(" ")[0] || e.tagName}`]); });
        }
        for (const [e, name, pseudo] of B.els) {
          if (!e.isConnected) continue;
          const cs = getComputedStyle(e, pseudo || null);
          if (cs.display === "none") continue;
          if (!pseudo && e.getBoundingClientRect().top >= (e.closest(".scroll, .sheet-scroll")?.getBoundingClientRect().bottom ?? innerHeight)) continue; // clipped below the scroll area: not a visible glitch
          let id = B.ids.get(e); if (!id) { id = B.series.size + 1; B.ids.set(e, id); }
          const key = name + "#" + id;
          let s = B.series.get(key); if (!s) B.series.set(key, (s = []));
          const tr = cs.translate === "none" ? [0, 0] : num(cs.translate);
          let x = tr[0] || 0, y = tr[1] || 0;
          if (cs.transform && cs.transform !== "none") { const m = num(cs.transform); if (m.length === 6) { x += m[4]; y += m[5]; } else if (m.length === 16) { x += m[12]; y += m[13]; } }
          s.push([t - B.t0, +cs.opacity, x, y]);
        }
      };
      mc.port1.onmessage = (e) => take(e.data);
      const loop = (t) => {
        if (!B.on) return;
        B.frames.push(t - B.t0);
        if (sample) mc.port2.postMessage(t);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    };
    const zig = (vals, th) => { // direction reversals larger than th
      let rev = 0, swing = 0, dir = 0, ext = vals[0], first = vals[0];
      for (const v of vals) {
        if (!dir) { if (Math.abs(v - ext) >= th) { dir = v > ext ? 1 : -1; ext = v; } continue; }
        if (dir * (v - ext) > 0) ext = v;
        else if (dir * (ext - v) >= th) { rev++; swing = Math.max(swing, Math.abs(ext - v)); dir = -dir; ext = v; }
      }
      return { rev, swing: +swing.toFixed(1) };
    };
    B.stop = () => {
      B.on = false; B.po1.disconnect(); B.po2.disconnect(); document.removeEventListener("reroute:rerender", B.rer);
      const d = []; for (let i = 1; i < B.frames.length; i++) d.push(B.frames[i] - B.frames[i - 1]);
      const sorted = [...d].sort((a, b) => a - b);
      const jank = []; for (let i = 1; i < B.frames.length; i++) if (d[i - 1] > 20) jank.push([+B.frames[i].toFixed(0), +d[i - 1].toFixed(1)]);
      const paths = [], raw = {};
      if (window.__mbRaw) for (const [k, s] of B.series) if (k.includes(window.__mbRaw)) raw[k] = s.map((p) => [Math.round(p[0]), +p[1].toFixed(2), +p[2].toFixed(1), +p[3].toFixed(1)]);
      for (const [k, s] of B.series) {
        if (s.length < 4) continue;
        const o = zig(s.map((p) => p[1]), 0.08), x = zig(s.map((p) => p[2]), 2.5), y = zig(s.map((p) => p[3]), 2.5);
        if (o.rev || x.rev || y.rev) paths.push(`${k} op:${o.rev}/${o.swing} x:${x.rev}/${x.swing} y:${y.rev}/${y.swing}`);
      }
      return {
        frames: d.length, over12: d.filter((v) => v > 12).length, over20: d.filter((v) => v > 20).length, over33: d.filter((v) => v > 33).length, max: +Math.max(0, ...d).toFixed(1),
        p95: +(sorted[Math.floor(sorted.length * 0.95)] || 0).toFixed(1), jank: jank.slice(0, 8), longtasks: B.lt, cls: +B.ls.reduce((a, e) => a + e[1], 0).toFixed(4),
        shifts: B.ls.slice(0, 3), marks: B.marks.filter((m) => m[0] !== "rerender" ? m[2] > 4 : true).slice(0, 10), tracked: B.series.size, paths: paths.slice(0, 12), raw,
      };
    };
  };

  const cdp = await page.context().newCDPSession(page);
  const sleep = (ms) => page.waitForTimeout(ms);
  const idle = async () => { for (let i = 0; i < 60; i++) { if (await page.evaluate(() => !RerouteLegacy.isTransitioning())) break; await sleep(50); } await sleep(350); };
  const go = (s, d) => page.evaluate(([s, d]) => RerouteLegacy.navigate(s, d), [s, d]);
  const click = (sel) => page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) throw new Error("missing " + sel); e.click(); }, sel);
  const toHome = async () => { await page.evaluate(() => { document.querySelector(".menu-backdrop.open [data-action=close-menu]")?.click(); }); await sleep(500); if (await page.evaluate(() => RerouteLegacy.state.screen) !== "home") { await go("home", "back"); await idle(); } };

  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/plan", (r) => r.fulfill({ path: CFG.fixture, contentType: "application/json" }));
  await page.route("**/api/status", async (r) => { const resp = await r.fetch(); const j = await resp.json(); j.live_available = true; await r.fulfill({ response: resp, json: j }); }); // the search button needs a live key; /api/plan is mocked, so none is used
  await page.goto(CFG.base);
  await page.evaluate(async () => {
    for (const r of (await navigator.serviceWorker?.getRegistrations()) || []) await r.unregister();
    for (const k of await caches.keys()) await caches.delete(k);
    localStorage.setItem("planb.demo", JSON.stringify({ on: true, weather: "live", disrupted: "none", traffic: "live", late_min: 0, start: "preset", simulate: true }));
  });
  await page.goto(CFG.base);
  await page.evaluate(`(${REC.toString()})()`);
  await page.evaluate((r) => { window.__mbRaw = r; }, CFG.raw);
  await page.waitForFunction(() => window.RerouteLegacy?.state && document.querySelector("#viewport .page"), null, { timeout: 15000 });
  await sleep(2500);
  if (CFG.css) await page.addStyleTag({ content: CFG.css }); // A/B experiments: CSS injected after load
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: CFG.cpu });
  // Get a plan into the state once (journey -> results), through the real search flow.
  await click('[data-action="start"]'); await idle();
  await click('[data-action="search"]'); await sleep(1200); await idle();
  const hasPlan = await page.evaluate(() => !!RerouteLegacy.state.plan?.options?.length);
  await toHome();

  // name, setup (runs un-measured, must leave a quiet state), action (runs inside the measured window), ms (window length), cleanup
  const T = [
    ["home->results", async () => {}, () => go("results", "forward"), 1300, async () => {}],
    ["results->home", async () => { await go("results", "forward"); await idle(); }, () => go("home", "back"), 1300],
    ["home->dashboard", async () => {}, () => go("dashboard", "forward"), 1300],
    ["dashboard->home", async () => { await go("dashboard", "forward"); await idle(); }, () => go("home", "back"), 1300],
    ["home->weather", async () => {}, () => go("weather", "forward"), 1300],
    ["weather->home", async () => { await go("weather", "forward"); await idle(); }, () => go("home", "back"), 1300],
    ["home->journey", async () => {}, () => go("journey", "forward"), 1300],
    ["journey->home", async () => { await go("journey", "forward"); await idle(); }, () => go("home", "back"), 1300],
    ["journey->results", async () => { await click('[data-action="start"]'); await idle(); }, () => click('[data-action="search"]'), 1900],
    ["results->next", async () => { await go("results", "forward"); await idle(); await click('[data-action="open-sheet"]'); await sleep(600); },
      () => click('.sheet [data-action="choose"]'), 1400],
    ["next->results", async () => { await toHome(); await go("results", "forward"); await idle(); await click('[data-action="open-sheet"]'); await sleep(600); await click('.sheet [data-action="choose"]'); await idle(); }, () => go("results", "back"), 1300],
    ["home->panic", async () => {}, () => go("panic", "up"), 1300],
    ["panic->home", async () => { await go("panic", "up"); await idle(); }, () => go("home", "down"), 1300],
    ["home->nav", async () => {}, () => go("nav", "up"), 1300],
    ["nav->home", async () => { await go("nav", "up"); await idle(); }, () => go("home", "down"), 1300],
    ["menu open", async () => {}, () => click('[data-action="open-menu"]'), 900],
    ["menu close (button)", async () => { await click('[data-action="open-menu"]'); await sleep(900); }, () => click('[data-action="close-menu"]'), 900],
    ["menu close (backdrop)", async () => { await click('[data-action="open-menu"]'); await sleep(900); }, () => click('.menu-backdrop'), 900],
    ["settings open", async () => { await click('[data-action="open-menu"]'); await sleep(900); }, () => click('[data-open="settings"]'), 1100],
    ["settings close", async () => { await toHome(); await click('[data-action="open-menu"]'); await sleep(900); await click('[data-open="settings"]'); await sleep(1100); }, () => click('[data-action="close-settings"]'), 900],
    ["sheet open (share)", async () => { await sleep(500); await click('[data-action="open-menu"]'); await sleep(900); }, () => click('[data-open="share"]'), 1100],
    ["sheet close", async () => { await toHome(); await click('[data-action="open-menu"]'); await sleep(900); await click('[data-open="share"]'); await sleep(1100); }, () => click('.sheet [data-action="close-sheet"]'), 900],
    ["profile open", async () => { await sleep(500); }, () => click('[data-action="toggle-profile"]'), 700],
    ["profile close", async () => { await sleep(300); }, () => click('[data-action="toggle-profile"]'), 700],
  ];

  const out = { cpu: CFG.cpu, hasPlan, rows: [] };
  for (const [name, setup, act, ms] of T) {
    if (CFG.only && !name.includes(CFG.only)) continue;
    const row = { name };
    for (const pass of ["frames", "paths"]) {
      try {
        await toHomeIfNeeded();
        await setup(); await idle();
        await page.evaluate((s) => window.__mb.start(s), pass === "paths");
        await act(); await sleep(ms);
        const r = await page.evaluate(() => window.__mb.stop());
        if (pass === "frames") Object.assign(row, { frames: r.frames, over12: r.over12, over20: r.over20, over33: r.over33, max: r.max, p95: r.p95, jank: JSON.stringify(r.jank), longtasks: JSON.stringify(r.longtasks), cls: r.cls, shifts: JSON.stringify(r.shifts), marks: JSON.stringify(r.marks) });
        else { row.paths = r.paths.length ? r.paths : "ok"; if (CFG.raw) row.raw = r.raw; }
      } catch (e) { row.error = String(e).slice(0, 160); }
      await idle();
    }
    out.rows.push(row);
    // leave a clean state for the next row: close overlays, back to home
    await page.evaluate(() => { document.querySelector(".settings-backdrop.open [data-action=close-settings]")?.click(); document.querySelector(".sheet-backdrop.open [data-action=close-sheet]")?.click(); document.querySelector(".menu-backdrop.open [data-action=close-menu]")?.click(); document.querySelector(".profile-menu.open") && document.querySelector('[data-action="toggle-profile"]').click(); });
    await sleep(600);
  }
  out.console = "check browser_console_messages";
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  return out;

  async function toHomeIfNeeded() { if (await page.evaluate(() => RerouteLegacy.state.screen) !== "home") { await go("home", "back"); await idle(); } }
}
