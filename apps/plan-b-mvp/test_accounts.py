"""Accounts tests: no network. Discovery, key sets, token exchange and revocation are replaced by FakeHttp with locally generated RSA / EC keys."""

from contextlib import closing
import json
import sqlite3
import tempfile
import unittest
from urllib.parse import parse_qs, urlsplit

from flask import Flask
from joserfc import jwt
from joserfc.jwk import ECKey, KeySet, RSAKey

import accounts
from accounts import AuthError, init_accounts, safe_next
from limits import RateLimiter

SECRET = "x" * 40
PUBLIC = "https://reroute.example"
GOOGLE = "https://accounts.google.com"
APPLE = "https://appleid.apple.com"
JSON = {"Content-Type": "application/json"}
APPLE_KEY = ECKey.generate_key("P-256")
APPLE_PEM = APPLE_KEY.as_pem(private=True).decode()
ENV = {"ACCOUNTS_SECRET_KEY": SECRET, "GOOGLE_CLIENT_ID": "g-web", "GOOGLE_CLIENT_SECRET": "s", "GOOGLE_IOS_CLIENT_ID": "g-ios", "GOOGLE_ANDROID_CLIENT_ID": "g-and",
       "APPLE_TEAM_ID": "TEAM123456", "APPLE_KEY_ID": "KEY1234567", "APPLE_CLIENT_ID": "au.example.web", "APPLE_BUNDLE_ID": "au.example.app", "APPLE_PRIVATE_KEY": APPLE_PEM,
       "APPLE_DOMAIN_ASSOCIATION": "apple-domain-token"}


class Clock:
    def __init__(self):
        self.now = 1_800_000_000.0

    def __call__(self):
        return self.now


class FakeHttp:
    def __init__(self):
        self.keys = {GOOGLE: RSAKey.generate_key(2048, parameters={"kid": "g1", "use": "sig"}), APPLE: ECKey.generate_key("P-256", parameters={"kid": "a1", "use": "sig"})}
        self.id_token, self.refresh, self.revoke_ok, self.exchanged, self.revoked = None, "apple-refresh-token", True, [], []

    def get_json(self, url):
        issuer = GOOGLE if "google" in url else APPLE
        if url.endswith("openid-configuration"):
            return {"issuer": issuer, "authorization_endpoint": issuer + "/auth", "token_endpoint": issuer + "/token", "jwks_uri": issuer + "/keys"}
        return KeySet([self.keys[issuer]]).as_dict(private=False)

    def exchange(self, token_url, client_id, client_secret, code, verifier, redirect_uri):
        self.exchanged.append({"url": token_url, "client_id": client_id, "secret": client_secret, "code": code, "verifier": verifier, "redirect_uri": redirect_uri})
        if code == "bad":
            raise RuntimeError("invalid_grant secret-code-text")
        return {"id_token": self.id_token, "refresh_token": self.refresh, "access_token": "a"}

    def revoke(self, url, data):
        self.revoked.append((url, data))
        return self.revoke_ok

    def mint(self, issuer=GOOGLE, now=1_800_000_000, **claims):
        key = self.keys[issuer]
        body = {"iss": issuer, "aud": "g-web", "sub": "1001", "iat": now, "exp": now + 600, "email": "ann@example.com", "email_verified": True, "name": "Ann Lee", **claims}
        return jwt.encode({"alg": "RS256" if issuer == GOOGLE else "ES256", "kid": key.kid}, {k: v for k, v in body.items() if v is not None}, key)


def build(env=None, clock=None, **kwargs):
    clock, http, app = clock or Clock(), FakeHttp(), Flask(__name__)
    acct = init_accounts(app, tempfile.mkdtemp(), limiter=RateLimiter(clock), public_url=PUBLIC, trusted_proxy=True, clock=clock, http=http,
                         env=ENV if env is None else env, **kwargs)
    return app, acct, http, clock


