// First-run consent, drawn with the app's own sheet classes (.sheet-backdrop / .sheet, slid in by the same `open` class and CSS the
// legacy sheets use). Shown only when the build can send something (see consent.js) and nothing has been chosen yet.
// Declining, Escape and tapping outside all mean "no thanks"; the app is identical either way.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { asked, configured, setConsent } from "./consent.js";
import { track } from "./index.js";
import { tick } from "../haptics.js";

export default function ConsentSheet({ ready }) {
  const [show, setShow] = useState(false);
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  useEffect(() => {
    if (!ready || !configured() || asked()) return;
    const t = setTimeout(() => setShow(true), 2500); // after the launch animation, never on top of it
    return () => clearTimeout(t);
  }, [ready]);
  useEffect(() => {
    if (!show) return;
    const view = document.getElementById("viewport"), before = document.activeElement;
    if (view) view.inert = true; // the page behind is not reachable while the sheet is up
    requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)));
    box.current?.querySelector("button")?.focus({ preventScroll: true });
    return () => { if (view) view.inert = false; before?.focus?.({ preventScroll: true }); };
  }, [show]);
  if (!show) return null;
  const close = (allow) => {
    tick();
    setConsent(allow);
    if (allow) track("consent_set", { analytics: true });
    setOpen(false);
    setTimeout(() => setShow(false), 300);
  };
  const keys = (e) => {
    if (e.key === "Escape") { e.stopPropagation(); close(false); }
    if (e.key === "Tab") { // keep focus inside the dialog
      const f = [...box.current.querySelectorAll("button")];
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); }
      else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
    }
  };
  return createPortal(
    <div className={`sheet-backdrop${open ? " open" : ""}`} onClick={(e) => e.target === e.currentTarget && close(false)} onKeyDown={keys}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="consent-title" aria-describedby="consent-body" ref={box}>
        <div className="grabber"><span /></div>
        <div className="sheet-head"><h3 id="consent-title">Help improve Reroute?</h3></div>
        <div className="sheet-scroll">
          <p className="hint" id="consent-body">With your OK, Reroute counts which features are used and sends crash reports, tied to a random code on this device and nothing else. It never includes your name, email, places, searches or location. You can change this any time in Settings. Reroute works the same either way.</p>
        </div>
        <div className="sheet-foot">
          <button className="btn btn-primary" onClick={() => close(true)}>Allow anonymous usage data</button>
          <button className="btn btn-text" onClick={() => close(false)}>No thanks</button>
        </div>
      </div>
    </div>,
    document.getElementById("app") || document.body,
  );
}
