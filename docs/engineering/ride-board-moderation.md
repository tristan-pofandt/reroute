# Ride board moderation

Written by Claude Sonnet 5.5 via Claude Code at T.P's request, 2026-10-28. **Human review required:** the policy wording, the 24 hour target, the retention periods and the word list must be approved by a team member, and someone must actually own the abuse mailbox before this ships to a store.

Why: Apple App Review Guideline 1.2 and the Google Play User Generated Content policy require apps with user-generated content to offer a way to filter objectionable content, report content, block abusive users, respond to reports in a timely way, and publish contact details (store-readiness audit, gap 2). The ride board is the only user-generated content in Reroute. Check the current store text before relying on this; no policy was fetched.

## Policy in one paragraph

Posts are about a real shared trip: nickname, broad start and destination labels, a public meeting point, optional short note. No contact details, links, handles, abuse, sexual content, scams or advertising. Anyone can report a post or block its poster. We aim to review reports within 24 hours (a target for a student prototype, not a guarantee, and it says so on the Community Guidelines page). Breaches lead to the post being removed, or removed with a ban. Rules for users are on the `/community` page; the in-app notice and acknowledgement are shown when posting.

## What the user sees

| Where | What |
|---|---|
| Every post from someone else on the ride board | `Report` and `Block` links (44 px tap targets) |
| Report sheet | Reason (harassment, scam/spam, unsafe/threatening, sexual, personal details, fake, other), optional note (300 characters), "also hide this person's posts" ticked by default, 24 hour statement, abuse address, "in an emergency call 000" |
| Block | Immediate: the poster's posts disappear, a toast confirms, a `Blocked` list at the bottom of the board has `Unblock` |
| Post form | A short Community rules box with a link to `/community` and a required checkbox; the server also refuses a post without `rules_ack: true` |
| Board footer | "We aim to review reports within 24 hours", the abuse address, link to the Community Guidelines |
| Your own hidden post | Badge `Under review` instead of `Yours` |
| Pages | `/community`, `/support`, linked from About, the side menu and the home legal links |

## Identity: pseudonymous poster ids

There are no accounts on the ride board, so every post and every block is tied to a **poster id**: 12 hex characters, `HMAC-SHA256(per-server salt, "<kind>:<value>")`. The kind is `account` (the signed-in user id, when accounts are enabled and the request carries a valid session), else `device` (a random 16 to 64 character id the browser keeps in local storage and sends as `X-Reroute-Device` on ride and plan calls), else `address` (the network address, a weak fallback for clients without the header). The salt lives in the ride database (`meta` table) so ids are stable across restarts and meaningless on another server. The poster id is public in the ride JSON (`poster`) so the client can hide blocked posters instantly; it cannot be reversed to a device or account without the salt.

Limits of this design: clearing browser storage gives a guest a new device id, so a guest ban or block can be evaded. A signed-in account gives a durable id. If this becomes a real problem, require sign-in to post (the accounts work already exists).

## Block lists

`blocks(blocker, poster, nickname)` in SQLite, per account when signed in, per device when a guest. The server removes blocked posters' rides from plan answers (`hide_blocked` in `server.py`) and from `matches`; the client also keeps a local copy (`planb.blockedPosters`) so the hide is instant and the `Blocked` list can be shown. Rides you have joined stay visible so you can leave them. Endpoints: `POST /api/rides/block` (`{id}` of a ride, or `{poster, nickname}`), `POST /api/rides/unblock` (`{poster}`), `GET /api/rides/blocks`.

## Reports and auto-hide

`POST /api/rides/report` `{id, reason, note}`: one report per reporter per post (a repeat replaces the earlier one), cannot report your own post, 10 reports per reporter per hour. When `AUTO_FLAG_REPORTS` (3) distinct reporters have reported a post it becomes `flagged`: hidden from matches, cannot be joined, shown to its owner as "Under review", and listed first in the operator queue. `approve` marks it `approved` and it is never auto-hidden again; `remove` deletes it.

## Content filter

