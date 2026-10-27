// window.RerouteBridge: the whole contract between the legacy app.js and the React shell. Created before app.js is loaded.
//
//   legacy -> React:  bridge.navigate(screen, direction, syncUrl)   ask the router to show `screen`
//                     bridge.isNative(screen)                       true when a native React screen replaces the legacy one
//                     bridge.register({ rerender, pageMounted, pageSettled })   legacy hands over its page hooks (called once)
//   React -> legacy:  bridge.legacy.pageMounted(el, screen) / pageSettled() / rerender()
import { screens } from "./screens/index.js";

let impl = null;
let pending = null;

export const bridge = (window.RerouteBridge = {
  legacy: null,
  register(hooks) { bridge.legacy = hooks; },
  isNative: (screen) => !!screens[screen],
  navigate(screen, direction = "forward", syncUrl = true) {
    if (impl) impl(screen, direction, syncUrl);
    else pending = [screen, direction, syncUrl]; // the router is not mounted yet; applied as soon as it is
  },
});

export function attachRouter(fn) {
  impl = fn;
  if (pending) { const p = pending; pending = null; fn(...p); }
  return () => { if (impl === fn) impl = null; };
}
