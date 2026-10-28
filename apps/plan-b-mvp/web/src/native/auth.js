// Native Sign in with Apple / Google via @capgo/capacitor-social-login. Loaded lazily by accounts/store.js on native only.
// Returns the ID token plus the raw nonce; the server checks the token's nonce claim against it (Apple's SDK gets the SHA-256, which the server also accepts).
import { SocialLogin } from "@capgo/capacitor-social-login";

let ready = null;
export const initAuth = (cfg) => (ready ||= SocialLogin.initialize({
  google: { webClientId: cfg.google?.web_client_id, iOSClientId: cfg.google?.ios_client_id, mode: "online" },
  apple: {}, // iOS uses the system sheet; Android is not offered (it would need the web flow)
}));

const hex = (bytes) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
export const newNonce = () => hex(crypto.getRandomValues(new Uint8Array(16))); // 32 hex characters
const sha256 = async (text) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));

export async function signIn(provider, cfg = {}) {
  await initAuth(cfg);
  const nonce = newNonce();
  const { result } = await SocialLogin.login({ provider, options: provider === "google"
    ? { scopes: ["email", "profile"], nonce }
    : { scopes: ["email", "name"], nonce: await sha256(nonce) } });
  const code = result.authorizationCode;
  return { provider, idToken: result.idToken, nonce, authorizationCode: typeof code === "string" ? code : null };
}
