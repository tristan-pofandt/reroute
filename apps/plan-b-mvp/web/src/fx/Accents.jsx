import { useThree } from "@react-three/fiber";
import { useSpring, useTransform } from "framer-motion";
import { motion } from "framer-motion-3d";
import { enter, enterDir, scrollVelocity } from "../fxBus.js";

// Three low-poly accents (indigo icosahedron, emerald ring, light-indigo octahedron). They are faint at rest and brighten while a page
// enters and while the page scrolls. Each page entry flies them in along Z and spins them sideways (the sign follows the direction);
// scroll velocity tilts and lifts them. Everything is a motion value, so React never re-renders per frame.
const DEFS = [
  // pos: x and y as a fraction of the half-width / half-height of the screen at z = 0, so they stay on screen at any aspect ratio.
  { geo: "ico", color: "#4F46E5", pos: [-0.78, 0.8, -1.2], size: 0.34, spin: 1, lift: 0.9, tilt: 0.05, from: -9 },
  { geo: "torus", color: "#34D399", pos: [0.8, -0.82, -0.6], size: 0.3, spin: -1.4, lift: -0.7, tilt: -0.04, from: -12 },
  { geo: "octa", color: "#6D70F5", pos: [0.55, 0.9, -2.4], size: 0.24, spin: 2, lift: 0.5, tilt: 0.07, from: -15 },
];

function Accent({ geo, color, pos: p, size: s0, spin, lift, tilt, from }) {
  const { width, height } = useThree((s) => s.viewport);
  const k = Math.min(1, width / 4); // smaller objects on a narrow phone screen
  const pos = [p[0] * width / 2, p[1] * height / 2, p[2]], size = s0 * (0.5 + 0.5 * k);
  // Smooth the raw scroll velocity so the objects ease rather than jitter.
  const vel = useSpring(scrollVelocity, { stiffness: 140, damping: 22, mass: 0.6 });
  const z = useTransform(enter, [0, 1], [from, pos[2]]);
  const spinY = useTransform(enter, [0, 1], [0, Math.PI * 2 * spin]);
  const y = useTransform([vel], ([v]) => pos[1] + v * 0.012 * lift);
  const rotX = useTransform(vel, (v) => v * tilt);
  const rotY = useTransform([spinY, vel], ([s, v]) => s * enterDir.sign + v * tilt * 0.6);
  const scale = useTransform(enter, [0, 0.5, 1], [0.2, 1, 1]);
  const opacity = useTransform([enter, vel], ([e, v]) => Math.min(0.85, 0.16 + Math.sin(Math.min(e, 1) * Math.PI) * 0.5 + Math.min(Math.abs(v) / 40, 0.4)));
  return (
    <motion.mesh position-x={pos[0]} position-y={y} position-z={z} rotation-x={rotX} rotation-y={rotY} scale={scale}>
      {geo === "ico" && <icosahedronGeometry args={[size, 0]} />}
      {geo === "torus" && <torusGeometry args={[size, size * 0.14, 6, 18]} />}
      {geo === "octa" && <octahedronGeometry args={[size, 0]} />}
      <motion.meshBasicMaterial color={color} transparent opacity={opacity} wireframe={geo === "torus"} depthWrite={false} />
    </motion.mesh>
  );
}

export default function Accents() {
  return <group renderOrder={1}>{DEFS.map((d) => <Accent key={d.geo} {...d} />)}</group>;
}
