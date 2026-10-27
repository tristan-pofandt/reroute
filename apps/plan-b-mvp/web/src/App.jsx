import { lazy, Suspense, useEffect, useState } from "react";
import AppRoutes from "./Routes.jsx";
import { loadLegacy } from "./legacyLoader.js";
import MotionLayer from "./motion/MotionLayer.jsx";
import { runLaunch } from "./motion/launch.js";
import { useReducedMotion } from "./reduced.js";

// three.js + R3F are the heavy part of the bundle. The chunk is only requested once the legacy scripts have loaded and the browser is idle
// (see `fx` below), so it never delays first paint; once mounted the canvas is never remounted by navigation.
const FxCanvas = lazy(() => import("./fx/FxCanvas.jsx"));
const idle = (fn) => {
  if (!window.requestIdleCallback) { const t = setTimeout(fn, 120); return () => clearTimeout(t); }
  const t = window.requestIdleCallback(fn, { timeout: 400 });
  return () => window.cancelIdleCallback(t);
};

const Splash = ({ out }) => (
  <div className={`splash${out ? " is-out" : ""}`} id="splash" aria-hidden="true"><svg width="88" height="88" viewBox="0 0 64 64"><defs><linearGradient id="splg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#6D70F5" /><stop offset="1" stopColor="#4F46E5" /></linearGradient></defs><rect width="64" height="64" rx="15" fill="url(#splg)" /><path d="M16 48 L48 16" fill="none" stroke="#fff" strokeOpacity=".38" strokeWidth="4" strokeLinecap="round" strokeDasharray="1 7" /><path d="M28.5 31.5l7 7M35.5 31.5l-7 7" stroke="#FCA5A5" strokeWidth="3.6" strokeLinecap="round" /><path className="rt" d="M16 48 C16 30 27 18 45 18" fill="none" stroke="#fff" strokeWidth="5.2" strokeLinecap="round" /><circle cx="16" cy="48" r="5" fill="#34D399" stroke="#fff" strokeWidth="2.6" /><g className="dot"><circle cx="47" cy="17" r="6" fill="#fff" /><circle cx="47" cy="17" r="2.6" fill="#4F46E5" /></g></svg></div>
);

// The static chrome the legacy code looks up by id (#app, #viewport, #net-banner, #demo-pill). The routed pages are children of #viewport.
export default function App() {
  const [state, setState] = useState("loading"); // loading -> ready | failed
  const [splash, setSplash] = useState("on"); // on -> out (fade fallback) -> gone
  const [fx, setFx] = useState(false);
  const reduced = useReducedMotion();
  useEffect(() => { loadLegacy().then(() => setState("ready"), (e) => { console.error(e); setState("failed"); setSplash("gone"); }); }, []);
  useEffect(() => {
    if (state !== "ready") return;
    runLaunch({ out: () => setSplash("out"), remove: () => setSplash("gone") });
    return idle(() => setFx(true));
  }, [state]);
  return (
    <>
      {fx && !reduced && <Suspense fallback={null}><FxCanvas /></Suspense>}
      <MotionLayer />
      <div className="app" id="app" data-screen="home">
        <div className="net-banner" id="net-banner" role="status" aria-live="polite" hidden />
        {splash !== "gone" && <Splash out={splash === "out"} />}
        <main className="viewport" id="viewport">
          {state === "ready" && <AppRoutes />}
          {state === "failed" && <p style={{ padding: 24 }}>Reroute could not start. Check your connection and reload.</p>}
        </main>
        <div className="demo-pill" id="demo-pill" hidden>
          <button className="demo-edit" data-action="open-demo" aria-label="Demo mode: edit settings"><span className="demo-dot" />Demo mode</button>
          <button className="demo-exit" data-action="demo-exit" aria-label="Exit demo mode"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg></button>
        </div>
      </div>
    </>
  );
}
