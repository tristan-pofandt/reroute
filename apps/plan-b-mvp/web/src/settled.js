// Coalesces `reroute:rerender` while a page is changing: a re-render of the entering screen's tree costs frames in the middle of its
// entrance and changes nothing the eye can use. `coalesce(fn)` returns a handler that runs `fn(event)` at once when idle, otherwise once on
// `reroute:settled` (Page.jsx), with the latest event; many events during one transition become one call.
export function coalesce(fn) {
  let last = null;
  const run = () => { const e = last; last = null; fn(e); };
  return (e) => {
    const waiting = last !== null;
    last = e;
    if (!window.RerouteLegacy?.isTransitioning?.()) return run();
    if (!waiting) document.addEventListener("reroute:settled", run, { once: true });
  };
}