def flow(client, http, provider="google", next_path="/", claims=None, method="GET", extra=None, **mint):
    """Start a sign-in, answer as the provider would, and return (login response, callback response, query the provider received)."""
    login = client.get(f"/auth/{provider}/login", query_string={"next": next_path}, base_url=PUBLIC)
    query = {k: v[0] for k, v in parse_qs(urlsplit(login.headers["Location"]).query).items()}
    issuer = GOOGLE if provider == "google" else APPLE
    http.id_token = http.mint(issuer, **{"nonce": query["nonce"], **({"aud": "au.example.web"} if provider == "apple" else {}), **(claims or {}), **mint})
    data = {"state": query["state"], "code": "good", **(extra or {})}
    sent = client.post(f"/auth/{provider}/callback", data=data, base_url=PUBLIC) if method == "POST" else client.get(f"/auth/{provider}/callback", query_string=data, base_url=PUBLIC)
    return login, sent, query


def signed_in(env=None, **kwargs):
    app, acct, http, clock = build(env, **kwargs)
    client = app.test_client()
    flow(client, http)
    me = client.get("/api/me", base_url=PUBLIC).get_json()
    return app, acct, http, clock, client, {"X-CSRF-Token": me["csrf"], **JSON}


class Providers(unittest.TestCase):
    def test_disabled_without_secret_and_without_credentials(self):
        with self.assertLogs("planb.accounts", "ERROR"):
            app, acct, _, _ = build({"GOOGLE_CLIENT_ID": "x", "GOOGLE_CLIENT_SECRET": "y"})
        client = app.test_client()
        self.assertFalse(client.get("/api/auth/providers").get_json()["enabled"])
        self.assertEqual(client.get("/api/me").get_json(), {"signed_in": False, "enabled": False})
        self.assertEqual(client.post("/auth/logout").status_code, 200)
        self.assertEqual(client.get("/api/account/data").status_code, 503)
        app, *_ = build({"ACCOUNTS_SECRET_KEY": SECRET})
        self.assertEqual(app.test_client().get("/api/auth/providers").get_json()["providers"], {"google": False, "apple": False})

    def test_short_secret_disables_and_dev_generates_a_key(self):
        with self.assertLogs("planb.accounts", "ERROR"):
            self.assertFalse(build({"ACCOUNTS_SECRET_KEY": "short"})[1].enabled)
        with self.assertLogs("planb.accounts", "WARNING"):
            self.assertTrue(build({"PLANB_DEV": "1"})[1].enabled)

    def test_unconfigured_provider_login_redirects_with_error_and_the_fake_one_needs_two_switches(self):
        app, *_ = build({"ACCOUNTS_SECRET_KEY": SECRET, "PLANB_DEV": "1"})
        client = app.test_client()
        for name in ("google", "apple", "fake", "evil"):
            reply = client.get(f"/auth/{name}/login?next=/privacy")
            self.assertEqual(reply.headers["Location"], "/privacy?auth_error=disabled", name)
        app, *_ = build({"ACCOUNTS_SECRET_KEY": SECRET, "PLANB_DEV": "1", "ACCOUNTS_FAKE_PROVIDER": "1"})
        self.assertTrue(app.test_client().get("/api/auth/providers").get_json()["providers"]["fake"])
        app, *_ = build({"ACCOUNTS_SECRET_KEY": SECRET, "ACCOUNTS_FAKE_PROVIDER": "1"})  # not PLANB_DEV: never
        self.assertNotIn("fake", app.test_client().get("/api/auth/providers").get_json()["providers"])

    def test_native_only_provider_has_no_web_button(self):
        app, *_ = build({"ACCOUNTS_SECRET_KEY": SECRET, "GOOGLE_IOS_CLIENT_ID": "g-ios"})
        found = app.test_client().get("/api/auth/providers").get_json()
        self.assertEqual((found["providers"]["google"], found["native"]["google"]), (False, True))


