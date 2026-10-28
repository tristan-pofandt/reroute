// Consent lives in this browser only (planb.* keys). Default: not asked, which counts as "no".
const KEY = "planb.analyticsConsent"; // "granted" | "denied"
const ID = "planb.analyticsId"; // random per install, created only while consent is granted, deleted on withdrawal
const subs = new Set();
const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* private mode */ } };

// Is anything wired at build time? With neither key the app shows no consent UI at all and nothing can ever be sent.
export const sendsUsage = () => !!(import.meta.env.VITE_POSTHOG_KEY && import.meta.env.VITE_POSTHOG_HOST);
export const configured = () => sendsUsage() || !!import.meta.env.VITE_SENTRY_DSN;
export const consent = () => read(KEY);
export const granted = () => configured() && consent() === "granted";
export const asked = () => consent() !== null;
export const onConsent = (fn) => (subs.add(fn), () => subs.delete(fn));

export function setConsent(allow) {
  write(KEY, allow ? "granted" : "denied");
  if (!allow) write(ID, null);
  subs.forEach((f) => f(allow));
}

export function installId() {
  if (!granted()) return null;
  let id = read(ID);
  if (!id) {
    id = crypto.randomUUID?.() || Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
    write(ID, id);
  }
  return id;
}
