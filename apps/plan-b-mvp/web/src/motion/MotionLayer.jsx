// The motion layer, mounted once. It owns every DOM-level effect (press / hover / focus, panel morphs, loaders, skeleton cross-fade,
// 3D scroll, count-up, parallax) with delegated listeners and one MutationObserver on #viewport, so it works the same for legacy HTML-string
// screens and for native React screens. It never touches React state. Reduced motion (system setting or the app's data-motion switch)
// tears the whole layer down and restores the DOM; turning it back off installs it again.
import { useEffect } from "react";
import { useReducedMotion } from "../reduced.js";
import { installAmbient } from "./ambient.js";
import { resetAll } from "./fm.js";
import { installMicro } from "./micro.js";
import { handleMutations } from "./panels.js";
import { installScroll3d, invalidate, sweep } from "./scroll3d.js";

function install() {
  const viewport = document.getElementById("viewport");
  if (!viewport) return () => {};
  document.documentElement.classList.add("fm");
  const offMicro = installMicro();
  const offScroll = installScroll3d(viewport);
  const amb = installAmbient(viewport);
  const mo = new MutationObserver((list) => {
    handleMutations(list, invalidate);
    if (list.some((m) => m.type === "childList" && m.addedNodes.length)) { sweep(viewport); amb.scan(); }
  });
  mo.observe(viewport, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"], attributeOldValue: true });
  return () => {
    mo.disconnect(); offMicro(); offScroll(); amb.stop();
    resetAll();
    document.documentElement.classList.remove("fm");
  };
}

export default function MotionLayer() {
  const reduced = useReducedMotion();
  useEffect(() => (reduced ? undefined : install()), [reduced]);
  return null;
}
