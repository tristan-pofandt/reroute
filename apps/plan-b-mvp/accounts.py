"""Optional accounts for Reroute: Google and Apple sign-in (OpenID Connect through Authlib), server-side sessions, synced data.

Guest mode stays the default: nothing here runs unless a visitor signs in. See docs/engineering/accounts.md for the design.
Everything secret comes from the environment (names only in the docs): ACCOUNTS_SECRET_KEY, GOOGLE_*, APPLE_*.
"""

import base64
from contextlib import closing
from datetime import datetime, timezone
import hashlib
import hmac
import json
import logging
import os
from pathlib import Path
import re
import secrets
import sqlite3
import threading
import time
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from authlib.common.security import generate_token
from authlib.integrations.requests_client import OAuth2Session
from authlib.oauth2.rfc7636 import create_s256_code_challenge
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from flask import Blueprint, Response, g, jsonify, request
from joserfc import jwt
from joserfc.errors import JoseError
from joserfc.jwk import ECKey, KeySet
import requests

log = logging.getLogger("planb.accounts")

SESSION_DAYS = 30
REAUTH_SECONDS = 600  # deleting an account needs a sign-in no older than this
PENDING_SECONDS = 600  # a sign-in must come back from the provider within ten minutes
TOUCH_SECONDS = 3600  # how often a session's rolling expiry (and cookie) is renewed
KEY_RE = re.compile(r"^[a-z][a-z0-9_-]{0,39}$")
MAX_KEYS, MAX_VALUE, MAX_TOTAL = 20, 256 * 1024, 1024 * 1024
ALGS = ["RS256", "ES256"]
WELL_KNOWN = {  # file name -> (environment variable holding the content, media type)
    "apple-developer-domain-association.txt": ("APPLE_DOMAIN_ASSOCIATION", "text/plain; charset=utf-8"),
    "apple-app-site-association": ("APPLE_APP_SITE_ASSOCIATION_JSON", "application/json"),
    "assetlinks.json": ("ANDROID_ASSETLINKS_JSON", "application/json"),
}
NATIVE_WARNING = "Native sign-in needs at least one client id (GOOGLE_*_CLIENT_ID / APPLE_BUNDLE_ID)."

SCHEMA = [  # version -> statements; applied once, in order
    """CREATE TABLE users (id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, display_name TEXT, email TEXT, email_verified INTEGER NOT NULL DEFAULT 0,
        avatar_url TEXT, deleted_at INTEGER);
    CREATE TABLE identities (provider TEXT NOT NULL, subject TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        email TEXT, created_at INTEGER NOT NULL, last_login INTEGER NOT NULL, PRIMARY KEY (provider, subject));
    CREATE INDEX identities_user ON identities(user_id);
    CREATE TABLE sessions (id_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind TEXT NOT NULL,
        provider TEXT NOT NULL, created_at INTEGER NOT NULL, last_seen INTEGER NOT NULL, expires_at INTEGER NOT NULL, auth_at INTEGER NOT NULL);
    CREATE INDEX sessions_user ON sessions(user_id);
    CREATE TABLE user_data (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, key TEXT NOT NULL, json TEXT NOT NULL,
        version INTEGER NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (user_id, key));
    CREATE TABLE pending_auth (state_hash TEXT PRIMARY KEY, provider TEXT NOT NULL, nonce TEXT NOT NULL, verifier TEXT NOT NULL,
        browser_hash TEXT NOT NULL, next TEXT NOT NULL, expires_at INTEGER NOT NULL);
    CREATE TABLE apple_tokens (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, client_id TEXT NOT NULL, refresh_token_enc BLOB NOT NULL,
        created_at INTEGER NOT NULL);""",
]


DELETE_PAGE = """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Delete your Reroute account</title><meta name="robots" content="index,follow">
<style>:root{color-scheme:light dark;font:17px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}body{max-width:40rem;margin:0 auto;padding:24px 16px 64px}
h1{font-size:1.6rem;line-height:1.2}h2{font-size:1.15rem;margin-top:2rem}a{color:inherit}code{font-size:.9em}</style></head>
<body><main>
<h1>Delete your Reroute account and data</h1>
<p>Reroute is a Brisbane trip planner. You never need an account to use it. This page is for people who made one (with Google or Apple) and want it gone.</p>
<h2>Delete it yourself, in the app (fastest)</h2>
<ol><li>Open Reroute and sign in if you are not already (deleting needs a sign-in from the last 10 minutes).</li>
<li>Open the menu in the top corner and choose your name, which opens the <a href="/account">Account</a> page.</li>
<li>Choose <strong>Delete my account</strong>, then confirm. If you want a copy first, choose <strong>Download my data</strong>.</li></ol>
<p>Deletion is immediate and cannot be undone.</p>
<h2>What is deleted</h2>
<ul><li>Your account record: name, email address and the Google or Apple identifier.</li>
<li>Every signed-in session on every device.</li>
<li>Everything synced to your account: settings, saved places and trip history.</li>
<li>If you used Sign in with Apple, we also ask Apple to revoke Reroute&#8217;s access to your Apple ID.</li></ul>
<h2>What stays</h2>
<p>Data kept only on your own device (in the browser or app) is not on our server; clear it in your browser or by uninstalling the app. Rides you posted to the community ride board are not linked to your account. Server logs that do not name you are rotated out by the host.</p>
<h2>Cannot sign in?</h2>
<p>Email <a href="mailto:privacy@reroute.invalid">privacy@reroute.invalid</a> from the address on the account and ask for it to be deleted. We will delete it within 30 days. <!-- TODO: replace privacy@reroute.invalid with the real contact address before launch. --></p>
<p><a href="/privacy">Privacy</a> &middot; <a href="/terms">Terms</a> &middot; <a href="/">Back to Reroute</a></p>
</main></body></html>"""


