import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { useMotionValue, useSpring, useTransform } from "framer-motion";
import { motion } from "framer-motion-3d";
import { enter, enterDir, scrollVelocity, wake } from "../fxBus.js";

// Three low-poly accents (indigo icosahedron, emerald ring, light-indigo octahedron). They are faint at rest and brighten while a page
// enters and while the page scrolls. Each page entry flies them in along Z and spins them sideways (the sign follows the direction);
// scroll velocity tilts and lifts them. Everything is a motion value, so React never re-renders per frame.
const DEFS = [
  // pos: x and y as a fraction of the half-width / half-height of the screen at z = 0, so they stay on screen at any aspect ratio.
  { geo: "ico", color: "#4F46E5", pos: [-0.78, 0.8, -1.2], size: 0.34, spin: 1, lift: 0.9, tilt: 0.05, from: -9 },
  { geo: "torus", color: "#34D399", pos: [0.8, -0.82, -0.6], size: 0.3, spin: -1.4, lift: -0.7, tilt: -0.04, from: -12 },
  { geo: "octa", color: "#6D70F5", pos: [0.55, 0.9, -2.4], size: 0.24, spin: 2, lift: 0.5, tilt: 0.07, from: -15 },
];

function Accent({ geo, color, pos: p, size, spin, lift, tilt, from, vw, vh }) {
  // Everything derived from the screen size is a motion value (vw / vh), so a resize or rotation moves the objects: values captured in a
  // useTransform closure would be frozen at the first render's size.
  const vel = useSpring(scrollVelocity, { stiffness: 140, damping: 22, mass: 0.6 }); // eases the raw velocity so objects do not jitter
  const x = useTransform(vw, (w) => (p[0] * w) / 2);
  const z = useTransform(enter, [0, 1], [from, p[2]]);
  const spinY = useTransform(enter, [0, 1], [0, Math.PI * 2 * spin]);
  const y = useTransform([vel, vh], ([v, h]) => (p[1] * h) / 2 + v * 0.012 * lift);
  const rotX = useTransform(vel, (v) => v * tilt);
  const rotY = useTransform([spinY, vel], ([s, v]) => s * enterDir.sign + v * tilt * 0.6);
  // Geometry is unit sized; this scale is the object size (smaller on a narrow phone) times the fly-in grow.
  const scale = useTransform([enter, vw], ([e, w]) => size * (0.5 + 0.5 * Math.min(1, w / 4)) * (e < 0.5 ? 0.2 + 1.6 * e : 1));
  const opacity = useTransform([enter, vel], ([e, v]) => Math.min(0.85, 0.16 + Math.sin(Math.min(e, 1) * Math.PI) * 0.5 + Math.min(Math.abs(v) / 40, 0.4)));
  return (
    <motion.mesh position-x={x} position-y={y} position-z={z} rotation-x={rotX} rotation-y={rotY} scale={scale}>
      {geo === "ico" && <icosahedronGeometry args={[1, 0]} />}
      {geo === "torus" && <torusGeometry args={[1, 0.14, 6, 18]} />}
      {geo === "octa" && <octahedronGeometry args={[1, 0]} />}
      <motion.meshBasicMaterial color={color} transparent opacity={opacity} wireframe={geo === "torus"} depthWrite={false} />
    </motion.mesh>
  );
}

export default function Accents() {
  const { width, height } = useThree((s) => s.viewport);
  const vw = useMotionValue(width), vh = useMotionValue(height);
  useEffect(() => { vw.set(width); vh.set(height); wake(200); }, [width, height, vw, vh]);
  return <group renderOrder={1}>{DEFS.map((d) => <Accent key={d.geo} {...d} vw={vw} vh={vh} />)}</group>;
}
