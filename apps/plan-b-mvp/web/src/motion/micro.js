// Press / hover / focus micro-interactions, delegated on the document so they cover legacy HTML and native screens alike.
// Handlers only call closest()/matches() and write inline style: no layout reads, so nothing here can force a reflow.
// Budget: 140-220 ms, scale and translate only.
import { backOut } from "framer-motion";
import { tick } from "../haptics.js";
import { drive } from "./fm.js";
import { FIELD, HOVERABLE, PRESSABLE } from "./selectors.js";

const fine = matchMedia("(hover: hover) and (pointer: fine)");
const pressTarget = (el) => (el.matches(".card-body") ? el.closest(".card") || el : el);

export function installMicro() {
  if (!CSS.supports("scale", "1") || !CSS.supports("translate", "0 1px")) return () => {}; // old WebKit: keep the plain CSS :active
  let alive = true, lastPointer = 0;
  const cleanups = new Set();

  const down = (e) => {
    lastPointer = performance.now();
    const el = e.target instanceof Element && e.target.closest(PRESSABLE);
    if (!el || el.disabled || (e.pointerType === "mouse" && e.button !== 0)) return;
    const t = pressTarget(el);
    tick();
    drive(t, "scale", 0.97, { duration: 0.14, ease: "easeOut" });
    const up = () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      cleanups.delete(up);
      if (alive) drive(t, "scale", 1, { duration: 0.22, ease: backOut });
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
    drive(el, "translate", -2, { duration: 0.18, ease: backOut });
    el.addEventListener("pointerleave", () => alive && drive(el, "translate", 0, { duration: 0.14, ease: "easeOut" }), { once: true });
  };

  // A field tapped into settles with a small elastic scale; focus arriving from the keyboard is left still.
  const focus = (e) => {
    const el = e.target;
    if (!(el instanceof Element) || !el.matches(FIELD) || performance.now() - lastPointer > 400) return;
    drive(el, "scale", 1, { from: 0.985, duration: 0.22, ease: backOut });
  };

  document.addEventListener("pointerdown", down, { passive: true });
  document.addEventListener("pointerover", over, { passive: true });
  document.addEventListener("focusin", focus);
  return () => {
    alive = false;
    document.removeEventListener("pointerdown", down);
    document.removeEventListener("pointerover", over);
    document.removeEventListener("focusin", focus);
    cleanups.forEach((f) => f());
  };
}
