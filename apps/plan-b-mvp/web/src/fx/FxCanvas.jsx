// The one WebGL canvas for the whole app. It is mounted above the router and never unmounted by navigation: route changes only move
// motion values (fxBus) that the veil shader and the 3D accents read. It renders on demand and sleeps when nothing is moving.
import { Component, useEffect, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { AdaptiveDpr } from "@react-three/drei";
import { awake, setKick, veil, wake } from "../fxBus.js";
import { useReducedMotion } from "../reduced.js";
import Veil from "./Veil.jsx";
import Accents from "./Accents.jsx";

const webglOk = () => {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; }
};

class Boundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) { console.warn("Reroute: WebGL layer disabled.", error); veil.enabled = false; }
  render() { return this.state.failed ? null : this.props.children; }
}

// Keeps R3F's on-demand loop ticking while anything is animating (wake() in fxBus), then lets it sleep after one last frame.
function Driver() {
  const invalidate = useThree((s) => s.invalidate);
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    let raf = 0, lost = false;
    const loop = () => { raf = 0; if (lost) return; invalidate(); if (awake()) raf = requestAnimationFrame(loop); };
    const canvas = gl.domElement;
    const onLost = (e) => { e.preventDefault(); lost = true; veil.enabled = false; };
    const onRestored = () => { lost = false; veil.enabled = true; invalidate(); };
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    setKick(() => { if (!raf && !lost) raf = requestAnimationFrame(loop); });
    veil.enabled = true;
    wake(50);
    return () => { cancelAnimationFrame(raf); setKick(null); veil.enabled = false; canvas.removeEventListener("webglcontextlost", onLost); canvas.removeEventListener("webglcontextrestored", onRestored); };
  }, [invalidate, gl]);
  return null;
}

export default function FxCanvas() {
  const reduced = useReducedMotion();
  const [ok] = useState(webglOk);
  if (reduced || !ok) return null; // no veil, no 3D: pages just change (reduced motion) or slide (no WebGL)
  return (
    <div id="fx-root" aria-hidden="true" style={{ position: "fixed", inset: 0, zIndex: 60, pointerEvents: "none" }}>
      <Boundary>
        <Canvas flat frameloop="demand" dpr={[1, 1.5]} gl={{ alpha: true, antialias: false, powerPreference: "low-power" }}
          camera={{ position: [0, 0, 6], fov: 40, near: 0.1, far: 50 }} style={{ pointerEvents: "none" }}>
          <AdaptiveDpr pixelated />
          <Driver />
          <Accents />
          <Veil />
        </Canvas>
      </Boundary>
    </div>
  );
}
