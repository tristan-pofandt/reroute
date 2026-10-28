import type { CapacitorConfig } from "@capacitor/cli";

// Production loads the bundled assets in `dist` and calls the API at VITE_API_BASE (see src/native/api.js).
// TODO(confirm): appId is a placeholder; changing it later means re-creating the store listings. Keep it identical on both stores.
const API_HOST = (process.env.VITE_API_BASE || "https://reroute.example").replace(/^https?:\/\//, "").replace(/\/.*$/, "");

const config: CapacitorConfig = {
  appId: "au.reroute.app",
  appName: "Reroute",
  webDir: "dist",
  android: { allowMixedContent: false },
  ios: { scheme: "reroute", contentInset: "never" },
  server: {
    androidScheme: "https",
    cleartext: false,
    allowNavigation: [API_HOST, "fonts.googleapis.com", "fonts.gstatic.com", "*.googleapis.com", "*.gstatic.com", "maps.google.com"],
  },
  plugins: {
    SplashScreen: { launchAutoHide: false, backgroundColor: "#090A0F", showSpinner: false },
    Keyboard: { resize: "none" },
    PushNotifications: { presentationOptions: ["badge", "sound", "alert"] },
  },
};
export default config;
