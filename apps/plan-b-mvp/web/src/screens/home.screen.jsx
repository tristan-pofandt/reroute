import { LegacyBody } from "./home/tree.jsx";
const HAPTICS = { "start": "tick", "open-alerts": "tick" };
export default function Home() { return <LegacyBody name="home" haptics={HAPTICS} />; }
