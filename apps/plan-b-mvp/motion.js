// Reroute's motion layer, built on GSAP 3 and ScrollTrigger (vendored in vendor/ so the installed app works offline).
// Every effect is an enhancement over a page that is already visible and usable: if GSAP fails to load, or motion is reduced
// (the system setting or Reroute's own Reduce motion switch), nothing here runs and app.css's plain transitions remain.
// Budget: UI feedback and state changes take 140–220 ms on transform and opacity; only scroll-bound motion and the count-up run longer.
(() => {
  const { gsap, ScrollTrigger } = window;
  const app = document.getElementById("app"), viewport = document.getElementById("viewport");
  if (!gsap || !ScrollTrigger || !app || !viewport) return;
  gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ duration: 0.2, ease: "power3.out", overwrite: "auto" });
  // Tells app.css that GSAP now owns transform on pressable controls, so a CSS transform transition does not drag behind each tween.
  document.documentElement.classList.add("gsap");

  const systemReduced = matchMedia("(prefers-reduced-motion: reduce)");
  const reduced = () => document.documentElement.dataset.motion === "reduced" || (systemReduced.matches && document.documentElement.dataset.motion !== "full");
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
  // Haptics follow the motion's weight: a press is a light tick, a panel opening is a soft double pulse. Android/Chrome only (iOS has no Vibration API); the pin drop in app.js keeps its own.
  const buzz = (pattern) => { if (!reduced()) try { navigator.vibrate?.(pattern); } catch { /* optional */ } };

  // ── Micro-interactions ─────────────────────────────────────────────────────
  // Press sinks a control to 0.97 at once; release springs it back past 1 with back.out, so a tap feels physical.
  const PRESSABLE = ".btn, .icon-btn, .nav-back, .nav-action, .home-btn, button.row, a.row, .panic-btn, .panic-go, .panic-chip, .panic-exit, .segmented button, .stepper button, .card-body, .impact-btn, .cost-toggle";
  const pressTarget = (el) => (el.matches(".card-body") ? el.closest(".card") || el : el);
  let lastPointer = 0;
  document.addEventListener("pointerdown", (e) => {
    lastPointer = performance.now();
    const el = e.target.closest?.(PRESSABLE);
    if (!el || el.disabled || reduced() || (e.pointerType === "mouse" && e.button !== 0)) return;
    const target = pressTarget(el);
    buzz(6);
    gsap.to(target, { scale: 0.97, duration: 0.14, ease: "power2.out" });
    const release = () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      gsap.to(target, { scale: 1, duration: 0.22, ease: "back.out(1.7)", clearProps: "scale" });
    };
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
  }, { passive: true });

  // Hover lift only for a real mouse: touch screens fire hover on tap, which would leave controls stuck up.
  const HOVERABLE = ".btn, .icon-btn, .panic-go, .panic-chip, .card, .impact-btn";
  document.addEventListener("pointerover", (e) => {
    if (e.pointerType !== "mouse" || !finePointer.matches || reduced()) return;
    const el = e.target.closest?.(HOVERABLE);
    if (!el || el.contains(e.relatedTarget) || el.disabled) return;
    gsap.to(el, { y: -2, duration: 0.18, ease: "back.out(1.7)" });
    el.addEventListener("pointerleave", () => gsap.to(el, { y: 0, duration: 0.14, clearProps: "y" }), { once: true });
  });

  // A field tapped into gives a small elastic settle; focus arriving from the keyboard is left still.
  document.addEventListener("focusin", (e) => {
    const el = e.target;
    if (!el.matches?.("input:not([type=checkbox]):not([type=radio]):not([type=range]), textarea, select") || reduced() || performance.now() - lastPointer > 400) return;
    gsap.fromTo(el, { scale: 0.985 }, { scale: 1, duration: 0.22, ease: "back.out(1.7)", clearProps: "scale" });
  });

  // ── Menus, settings and sheets ─────────────────────────────────────────────
  // The panels slide in CSS (app.css); their contents follow in a short stagger once the panel is opening, capped at 8 rows.
  const STAGGERED = [
    [".menu-backdrop", ".menu-scroll > *", { x: -14 }],
    [".settings-backdrop", ".settings-scroll > *", { x: 14 }],
    [".sheet-backdrop", ".sheet-scroll > *", { y: 10 }],
  ];
  function staggerIn(panel) {
    const match = STAGGERED.find(([sel]) => panel.matches(sel));
    if (!match || reduced()) return;
    buzz([10, 30, 6]);
    const rows = [...panel.querySelectorAll(match[1])].slice(0, 8);
    if (rows.length) gsap.fromTo(rows, { opacity: 0, ...match[2] }, { opacity: 1, x: 0, y: 0, duration: 0.2, stagger: 0.025, delay: 0.04, clearProps: "opacity,transform" });
  }
  new MutationObserver((list) => {
    list.forEach((m) => {
      if (m.target.matches("button.is-loading")) addLoader(m.target);
      if (m.target.classList.contains("open") && !(m.oldValue || "").split(" ").includes("open")) staggerIn(m.target);
    });
  }).observe(app, { subtree: true, attributes: true, attributeFilter: ["class"], attributeOldValue: true });

  // ── Loading ────────────────────────────────────────────────────────────────
  // Busy buttons get a loader drawn from the logo: the direct route bends into the detour and back, the app's idea in one line.
  const STRAIGHT = "M4 28 C10 22 18 14 28 4", DETOUR = "M4 28 C4 16 11 6 25 6";
  function addLoader(button) {
    if (button.querySelector(".morph-loader") || reduced()) return;
    button.insertAdjacentHTML("afterbegin", `<svg class="morph-loader" viewBox="0 0 32 32" aria-hidden="true"><path d="${STRAIGHT}"/><circle cx="4" cy="28" r="3.5"/></svg>`);
    const path = button.querySelector(".morph-loader path");
    const tween = gsap.to(path, { attr: { d: DETOUR }, duration: 0.5, ease: "sine.inOut", repeat: -1, yoyo: true,
      onRepeat: () => { if (!path.isConnected || !button.classList.contains("is-loading")) { tween.kill(); path.closest("svg")?.remove(); } } });
  }

  // When a skeleton is replaced by real content in the same container, the content cross-fades and slides in over 240 ms.
  function crossFade(m) {
    const wasSkeleton = [...m.removedNodes].some((n) => n.nodeType === 1 && (n.matches(".skeleton, [role=status]") || n.querySelector?.(".skeleton")));
    const added = [...m.addedNodes].filter((n) => n.nodeType === 1 && !n.matches(".skeleton") && !n.querySelector(".skeleton"));
    if (wasSkeleton && added.length) gsap.fromTo(added.slice(0, 8), { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.24, stagger: 0.03, clearProps: "opacity,transform" });
  }

  // ── Scroll-bound motion ────────────────────────────────────────────────────
  // Blocks below the fold rise in tied to the scroll position of their own scroll area (the app scrolls inside .scroll, not the window),
  // so they reverse as you scroll back. clamp() ends each one within the scroll range, so the last block is always fully shown at the bottom.
  const REVEAL = ".scroll > .group, .scroll > .card, .scroll > .ride-card, .scroll > .wx, .scroll .chart-card, .scroll > .empty-card, .sheet-scroll > .group";
  function bindScroll(root) {
    let added = false;
    root.querySelectorAll(REVEAL).forEach((el) => {
      if (el.dataset.st) return;
      el.dataset.st = "1";
      const scroller = el.closest(".scroll, .sheet-scroll");
      if (!scroller || el.getBoundingClientRect().top < innerHeight) return; // on screen already: its own entrance plays
      added = true;
      gsap.fromTo(el, { opacity: 0, y: 28, scale: 0.98 }, { opacity: 1, y: 0, scale: 1, ease: "none",
        scrollTrigger: { trigger: el, scroller, start: "clamp(top 98%)", end: "clamp(top 70%)", scrub: 0.3 } });
    });
    // Chart bars grow from their baseline as the chart crosses the screen, and shrink back if you scroll away.
    root.querySelectorAll(".scroll .chart-card").forEach((card) => {
      if (card.dataset.stBars) return;
      card.dataset.stBars = "1";
      const bars = card.querySelectorAll(".bar");
      if (!bars.length) return;
      added = true;
      gsap.fromTo(bars, { clipPath: "inset(100% 0% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", ease: "none", stagger: 0.04,
        scrollTrigger: { trigger: card, scroller: card.closest(".scroll"), start: "clamp(top 90%)", end: "clamp(center 60%)", scrub: 0.4 } });
    });
    // The dashboard's headline figure and the home hero drift up and dim slightly as their screen scrolls, giving the page depth.
    root.querySelectorAll(".scroll .kpi.lead, .scroll .hero-art").forEach((el) => {
      if (el.dataset.stDepth) return;
      el.dataset.stDepth = "1";
      added = true;
      gsap.to(el, { y: -24, opacity: 0.6, ease: "none", scrollTrigger: { trigger: el, scroller: el.closest(".scroll"), start: "top top+=80", end: "bottom top", scrub: true } });
    });
    // Figures count up once, the first time they are seen.
    root.querySelectorAll(".kpi b").forEach((el) => {
      if (el.dataset.stCount) return;
      el.dataset.stCount = "1";
      added = true;
      ScrollTrigger.create({ trigger: el, scroller: el.closest(".scroll"), start: "clamp(top 95%)", once: true, onEnter: () => countUp(el) });
    });
    return added;
  }

  function countUp(el) {
    const node = el.firstChild, text = node?.nodeValue;
    const m = el.childNodes.length === 1 && node.nodeType === 3 ? text.match(/\d[\d,]*(\.\d+)?/) : null;
    const end = m ? parseFloat(m[0].replace(/,/g, "")) : 0;
    if (!(end > 0)) return;
    const dp = m[1] ? m[1].length - 1 : 0, value = { v: 0 };
    // Writes the text node in place (characterData), so the DOM observer below is not woken on every frame.
    gsap.to(value, { v: end, duration: 0.8, ease: "power2.out", onUpdate: () => { node.nodeValue = text.replace(m[0], value.v.toFixed(dp)); }, onComplete: () => { node.nodeValue = text; } });
  }

  // ScrollTriggers on screens that have gone are killed; positions are re-measured once a screen's slide-in has finished.
  let refreshTimer = 0;
  function sweep() {
    ScrollTrigger.getAll().forEach((t) => { if (!t.trigger?.isConnected) t.kill(); });
    if (bindScroll(viewport)) { clearTimeout(refreshTimer); refreshTimer = setTimeout(() => ScrollTrigger.refresh(), 260); }
  }

  let queued = false;
  new MutationObserver((list) => {
    if (reduced()) return;
    list.forEach((m) => {
      if (m.removedNodes.length) crossFade(m);
      m.addedNodes.forEach((n) => { if (n.nodeType === 1) (n.matches("button.is-loading") ? [n] : n.querySelectorAll("button.is-loading")).forEach(addLoader); });
    });
    if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; sweep(); }); }
  }).observe(viewport, { childList: true, subtree: true });

  // ── Launch ─────────────────────────────────────────────────────────────────
  // The splash in index.html clears itself in CSS; this only lets the first screen rise in behind it, then tidies up.
  if (document.getElementById("splash") && !reduced()) {
    app.classList.add("launching");
    setTimeout(() => { app.classList.remove("launching"); document.getElementById("splash")?.remove(); }, 1100);
  }
  if (!reduced()) requestAnimationFrame(sweep);

  // Turning Reduce motion on mid-session stops everything already bound to scroll and clears what it changed.
  const settle = () => { if (reduced()) { ScrollTrigger.getAll().forEach((t) => t.kill(true)); gsap.globalTimeline.clear(); viewport.querySelectorAll("[style]").forEach((el) => gsap.set(el, { clearProps: "opacity,transform,clipPath" })); } };
  systemReduced.addEventListener("change", settle);
  new MutationObserver(settle).observe(document.documentElement, { attributes: true, attributeFilter: ["data-motion"] });
})();