class AuthError(Exception):
    """A sign-in that must be refused. `code` is one of the short strings the page shows; the details are logged, never sent."""

    def __init__(self, code="failed", detail=""):
        super().__init__(detail or code)
        self.code = code


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def safe_next(value):
    """A same-site path (with optional query) or "/". Rejects absolute URLs, //host, backslashes and control characters."""
    if not isinstance(value, str) or not value.startswith("/") or value.startswith("//") or len(value) > 200:
        return "/"
    if "\\" in value or any(ord(char) < 32 or ord(char) == 127 for char in value):
        return "/"
    parts = urlsplit(value)
    if parts.scheme or parts.netloc:
        return "/"
    return urlunsplit(("", "", parts.path, parts.query, ""))


def clean_text(value, limit):
    text = " ".join(str(value or "").split())
    return "".join(char for char in text if ord(char) >= 32)[:limit] or None


def clean_email(value):
    email = str(value or "").strip()[:254]
    return email if re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email) else None


def truthy(value):
    return value is True or str(value).lower() == "true"  # Apple sends email_verified as the string "true"


class Http:
    """The only code that touches the network (discovery, key sets, token exchange, revocation); tests replace it."""

    timeout = 10

    def get_json(self, url):
        reply = requests.get(url, timeout=self.timeout)
        reply.raise_for_status()
        return reply.json()

    def exchange(self, token_url, client_id, client_secret, code, verifier, redirect_uri):
        session = OAuth2Session(client_id, client_secret, token_endpoint_auth_method="client_secret_post", redirect_uri=redirect_uri or None)
        try:
            return dict(session.fetch_token(token_url, code=code, timeout=self.timeout, **({"code_verifier": verifier} if verifier else {})))
        finally:
            session.close()

    def revoke(self, url, data):
        reply = requests.post(url, data=data, timeout=self.timeout)
        return reply.status_code == 200


class Provider:
    """One OpenID Connect provider: builds the sign-in URL, exchanges the code and verifies ID tokens (web and native)."""

    def __init__(self, name, discovery, issuers, scope, web_client, native_clients, secret, http, clock, extra=None):
        self.name, self.discovery, self.issuers, self.scope = name, discovery, issuers, scope
        self.web_client, self.native_clients, self.secret = web_client, native_clients, secret
        self.http, self.clock, self.extra = http, clock, extra or {}
        self._meta = self._keys = None
        self._meta_at = self._keys_at = 0.0
        self._lock = threading.RLock()  # keys() calls meta() while holding it

    @property
    def web_enabled(self):
        return bool(self.web_client and self.secret)

    @property
    def audiences(self):
        return [item for item in [self.web_client, *self.native_clients] if item]

    def meta(self):
        with self._lock:
            if not self._meta or self.clock() - self._meta_at > 86400:
                self._meta, self._meta_at = self.http.get_json(self.discovery), self.clock()
            return self._meta

    def keys(self, refresh=False):
        with self._lock:
            if refresh and self._keys and self.clock() - self._keys_at < 60:  # at most one forced fetch a minute
                refresh = False
            if not self._keys or refresh or self.clock() - self._keys_at > 3600:
                self._keys, self._keys_at = KeySet.import_key_set(self.http.get_json(self.meta()["jwks_uri"])), self.clock()
            return self._keys

    def authorize_url(self, redirect_uri, state, nonce, verifier):
        session = OAuth2Session(self.web_client, scope=self.scope, redirect_uri=redirect_uri, code_challenge_method="S256")
        url, _ = session.create_authorization_url(self.meta()["authorization_endpoint"], state=state, nonce=nonce, code_verifier=verifier, **self.extra)
        return url

    def exchange(self, code, verifier, redirect_uri, client_id=None):
        client_id = client_id or self.web_client
        return self.http.exchange(self.meta()["token_endpoint"], client_id, self.secret(client_id), code, verifier, redirect_uri)

    def verify(self, id_token, audiences=None, nonce=None, native=False):
        """The ID token's claims after checking signature, issuer, audience, expiry and nonce, else AuthError."""
        if not isinstance(id_token, str) or not 20 < len(id_token) < 8192:
            raise AuthError("failed", "malformed id_token")
        try:
            try:
                token = jwt.decode(id_token, self.keys(), algorithms=ALGS)
            except JoseError:  # an unknown kid usually means the provider rotated its keys
                token = jwt.decode(id_token, self.keys(refresh=True), algorithms=ALGS)
            now = lambda: int(self.clock())  # noqa: E731
            jwt.JWTClaimsRegistry(now=now, leeway=60, iss={"essential": True, "values": self.issuers}, sub={"essential": True},
                                  aud={"essential": True, "values": audiences or self.audiences}, exp={"essential": True}).validate(token.claims)
        except (JoseError, ValueError, KeyError, requests.RequestException) as error:
            raise AuthError("failed", f"{self.name} id_token rejected: {type(error).__name__}") from error
        claims = token.claims
        got = claims.get("nonce")
        if not nonce or not isinstance(got, str) or not any(hmac.compare_digest(got, wanted) for wanted in ([nonce, digest(nonce)] if native else [nonce])):
            raise AuthError("failed", f"{self.name} nonce mismatch")
        if not isinstance(claims.get("sub"), str) or not claims["sub"] or len(claims["sub"]) > 255:
            raise AuthError("failed", "bad subject")
        return claims


