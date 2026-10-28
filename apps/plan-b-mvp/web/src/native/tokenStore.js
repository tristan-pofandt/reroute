// The native bearer token lives in the Keychain (iOS) / Keystore-backed storage (Android) via @aparajita/capacitor-secure-storage.
// Imported lazily and only when native (accounts/store.js); the web keeps using the session cookie and never loads this.
// If the secure plugin is unavailable the token falls back to localStorage so sign-in still works; an old localStorage token is moved on first read.
const KEY = "planb.nativeToken";
let plugin = null;
const secure = () => (plugin ||= import("@aparajita/capacitor-secure-storage").then((m) => m.SecureStorage));
const local = {
  get: () => { try { return localStorage.getItem(KEY); } catch { return null; } },
  set: (token) => { try { localStorage.setItem(KEY, token); } catch { /* blocked: sign in again next time */ } },
  remove: () => { try { localStorage.removeItem(KEY); } catch { /* nothing stored */ } },
};

export async function getToken() {
  try {
    const stored = await (await secure()).get(KEY, false, false); // no Date conversion, no iCloud sync
    if (stored) return stored;
    const old = local.get();
    if (old) { await (await secure()).set(KEY, old, false, false); local.remove(); }
    return old;
  } catch { return local.get(); }
}

export async function setToken(token) {
  try {
    const store = await secure();
    if (token) await store.set(KEY, token, false, false); else await store.remove(KEY, false);
    local.remove(); // never leave a copy in plain storage
  } catch { token ? local.set(token) : local.remove(); }
}