class WebFlow(unittest.TestCase):
    def test_login_redirect_parameters(self):
        app, acct, http, _ = build()
        reply = app.test_client().get("/auth/google/login?next=/privacy", base_url=PUBLIC)
        url = urlsplit(reply.headers["Location"])
        query = {k: v[0] for k, v in parse_qs(url.query).items()}
        self.assertEqual(reply.status_code, 303)
        self.assertEqual(url.netloc + url.path, "accounts.google.com/auth")
        self.assertEqual((query["response_type"], query["client_id"], query["scope"], query["code_challenge_method"]), ("code", "g-web", "openid email profile", "S256"))
        self.assertEqual(query["redirect_uri"], PUBLIC + "/auth/google/callback")
        self.assertGreaterEqual(len(query["state"]), 32)
        self.assertGreaterEqual(len(query["nonce"]), 32)
        with closing(acct.db()) as conn:
            row = conn.execute("SELECT * FROM pending_auth").fetchone()
        from authlib.oauth2.rfc7636 import create_s256_code_challenge
        self.assertEqual(query["code_challenge"], create_s256_code_challenge(row["verifier"]))
        self.assertEqual((row["next"], row["nonce"], row["state_hash"]), ("/privacy", query["nonce"], accounts.digest(query["state"])))
        cookie = reply.headers["Set-Cookie"]
        self.assertIn("HttpOnly", cookie)
        self.assertIn("Secure", cookie)
        self.assertIn("SameSite=Lax", cookie)
        self.assertNotIn(query["state"], cookie)

    def test_callback_success_creates_a_session_and_returns_to_the_start_page(self):
        app, acct, http, _ = build()
        client = app.test_client()
        login, done, _ = flow(client, http, next_path="/privacy?x=1")
        self.assertEqual(done.headers["Location"], "/privacy?x=1&signed_in=1")
        self.assertEqual(http.exchanged[0]["redirect_uri"], PUBLIC + "/auth/google/callback")
        self.assertTrue(http.exchanged[0]["verifier"])
        cookies = [c for c in done.headers.getlist("Set-Cookie") if c.startswith("__Host-planb_session=")]
        self.assertTrue(cookies and "HttpOnly" in cookies[0] and "Secure" in cookies[0] and "SameSite=Lax" in cookies[0] and "Max-Age=2592000" in cookies[0])
        me = client.get("/api/me", base_url=PUBLIC).get_json()
        self.assertEqual((me["signed_in"], me["user"]["display_name"], me["user"]["email"], me["user"]["provider"]), (True, "Ann Lee", "ann@example.com", "google"))
        raw = client.get_cookie("__Host-planb_session", domain="reroute.example").value
        with closing(sqlite3.connect(acct.path)) as conn:  # the token itself is never stored
            self.assertNotIn(raw, "".join(str(v) for row in conn.execute("SELECT * FROM sessions") for v in row))
        self.assertNotIn(raw, done.headers["Location"])

    def test_state_is_single_use_and_bound_to_the_browser(self):
        app, _, http, _ = build()
        client = app.test_client()
        login, first, query = flow(client, http)
        self.assertIn("signed_in=1", first.headers["Location"])
        replay = client.get("/auth/google/callback", query_string={"state": query["state"], "code": "good"}, base_url=PUBLIC)
        self.assertEqual(replay.headers["Location"], "/?auth_error=expired")
        other = app.test_client()  # a different browser finishing a flow it did not start
        login = client.get("/auth/google/login", base_url=PUBLIC)
        state = parse_qs(urlsplit(login.headers["Location"]).query)["state"][0]
        self.assertEqual(other.get("/auth/google/callback", query_string={"state": state, "code": "good"}).headers["Location"], "/?auth_error=failed")
        for params in ({}, {"state": "nope", "code": "x"}):
            self.assertEqual(client.get("/auth/google/callback", query_string=params).headers["Location"], "/?auth_error=expired")

    def test_provider_error_bad_code_wrong_nonce_audience_and_issuer_are_refused(self):
        app, _, http, _ = build()
        client = app.test_client()
        login = client.get("/auth/google/login", base_url=PUBLIC)
        state = parse_qs(urlsplit(login.headers["Location"]).query)["state"][0]
        self.assertEqual(client.get("/auth/google/callback", query_string={"state": state, "error": "access_denied"}, base_url=PUBLIC).headers["Location"], "/?auth_error=cancelled")
        for claims in ({"nonce": "wrong" * 8}, {"aud": "someone-else"}, {"iss": "https://evil.example"}, {"exp": 1_700_000_000}, {"sub": None}):
            with self.assertLogs("planb.accounts", "WARNING"):
                _, done, _ = flow(client, http, claims=claims)
            self.assertEqual(done.headers["Location"], "/?auth_error=failed", claims)
        login = client.get("/auth/google/login", base_url=PUBLIC)
        state = parse_qs(urlsplit(login.headers["Location"]).query)["state"][0]
        with self.assertLogs("planb.accounts", "WARNING") as logs:
            self.assertEqual(client.get("/auth/google/callback", query_string={"state": state, "code": "bad"}, base_url=PUBLIC).headers["Location"], "/?auth_error=failed")
        self.assertNotIn("secret-code-text", "".join(logs.output))
        self.assertFalse(client.get("/api/me", base_url=PUBLIC).get_json()["signed_in"])

    def test_unverified_email_is_not_trusted_for_linking(self):
        app, acct, http, _ = build()
        client = app.test_client()
        flow(client, http, claims={"sub": "a"})
        other = app.test_client()
        flow(other, http, claims={"sub": "b", "email_verified": False})
        flow(app.test_client(), http, claims={"sub": "c"})  # verified, same email as the first: one person, one user
        with closing(acct.db()) as conn:
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM users").fetchone()[0], 2)
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM identities").fetchone()[0], 3)

    def test_apple_form_post_flow(self):
        app, acct, http, _ = build()
        client = app.test_client()
        login = client.get("/auth/apple/login?next=/", base_url=PUBLIC)
        query = {k: v[0] for k, v in parse_qs(urlsplit(login.headers["Location"]).query).items()}
        self.assertEqual((query["response_mode"], query["scope"], query["client_id"], query["code_challenge_method"]), ("form_post", "name email", "au.example.web", "S256"))
        self.assertIn("SameSite=None", login.headers["Set-Cookie"])
        self.assertIn("Secure", login.headers["Set-Cookie"])
        http.id_token = http.mint(APPLE, aud="au.example.web", nonce=query["nonce"], sub="001.apple", email="x1y2@privaterelay.appleid.com", email_verified="true", name=None)
        user = json.dumps({"name": {"firstName": "Bea", "lastName": "Chan"}, "email": "x1y2@privaterelay.appleid.com"})
        done = client.post("/auth/apple/callback", data={"state": query["state"], "code": "good", "user": user}, base_url=PUBLIC)
        self.assertEqual(done.headers["Location"], "/?signed_in=1")
        me = client.get("/api/me", base_url=PUBLIC).get_json()
        self.assertEqual((me["user"]["display_name"], me["user"]["email"], me["user"]["provider"]), ("Bea Chan", "x1y2@privaterelay.appleid.com", "apple"))
        secret = jwt.decode(http.exchanged[0]["secret"], APPLE_KEY, algorithms=["ES256"])  # the client secret is a JWT signed with the team's key
        self.assertEqual((secret.header["kid"], secret.claims["iss"], secret.claims["sub"], secret.claims["aud"]), ("KEY1234567", "TEAM123456", "au.example.web", APPLE))
        self.assertLessEqual(secret.claims["exp"] - secret.claims["iat"], 600)
        with closing(sqlite3.connect(acct.path)) as conn:
            stored = conn.execute("SELECT refresh_token_enc FROM apple_tokens").fetchone()[0]
        self.assertNotIn(b"apple-refresh-token", stored)
        self.assertEqual(acct.fernet.decrypt(stored), b"apple-refresh-token")

    def test_apple_without_the_pre_auth_cookie_is_refused(self):
        app, _, http, _ = build()
        client = app.test_client()
        login = client.get("/auth/apple/login", base_url=PUBLIC)
        state = parse_qs(urlsplit(login.headers["Location"]).query)["state"][0]
        client.delete_cookie("planb_pre", path="/auth/")
        with self.assertLogs("planb.accounts", "WARNING"):
            self.assertEqual(client.post("/auth/apple/callback", data={"state": state, "code": "x"}, base_url=PUBLIC).headers["Location"], "/?auth_error=failed")

    def test_open_redirects_are_rejected(self):
        for bad in ("//evil.example", "https://evil.example/", "/\\evil.example", "javascript:alert(1)", "/ok\nhttps://evil", "evil", "", None, "/" + "a" * 300):
            self.assertEqual(safe_next(bad), "/", bad)
        self.assertEqual(safe_next("/privacy?a=1#frag"), "/privacy?a=1")
        app, _, http, _ = build()
        client = app.test_client()
        _, done, _ = flow(client, http, next_path="//evil.example/steal")
        self.assertEqual(done.headers["Location"], "/?signed_in=1")