def apple_secret(team, key_id, pem, clock):
    """Apple's client secret: a short-lived ES256 JWT signed with the team's Sign in with Apple key."""
    def make(client_id):
        now = int(clock())
        key = ECKey.import_key(pem() if callable(pem) else pem)
        header = {"alg": "ES256", "kid": key_id}
        return jwt.encode(header, {"iss": team, "iat": now, "exp": now + 600, "aud": "https://appleid.apple.com", "sub": client_id}, key, algorithms=["ES256"])
    return make


class Accounts:
    """The database, the providers and the sign-in logic. Routes are in `blueprint()`."""

    def __init__(self, data_dir, public_url=None, trusted_proxy=False, limiter=None, client=None, clock=time.time, http=None, env=None):
        env = os.environ if env is None else env
        self.clock, self.http = clock, http or Http()
        self.dev = env.get("PLANB_DEV") == "1"
        self.public_url = (public_url or "").rstrip("/") or None
        self.secure = bool(self.public_url and self.public_url.startswith("https://")) or bool(trusted_proxy)
        self.limiter, self.client = limiter, client or (lambda: (request.remote_addr or "", False))
        self.env, self.path = env, Path(data_dir) / "accounts.db"
        self.providers, self.fake = {}, False
        self.secret = self._secret(env.get("ACCOUNTS_SECRET_KEY", ""))
        self.enabled = self.secret is not None
        self._seen, self._seen_lock = {}, threading.Lock()
        self.on_delete = []  # callables(user_id) run after an account is deleted (e.g. native push tokens)
        if not self.enabled:
            return
        self.fernet = Fernet(base64.urlsafe_b64encode(HKDF(hashes.SHA256(), 32, None, b"planb apple refresh token").derive(self.secret)))
        self.fake = self.dev and env.get("ACCOUNTS_FAKE_PROVIDER") == "1"
        self._providers(env)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._migrate()

    # ── Configuration ───────────────────────────────────────────────────────

    def _secret(self, value):
        value = value.strip()
        if len(value) >= 32:
            return value.encode()
        if self.dev and not value:
            log.warning("ACCOUNTS_SECRET_KEY is not set: using a random key for this process (PLANB_DEV=1 only).")
            return secrets.token_bytes(32)
        log.error("Accounts are DISABLED: set ACCOUNTS_SECRET_KEY to a random string of at least 32 characters." if not value else
                  "Accounts are DISABLED: ACCOUNTS_SECRET_KEY must be at least 32 characters.")
        return None

    def _providers(self, env):
        listed = lambda name: [item.strip() for item in env.get(name, "").split(",") if item.strip()]  # noqa: E731
        google_id, google_secret = env.get("GOOGLE_CLIENT_ID", "").strip(), env.get("GOOGLE_CLIENT_SECRET", "").strip()
        native = listed("GOOGLE_IOS_CLIENT_ID") + listed("GOOGLE_ANDROID_CLIENT_ID")
        if google_id or native:
            self.providers["google"] = Provider(
                "google", "https://accounts.google.com/.well-known/openid-configuration", ["https://accounts.google.com", "accounts.google.com"],
                "openid email profile", google_id if google_secret else None, ([google_id] if google_id else []) + native, lambda _client: google_secret,
                self.http, self.clock, {"prompt": "select_account"})
        team, key_id, client = (env.get(name, "").strip() for name in ("APPLE_TEAM_ID", "APPLE_KEY_ID", "APPLE_CLIENT_ID"))
        bundle = listed("APPLE_BUNDLE_ID")
        if team and key_id and (client or bundle) and (env.get("APPLE_PRIVATE_KEY") or env.get("APPLE_PRIVATE_KEY_FILE")):
            self.providers["apple"] = Provider(
                "apple", "https://appleid.apple.com/.well-known/openid-configuration", ["https://appleid.apple.com"], "name email", client or None,
                ([client] if client else []) + bundle, apple_secret(team, key_id, self._apple_pem, self.clock), self.http, self.clock, {"response_mode": "form_post"})
        if not self.public_url and not self.dev and any(p.web_enabled for p in self.providers.values()):
            log.error("PUBLIC_URL is not set, so the web sign-in redirect URI is unknown: web sign-in is disabled.")

    def _apple_pem(self):
        path = self.env.get("APPLE_PRIVATE_KEY_FILE", "").strip()
        pem = Path(path).read_text(encoding="utf-8") if path else self.env.get("APPLE_PRIVATE_KEY", "")
        return pem.replace("\\n", "\n").encode()

    def web_ready(self, name):
        return self.enabled and (name == "fake" and self.fake or name in self.providers and self.providers[name].web_enabled and bool(self.public_url or self.dev))

    def native_ready(self, name):
        return self.enabled and name in self.providers and bool(self.providers[name].audiences)

    def redirect_uri(self, name):
        return f"{self.public_url or request.url_root.rstrip('/')}/auth/{name}/callback"

    # ── Database ────────────────────────────────────────────────────────────

    def db(self):
        conn = sqlite3.connect(self.path, timeout=10)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def _migrate(self):
        with closing(self.db()) as conn, conn:
            conn.execute("PRAGMA journal_mode = WAL")
            conn.execute("CREATE TABLE IF NOT EXISTS migrations (version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL)")
            done = {row[0] for row in conn.execute("SELECT version FROM migrations")}
            for version, script in enumerate(SCHEMA, 1):
                if version not in done:
                    conn.executescript(script)
                    conn.execute("INSERT INTO migrations VALUES (?, ?)", (version, int(self.clock())))

    # ── Sessions ────────────────────────────────────────────────────────────

    def csrf_for(self, id_hash):
        return hmac.new(self.secret, b"csrf:" + id_hash.encode(), hashlib.sha256).hexdigest()

    def new_session(self, user_id, kind, provider):
        """A fresh session (never re-using an old id). Returns (token for the cookie or bearer header, expiry)."""
        token, now = secrets.token_urlsafe(32), int(self.clock())
        with closing(self.db()) as conn, conn:
            conn.execute("DELETE FROM sessions WHERE expires_at < ?", (now,))
            conn.execute("INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?, ?, ?)", (digest(token), user_id, kind, provider, now, now, now + SESSION_DAYS * 86400, now))
        return token, now + SESSION_DAYS * 86400

    def load_session(self, token):
        """The (session, user) rows for a token, extending the rolling expiry; None when unknown or expired."""
        if not token or len(token) > 100:
            return None
        now, key = int(self.clock()), digest(token)
        with closing(self.db()) as conn, conn:
            row = conn.execute("SELECT s.*, u.display_name, u.email, u.email_verified FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id_hash = ?", (key,)).fetchone()
            if not row:
                return None
            if row["expires_at"] <= now:
                conn.execute("DELETE FROM sessions WHERE id_hash = ?", (key,))
                return None
            renewed = now - row["last_seen"] >= TOUCH_SECONDS
            if renewed:
                conn.execute("UPDATE sessions SET last_seen = ?, expires_at = ? WHERE id_hash = ?", (now, now + SESSION_DAYS * 86400, key))
        return dict(row), renewed

    # ── Users ───────────────────────────────────────────────────────────────

    def login(self, provider, subject, email, verified, name):
        """Find or create the user for a verified provider identity. Linked by email only when both sides are verified."""
        now = int(self.clock())
        with closing(self.db()) as conn, conn:
            row = conn.execute("SELECT user_id FROM identities WHERE provider = ? AND subject = ?", (provider, subject)).fetchone()
            if row:
                user_id = row["user_id"]
                conn.execute("UPDATE identities SET last_login = ?, email = COALESCE(?, email) WHERE provider = ? AND subject = ?", (now, email, provider, subject))
                conn.execute("UPDATE users SET display_name = COALESCE(display_name, ?), email = COALESCE(email, ?), email_verified = MAX(email_verified, ?) "
                             "WHERE id = ?", (name, email, int(verified), user_id))
                return user_id
            found = conn.execute("SELECT id FROM users WHERE email = ? AND email_verified = 1", (email,)).fetchone() if email and verified else None
            user_id = found["id"] if found else "u_" + secrets.token_urlsafe(16)
            if not found:
                conn.execute("INSERT INTO users (id, created_at, display_name, email, email_verified) VALUES (?, ?, ?, ?, ?)", (user_id, now, name, email, int(verified)))
            conn.execute("INSERT INTO identities VALUES (?, ?, ?, ?, ?, ?)", (provider, subject, user_id, email, now, now))
            return user_id

    def finish(self, provider, claims, hint_name=None, kind="web", code_tokens=None):
        """Turn verified ID-token claims into a user and a session. Returns (user_id, token, expiry)."""
        email = clean_email(claims.get("email"))
        verified = bool(email) and truthy(claims.get("email_verified"))
        user_id = self.login(provider, claims["sub"], email, verified, clean_text(claims.get("name") or hint_name, 80))
        if code_tokens and code_tokens.get("refresh_token") and provider == "apple":
            self.keep_apple_token(user_id, code_tokens["client_id"], code_tokens["refresh_token"])
        token, expiry = self.new_session(user_id, kind, provider)
        log.info("sign-in provider=%s user=%s kind=%s", provider, user_id, kind)
        return user_id, token, expiry

    def keep_apple_token(self, user_id, client_id, refresh_token):
        """Apple requires revoking its tokens when an account is deleted, so this is the one provider token kept (encrypted)."""
        with closing(self.db()) as conn, conn:
            conn.execute("INSERT OR REPLACE INTO apple_tokens VALUES (?, ?, ?, ?)", (user_id, client_id, self.fernet.encrypt(refresh_token.encode()), int(self.clock())))

    def revoke_apple(self, user_id):
        """True when there is nothing to revoke or Apple confirmed the revocation."""
        with closing(self.db()) as conn:
            row = conn.execute("SELECT client_id, refresh_token_enc FROM apple_tokens WHERE user_id = ?", (user_id,)).fetchone()
        if not row:
            return True
        provider = self.providers.get("apple")
        if not provider:
            return False
        try:
            data = {"client_id": row["client_id"], "client_secret": provider.secret(row["client_id"]), "token": self.fernet.decrypt(row["refresh_token_enc"]).decode(),
                    "token_type_hint": "refresh_token"}
            return bool(self.http.revoke("https://appleid.apple.com/auth/revoke", data))
        except Exception:  # never log the exception text: it could carry the token
            log.error("Apple token revocation failed for user=%s", user_id)
            return False

    def delete_user(self, user_id):
        with closing(self.db()) as conn, conn:
            counts = {"identities": conn.execute("SELECT COUNT(*) FROM identities WHERE user_id = ?", (user_id,)).fetchone()[0],
                      "sessions": conn.execute("SELECT COUNT(*) FROM sessions WHERE user_id = ?", (user_id,)).fetchone()[0],
                      "data_keys": conn.execute("SELECT COUNT(*) FROM user_data WHERE user_id = ?", (user_id,)).fetchone()[0]}
            conn.execute("DELETE FROM users WHERE id = ?", (user_id,))  # the other tables cascade
        for hook in self.on_delete:
            try:
                counts["push_tokens"] = hook(user_id)
            except Exception:
                log.error("account delete hook failed user=%s", user_id)
        log.info("account deleted user=%s", user_id)
        return counts

    def request_user(self, req):
        """The signed-in user id for a Flask request (bearer token or session cookie), else None."""
        if not self.enabled:
            return None
        bearer = req.headers.get("Authorization", "")
        token = bearer[7:].strip() if bearer.lower().startswith("bearer ") else req.cookies.get("__Host-planb_session" if self.secure else "planb_session")
        found = self.load_session(token)
        return found[0]["user_id"] if found else None

    def seen_before(self, id_token, exp):
        """Native ID tokens are single-use: remember each for as long as it could still verify."""
        key, now = digest(id_token), self.clock()
        with self._seen_lock:
            self._seen = {k: v for k, v in self._seen.items() if v > now}
            if key in self._seen:
                return True
            self._seen[key] = (exp if isinstance(exp, (int, float)) else now) + 120
            return False

    # ── Synced data ─────────────────────────────────────────────────────────

    def data_rows(self, user_id):
        with closing(self.db()) as conn:
            return {row["key"]: {"value": json.loads(row["json"]), "version": row["version"], "updated_at": row["updated_at"]}
                    for row in conn.execute("SELECT key, json, version, updated_at FROM user_data WHERE user_id = ?", (user_id,))}

    def put(self, user_id, key, value, base, now=None):
        """Store `value` if `base` is the version the server holds. Returns (ok, current row)."""
        text = json.dumps(value, separators=(",", ":"), ensure_ascii=False)
        if len(text.encode()) > MAX_VALUE:
            raise ValueError("That value is too large to sync.")
        now = int(now if now is not None else self.clock())
        with closing(self.db()) as conn, conn:
            row = conn.execute("SELECT version, json, updated_at FROM user_data WHERE user_id = ? AND key = ?", (user_id, key)).fetchone()
            have = row["version"] if row else 0
            if have != base:
                return False, {"value": json.loads(row["json"]), "version": have, "updated_at": row["updated_at"]}
            total, count = conn.execute("SELECT COALESCE(SUM(LENGTH(json)), 0), COUNT(*) FROM user_data WHERE user_id = ? AND key != ?", (user_id, key)).fetchone()
            if total + len(text.encode()) > MAX_TOTAL or (not row and count >= MAX_KEYS):
                raise ValueError("Your synced data is at its size limit.")
            conn.execute("INSERT OR REPLACE INTO user_data VALUES (?, ?, ?, ?, ?)", (user_id, key, text, have + 1, now))
            return True, {"value": value, "version": have + 1, "updated_at": now}

    def merge(self, user_id, local):
        """Guest-to-account merge, newest wins per key; the answer says what happened to every key and never hides a replacement."""
        server, now, report = self.data_rows(user_id), int(self.clock()), {}
        for key, item in local.items():
            stamp = item.get("updated_at")
            stamp = int(stamp / 1000 if isinstance(stamp, (int, float)) and stamp > 10**11 else stamp) if isinstance(stamp, (int, float)) and stamp > 0 else 0
            stamp = min(stamp, now)
            have = server.get(key)
            if have and have["updated_at"] >= stamp:
                report[key] = {"action": "kept_server", **have}
            else:
                ok, row = self.put(user_id, key, item["value"], have["version"] if have else 0, now=max(stamp, 1))
                report[key] = {"action": "replaced_server" if have else "uploaded", **row, **({"previous": have} if have else {})}
        for key, have in server.items():
            report.setdefault(key, {"action": "server_only", **have})
        return report


