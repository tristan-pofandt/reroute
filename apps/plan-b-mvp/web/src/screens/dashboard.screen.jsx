import { LegacyBody } from "./home/tree.jsx";
const HAPTICS = { "toggle-table": "tick" };
export default function Dashboard() { return <LegacyBody name="dashboard" haptics={HAPTICS} />; }