class Native(unittest.TestCase):
    def post(self, client, http, provider="google", nonce="n" * 24, claims=None, **extra):
        token = http.mint(GOOGLE if provider == "google" else APPLE, nonce=nonce, **(claims or {}))
        return client.post(f"/auth/native/{provider}", json={"id_token": token, "nonce": nonce, **extra})

    def test_valid_token_gives_a_cookie_and_a_hashed_bearer_token(self):
        app, acct, http, _ = build()
        client = app.test_client()
        reply = self.post(client, http, claims={"aud": "g-ios"})
        data = reply.get_json()
        self.assertEqual((reply.status_code, data["token_type"], data["user"]["email"]), (200, "Bearer", "ann@example.com"))
        self.assertIn("HttpOnly", reply.headers["Set-Cookie"])
        plain = app.test_client()
        self.assertFalse(plain.get("/api/me").get_json()["signed_in"])
        me = plain.get("/api/me", headers={"Authorization": "Bearer " + data["token"]}).get_json()
        self.assertTrue(me["signed_in"])
        with closing(sqlite3.connect(acct.path)) as conn:
            self.assertNotIn(data["token"], "".join(str(v) for row in conn.execute("SELECT * FROM sessions") for v in row))
        put = plain.put("/api/account/data/settings", json={"version": 0, "value": {"a": 1}}, headers={"Authorization": "Bearer " + data["token"]})
        self.assertEqual(put.status_code, 200)  # a bearer token carries no ambient credentials, so no CSRF header is needed

    def test_apple_native_hashed_nonce_and_revocable_authorization_code(self):
        app, acct, http, _ = build()
        client = app.test_client()
        raw = "r" * 30
        reply = client.post("/auth/native/apple", json={"id_token": http.mint(APPLE, aud="au.example.app", nonce=accounts.digest(raw), sub="002"), "nonce": raw,
                                                         "authorization_code": "good"})
        self.assertEqual(reply.status_code, 200)
        self.assertEqual(http.exchanged[0]["client_id"], "au.example.app")
        self.assertEqual(http.exchanged[0]["verifier"], "")

    def test_bad_tokens_are_rejected(self):
        app, _, http, clock = build()
        client = app.test_client()
        cases = [{"aud": "unknown-client"}, {"iss": "https://evil.example"}, {"exp": 1_700_000_000}, {"nonce": "different" * 4}]
        for claims in cases:
            with self.assertLogs("planb.accounts", "WARNING"):
                nonce = "n" * 24
                reply = client.post("/auth/native/google", json={"id_token": http.mint(**{"nonce": nonce, **claims}), "nonce": nonce})
            self.assertEqual(reply.status_code, 401, claims)
        other_key = RSAKey.generate_key(2048, parameters={"kid": "g1"})  # right kid, wrong signature
        forged = jwt.encode({"alg": "RS256", "kid": "g1"}, {"iss": GOOGLE, "aud": "g-web", "sub": "1", "exp": 1_800_000_600, "nonce": "n" * 24}, other_key)
        with self.assertLogs("planb.accounts", "WARNING"):
            self.assertEqual(client.post("/auth/native/google", json={"id_token": forged, "nonce": "n" * 24}).status_code, 401)
        with self.assertLogs("planb.accounts", "WARNING"):
            self.assertEqual(client.post("/auth/native/google", json={"id_token": "x" * 40, "nonce": "n" * 24}).status_code, 401)
        self.assertEqual(client.post("/auth/native/google", json={"id_token": http.mint(), "nonce": "short"}).status_code, 400)
        self.assertEqual(client.post("/auth/native/google", data="x", headers={"Content-Type": "text/plain"}).status_code, 400)
        clock.now += 3600  # an hour later the same token has expired
        with self.assertLogs("planb.accounts", "WARNING"):
            self.assertEqual(client.post("/auth/native/google", json={"id_token": http.mint(nonce="n" * 24, now=1_800_000_000), "nonce": "n" * 24}).status_code, 401)

    def test_a_token_works_once_and_the_endpoint_is_rate_limited(self):
        app, _, http, _ = build(limits={"native": 3})
        client = app.test_client()
        token = http.mint(nonce="n" * 24)
        self.assertEqual(client.post("/auth/native/google", json={"id_token": token, "nonce": "n" * 24}).status_code, 200)
        with self.assertLogs("planb.accounts", "WARNING"):
            self.assertEqual(client.post("/auth/native/google", json={"id_token": token, "nonce": "n" * 24}).status_code, 401)
        self.assertEqual(client.post("/auth/native/google", json={"id_token": http.mint(nonce="m" * 24), "nonce": "m" * 24}).status_code, 200)
        last = client.post("/auth/native/google", json={"id_token": http.mint(nonce="k" * 24), "nonce": "k" * 24})
        self.assertEqual(last.status_code, 429)
        self.assertIn("Retry-After", last.headers)

    def test_unconfigured_native_provider_is_not_found(self):
        app, *_ = build({"ACCOUNTS_SECRET_KEY": SECRET})
        self.assertEqual(app.test_client().post("/auth/native/google", json={}).status_code, 404)