def blueprint(acct, limits=None):
    """The routes. `limits` maps a bucket name to its per-IP hourly allowance."""
    bp = Blueprint("accounts", __name__)
    limits = {"auth": 60, "native": 30, "write": 600, "delete": 5, **(limits or {})}
    cookie = "__Host-planb_session" if acct.secure else "planb_session"
    pre_cookie = "planb_pre"

    def reply(value, status=200):
        response = jsonify(value)
        response.status_code = status
        response.headers["Cache-Control"] = "no-store"
        return response

    def fail(message, status, **extra):
        return reply({"error": message, **extra}, status)

    def limited(bucket):
        address, local = acct.client()
        if local or not acct.limiter:
            return None
        allowed, wait = acct.limiter.allow("acct-" + bucket, address, limits[bucket])
        if allowed:
            return None
        response = fail(f"Too many attempts. Try again in about {max(1, wait // 60)} minute(s).", 429)
        response.headers["Retry-After"] = str(wait)
        return response

    def set_session_cookie(response, token, expiry):
        response.set_cookie(cookie, token, max_age=max(1, expiry - int(acct.clock())), httponly=True, secure=acct.secure, samesite="Lax", path="/")

    def current():
        """(session row, user row) for the cookie or bearer token on this request, else None. Cached for the request."""
        if "acct" not in g:
            g.acct, bearer = None, request.headers.get("Authorization", "")
            via = "bearer" if bearer.lower().startswith("bearer ") else "cookie"
            token = bearer[7:].strip() if via == "bearer" else request.cookies.get(cookie)
            found = acct.load_session(token) if acct.enabled else None
            if found:
                g.acct, g.acct_via, g.acct_token = found[0], via, token
                if found[1] and via == "cookie":
                    g.acct_renew = int(acct.clock()) + SESSION_DAYS * 86400
        return g.acct

    # The native app's origins (capacitor://localhost, https://localhost) are the same list security.py uses for CORS.
    native_origins = {item.strip().rstrip("/").lower() for item in acct.env.get("PLANB_CORS_ORIGINS", "").split(",") if item.strip()}

    def origin_ok():
        origin = request.headers.get("Origin")
        if not origin or origin.rstrip("/").lower() in native_origins:
            return True
        allowed = {request.host.lower()}
        if acct.public_url:
            allowed.add(urlsplit(acct.public_url).netloc.lower())
        return urlsplit(origin).netloc.lower() in allowed

    def body(limit):
        if request.mimetype != "application/json":
            raise ValueError("Send the request as JSON.")
        if not origin_ok():
            raise PermissionError("Requests must come from this app.")
        data = request.get_data(cache=False)
        if not 0 < len(data) <= limit:
            raise ValueError("The request is too large or empty.")
        value = json.loads(data)
        if not isinstance(value, dict):
            raise ValueError("Send a JSON object.")
        return value

    def private(handler=None, write=True, size=8192, bucket=None):
        """A signed-in route: 503 when accounts are off, 401 without a session, CSRF checked for cookie-authenticated writes."""
        def wrap(handler):
            def view(**kwargs):
                if not acct.enabled:
                    return fail("Accounts are not available on this server.", 503)
                session = current()
                if not session:
                    return fail("Sign in first.", 401)
                if write and g.acct_via == "cookie":
                    expected = acct.csrf_for(session["id_hash"])
                    if not hmac.compare_digest(request.headers.get("X-CSRF-Token", "").encode(), expected.encode()):
                        return fail("Reload the page and try again.", 403)
                blocked = limited(bucket) if bucket else None
                if blocked:
                    return blocked
                try:
                    return handler(session, body(size) if write and request.method != "DELETE" and size else None, **kwargs)
                except PermissionError as error:
                    return fail(str(error), 403)
                except (ValueError, KeyError, TypeError, AttributeError) as error:
                    return fail(str(error) if isinstance(error, ValueError) else "Enter a valid request.", 400)
            view.__name__ = handler.__name__
            return view
        return wrap(handler) if handler else wrap

    def user_json(session):
        with closing(acct.db()) as conn:
            ids = [dict(r) for r in conn.execute("SELECT provider, email, created_at, last_login FROM identities WHERE user_id = ? ORDER BY last_login DESC", (session["user_id"],))]
        return {"id": session["user_id"], "display_name": session["display_name"], "email": session["email"], "email_verified": bool(session["email_verified"]),
                "provider": session["provider"], "identities": [i["provider"] for i in ids], "signed_in_at": session["auth_at"], "last_login": ids[0]["last_login"] if ids else None}

    @bp.after_request
    def finish(response):
        response.headers.setdefault("Cache-Control", "no-store")
        response.headers["Vary"] = "Cookie"
        if g.get("acct_renew") and cookie not in response.headers.get("Set-Cookie", ""):
            set_session_cookie(response, g.acct_token, g.acct_renew)
        return response

    # ── Public information ──────────────────────────────────────────────────

    @bp.get("/api/auth/providers")
    def providers():
        names = {name: acct.web_ready(name) for name in ("google", "apple")}
        if acct.fake:
            names["fake"] = True
        native = {name: acct.native_ready(name) for name in ("google", "apple")}
        first = lambda key: acct.env.get(key, "").split(",")[0].strip()  # client IDs are public (they appear in the sign-in URL)
        config = {"google": {"web_client_id": acct.providers["google"].web_client or "", "ios_client_id": first("GOOGLE_IOS_CLIENT_ID")}} if native["google"] else {}
        return reply({"enabled": acct.enabled, "providers": names, "native": native, "native_config": config})

    @bp.get("/api/me")
    def me():
        session = current()
        if not session:
            return reply({"signed_in": False, "enabled": acct.enabled})
        return reply({"signed_in": True, "enabled": True, "user": user_json(session), "csrf": acct.csrf_for(session["id_hash"]),
                      "reauth_required": int(acct.clock()) - session["auth_at"] > REAUTH_SECONDS})

    @bp.get("/account/delete")
    def delete_page():  # public and script-free: Google Play needs a web address that explains account deletion
        return Response(DELETE_PAGE, mimetype="text/html", headers={"Cache-Control": "public, max-age=3600"})

    @bp.get("/.well-known/<name>")
    def well_known(name):
        entry = WELL_KNOWN.get(name)
        text = acct.env.get(entry[0], "") if entry else ""
        file = acct.env.get(entry[0] + "_FILE", "") if entry else ""
        if file:
            try:
                text = Path(file).read_text(encoding="utf-8")
            except OSError:
                text = ""
        if not text.strip():
            return Response("Not found.", 404, mimetype="text/plain")
        return Response(text.replace("\\n", "\n") if entry[1].startswith("text/plain") else text, mimetype=entry[1].split(";")[0], headers={"Cache-Control": "public, max-age=3600"})

    # ── Web sign-in (full-page redirects) ───────────────────────────────────

    def back(next_path, **params):
        parts = urlsplit(safe_next(next_path))
        query = parse_qsl(parts.query) + list(params.items())
        response = Response(status=303)
        response.headers["Location"] = urlunsplit(("", "", parts.path, urlencode(query), ""))
        return response

    @bp.get("/auth/<name>/login")
    def start(name):
        next_path = safe_next(request.args.get("next", "/"))
        if not acct.web_ready(name):
            return back(next_path, auth_error="disabled")
        blocked = limited("auth")
        if blocked:
            return back(next_path, auth_error="busy")
        if name == "fake":
            return fake_login(next_path)
        state, nonce, verifier, browser = (generate_token(32), generate_token(32), generate_token(64), secrets.token_urlsafe(32))
        try:
            url = acct.providers[name].authorize_url(acct.redirect_uri(name), state, nonce, verifier)
        except Exception:
            log.exception("could not start %s sign-in", name)
            return back(next_path, auth_error="failed")
        now = int(acct.clock())
        with closing(acct.db()) as conn, conn:
            conn.execute("DELETE FROM pending_auth WHERE expires_at < ?", (now,))
            conn.execute("INSERT INTO pending_auth VALUES (?, ?, ?, ?, ?, ?, ?)", (digest(state), name, nonce, verifier, digest(browser), next_path, now + PENDING_SECONDS))
        response = Response(status=303)
        response.headers["Location"] = url
        # Apple answers with a cross-site POST, which only carries a SameSite=None cookie; the sign-in state itself lives on the server.
        response.set_cookie(pre_cookie, browser, max_age=PENDING_SECONDS, httponly=True, secure=acct.secure, path="/auth/",
                            samesite="None" if name == "apple" and acct.secure else "Lax")
        return response

    def fake_login(next_path):  # development only: no provider, no network
        subject = re.sub(r"[^a-z0-9._-]", "", request.args.get("sub", "dev-user").lower())[:40] or "dev-user"
        claims = {"sub": subject, "email": request.args.get("email", f"{subject}@example.test"), "email_verified": True, "name": request.args.get("name", "Dev User")}
        _, token, expiry = acct.finish("fake", claims)
        response = back(next_path, signed_in="1")
        set_session_cookie(response, token, expiry)
        return response

    @bp.route("/auth/<name>/callback", methods=["GET", "POST"])
    def callback(name):
        params = request.form if request.method == "POST" else request.args
        if name not in ("google", "apple"):
            return fail("Not found.", 404)
        state = params.get("state", "")
        pending = None
        if isinstance(state, str) and 0 < len(state) <= 200:
            with closing(acct.db()) as conn, conn:  # one use: the row is gone before anything else happens
                pending = conn.execute("SELECT * FROM pending_auth WHERE state_hash = ?", (digest(state),)).fetchone()
                conn.execute("DELETE FROM pending_auth WHERE state_hash = ?", (digest(state),))
        next_path = pending["next"] if pending else "/"
        response = None
        try:
            if limited("auth"):
                raise AuthError("busy")
            if not pending or pending["provider"] != name or pending["expires_at"] < acct.clock() or not acct.web_ready(name):
                raise AuthError("expired", "unknown, replayed or expired state")
            if not hmac.compare_digest(digest(request.cookies.get(pre_cookie, "")), pending["browser_hash"]):
                raise AuthError("failed", "sign-in was started in another browser")
            if params.get("error"):
                raise AuthError("cancelled")
            code = params.get("code", "")
            if not isinstance(code, str) or not 0 < len(code) <= 2048:
                raise AuthError("failed", "no code")
            provider = acct.providers[name]
            try:
                tokens = provider.exchange(code, pending["verifier"], acct.redirect_uri(name))
            except Exception as error:  # the provider's error text can echo the code, so only the type is logged
                raise AuthError("failed", f"token exchange failed: {type(error).__name__}") from error
            claims = provider.verify(tokens.get("id_token"), [provider.web_client], pending["nonce"])
            hint = None
            if name == "apple":  # the name arrives once, in the first POST only
                try:
                    given = json.loads(params.get("user", "{}") or "{}").get("name", {})
                    hint = " ".join(filter(None, [clean_text(given.get("firstName"), 40), clean_text(given.get("lastName"), 40)])) or None
                except (ValueError, AttributeError):
                    hint = None
            _, token, expiry = acct.finish(name, claims, hint, code_tokens={"client_id": provider.web_client, "refresh_token": tokens.get("refresh_token")})
            response = back(next_path, signed_in="1")
            set_session_cookie(response, token, expiry)
        except AuthError as error:
            log.warning("sign-in refused provider=%s: %s", name, error)
            response = back(next_path, auth_error=error.code)
        response.delete_cookie(pre_cookie, path="/auth/")
        return response

    # ── Native sign-in (ID token from the platform SDK) ─────────────────────

    @bp.post("/auth/native/<name>")
    def native(name):
        if not acct.native_ready(name):
            return fail("This sign-in is not available.", 404)
        blocked = limited("native")
        if blocked:
            return blocked
        try:
            data = body(16384)
            provider = acct.providers[name]
            nonce = data.get("nonce")
            if not isinstance(nonce, str) or not 16 <= len(nonce) <= 256:
                raise ValueError("Send the nonce used for the sign-in.")
            claims = provider.verify(data.get("id_token"), provider.audiences, nonce, native=True)
            if acct.seen_before(data["id_token"], claims.get("exp")):
                raise AuthError("failed", "id_token already used")
            tokens = None
            if name == "apple" and isinstance(data.get("authorization_code"), str):  # lets the server revoke later
                client = claims["aud"] if isinstance(claims["aud"], str) else claims["aud"][0]
                got = provider.exchange(data["authorization_code"][:2048], "", "", client_id=client)
                tokens = {"client_id": client, "refresh_token": got.get("refresh_token")}
            _, token, expiry = acct.finish(name, claims, kind="native", code_tokens=tokens)
        except AuthError as error:
            log.warning("native sign-in refused provider=%s: %s", name, error)
            return fail("Sign-in could not be verified.", 401)
        except PermissionError as error:
            return fail(str(error), 403)
        except (ValueError, TypeError) as error:
            return fail(str(error) if isinstance(error, ValueError) else "Enter a valid request.", 400)
        except Exception as error:
            log.error("native sign-in failed provider=%s: %s", name, type(error).__name__)
            return fail("Sign-in could not be verified.", 502)
        session = acct.load_session(token)[0]
        response = reply({"token": token, "token_type": "Bearer", "expires_at": expiry, "csrf": acct.csrf_for(session["id_hash"]), "user": user_json(session)})
        set_session_cookie(response, token, expiry)
        return response

    @bp.post("/auth/logout")
    def logout():
        session = current()
        if session:
            if g.acct_via == "cookie" and not hmac.compare_digest(request.headers.get("X-CSRF-Token", "").encode(), acct.csrf_for(session["id_hash"]).encode()):
                return fail("Reload the page and try again.", 403)
            with closing(acct.db()) as conn, conn:
                conn.execute("DELETE FROM sessions WHERE id_hash = ?", (session["id_hash"],))
        g.acct_renew = None
        response = reply({"signed_in": False})
        response.delete_cookie(cookie, path="/")
        return response

    # ── Account API ─────────────────────────────────────────────────────────

    @bp.get("/api/account/data")
    @private(write=False)
    def data_all(session, _):
        return reply({"data": acct.data_rows(session["user_id"])})

    @bp.put("/api/account/data/<key>")
    @private(size=MAX_VALUE + 1024, bucket="write")
    def data_put(session, data, key):
        if not KEY_RE.match(key):
            raise ValueError("That data key is not valid.")
        base = data["version"]
        if isinstance(base, bool) or not isinstance(base, int) or base < 0 or "value" not in data:
            raise ValueError("Send the version you last saw and a value.")
        ok, row = acct.put(session["user_id"], key, data["value"], base)
        return reply({"ok": ok, "conflict": not ok, **row}, 200 if ok else 409)

    @bp.post("/api/account/merge")
    @private(size=MAX_TOTAL + 4096, bucket="write")
    def merge(session, data):
        local = data["local"]
        if not isinstance(local, dict) or len(local) > MAX_KEYS or not all(KEY_RE.match(k) and isinstance(v, dict) and "value" in v for k, v in local.items()):
            raise ValueError("Send the data saved on this device.")
        return reply({"merged": acct.merge(session["user_id"], local)})

    @bp.get("/api/account/export")
    @private(write=False)
    def export(session, _):
        with closing(acct.db()) as conn:
            user = dict(conn.execute("SELECT id, created_at, display_name, email, email_verified FROM users WHERE id = ?", (session["user_id"],)).fetchone())
            identities = [dict(r) for r in conn.execute("SELECT provider, subject, email, created_at, last_login FROM identities WHERE user_id = ?", (session["user_id"],))]
            sessions = [dict(r) for r in conn.execute("SELECT kind, provider, created_at, last_seen, expires_at FROM sessions WHERE user_id = ?", (session["user_id"],))]
        stamp = lambda n: datetime.fromtimestamp(n, timezone.utc).isoformat()  # noqa: E731
        for row in [user, *identities, *sessions]:
            for field in ("created_at", "last_login", "last_seen", "expires_at"):
                if field in row:
                    row[field] = stamp(row[field])
        out = {"exported_at": stamp(acct.clock()), "user": user, "identities": identities, "sessions": sessions,
               "synced_data": {k: {**v, "updated_at": stamp(v["updated_at"])} for k, v in acct.data_rows(session["user_id"]).items()},
               "note": "This is everything Reroute stores about your account. The app's own saved data stays on your device unless you sync it."}
        response = reply(out)
        response.headers["Content-Disposition"] = 'attachment; filename="reroute-account-data.json"'
        return response

    @bp.post("/api/account/delete")
    @private(bucket="delete")
    def delete(session, data):
        if data.get("confirm") != "delete":
            raise ValueError('Send {"confirm": "delete"} to delete the account.')
        if int(acct.clock()) - session["auth_at"] > REAUTH_SECONDS:
            return fail("Sign in again to delete your account.", 401, reauth=True, provider=session["provider"])
        if not acct.revoke_apple(session["user_id"]):
            return fail("Apple could not be reached to revoke access. Nothing was deleted; try again in a few minutes.", 502)
        removed = acct.delete_user(session["user_id"])
        g.acct_renew = None
        response = reply({"deleted": True, "deleted_at": datetime.fromtimestamp(acct.clock(), timezone.utc).isoformat(), "removed": removed})
        response.delete_cookie(cookie, path="/")
        return response

    return bp


def init_accounts(app, data_dir, limiter=None, client=None, public_url=None, trusted_proxy=False, clock=time.time, http=None, env=None, limits=None):
    """Create the Accounts object, register its routes and the security headers. Returns the Accounts object."""
    acct = Accounts(data_dir, public_url, trusted_proxy, limiter, client, clock, http, env)
    app.extensions["accounts"] = acct
    app.register_blueprint(blueprint(acct, limits))

    @app.after_request
    def headers(response):  # only fills gaps: anything a route set itself is kept
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
        if acct.secure:
            response.headers.setdefault("Strict-Transport-Security", "max-age=15552000")
        return response
    return acct
