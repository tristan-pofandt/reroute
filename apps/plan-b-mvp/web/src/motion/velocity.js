// Scroll velocity (px per frame, about 16.7 ms, signed) from Lenis or native touch scroll; the scroll reveals tilt with it.
// It decays to 0 when scrolling stops. A motion value, so reading it never re-renders React.
import { animate, motionValue } from "framer-motion";

export const scrollVelocity = motionValue(0);

let decay = null, timer = 0;
export function pushVelocity(v) {
  decay?.stop();
  scrollVelocity.set(Math.max(-80, Math.min(80, v)));
  clearTimeout(timer);
  timer = setTimeout(() => { decay = animate(scrollVelocity, 0, { duration: 0.5, ease: "easeOut" }); }, 70);
}
