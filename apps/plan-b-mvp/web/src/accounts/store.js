// Account state for the React shell: who is signed in, and the debounced sync of settings / saved places / trip history.
// One module-level store (useAccount() reads it), so the avatar menu, the Account screen and the sync loop always agree.
//
// Sync model: the server holds {value, version} per key. This device remembers, per key, the version it last saw and a hash of the value
// it last synced (localStorage "planb.acct.sync"). A key is "dirty" when its current hash differs, so the offline queue survives reloads
// with no extra bookkeeping. Nothing is ever overwritten silently: the first sign-in uses the merge endpoint with unknown device stamps
// (the server's copy wins ties and the answer says what happened), a stale write comes back as a conflict, and the person chooses.
import { useSyncExternalStore } from "react";
import { KEYS, readLocal, same, writeLocal } from "./adapter.js";

const SYNC_KEY = "planb.acct.sync";
const DEBOUNCE_MS = 2000, TICK_MS = 5000, PULL_MS = 60000;

// What the page was opened with: the redirect back from a provider adds ?signed_in=1 or ?auth_error=<code>. Read once, then removed.
const landing = (() => {
  try {
    const url = new URL(location.href), found = { signedIn: url.searchParams.has("signed_in"), error: url.searchParams.get("auth_error") };
    if (found.signedIn || found.error) {
      url.searchParams.delete("signed_in"); url.searchParams.delete("auth_error");
      history.replaceState(history.state, "", url.pathname + url.search + url.hash);
    }
    return found;
  } catch { return { signedIn: false, error: null }; }
})();

export const AUTH_ERRORS = {
  cancelled: "Sign-in was cancelled.", expired: "That sign-in took too long or was already used. Please try again.",
  busy: "Too many attempts. Try again in a little while.", disabled: "That sign-in is not set up on this server.",
  failed: "Sign-in could not be verified. Please try again.",
};

let state = { status: "loading", enabled: false, providers: {}, user: null, csrf: null, reauth: false, landing,
  sync: { state: "off", at: null }, conflicts: {}, notice: null, busy: false, error: null };
const subs = new Set();
const set = (patch) => { state = { ...state, ...patch }; subs.forEach((f) => f()); publish(); };
export const getAccount = () => state;
export const subscribe = (f) => (subs.add(f), () => subs.delete(f));

// The legacy avatar menu reads window.RerouteAccount when it renders and is patched live below.
function publish() {
  const label = state.user ? (state.user.display_name || state.user.email || "Account").slice(0, 40) : "Sign in";
  window.RerouteAccount = { signedIn: !!state.user, label };
  document.querySelectorAll("[data-account-label]").forEach((el) => { if (el.textContent !== label) el.textContent = label; });
}

// ── Talking to the server ───────────────────────────────────────────────────

async function call(path, { method = "GET", body } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET" && state.csrf) headers["X-CSRF-Token"] = state.csrf;
  const response = await fetch(path, { method, headers, credentials: "same-origin", cache: "no-store", body: body === undefined ? undefined : JSON.stringify(body) });
  let json = null;
  try { json = await response.json(); } catch { /* an empty or non-JSON body */ }
  return { ok: response.ok, status: response.status, json: json || {} };
}

const readSync = (user) => {
  try { const saved = JSON.parse(localStorage.getItem(SYNC_KEY) || "null"); if (saved?.user === user) return saved; } catch { /* unreadable: start again */ }
  return { user, versions: {}, hashes: {} };
};
const writeSync = (saved) => { try { localStorage.setItem(SYNC_KEY, JSON.stringify(saved)); } catch { /* storage full or blocked: the sync simply restarts */ } };
const forget = () => { try { localStorage.removeItem(SYNC_KEY); } catch { /* ignore */ } };
const hash = (value) => JSON.stringify(value);

