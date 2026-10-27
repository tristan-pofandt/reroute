// Launch sequence. The splash (mark + route line, CSS in app.css) sits UNDER the WebGL canvas. Once the app is ready and the mark has
// drawn, the veil floods across the screen; the splash is removed while the veil fully covers it, and the veil lifts to reveal the first
// screen, whose blocks then fly in (scroll3d waits on `launched`). If the canvas is unavailable the splash just fades.
import { playVeil, veil } from "../fxBus.js";
import { swell } from "../haptics.js";
import { reducedMotion } from "../reduced.js";

let release;
export const launched = new Promise((r) => { release = r; });

const MARK_MS = 640, GIVE_UP_MS = 1800, COVER_MS = 380;

// `out` starts the fade fallback, `remove` takes the splash out of the tree.
export function runLaunch({ out, remove }) {
  const t0 = performance.now();
  const finish = () => { remove(); release(); };
  if (reducedMotion()) return finish();
  const poll = () => {
    const age = performance.now() - t0;
    if (reducedMotion()) finish();
    else if (age >= MARK_MS && veil.enabled) { swell(); playVeil("forward"); setTimeout(finish, COVER_MS); }
    else if (age >= GIVE_UP_MS) { out(); setTimeout(finish, 220); }
    else setTimeout(poll, 40);
  };
  poll();
}
