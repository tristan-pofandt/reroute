// Reroute's WebGL layer: one persistent canvas whose GLSL fragment shader draws a liquid veil that floods across the screen on every
// screen change, hiding the swap, and morphs shared elements (GSAP Flip) between screens. The canvas is created once and never torn down,
// but it only renders while a transition is running, so it costs no power at rest. Loaded as a module after gsap and motion.js; if WebGL,
// three.js or GSAP is unavailable, or motion is reduced, nothing here runs and the plain CSS slide in app.css is what you see.
import * as THREE from "./vendor/three.module.min.js";

const { gsap, Flip } = window;
const root = document.documentElement;
const systemReduced = matchMedia("(prefers-reduced-motion: reduce)");
const reduced = () => root.dataset.motion === "reduced" || (systemReduced.matches && root.dataset.motion !== "full");
// Haptic weight follows the motion: the veil's leading edge is a swell, the settle is one firm tap.
const buzz = (pattern) => { if (!reduced()) try { navigator.vibrate?.(pattern); } catch { /* optional */ } };

const VERT = "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";
// The veil is a band travelling along uAxis. Its leading and trailing edges are displaced by fractal noise (and by scroll/swipe energy
// in uEnergy), so they read as liquid rather than a straight wipe. Inside the band: a brand-indigo body with a bright rim at each edge.
const FRAG = `
precision mediump float;
varying vec2 vUv;
uniform float uTime, uProgress, uEnergy;
uniform vec2 uAxis, uRes;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + 7.1; a *= 0.5; } return v; }
void main() {
  vec2 uv = vUv, aspect = vec2(uRes.x / uRes.y, 1.0);
  // Position along the travel direction, 0 at the entry edge and 1 at the exit edge.
  float along = dot(uv - 0.5, uAxis) + 0.5;
  float wobble = fbm(uv * aspect * 2.2 + vec2(uTime * 0.9, -uTime * 0.6)) - 0.5;
  float warp = wobble * (0.34 + uEnergy * 0.2);
  // The band runs from -0.5 to 1.5 so it fully enters and fully leaves the screen.
  float head = mix(-0.55, 1.05, uProgress), tail = head - 0.62;
  float a = smoothstep(tail - 0.02, tail + 0.14, along + warp);
  float b = 1.0 - smoothstep(head - 0.14, head + 0.02, along + warp);
  float body = a * b;
  float rim = (smoothstep(0.0, 0.18, body) - smoothstep(0.18, 0.62, body)) * 0.9;
  vec3 deep = vec3(0.31, 0.275, 0.898), light = vec3(0.427, 0.439, 0.961), glow = vec3(0.55, 0.9, 0.82);
  vec3 col = mix(deep, light, fbm(uv * aspect * 3.0 - uTime * 0.4));
  col = mix(col, glow, rim * 0.55);
  gl_FragColor = vec4(col, body * 0.97);
}`;

(function boot() {
  if (!gsap || reduced()) return;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: "low-power" });
  } catch { return; } // no WebGL: the CSS slide stays
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); // the veil is soft-edged, so a lower resolution is invisible and cheaper
  const canvas = renderer.domElement;
  canvas.id = "fx-canvas";
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%;z-index:60;pointer-events:none;visibility:hidden";
  document.body.appendChild(canvas);

  const scene = new THREE.Scene(), camera = new THREE.Camera();
  const uniforms = { uTime: { value: 0 }, uProgress: { value: 0 }, uEnergy: { value: 0 }, uAxis: { value: new THREE.Vector2(1, 0) }, uRes: { value: new THREE.Vector2(1, 1) } };
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, transparent: true, depthTest: false })));

  const fit = () => { renderer.setSize(innerWidth, innerHeight, false); uniforms.uRes.value.set(innerWidth, innerHeight); };
  fit();
  addEventListener("resize", fit);
  let lost = false;
  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); lost = true; });
  canvas.addEventListener("webglcontextrestored", () => { lost = false; fit(); });

  const draw = () => { uniforms.uTime.value = performance.now() / 1000; renderer.render(scene, camera); };
  const AXES = { forward: [1, 0], back: [-1, 0], up: [0, 1], down: [0, -1] }; // vUv.y points up, so "up" floods from the bottom edge
  let sweep = null;
  function play(direction) {
    if (lost || reduced()) return;
    sweep?.kill();
    uniforms.uAxis.value.set(...(AXES[direction] || AXES.forward));
    uniforms.uEnergy.value = direction === "up" || direction === "down" ? 1 : 0.4;
    uniforms.uProgress.value = 0;
    canvas.style.visibility = "visible";
    gsap.ticker.add(draw);
    buzz([6, 24, 14]);
    // The screen swap (400 ms of CSS slide in app.js) happens beneath the veil's thickest part.
    sweep = gsap.to(uniforms.uProgress, { value: 1, duration: 0.7, ease: "power2.inOut", overwrite: true,
      onComplete: () => { gsap.ticker.remove(draw); canvas.style.visibility = "hidden"; renderer.clear(); } });
    gsap.delayedCall(0.36, () => buzz(16)); // the new screen lands
  }

  // ── Shared-element morph (the layoutId idea) ──────────────────────────────
  // The same figure on two screens carries one id; the incoming copy animates from where the outgoing one was.
  const SHARED = { impact: [".impact-btn", ".kpi.lead"] };
  const tag = (scope) => Object.entries(SHARED).forEach(([id, sels]) => sels.forEach((s) => scope.querySelectorAll(s).forEach((el) => { el.dataset.flip = id; })));
  let flipState = null;
  document.addEventListener("reroute:before", () => {
    if (!Flip || reduced()) return;
    tag(document.getElementById("viewport"));
    flipState = Flip.getState("#viewport [data-flip]");
  });
  document.addEventListener("reroute:nav", (e) => {
    play(e.detail.direction);
    if (!flipState) return;
    const state = flipState; flipState = null;
    const incoming = e.detail.page;
    tag(incoming);
    const targets = incoming.querySelectorAll("[data-flip]");
    if (targets.length) Flip.from(state, { targets, duration: 0.5, ease: "power3.inOut", scale: true, nested: true, props: "opacity" });
  });
  if (Flip) gsap.registerPlugin(Flip);
  root.classList.add("fx");
})();
