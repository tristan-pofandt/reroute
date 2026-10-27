// Loads the legacy classic scripts, in order, once the React shell (which owns #app and #viewport) is in the DOM.
const SCRIPTS = ["/offline.js", "/app.js"];
let promise = null;

export function loadLegacy() {
  return (promise ||= SCRIPTS.reduce((chain, src) => chain.then(() => new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src = src;
    el.async = false;
    el.onload = resolve;
    el.onerror = () => reject(new Error(`Could not load ${src}`));
    document.body.appendChild(el);
  })), Promise.resolve()));
}
