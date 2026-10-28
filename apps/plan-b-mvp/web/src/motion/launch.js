// Launch sequence. The splash (mark + route line, CSS in app.css) sits over the first page, which is already mounted but hidden. Once the
// app is ready and the mark has finished drawing, the splash mark slides away with the page-transition choreography (same easing, same
// leave-and-fade), the splash backdrop fades, and the first screen's elements stagger in (Page.jsx waits on `launched`).
// Reduced motion: no splash, the page is simply there.
import { animate } from "framer-motion";
import { DUR, EASE, slide, slow } from "../choreography.js";
import { reducedMotion } from "../reduced.js";

let release;
export const launched = new Promise((r) => { release = r; });

const MARK_DONE_MS = 680; // ms after navigation start: the mark's draw (app.css, ~520 ms after the splash mounts) has finished

// `remove` takes the splash out of the tree.
export function runLaunch({ remove }) {
  const splash = document.getElementById("splash");
  if (!splash || reducedMotion()) { remove(); release(); return; }
  const s = slow();
  const go = () => {
    if (reducedMotion()) { remove(); release(); return; }
    slide([splash.querySelector("svg")], { x: -96, y: 0 }, { out: true });
    animate(splash, { opacity: 0 }, { duration: DUR.rise * s, ease: EASE, delay: 0.1 * s });
    setTimeout(release, 130 * s); // the page's elements start arriving as the backdrop thins out
    setTimeout(remove, 460 * s);
  };
  setTimeout(go, Math.max(0, MARK_DONE_MS - performance.now()));
}
