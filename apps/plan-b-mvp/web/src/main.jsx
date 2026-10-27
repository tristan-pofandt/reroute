import "./bridge.js"; // defines window.RerouteBridge before the legacy scripts load
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(<App />);
