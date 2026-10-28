import { beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({ signIn: vi.fn() }));
vi.mock("../native/auth.js", () => sdk);
// In-memory stand-in for the Keychain/Keystore plugin: the bearer token must end up here and never in localStorage.
const vault = vi.hoisted(() => new Map());
vi.mock("@aparajita/capacitor-secure-storage", () => ({ SecureStorage: {
  get: async (key) => vault.get(key) ?? null, set: async (key, value) => { vault.set(key, value); }, remove: async (key) => vault.delete(key) } }));

const json = (value, status = 200) => ({ ok: status < 400, status, json: async () => value });
const providers = { enabled: true, providers: { google: false, apple: false }, native: { google: true, apple: true }, native_config: { google: { web_client_id: "web.apps", ios_client_id: "ios.apps" } } };
const user = { id: "u_1", display_name: "Ann" };

async function setup(platform, signedIn = false) {
  vi.resetModules();
  localStorage.clear();
  vault.clear();
  window.Capacitor = { isNativePlatform: () => platform !== "web", getPlatform: () => platform };
  const calls = [];
  globalThis.fetch = vi.fn(async (url, init = {}) => {
    calls.push({ url, init });
    if (url === "/api/auth/providers") return json(providers);
    if (url === "/api/me") return json(signedIn || vault.has("planb.nativeToken") ? { signed_in: true, user, csrf: "c" } : { signed_in: false });
    if (url === "/auth/native/google" || url === "/auth/native/apple") return json({ token: "bearer-1", token_type: "Bearer", user });
    if (url.startsWith("/api/account/")) return json({ data: {}, versions: {} });
    return json({});
  });
  const store = await import("../accounts/store.js");
  await store.refresh();
  return { store, calls };
}

describe("native sign-in", () => {
  beforeEach(() => sdk.signIn.mockReset());

  it("gets an ID token from the SDK, posts it to /auth/native/google, then calls the API with the bearer token", async () => {
    sdk.signIn.mockResolvedValue({ provider: "google", idToken: "id.tok.en", nonce: "n".repeat(32), authorizationCode: null });
    const { store, calls } = await setup("ios");
    expect(store.canSignIn(store.getAccount(), "google")).toBe(true);
    await store.signIn("google");
    expect(sdk.signIn).toHaveBeenCalledWith("google", providers.native_config);
    const post = calls.find((c) => c.url === "/auth/native/google");
    expect(JSON.parse(post.init.body)).toEqual({ id_token: "id.tok.en", nonce: "n".repeat(32) });
    expect(vault.get("planb.nativeToken")).toBe("bearer-1");
    expect(localStorage.getItem("planb.nativeToken")).toBeNull();
    expect(store.getAccount().user.id).toBe("u_1");
    const me = calls.filter((c) => c.url === "/api/me").pop();
    expect(me.init.headers.Authorization).toBe("Bearer bearer-1");
  });

  it("sends the Apple authorization code so the server can revoke later", async () => {
    sdk.signIn.mockResolvedValue({ provider: "apple", idToken: "a.b.c", nonce: "m".repeat(32), authorizationCode: "code1" });
    const { store, calls } = await setup("ios");
    await store.signIn("apple");
    expect(JSON.parse(calls.find((c) => c.url === "/auth/native/apple").init.body).authorization_code).toBe("code1");
  });

  it("shows a friendly error and stores nothing when the person cancels or the server refuses", async () => {
    sdk.signIn.mockRejectedValue(new Error("User cancelled"));
    const { store } = await setup("ios");
    await store.signIn("google");
    expect(store.getAccount().error).toMatch(/cancelled/i);
    expect(vault.size).toBe(0);
    sdk.signIn.mockResolvedValue({ idToken: "x.y.z", nonce: "n".repeat(32) });
    globalThis.fetch.mockImplementationOnce(async () => json({}, 200)).mockImplementationOnce(async () => json({}, 200)).mockImplementationOnce(async () => json({ error: "Sign-in could not be verified." }, 401));
    await store.signIn("google");
    expect(store.getAccount().error).toMatch(/could not be verified/i);
    expect(vault.size).toBe(0);
  });

  it("clears the bearer token on sign out", async () => {
    const { store } = await setup("ios", true);
    vault.set("planb.nativeToken", "bearer-1");
    await store.signOut();
    expect(vault.size).toBe(0);
  });

  it("offers Apple on iOS but not on Android, and only the redirect providers on the web", async () => {
    let { store } = await setup("android");
    expect([store.canSignIn(store.getAccount(), "google"), store.canSignIn(store.getAccount(), "apple")]).toEqual([true, false]);
    ({ store } = await setup("web"));
    expect([store.canSignIn(store.getAccount(), "google"), store.canSignIn(store.getAccount(), "apple")]).toEqual([false, false]);
    expect(localStorage.getItem("planb.nativeToken")).toBeNull();
    expect(vault.size).toBe(0);
  });

  it("moves an old localStorage token into secure storage on first read", async () => {
    localStorage.setItem("planb.nativeToken", "old-token");
    const { getToken, setToken } = await import("../native/tokenStore.js");
    expect(await getToken()).toBe("old-token");
    expect(vault.get("planb.nativeToken")).toBe("old-token");
    expect(localStorage.getItem("planb.nativeToken")).toBeNull();
    await setToken(null);
    expect(vault.size).toBe(0);
  });
});
