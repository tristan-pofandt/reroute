// Account screen (optional accounts: Google and Apple sign-in, synced data). Guest mode stays the default; nothing here is needed to use Reroute.
// State and sync live in ../accounts/store.js; this file is only the screen. Sign-in is a full-page redirect (PWA / Capacitor / WebView safe).
import { useState } from "react";
import { Navbar } from "./legal/Chrome.jsx";
import { Item, Shared } from "../shared.jsx";
import { AUTH_ERRORS, canSignIn, useAccount } from "../accounts/store.js";
import "../accounts/account.css";

const NAMES = { google: "Google", apple: "Apple", fake: "the test provider" };
const KEY_LABELS = { settings: "settings", places: "saved places", trips: "trip history" };
const standalone = () => { try { return matchMedia("(display-mode: standalone)").matches || navigator.standalone === true; } catch { return false; } };
const when = (seconds) => (seconds ? new Date(seconds * 1000).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "just now");

// The Google "G" mark, unmodified (Google Identity branding guidelines).
const GoogleG = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" /><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" /><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" /><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" /></svg>
);
// The Apple logo glyph used on the Sign in with Apple button.
const AppleMark = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" /></svg>
);

function SyncLine({ sync }) {
  const text = { off: "Not syncing", syncing: "Syncing…", synced: `Up to date${sync.at ? ` (${new Date(sync.at).toLocaleTimeString(undefined, { timeStyle: "short" })})` : ""}`,
    offline: "Offline: changes will sync when you are back online", error: "Could not sync just now. It will try again", conflict: "Needs your attention" }[sync.state] || "Not syncing";
  return <span className={`acct-sync ${sync.state}`}>{text}</span>;
}

function Conflicts({ account }) {
  return Object.entries(account.conflicts).map(([key, found]) => (
    <Item key={key} className="acct-panel" role="alert" index={9}>
      <p><strong>Your {KEY_LABELS[key] || key} differ from your account.</strong> {found.reason === "first"
        ? "This device and your account both had different ones. Nothing has been overwritten."
        : "Another device changed them. Nothing has been overwritten."}</p>
      <div className="btn-row">
        <button className="btn btn-secondary" onClick={() => account.resolve(key, "account")}>Use the account copy</button>
        <button className="btn btn-secondary" onClick={() => account.resolve(key, "device")}>Keep this device's</button>
      </div>
    </Item>
  ));
}

function SignedIn({ account }) {
  const { user, sync } = account;
  const [step, setStep] = useState(0); // 0 closed, 1 asking, so Delete is always two taps
  const provider = NAMES[user.provider] || user.provider;
  return (
    <>
      <Item tag="p" className="subtitle" index={2}>You are signed in. Reroute works the same either way; an account only keeps your settings, saved places and trip history in step across devices.</Item>
      <Item tag="dl" className="acct-card" index={3}>
        <div><dt>Name</dt><dd>{user.display_name || "Not given"}</dd></div>
        <div><dt>Email</dt><dd>{user.email || "Not given"}</dd></div>
        <div><dt>Signed in with</dt><dd>{provider}</dd></div>
        <div><dt>Last sign-in</dt><dd>{when(user.last_login)}</dd></div>
        <div><dt>Sync</dt><dd><SyncLine sync={sync} /></dd></div>
      </Item>
      <Conflicts account={account} />
      <Item className="acct-actions" index={4}>
        <a className="btn btn-secondary" href={account.exportUrl} download="reroute-account-data.json">Download my data</a>
        <button className="btn btn-secondary" disabled={account.busy} onClick={account.signOut}>Sign out</button>
      </Item>
      <Item className="acct-danger" index={5}>
        {step === 0 && <button className="btn btn-text acct-delete" onClick={() => setStep(1)}>Delete my account</button>}
        {step === 1 && (
          <div className="acct-panel error" role="alertdialog" aria-labelledby="acct-del-h">
            <h2 id="acct-del-h">Delete your account?</h2>
            <p>This permanently deletes your account, your sign-in details and everything synced to it
              {user.provider === "apple" ? ", and tells Apple to revoke Reroute's access" : ""}. Data stored only on this device stays here. It cannot be undone.</p>
            {account.reauth
              ? <><p>For your safety, sign in again first.</p><button className="btn btn-primary" onClick={() => account.signIn(user.provider)}>Sign in again to continue</button></>
              : <button className="btn btn-primary acct-confirm" disabled={account.busy} onClick={async () => { if (!(await account.deleteAccount())) setStep(1); }}>Yes, delete everything</button>}
            <button className="btn btn-text" onClick={() => setStep(0)}>Keep my account</button>
          </div>
        )}
      </Item>
    </>
  );
}