export async function refresh() {
  if (navigator.onLine === false) { set({ status: state.user ? "ready" : "error", error: "You are offline." }); return; }
  try {
    const [providers, me] = await Promise.all([call("/api/auth/providers"), call("/api/me")]);
    if (!providers.ok || !me.ok) throw new Error("unavailable");
    const user = me.json.signed_in ? me.json.user : null;
    set({ status: "ready", error: null, enabled: !!providers.json.enabled, providers: providers.json.providers || {}, user, csrf: me.json.csrf || null,
      reauth: !!me.json.reauth_required, sync: user ? state.sync : { state: "off", at: null } });
    if (user) startSync(); else stopSync();
  } catch {
    set({ status: state.user ? "ready" : "error", error: "Could not reach Reroute." });
  }
}

// ── Actions ─────────────────────────────────────────────────────────────────

// A full-page redirect (works in an installed PWA and in a WebView); the server brings the person back to `next` afterwards.
export function signIn(provider, next = location.pathname + location.search) {
  location.assign(`/auth/${encodeURIComponent(provider)}/login?next=${encodeURIComponent(next)}`);
}

export async function signOut() {
  set({ busy: true });
  const reply = await call("/auth/logout", { method: "POST", body: {} }).catch(() => null);
  if (reply?.ok) { stopSync(); forget(); set({ user: null, csrf: null, busy: false, conflicts: {}, notice: null, sync: { state: "off", at: null } }); }
  else set({ busy: false, error: "Could not sign out. Try again." });
}

export async function deleteAccount() {
  set({ busy: true, error: null });
  const reply = await call("/api/account/delete", { method: "POST", body: { confirm: "delete" } }).catch(() => null);
  if (reply?.ok) { stopSync(); forget(); set({ user: null, csrf: null, busy: false, conflicts: {}, notice: "deleted", sync: { state: "off", at: null } }); return true; }
  if (reply?.json?.reauth) { set({ busy: false, reauth: true }); return false; }
  set({ busy: false, error: reply?.json?.error || "Could not delete the account. Nothing was deleted; try again." });
  return false;
}

export const exportUrl = "/api/account/export";

// ── Sync ────────────────────────────────────────────────────────────────────

let timer = null, pullTimer = null, started = null, running = false;
const since = {}; // key -> { hash, at }: when a local change was first seen (the debounce)

function stopSync() { clearInterval(timer); clearInterval(pullTimer); timer = pullTimer = started = null; }

function startSync() {
  if (started === state.user.id) return;
  stopSync();
  started = state.user.id;
  adopt().then(() => {
    if (started !== state.user?.id) return;
    timer = setInterval(tick, TICK_MS);
    pullTimer = setInterval(pull, PULL_MS);
  });
}

const status = (patch) => set({ sync: { ...state.sync, ...patch } });

// First time this account is used on this device: merge instead of overwrite. Device stamps are unknown (0), so the server wins ties.
async function adopt() {
  const saved = readSync(state.user.id);
  if (saved.adopted) return pull();
  const local = readLocal(), items = {};
  for (const key of KEYS) if (local[key] !== undefined) items[key] = { value: local[key], updated_at: 0 };
  status({ state: "syncing" });
  try {
    const reply = await call("/api/account/merge", { method: "POST", body: { local: items } });
    if (!reply.ok) throw new Error("merge");
    let restored = false;
    const conflicts = {};
    for (const [key, row] of Object.entries(reply.json.merged || {})) {
      saved.versions[key] = row.version;
      if (key in items && same(row.value, items[key].value)) saved.hashes[key] = hash(row.value);
      else if (!(key in items)) { if (writeLocal(key, row.value)) { saved.hashes[key] = hash(row.value); restored = true; } }
      else conflicts[key] = { value: row.value, version: row.version, reason: "first" };
    }
    saved.adopted = true;
    writeSync(saved);
    set({ conflicts, notice: restored ? "restored" : state.notice });
    status({ state: Object.keys(conflicts).length ? "conflict" : "synced", at: Date.now() });
  } catch { status({ state: "offline" }); }
}

