// Press / hover micro-interactions, delegated on the document so they cover legacy HTML and native screens alike.
// Handlers only call closest()/matches() and write inline style: no layout reads, so nothing here can force a reflow.
// Budget: 140-160 ms, scale and translate only, one ease-out. Press 0.97, release without overshoot (the old backOut moved 0.3%: invisible).
import { DUR, EASE } from "../choreography.js";
import { tick } from "../haptics.js";
import { drive } from "./fm.js";
import { HOVERABLE, PRESSABLE } from "./selectors.js";

const fine = matchMedia("(hover: hover) and (pointer: fine)");
const pressTarget = (el) => (el.matches(".card-body") ? el.closest(".card") || el : el);

export function installMicro() {
  if (!CSS.supports("scale", "1") || !CSS.supports("translate", "0 1px")) return () => {}; // old WebKit: keep the plain CSS :active
  let alive = true;
  const cleanups = new Set();

  const down = (e) => {
    const el = e.target instanceof Element && e.target.closest(PRESSABLE);
    if (!el || el.disabled || (e.pointerType === "mouse" && e.button !== 0)) return;
    const t = pressTarget(el);
    tick();
    drive(t, "scale", 0.97, { duration: DUR.press, ease: EASE });
    const up = () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      cleanups.delete(up);
      if (alive) drive(t, "scale", 1, { duration: DUR.release, ease: EASE });
    };
    cleanups.add(up);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  // Hover lift for a real mouse only: touch screens fire hover on tap, which would leave controls stuck up.
  const over = (e) => {
    if (e.pointerType !== "mouse" || !fine.matches) return;
    const el = e.target instanceof Element && e.target.closest(HOVERABLE);
    if (!el || el.contains(e.relatedTarget) || el.disabled) return;
    drive(el, "translate", -2, { duration: DUR.hover, ease: EASE });
    el.addEventListener("pointerleave", () => alive && drive(el, "translate", 0, { duration: DUR.hover, ease: EASE }), { once: true });
  };

  document.addEventListener("pointerdown", down, { passive: true });
  document.addEventListener("pointerover", over, { passive: true });
  return () => {
    alive = false;
    document.removeEventListener("pointerdown", down);
    document.removeEventListener("pointerover", over);
    cleanups.forEach((f) => f());
  };
}
