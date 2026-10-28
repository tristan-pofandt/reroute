import { ABUSE_EMAIL, RESPONSE_HOURS } from "./contact.js";

export default function CommunityBody() {
  return (<>
    <p className="eyebrow">Shared rides</p><h1 className="large-title">Community Guidelines</h1>
    <p className="subtitle">The ride board only works when people feel safe using it. These rules apply to every post, nickname and note on it.</p>
    <h2>What is welcome</h2>
    <p>Honest posts about a real trip you are making: where you are starting, where you are going, when you leave, how many seats you have or how many people you want to split an Uber with, and a public meeting point. Friendly, short notes that help people find each other.</p>
    <h2>What is not allowed</h2>
    <div className="group"><div className="group-card">
      <div className="row"><span className="row-label"><b>Harassment, hate and threats</b><small>Abuse, bullying, discrimination, threats of harm, or anything that targets a person or group.</small></span></div>
      <div className="row"><span className="row-label"><b>Sexual or graphic content</b><small>Sexual solicitation, nudity, graphic or violent content, or using the board to meet people for anything other than sharing a trip.</small></span></div>
      <div className="row"><span className="row-label"><b>Scams, spam and advertising</b><small>Asking for money outside the shared cost of the trip, selling things, promoting services, links, or fake posts.</small></span></div>
      <div className="row"><span className="row-label"><b>Contact details and personal information</b><small>No phone numbers, email addresses, social handles, links, home addresses or other people's details. Use a first name or nickname and a public meeting point.</small></span></div>
      <div className="row"><span className="row-label"><b>Unsafe or illegal trips</b><small>Anything that breaks road rules or the law, including drink or drug driving, unlicensed driving or overloading a car.</small></span></div>
      <div className="row"><span className="row-label"><b>Impersonation and false information</b><small>Pretending to be someone else, or posting trips you do not intend to make.</small></span></div>
    </div></div>
    <p>Posts are checked by an automatic filter for abusive words, links and contact details before they appear. The filter is simple and will miss things, so reports from people like you matter.</p>
    <h2>Staying safe</h2>
    <p>Reroute does not check drivers, vehicles, insurance or riders, and does not take payment. Meet somewhere public and well lit, tell a friend where you are going, check the car and driver match the post, and trust your judgement: you can always decline a ride. Splitting an Uber is arranged in the Uber app. In an emergency call 000.</p>
    <h2>Reporting</h2>
    <p>Every post on the ride board has a <b>Report</b> button. Choose a reason and, if you like, add a note. You can also tap <b>Block</b> to hide everything from that person straight away; you can unblock them at the bottom of the ride board. The person is not told who reported or blocked them. If several people report a post it is hidden automatically until a person at Reroute has reviewed it.</p>
    <p>To report something that is not on a post, or to reach us urgently, email <a href={`mailto:${ABUSE_EMAIL}`}>{ABUSE_EMAIL}</a> (placeholder address: not yet monitored). We aim to review every report within {RESPONSE_HOURS} hours. This is a target for a student prototype, not a guarantee.</p>
    <h2>What we do about it</h2>
    <p>Depending on how serious it is, we approve the post, remove it, or remove it and ban the person who posted it from the ride board. Serious or repeated breaches mean a ban; illegal content and credible threats may be passed to the police. Bans are tied to the account or device the post came from, and we keep a short log of moderation actions (the post text, the reason and the date) for up to 90 days so a decision can be reviewed.</p>
    <h2>Appeals</h2>
    <p>If you think a post of yours was removed or you were banned by mistake, email <a href={`mailto:${ABUSE_EMAIL}`}>{ABUSE_EMAIL}</a> with the nickname you used, the time of the post and the trip, and we will have a second person look at it. We aim to reply within {RESPONSE_HOURS} hours on weekdays.</p>
    <p className="fine">Review before public release: replace the placeholder contact addresses, confirm who answers them, and have the rules checked against the Terms of Use. This page is plain-language product information, not legal advice.</p>
    <button className="btn btn-secondary" data-action="go" data-screen="terms">Read the Terms of Use</button>
    <button className="btn btn-secondary" data-action="go" data-screen="support">Support and contact</button>
  </>);
}
