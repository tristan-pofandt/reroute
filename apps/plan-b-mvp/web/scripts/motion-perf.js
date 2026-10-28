// Off-main-thread check + Impact-button path check for the Reroute shell. ONE async function `(page) => result` for the playwright MCP
// (`browser_run_code_unsafe`), same conventions as motion-bench.js (serve it with `python -m http.server` and eval it; no fs).
// Settings: globalThis.BENCH_CFG = { base, cpu, mode: "busy" | "impact", only: "weather", seed: true }
//   busy:   (BENCH_CFG.busy = "freeze" blocks once for 300 ms instead and reports `inFreeze`, the changed pictures inside it) a synthetic 30 ms main-thread block every 100 ms (setInterval) runs while the transition plays. The picture is recorded with
//           CDP Page.startScreencast (frames come from the compositor, so they keep coming while the main thread is blocked), decoded in a
//           second tab and diffed. Reported: number of frames whose picture changed, the longest time the picture stood still while the
//           transition was in flight (`stall`), and the share of the 30 ms blocks during which it still moved. Compositor-driven motion keeps
//           moving through a block; main-thread motion freezes for it (stall >= 30 ms).
//   impact: samples the Impact button / dashboard lead figure (opacity, painted x and y) after every frame and reports whether the path is
//           monotonic (one direction, no flash) for home <-> results / weather / menu / dashboard, with and without a seeded trip.
async (page) => {
  const CFG = { base: "http://127.0.0.1:9101/", cpu: 1, mode: "busy", only: "", seed: false };
  Object.assign(CFG, globalThis.BENCH_CFG || {});
  const ctx = page.context(), cdp = await ctx.newCDPSession(page);
  const sleep = (ms) => page.waitForTimeout(ms);
  const idle = async () => { for (let i = 0; i < 60; i++) { if (await page.evaluate(() => !RerouteLegacy.isTransitioning())) break; await sleep(50); } await sleep(350); };
  const go = (s, d) => page.evaluate(([s, d]) => RerouteLegacy.navigate(s, d), [s, d]);
  const click = (sel) => page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) throw new Error("missing " + sel + " on " + RerouteLegacy.state.screen); e.click(); }, sel);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(CFG.base);
  await page.evaluate(async (seed) => {
    for (const r of (await navigator.serviceWorker?.getRegistrations()) || []) await r.unregister();
    for (const k of await caches.keys()) await caches.delete(k);
    localStorage.setItem("planb.demo", JSON.stringify({ on: true, weather: "live", disrupted: "none", traffic: "live", late_min: 0, start: "preset", simulate: true }));
    localStorage.setItem("planb.trips", JSON.stringify(seed ? [{ ref: "t1", date: new Date().toISOString(), mode: "transit", kind: "transit", title: "Bus", co2_kg: 1, co2_saved: 2.4, cost: 3, cost_saved: 4, cost_saved_partial: false, distance_km: 5 }] : []));
  }, CFG.seed);
  await page.goto(CFG.base);
  await page.waitForFunction(() => window.RerouteLegacy?.state && document.querySelector("#viewport .page"), null, { timeout: 15000 });
  await sleep(2500);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: CFG.cpu });

  const T = [
    ["home->weather", async () => {}, () => go("weather", "forward")],
    ["weather->home", async () => { await go("weather", "forward"); await idle(); }, () => go("home", "back")],
    ["home->journey", async () => {}, () => click('[data-action="start"]')],
    ["home->dashboard", async () => {}, () => go("dashboard", "forward")],
    ["dashboard->home", async () => { await go("dashboard", "forward"); await idle(); }, () => go("home", "back")],
    ["home->panic", async () => {}, () => go("panic", "up")],
    ["menu open", async () => {}, () => click('[data-action="open-menu"]')],
    ["settings open", async () => { await click('[data-action="open-menu"]'); await sleep(900); }, () => click('[data-open="settings"]')],
    // control: a plain CSS transform animation (compositor-driven by construction) must keep moving through a block, or the harness is wrong
    ["control (css transform)", async () => {}, () => page.evaluate(() => { document.getElementById("ctl")?.remove(); document.body.insertAdjacentHTML("beforeend", '<div id="ctl" style="position:fixed;left:0;top:300px;width:100px;height:100px;background:red;z-index:99999;animation:ctl 1s linear forwards"></div><style>@keyframes ctl{to{transform:translateX(250px)}}</style>'); setTimeout(() => document.getElementById("ctl").remove(), 1200); })],
  ].filter(([n]) => n.includes(CFG.only));
  const reset = async () => {
    await page.evaluate(() => { for (const s of [".settings-backdrop.open [data-action=close-settings]", ".sheet-backdrop.open [data-action=close-sheet]", ".menu-backdrop.open [data-action=close-menu]"]) document.querySelector(s)?.click(); });
    await sleep(600);
    if (await page.evaluate(() => RerouteLegacy.state.screen) !== "home") { await go("home", "back"); await idle(); }
    await page.waitForSelector('#viewport .page[data-screen="home"] [data-action="open-menu"]', { timeout: 5000 });
    await sleep(300);
  };
  const out = { cpu: CFG.cpu, mode: CFG.mode, seed: CFG.seed, rows: [] };

  if (CFG.mode === "busy") {
    // The picture is recorded with CDP Page.startScreencast (frames are copied from the compositor's output, so they keep coming while the
    // main thread is blocked), decoded in a second tab and diffed against the previous frame. For every 30 ms block that falls inside the
    // transition we ask: did the picture still change during it (strictly inside it)? `moved` is that share. A
    // main-thread animation cannot move during a block (0 %); a compositor animation can. `still` = the longest time nothing changed.
    const dec = await ctx.newPage(); await dec.goto("about:blank");
    let frames = [];
    cdp.on("Page.screencastFrame", (f) => { frames.push([f.metadata.timestamp * 1000, f.data]); cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {}); });
    await cdp.send("Page.startScreencast", { format: "jpeg", quality: 40, maxWidth: 195, maxHeight: 422, everyNthFrame: 1 });
    for (const [name, setup, act] of T) try {
      await reset(); await setup(); await idle();
      await page.evaluate((on) => { window.__blocks = []; const run = (ms) => { const e = performance.now(); window.__blocks.push([performance.timeOrigin + e, ms]); while (performance.now() - e < ms); };
        window.__run = run; if (on && on !== "freeze") window.__busy = setInterval(() => run(30), 100); }, CFG.busy === false ? false : CFG.busy || true);
      await sleep(250); frames = [];
      if (CFG.busy === "freeze") await page.evaluate(() => setTimeout(() => window.__run(300), 90));
      await act(); await sleep(1100);
      const blocks = await page.evaluate(() => { clearInterval(window.__busy); return window.__blocks; });
      const diffs = await dec.evaluate(async (fr) => {
        const c = new OffscreenCanvas(195, 422), g = c.getContext("2d", { willReadFrequently: true }); let prev = null; const out = [];
        for (const [t, b64] of fr) {
          const bmp = await createImageBitmap(await (await fetch("data:image/jpeg;base64," + b64)).blob()); g.drawImage(bmp, 0, 0);
          const d = g.getImageData(0, 0, 195, 422).data; let s = 0;
          if (prev) for (let i = 0; i < d.length; i += 16) s += Math.abs(d[i] - prev[i]);
          out.push([t, prev ? s / (d.length / 16) : 0]); prev = d;
        }
        return out;
      }, frames);
      const ch = diffs.filter((d, i) => i && d[1] > 0.25).map((d) => d[0]);
      let still = 0; for (let i = 1; i < ch.length; i++) still = Math.max(still, ch[i] - ch[i - 1]);
      const inside = blocks.filter(([b, ms]) => ch.length && b > ch[0] - 100 && b + ms < ch[ch.length - 1]);
      const moved = inside.filter(([b, ms]) => ch.some((t) => t >= b + 3 && t <= b + ms)).length;
      const inFreeze = CFG.busy === "freeze" ? ch.filter((t) => t >= blocks[0][0] + 40 && t <= blocks[0][0] + 300).length : undefined;
      out.rows.push({ name, shots: frames.length, changed: ch.length, spanMs: ch.length ? Math.round(ch[ch.length - 1] - ch[0]) : 0, still: Math.round(still), blocks: inside.length, moved, inFreeze });
    } catch (e) { out.rows.push({ name, error: String(e).slice(0, 120) }); }
    await cdp.send("Page.stopScreencast"); await dec.close();
  } else {
    await page.evaluate(() => {
      const num = (s) => (String(s).match(/-?\d+(\.\d+)?/g) || []).map(Number);
      window.__imp = { run(ms) {
        const s = []; const t0 = performance.now(); const mc = new MessageChannel();
        const sample = () => { const e = document.querySelector("#viewport .impact-btn, #viewport .kpi.lead"); if (!e) return s.push([performance.now() - t0, null]); const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
          s.push([performance.now() - t0, +cs.opacity, +r.left.toFixed(1), +r.top.toFixed(1), e.className.includes("lead") ? "lead" : "btn"]); };
        mc.port1.onmessage = sample;
        const loop = () => { if (performance.now() - t0 > ms) return; mc.port2.postMessage(0); requestAnimationFrame(loop); };
        requestAnimationFrame(loop);
        return new Promise((r) => setTimeout(() => r(s), ms + 50));
      } };
    });
    for (const [name, setup, act] of T) {
      await reset(); await setup(); await idle();
      const p = page.evaluate(() => window.__imp.run(1300));
      await act();
      const s = await p;
      // collapse to phases: where was it, how did opacity/x/y move, how many direction reversals
      const vis = s.filter((r) => r[1] != null);
      const rev = (k, th) => { let dir = 0, ext = vis[0]?.[k], n = 0; for (const r of vis) { const v = r[k]; if (!dir) { if (Math.abs(v - ext) >= th) { dir = v > ext ? 1 : -1; ext = v; } continue; } if (dir * (v - ext) > 0) ext = v; else if (dir * (ext - v) >= th) { n++; dir = -dir; ext = v; } } return n; };
      const gone = s.filter((r) => r[1] == null).length;
      out.rows.push({ name, samples: s.length, absent: gone, kinds: [...new Set(vis.map((r) => r[4]))].join("+"), opRev: rev(1, 0.08), xRev: rev(2, 2.5), yRev: rev(3, 2.5),
        first: vis[0]?.slice(1, 4).join("/"), last: vis.at(-1)?.slice(1, 4).join("/"), min: Math.min(...vis.map((r) => r[1])), steps: vis.filter((r, i) => i % Math.ceil(vis.length / 14) === 0).map((r) => `${Math.round(r[0])}:${r[1].toFixed(2)}:${Math.round(r[2])}`).join(" ") });
    }
  }
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  await cdp.detach().catch(() => {}); // a session left open with a screencast running slows the tab for every later measurement
  return out;
}