`contentfilter.py` plus `moderation/wordlist.txt` (starter list, edit freely) and an optional untracked `data/wordlist.extra.txt` in the same format, so an operator can add words without a code change. Matching normalises case, accents, look-alike characters (`5hit`, `$h!t`), letter repeats and spaced letters (`f.u.c.k`), then compares whole words with common endings, so `class` and `Scunthorpe` pass. A second section (`[scam-contact]`) holds contact-and-scam hooks (`whatsapp`, `dm me`, `bitcoin`, ...). Regexes also reject URLs and bare domains, email addresses, `@handles`, phone numbers (eight or more digits with separators) and spoken digit runs. It is applied to the nickname, both place labels, the meeting point and the note, on create, and to the nickname on join. It is a speed bump, not a classifier: it will miss deliberate evasion (other languages, images are not possible here, unusual spellings) and may reject odd place names. The report button is the real control.

## Rate limits

Per poster id, in memory (single worker): 3 posts per hour, 8 per day, 10 joins per hour, 10 reports per hour, 30 blocks per hour. Over the limit the API answers 429 with `Retry-After`. These sit on top of the per-address limits in `limits.py`.

## Expiry and retention

A post is deleted 30 minutes after its departure time (`EXPIRE_AFTER`), together with its reports. Max 500 live posts. Moderation log entries (`approve`, `remove`, `ban`, `unban`, `auto-hide`, with the removed post's nickname, meeting point and note) are kept 90 days (`LOG_DAYS`) so an appeal can be answered, then purged. Bans and blocks are kept until lifted.

## Operator queue

`GET /admin/moderation` (HTML) and the same URL with `Authorization: Bearer <token>` or `?format=json` (JSON). Off (404) unless `PLANB_ADMIN_TOKEN` is set. The HTML page asks for the token once and sets an 8 hour `HttpOnly`, `SameSite=Strict`, path `/admin` cookie (`Secure` over HTTPS); wrong tokens are throttled to 10 per 15 minutes per address; the page has its own strict CSP (`default-src 'none'`), is `noindex`, escapes all user text and refuses cross-origin form posts. Actions: `POST /admin/moderation/action` with `action` = `approve`, `remove`, `ban` (removes the poster's posts and blocks new ones) or `unban` (with `id` or `poster`); JSON body with the bearer token, or the page's forms.

```
curl -H "Authorization: Bearer $PLANB_ADMIN_TOKEN" https://HOST/admin/moderation?format=json
curl -H "Authorization: Bearer $PLANB_ADMIN_TOKEN" -H "Content-Type: application/json" \
     -d '{"action":"remove","id":"5439456f"}' https://HOST/admin/moderation/action
```

## Operator runbook

1. **Set up once:** generate a 32+ character random token (`python -c "import secrets;print(secrets.token_urlsafe(32))"`), store it as the host secret `PLANB_ADMIN_TOKEN`, redeploy. Put a persistent disk on `PLANB_DATA_DIR`, otherwise the ride database (including bans) is lost on redeploy. Replace the placeholder `abuse@reroute.invalid` / `support@reroute.invalid` (in `web/src/screens/legal/contact.js` and `ABUSE_EMAIL` in `app.js`) with a monitored mailbox and forward it to at least two people.
2. **Daily (and within 24 hours of any report):** open `/admin/moderation`, sign in, read each item (reasons, notes, the post). Approve if fine; Remove if it breaks the rules; Remove and ban for threats, sexual content, repeated or scam posts.
3. **Email reports** to the abuse address: find the post by nickname and time (the queue shows the id, poster and times), act as above, reply to the reporter that it was reviewed (no need to say what was done).
4. **Appeals:** a second person reads the log entry (post text is in the `remove` detail for 90 days), and if wrong, uses Unban with the poster id the user cannot know: ask for the nickname, time and trip, find it in the log. Reply within 24 hours on weekdays.
5. **Threats of harm, child safety, or anything illegal:** remove and ban immediately, keep a copy of the log text, and contact the police; Reroute has no other safeguarding process. Do not forward the ride JSON; it holds only rounded coordinates.
6. **Extend the filter:** add words to `data/wordlist.extra.txt` on the server (one per line, `[abuse]` or `[scam-contact]` headings) and restart.
7. **If the token leaks:** change `PLANB_ADMIN_TOKEN` and restart; old cookies stop working because they are derived from the token.

## Not done

No image or profile content exists, so no image moderation. No email notification to the operator when a post is auto-hidden (the queue must be checked). No signed-in requirement to post. No translation of the filter beyond English. The 24 hour response time depends on people, not code.
