import pkg from "../../../package.json";
import { ABUSE_EMAIL, RESPONSE_HOURS, SUPPORT_EMAIL } from "./contact.js";

const build = typeof __RELEASE__ === "undefined" ? "dev" : __RELEASE__;

export default function SupportBody() {
  return (<>
    <p className="eyebrow">Help</p><h1 className="large-title">Support and contact</h1>
    <p className="subtitle">Something wrong, something confusing, or something you want removed? Start here.</p>
    <h2>Contact us</h2>
    <div className="group"><div className="group-card">
      {/* TODO before launch: set VITE_SUPPORT_EMAIL to a monitored mailbox (the default .invalid domain never resolves). */}
      <div className="row"><span className="row-label"><b>General support</b><small>Questions, bugs and privacy requests. Placeholder address: not yet monitored.</small><a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></span></div>
      <div className="row"><span className="row-label"><b>Report abuse on the ride board</b><small>Use the Report button on a post, or email us. We aim to review reports within {RESPONSE_HOURS} hours.</small><a href={`mailto:${ABUSE_EMAIL}`}>{ABUSE_EMAIL}</a></span></div>
      <div className="row"><span className="row-label"><b>This version</b><small>Reroute {pkg.version}, build {build}. Include this when you contact us.</small></span></div>
    </div></div>
    <h2>Questions</h2>
    <div className="group"><div className="group-card">
      <div className="row"><span className="row-label"><b>Is Reroute an official Translink app?</b><small>No. It is a student prototype that uses Translink's open data. Always check signs and official services before you travel.</small></span></div>
      <div className="row"><span className="row-label"><b>Why does it say live search is off?</b><small>The server has no Google Maps key, or today's search allowance has been used. Try again tomorrow, or use Demo mode from the menu to see how it works with simulated data.</small></span></div>
      <div className="row"><span className="row-label"><b>Does it work outside Brisbane?</b><small>Public transport and disruptions cover South East Queensland only. Driving, walking and cycling routes work further afield.</small></span></div>
      <div className="row"><span className="row-label"><b>Do I need an account?</b><small>No. Everything works without one. An account only syncs your settings and saved places between devices.</small></span></div>
      <div className="row"><span className="row-label"><b>How do I stop notifications?</b><small>Turn the watch off in Settings, or switch notifications off for Reroute in your browser or phone settings.</small></span></div>
    </div></div>
    <h2>How to report a problem</h2>
    <p>Email {SUPPORT_EMAIL} with what you were doing, what you expected, what happened, the version and build above, and your phone or browser. Please do not include passwords. A screenshot helps. For a bad post or person on the ride board, use Report on the post instead (see the Community Guidelines).</p>
    <h2>How to delete your data</h2>
    <p><b>On this device:</b> your settings, saved places and history live in this browser only. Clear this site's data in your browser or phone settings and they are gone; on the native app, uninstall it or clear its storage. Offline map areas are deleted the same way.</p>
    <p><b>Ride board:</b> open Shared rides and tap Cancel this ride or Leave this ride. Posts are deleted by themselves 30 minutes after the departure time.</p>
    <p><b>Account:</b> if you created an account you can delete it, with the data synced to it, from the Account screen in the profile menu.</p>
    <p><b>Anything else, or if you cannot get in:</b> email {SUPPORT_EMAIL} and tell us what to delete; we aim to reply within {RESPONSE_HOURS} hours on weekdays. The Privacy Policy lists what is kept and for how long.</p>
    <p className="fine">Review before public release: replace the placeholder addresses and confirm someone answers them. This page is plain-language product information, not legal advice.</p>
    <button className="btn btn-secondary" data-action="go" data-screen="privacy">Read the Privacy Policy</button>
    <button className="btn btn-secondary" data-action="go" data-screen="community">Community Guidelines</button>
    <button className="btn btn-secondary" data-action="go" data-screen="licences">Licences</button>
  </>);
}
