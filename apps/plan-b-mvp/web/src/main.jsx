import "./bridge.js"; // defines window.RerouteBridge before the legacy scripts load
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./motion/motion.css";
import { isNative } from "./native/platform.js";
import ErrorBoundary from "./errors/ErrorBoundary.jsx";
import { installGlobalHandlers } from "./errors/report.js";

installGlobalHandlers();

if (isNative()) import("./native/index.js").then((m) => m.initNative()); // Capacitor shell only; the web never loads it

createRoot(document.getElementById("root")).render(<ErrorBoundary><App /></ErrorBoundary>);
