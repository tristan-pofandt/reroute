// Native Sign in with Apple / Google via @capgo/capacitor-social-login. Not wired to the UI (the accounts work owns that);
// the accounts screen can `await import("../native/auth.js")` on native and send the returned idToken to the server.
import { SocialLogin } from "@capgo/capacitor-social-login";

let ready = null;
export const initAuth = (cfg) => (ready ||= SocialLogin.initialize({
  google: { webClientId: cfg.googleWebClientId, iOSClientId: cfg.googleIosClientId, mode: "online" },
  apple: {}, // iOS uses the system sheet; Android needs apple.clientId + redirectUrl (web flow) if offered
}));

export async function signIn(provider, cfg) {
  await initAuth(cfg);
  const { result } = await SocialLogin.login({ provider, options: provider === "google" ? { scopes: ["email", "profile"] } : { scopes: ["email", "name"] } });
  return { provider, idToken: result.idToken, accessToken: result.accessToken?.token || null, profile: result.profile };
}