// Another device may have changed things: fetch, apply what this device has not touched, and flag what both changed.
async function pull() {
  if (!state.user || navigator.onLine === false) return;
  try {
    const reply = await call("/api/account/data");
    if (!reply.ok) return;
    const saved = readSync(state.user.id), local = readLocal(), conflicts = { ...state.conflicts };
    let updated = false;
    for (const [key, row] of Object.entries(reply.json.data || {})) {
      if (row.version <= (saved.versions[key] || 0) || key in conflicts) continue;
      const untouched = local[key] === undefined || saved.hashes[key] === hash(local[key]);
      if (untouched && writeLocal(key, row.value)) { saved.versions[key] = row.version; saved.hashes[key] = hash(row.value); updated = true; }
      else conflicts[key] = { value: row.value, version: row.version, reason: "other-device" };
    }
    writeSync(saved);
    set({ conflicts, notice: updated ? "restored" : state.notice });
    if (Object.keys(conflicts).length) status({ state: "conflict" });
    else if (state.sync.state === "syncing") status({ state: "synced", at: Date.now() });
  } catch { /* the next pull tries again */ }
}

// Push every key whose value has changed and stayed unchanged for DEBOUNCE_MS.
async function tick() {
  if (!state.user || running || document.hidden) return;
  const saved = readSync(state.user.id), local = readLocal(), now = Date.now();
  const dirty = KEYS.filter((key) => local[key] !== undefined && !(key in state.conflicts) && hash(local[key]) !== saved.hashes[key]);
  if (!dirty.length) { if (state.sync.state === "offline" || state.sync.state === "error") status({ state: "synced", at: Date.now() }); return; }
  for (const key of dirty) if (since[key]?.hash !== hash(local[key])) since[key] = { hash: hash(local[key]), at: now };
  const ready = dirty.filter((key) => now - since[key].at >= DEBOUNCE_MS);
  if (!ready.length) return;
  if (navigator.onLine === false) { status({ state: "offline" }); return; }
  running = true;
  status({ state: "syncing" });
  try {
    const conflicts = { ...state.conflicts };
    for (const key of ready) {
      const reply = await call(`/api/account/data/${key}`, { method: "PUT", body: { version: saved.versions[key] || 0, value: local[key] } });
      if (reply.ok) { saved.versions[key] = reply.json.version; saved.hashes[key] = hash(local[key]); }
      else if (reply.status === 409) conflicts[key] = { value: reply.json.value, version: reply.json.version, reason: "other-device" };
      else if (reply.status === 401) { await refresh(); return; }
      else throw new Error(reply.json.error || "save");
    }
    writeSync(saved);
    set({ conflicts });
    status({ state: Object.keys(conflicts).length ? "conflict" : "synced", at: Date.now() });
  } catch (error) {
    status({ state: navigator.onLine === false ? "offline" : "error", message: String(error.message || "") });
  } finally { running = false; }
}

// The person's answer to a conflict. "account": take the account copy (the page reloads so the app reads it). "device": keep this device's
// copy and upload it over the account's, which is the one explicit overwrite.
export async function resolve(key, choice) {
  const found = state.conflicts[key];
  if (!found || !state.user) return;
  const saved = readSync(state.user.id);
  if (choice === "account") {
    writeLocal(key, found.value);
    saved.versions[key] = found.version; saved.hashes[key] = hash(found.value);
    writeSync(saved);
    location.reload();
    return;
  }
  const value = readLocal()[key];
  const reply = await call(`/api/account/data/${key}`, { method: "PUT", body: { version: found.version, value } }).catch(() => null);
  const { [key]: _gone, ...rest } = state.conflicts;
  if (reply?.ok) { saved.versions[key] = reply.json.version; saved.hashes[key] = hash(value); writeSync(saved); set({ conflicts: rest }); status({ state: Object.keys(rest).length ? "conflict" : "synced", at: Date.now() }); }
  else set({ error: "Could not upload this device's copy. Try again." });
}

export const dismissNotice = () => set({ notice: null });

addEventListener("online", () => { if (state.user) { tick(); pull(); } else if (state.status === "error") refresh(); });
document.addEventListener("visibilitychange", () => { if (!document.hidden && state.user) pull(); });
publish();
refresh();

// ── React ───────────────────────────────────────────────────────────────────

export function useAccount() {
  const current = useSyncExternalStore(subscribe, getAccount);
  return { ...current, signIn, signOut, deleteAccount, refresh, resolve, dismissNotice, exportUrl };
}