class AccountApi(unittest.TestCase):
    def test_csrf_is_required_for_cookie_writes(self):
        app, _, _, _, client, headers = signed_in()
        body = {"version": 0, "value": 1}
        self.assertEqual(client.put("/api/account/data/settings", json=body, base_url=PUBLIC).status_code, 403)
        self.assertEqual(client.put("/api/account/data/settings", json=body, headers={"X-CSRF-Token": "0" * 64}, base_url=PUBLIC).status_code, 403)
        self.assertEqual(client.put("/api/account/data/settings", json=body, headers={"X-CSRF-Token": headers["X-CSRF-Token"]}, base_url=PUBLIC).status_code, 200)
        self.assertEqual(client.put("/api/account/data/settings", data="{}", headers={**headers, "Content-Type": "text/plain"}, base_url=PUBLIC).status_code, 400)
        self.assertEqual(client.put("/api/account/data/places", json={"version": 0, "value": 1}, headers={**headers, "Origin": "https://evil.example"}, base_url=PUBLIC).status_code, 403)
        self.assertEqual(client.post("/auth/logout", base_url=PUBLIC).status_code, 403)
        self.assertEqual(client.get("/api/me", base_url=PUBLIC).get_json()["signed_in"], True)

    def test_signed_out_requests_are_401(self):
        app, *_ = build()
        client = app.test_client()
        for method, path in (("get", "/api/account/data"), ("get", "/api/account/export"), ("post", "/api/account/delete"), ("put", "/api/account/data/settings"), ("post", "/api/account/merge")):
            self.assertEqual(getattr(client, method)(path).status_code, 401, path)

    def test_data_versions_conflicts_and_limits(self):
        _, _, _, _, client, h = signed_in()
        put = lambda key, version, value: client.put(f"/api/account/data/{key}", json={"version": version, "value": value}, headers=h, base_url=PUBLIC)  # noqa: E731
        self.assertEqual(put("places", 0, [1]).get_json()["version"], 1)
        stale = put("places", 0, [2])
        self.assertEqual((stale.status_code, stale.get_json()["conflict"], stale.get_json()["value"], stale.get_json()["version"]), (409, True, [1], 1))
        self.assertEqual(put("places", 1, [1, 2]).get_json()["version"], 2)
        self.assertEqual(client.get("/api/account/data", base_url=PUBLIC).get_json()["data"]["places"]["value"], [1, 2])
        self.assertEqual(put("Bad Key", 0, 1).status_code, 400)
        self.assertEqual(put("big", 0, "x" * (accounts.MAX_VALUE + 1)).status_code, 400)
        for index in range(accounts.MAX_KEYS - 1):
            self.assertEqual(put(f"k{index}", 0, index).status_code, 200)
        self.assertEqual(put("onetoomany", 0, 1).status_code, 400)

    def test_merge_newest_wins_and_reports_every_key(self):
        _, acct, _, clock, client, h = signed_in()
        client.put("/api/account/data/settings", json={"version": 0, "value": {"from": "server"}}, headers=h, base_url=PUBLIC)
        client.put("/api/account/data/trips", json={"version": 0, "value": ["server"]}, headers=h, base_url=PUBLIC)
        old, new = (clock.now - 86400) * 1000, (clock.now + 5) * 1000
        clock.now += 10  # a device stamp cannot be in the future, so time has to pass for it to be newer than the server copy
        merged = client.post("/api/account/merge", json={"local": {"settings": {"value": {"from": "device"}, "updated_at": old}, "trips": {"value": ["device"], "updated_at": new},
                                                              "places": {"value": ["p"], "updated_at": old}}}, headers=h, base_url=PUBLIC).get_json()["merged"]
        self.assertEqual({k: v["action"] for k, v in merged.items()}, {"settings": "kept_server", "trips": "replaced_server", "places": "uploaded"})
        self.assertEqual(merged["trips"]["previous"]["value"], ["server"])
        self.assertEqual(client.get("/api/account/data", base_url=PUBLIC).get_json()["data"]["settings"]["value"], {"from": "server"})
        self.assertEqual(client.post("/api/account/merge", json={"local": []}, headers=h, base_url=PUBLIC).status_code, 400)

    def test_export_has_everything_and_nothing_secret(self):
        _, _, _, _, client, h = signed_in()
        client.put("/api/account/data/settings", json={"version": 0, "value": {"a": 1}}, headers=h, base_url=PUBLIC)
        reply = client.get("/api/account/export", base_url=PUBLIC)
        self.assertIn("attachment", reply.headers["Content-Disposition"])
        data = reply.get_json()
        self.assertEqual((data["user"]["email"], data["identities"][0]["provider"], data["synced_data"]["settings"]["value"]), ("ann@example.com", "google", {"a": 1}))
        self.assertNotIn(client.get_cookie("__Host-planb_session", domain="reroute.example").value, reply.get_data(as_text=True))

    def test_delete_needs_confirmation_and_a_recent_sign_in_then_removes_everything(self):
        app, acct, http, clock, client, h = signed_in()
        client.put("/api/account/data/settings", json={"version": 0, "value": 1}, headers=h, base_url=PUBLIC)
        self.assertEqual(client.post("/api/account/delete", json={}, headers=h, base_url=PUBLIC).status_code, 400)
        clock.now += 601
        stale = client.post("/api/account/delete", json={"confirm": "delete"}, headers=h, base_url=PUBLIC)
        self.assertEqual((stale.status_code, stale.get_json()["reauth"], stale.get_json()["provider"]), (401, True, "google"))
        self.assertTrue(client.get("/api/me", base_url=PUBLIC).get_json()["reauth_required"])
        flow(client, http)  # signing in again within ten minutes
        h = {"X-CSRF-Token": client.get("/api/me", base_url=PUBLIC).get_json()["csrf"], **JSON}
        done = client.post("/api/account/delete", json={"confirm": "delete"}, headers=h, base_url=PUBLIC)
        self.assertEqual((done.status_code, done.get_json()["deleted"], done.get_json()["removed"]["data_keys"]), (200, True, 1))
        with closing(sqlite3.connect(acct.path)) as conn:
            for table in ("users", "identities", "sessions", "user_data", "apple_tokens"):
                self.assertEqual(conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0], 0, table)
        self.assertFalse(client.get("/api/me", base_url=PUBLIC).get_json()["signed_in"])

    def test_deleting_an_apple_account_revokes_the_token_first(self):
        app, acct, http, clock = build()
        client = app.test_client()
        login = client.get("/auth/apple/login", base_url=PUBLIC)
        query = {k: v[0] for k, v in parse_qs(urlsplit(login.headers["Location"]).query).items()}
        http.id_token = http.mint(APPLE, aud="au.example.web", nonce=query["nonce"], sub="9", email=None)
        client.post("/auth/apple/callback", data={"state": query["state"], "code": "good"}, base_url=PUBLIC)
        h = {"X-CSRF-Token": client.get("/api/me", base_url=PUBLIC).get_json()["csrf"], **JSON}
        http.revoke_ok = False
        self.assertEqual(client.post("/api/account/delete", json={"confirm": "delete"}, headers=h, base_url=PUBLIC).status_code, 502)
        self.assertTrue(client.get("/api/me", base_url=PUBLIC).get_json()["signed_in"])  # nothing was deleted
        http.revoke_ok = True
        self.assertEqual(client.post("/api/account/delete", json={"confirm": "delete"}, headers=h, base_url=PUBLIC).status_code, 200)
        url, data = http.revoked[-1]
        self.assertEqual((url, data["token"], data["token_type_hint"], data["client_id"]), (APPLE + "/auth/revoke", "apple-refresh-token", "refresh_token", "au.example.web"))

    def test_logout_ends_the_session_on_the_server(self):
        app, acct, _, _, client, h = signed_in()
        token = client.get_cookie("__Host-planb_session", domain="reroute.example").value
        self.assertEqual(client.post("/auth/logout", headers=h, base_url=PUBLIC).status_code, 200)
        self.assertFalse(client.get("/api/me", base_url=PUBLIC).get_json()["signed_in"])
        self.assertFalse(app.test_client().get("/api/me", headers={"Authorization": "Bearer " + token}).get_json()["signed_in"])  # revoked, not just forgotten

    def test_sessions_expire_after_thirty_idle_days_and_roll_while_used(self):
        app, acct, http, clock, client, h = signed_in()
        clock.now += 20 * 86400
        self.assertTrue(client.get("/api/me", base_url=PUBLIC).get_json()["signed_in"])  # renews to day 50
        clock.now += 20 * 86400
        self.assertTrue(client.get("/api/me", base_url=PUBLIC).get_json()["signed_in"])
        clock.now += 31 * 86400
        self.assertFalse(client.get("/api/me", base_url=PUBLIC).get_json()["signed_in"])
        with closing(acct.db()) as conn:
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM sessions").fetchone()[0], 0)

    def test_auth_endpoints_are_rate_limited_per_ip(self):
        app, *_ = build(limits={"auth": 3})
        client = app.test_client()
        seen = [client.get("/auth/google/login", environ_overrides={"REMOTE_ADDR": "203.0.113.9"}, base_url=PUBLIC).status_code for _ in range(4)]
        self.assertEqual(seen, [303, 303, 303, 303])  # the 4th is refused with a redirect that carries an error
        last = client.get("/auth/google/login", environ_overrides={"REMOTE_ADDR": "203.0.113.9"}, base_url=PUBLIC)
        self.assertEqual(last.headers["Location"], "/?auth_error=busy")
        self.assertIn("accounts.google.com", client.get("/auth/google/login", environ_overrides={"REMOTE_ADDR": "203.0.113.10"}, base_url=PUBLIC).headers["Location"])

    def test_fake_provider_signs_in_only_when_enabled(self):
        app, *_ = build({"ACCOUNTS_SECRET_KEY": SECRET, "PLANB_DEV": "1", "ACCOUNTS_FAKE_PROVIDER": "1"})
        client = app.test_client()
        reply = client.get("/auth/fake/login?next=/privacy&name=Zed&sub=z1", base_url=PUBLIC)
        self.assertEqual(reply.headers["Location"], "/privacy?signed_in=1")
        self.assertEqual(client.get("/api/me", base_url=PUBLIC).get_json()["user"]["display_name"], "Zed")

    def test_well_known_files_come_from_the_environment(self):
        app, *_ = build()
        client = app.test_client()
        reply = client.get("/.well-known/apple-developer-domain-association.txt")
        self.assertEqual((reply.status_code, reply.get_data(as_text=True), reply.mimetype), (200, "apple-domain-token", "text/plain"))
        self.assertEqual(client.get("/.well-known/assetlinks.json").status_code, 404)  # not configured
        self.assertEqual(client.get("/.well-known/passwd").status_code, 404)

    def test_public_deletion_page_needs_no_script_or_sign_in(self):
        app, *_ = build({"ACCOUNTS_SECRET_KEY": SECRET})
        reply = app.test_client().get("/account/delete")
        text = reply.get_data(as_text=True)
        self.assertEqual((reply.status_code, reply.mimetype), (200, "text/html"))
        self.assertIn("Delete my account", text)
        self.assertNotIn("<script", text)

    def test_security_headers_and_no_store(self):
        app, *_ = build()
        reply = app.test_client().get("/api/me", base_url=PUBLIC)
        self.assertEqual((reply.headers["X-Content-Type-Options"], reply.headers["Cache-Control"]), ("nosniff", "no-store"))
        self.assertIn("Strict-Transport-Security", reply.headers)


if __name__ == "__main__":
    unittest.main()
