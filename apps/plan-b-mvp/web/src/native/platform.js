// The only native file imported eagerly: no plugin code is pulled in here.
export const isNative = () => !!window.Capacitor?.isNativePlatform?.();
export const platform = () => (isNative() ? window.Capacitor.getPlatform() : "web"); // "ios" | "android" | "web"
