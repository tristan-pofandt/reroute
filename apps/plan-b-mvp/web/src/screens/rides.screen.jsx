import { LegacyBody } from "./home/tree.jsx";
import "./safety.css";
const HAPTICS = { "ride-join": "snap", "ride-leave": "snap", "ride-create": "snap", "ride-join-start": "tick", "ride-report-send": "snap", "ride-block": "tick", "ride-unblock": "tick" };
export default function Rides() { return <LegacyBody name="rides" haptics={HAPTICS} />; }