function SignedOut({ account }) {
  const { providers } = account;
  const shown = ["google", "apple"].filter((name) => canSignIn(account, name));
  return (
    <>
      <Item tag="p" className="subtitle" index={2}>Reroute works fully without an account. Signing in is optional.</Item>
      <Item tag="h2" index={3}>What an account is for</Item>
      <Item tag="p" index={4}>It keeps your settings, saved places and trip history in step across your devices, and lets you get them back on a new phone. Planning trips works exactly the same without it.</Item>
      <Item tag="h2" index={5}>What is stored</Item>
      <Item tag="p" index={6}>Your name and email address from Google or Apple, an ID from that provider, your sign-in times, and the data you sync. No passwords, no ads, no tracking. You can download or delete all of it at any time.</Item>
      {account.enabled && (shown.length > 0 || providers.fake) ? (
        <Item className="acct-signin" index={7}>
          {shown.includes("google") && <button className="acct-brand acct-google" disabled={account.busy} onClick={() => account.signIn("google")}><GoogleG /><span>Continue with Google</span></button>}
          {shown.includes("apple") && <button className="acct-brand acct-apple" disabled={account.busy} onClick={() => account.signIn("apple")}><AppleMark /><span>Sign in with Apple</span></button>}
          {providers.fake && <button className="btn btn-secondary acct-fake" onClick={() => account.signIn("fake")}>Test sign-in (development only)</button>}
        </Item>
      ) : (
        <Item className="feedback-banner info" index={7}><p>Sign-in is not set up on this server, so Reroute is running as a guest. Nothing is lost: everything works.</p></Item>
      )}
      <Item tag="p" className="fine" index={8}>
        By continuing you agree to the <button className="text-link" data-action="go" data-screen="terms">Terms of Use</button> and have read the <button className="text-link" data-action="go" data-screen="privacy">Privacy Policy</button>.
      </Item>
    </>
  );
}

export default function AccountScreen() {
  const account = useAccount();
  const { landing, status, user } = account;
  const banner = landing.error ? <Item className="feedback-banner error" role="alert" index={1}><p>{AUTH_ERRORS[landing.error] || AUTH_ERRORS.failed}</p></Item>
    : landing.signedIn && user ? <Item className="feedback-banner success" role="status" index={1}><p>You're signed in.{standalone() ? "" : " If you started in the installed app, return to it now."}</p></Item>
    : account.notice === "deleted" ? <Item className="feedback-banner success" role="status" index={1}><p>Your account and its data were deleted.</p></Item>
    : account.notice === "restored" ? <Item className="feedback-banner success" role="status" index={1}><p>Your account's saved data was added to this device. <button className="text-link" onClick={() => location.reload()}>Reload to use it</button>.</p></Item>
    : null;
  return (
    <>
      <Navbar />
      <div className="scroll legal-content">
        <Item tag="p" className="eyebrow" index={0}>Reroute</Item>
        <Shared tag="h1" id="title" className="large-title">Account</Shared>
        {banner}
        {status === "loading" && <Item className="skel-stack" index={2} role="status" aria-label="Checking your account"><div className="skeleton skel-line w-60" /><div className="skeleton skel-line sm w-40" /></Item>}
        {status === "error" && !user && (
          <Item className="feedback-banner" role="alert" index={2}><p>{account.error || "Could not reach Reroute."} Everything else still works as a guest.</p>
            <button className="btn btn-secondary" onClick={account.refresh}>Try again</button></Item>
        )}
        {status === "ready" && (user ? <SignedIn account={account} /> : <SignedOut account={account} />)}
        {status === "ready" && account.error && <Item tag="p" className="fine acct-error" role="alert" index={10}>{account.error}</Item>}
        {!user && <Item className="acct-guest" index={11}><button className="btn btn-text" data-action="go-home">Continue without an account</button></Item>}
      </div>
    </>
  );
}
