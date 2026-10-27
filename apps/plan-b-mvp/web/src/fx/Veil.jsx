import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector2 } from "three";
import { scrollVelocity, veil } from "../fxBus.js";
import { FRAG, VERT } from "./veil.glsl.js";

const AXES = { forward: [1, 0], back: [-1, 0], up: [0, 1], down: [0, -1] }; // vUv.y points up, so "up" floods from the bottom edge
const AXIS = new Vector2(1, 0);

// A full-screen quad. Its vertex shader works in clip space, so the camera is irrelevant. It only draws while the veil is running.
export default function Veil() {
  const mesh = useRef();
  const uniforms = useMemo(() => ({
    uTime: { value: 0 }, uProgress: { value: 0 }, uEnergy: { value: 0 }, uVelocity: { value: 0 },
    uAxis: { value: AXIS.clone() }, uRes: { value: new Vector2(1, 1) },
  }), []);

  useFrame(({ size, gl }) => {
    const p = veil.progress.get();
    const m = mesh.current;
    // Outside (0,1) nothing is drawn: this render is the one that clears the last veil frame off the canvas.
    m.visible = p > 0.001 && p < 0.999;
    if (!m.visible) return;
    const a = AXES[veil.direction] || AXES.forward;
    uniforms.uAxis.value.set(a[0], a[1]);
    uniforms.uProgress.value = p;
    uniforms.uEnergy.value = veil.energy;
    uniforms.uVelocity.value = Math.max(-1, Math.min(1, scrollVelocity.get() / 40));
    uniforms.uTime.value = performance.now() / 1000;
    uniforms.uRes.value.set(size.width * gl.getPixelRatio(), size.height * gl.getPixelRatio());
  });

  return (
    <mesh ref={mesh} frustumCulled={false} renderOrder={100} visible={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial vertexShader={VERT} fragmentShader={FRAG} uniforms={uniforms} transparent depthTest={false} depthWrite={false} />
    </mesh>
  );
}
