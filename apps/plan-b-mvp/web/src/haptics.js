// One haptics API for the web (Vibration API) and the Capacitor shell (native taps). Everything is a no-op when unsupported or when
// motion is reduced, so callers never need to check. Android/Chrome vibrates; iOS Safari has no Vibration API and stays silent.
import { reducedMotion } from "./reduced.js";

const native = () => !!window.Capacitor?.isNativePlatform?.();
let plugin = null;
const load = () => (plugin ||= import("@capacitor/haptics").catch(() => null));

// [web pattern, native call]. The web pattern is vibrate() milliseconds; the native call picks the closest system feedback.
const P = {
  tick: [6, (h) => h.impact({ style: "LIGHT" })],
  soft: [[10, 30, 6], (h) => h.impact({ style: "MEDIUM" })],
  thud: [16, (h) => h.impact({ style: "HEAVY" })],
  snap: [[8, 14, 8], (h) => h.selectionChanged()],
  error: [[30, 40, 30, 40, 60], (h) => h.notification({ type: "ERROR" })],
};

function fire(name) {
  if (reducedMotion()) return;
  const [pattern, call] = P[name];
  try {
    if (native()) load().then((m) => m && call(m.Haptics)).catch(() => {});
    else navigator.vibrate?.(pattern);
  } catch { /* optional */ }
}

export const tick = () => fire("tick");
export const soft = () => fire("soft");
export const thud = () => fire("thud");
export const snap = () => fire("snap");
export const error = () => fire("error");
