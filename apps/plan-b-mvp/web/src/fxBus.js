// Shared, framework-free state between the DOM world (router, Lenis) and the persistent WebGL canvas.
// The canvas renders on demand, so anything that moves something on it calls wake() to keep frames coming for a while.
import { animate, motionValue } from "framer-motion";
import { reducedMotion } from "./reduced.js";

export const veil = {
  progress: motionValue(0), // 0 = idle, 1 = done; driven by animate()
  direction: "forward",
  energy: 0.4,
  enabled: false, // set true by the canvas once WebGL is up; false means "do nothing"
  run: null,
};
export const scrollVelocity = motionValue(0); // px per frame (about 16.7 ms), signed, decays to 0 when scrolling stops
export const enter = motionValue(0); // 0..1 each time a page enters; accents fly in on it
export const enterDir = { sign: 1 };

const bus = { until: 0, kick: null };
export const wake = (ms = 800) => { bus.until = Math.max(bus.until, performance.now() + ms); bus.kick?.(); };
export const awake = () => performance.now() < bus.until;
export const setKick = (fn) => { bus.kick = fn; };

const VEIL_MS = 800;
export function playVeil(direction) {
  if (!veil.enabled || reducedMotion()) return;
  veil.direction = direction;
  veil.energy = direction === "up" || direction === "down" ? 1 : 0.5;
  veil.run?.stop();
  veil.progress.set(0);
  wake(VEIL_MS + 300);
  veil.run = animate(veil.progress, 1, { duration: VEIL_MS / 1000, ease: [0.45, 0, 0.2, 1] });
  playEnter(direction);
}

export function playEnter(direction) {
  if (!veil.enabled || reducedMotion()) return;
  enterDir.sign = direction === "back" || direction === "down" ? -1 : 1;
  enter.set(0);
  wake(1800);
  animate(enter, 1, { duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.12 });
}

// Scroll velocity from a scroll element (Lenis or native touch scroll): the signed px/frame, easing back to 0 once it stops.
let decay = null;
export function pushVelocity(v) {
  decay?.stop();
  scrollVelocity.set(Math.max(-80, Math.min(80, v)));
  wake(1000);
  clearTimeout(pushVelocity.t);
  pushVelocity.t = setTimeout(() => { decay = animate(scrollVelocity, 0, { duration: 0.5, ease: "easeOut" }); }, 70);
}

// Handy for debugging in the console, e.g. RerouteFx.veil.progress.set(0.5); RerouteFx.wake(). Not used by the app.
window.RerouteFx = { veil, scrollVelocity, enter, wake, playVeil };
