import { LegacyBody } from "./home/tree.jsx";
const HAPTICS = { "ride-join": "snap", "ride-leave": "snap", "ride-create": "snap", "ride-join-start": "tick" };
export default function Rides() { return <LegacyBody name="rides" haptics={HAPTICS} />; }
