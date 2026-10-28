"""Native push (Android and iOS) through Firebase Cloud Messaging HTTP v1, for the Capacitor app.

FCM delivers to both platforms (upload the APNs auth key to Firebase for iOS), so one sender covers both; direct APNs is not implemented.
Configuration, from the environment only (never commit it): FCM_SERVICE_ACCOUNT_JSON (the service account JSON itself) or
FCM_SERVICE_ACCOUNT_FILE (path to it). Without one of them native push is off and the endpoints answer 503.
The OAuth access token is minted by signing a JWT with `cryptography` (already a dependency), so no google-auth package is needed.
Registered tokens live next to the Web Push subscriptions in push.py's store and use the same watch and monitor. Tokens are never logged.
"""

import base64
import json
import re
import threading
import time

FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging"
FCM_URL = "https://fcm.googleapis.com/v1/projects/{}/messages:send"
DEFAULT_TOKEN_URI = "https://oauth2.googleapis.com/token"
DROP_CODES = {"UNREGISTERED", "INVALID_ARGUMENT"}  # the token is dead (or malformed): forget it
TOKEN = re.compile(r"^[A-Za-z0-9:_\-.]{20,4096}$")
DEVICE = re.compile(r"^[A-Za-z0-9_-]{16,64}$")
LOCALE = re.compile(r"^[A-Za-z]{2,3}([-_][A-Za-z0-9]{2,8})*$")
VERSION = re.compile(r"^[0-9A-Za-z.+_-]{1,32}$")


class Gone(Exception):
    """FCM says this token no longer exists."""


def _b64(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=")


class FcmSender:
    def __init__(self, account, http=None, clock=time.time):
        for field in ("client_email", "private_key", "project_id"):
            if not isinstance(account.get(field), str) or not account[field]:
                raise ValueError(f"The FCM service account is missing {field}.")
        self.account, self.clock = account, clock
        if http is None:
            import requests
            http = requests
        self.http = http
        self._access, self._expires, self._lock = None, 0, threading.Lock()

    @classmethod
    def from_env(cls, env, http=None, clock=time.time):
        """A sender, or None when FCM is not configured (or the configuration is unusable)."""
        try:
            raw = (env.get("FCM_SERVICE_ACCOUNT_JSON") or "").strip()
            path = (env.get("FCM_SERVICE_ACCOUNT_FILE") or "").strip()
            if not raw and path:
                with open(path, encoding="utf-8") as handle:
                    raw = handle.read()
            return cls(json.loads(raw), http, clock) if raw else None
        except (OSError, ValueError, TypeError):
            return None

    def _jwt(self, now):
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import padding
        claims = {"iss": self.account["client_email"], "scope": FCM_SCOPE, "aud": self.account.get("token_uri") or DEFAULT_TOKEN_URI, "iat": int(now), "exp": int(now) + 3600}
        signing = _b64(json.dumps({"alg": "RS256", "typ": "JWT"}).encode()) + b"." + _b64(json.dumps(claims).encode())
        key = serialization.load_pem_private_key(self.account["private_key"].encode(), None)
        return (signing + b"." + _b64(key.sign(signing, padding.PKCS1v15(), hashes.SHA256()))).decode()

    def access_token(self):
        with self._lock:
            now = self.clock()
            if not self._access or self._expires - 60 <= now:
                response = self.http.post(self.account.get("token_uri") or DEFAULT_TOKEN_URI, timeout=10,
                                          data={"grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer", "assertion": self._jwt(now)})
                if response.status_code != 200:
                    raise RuntimeError("FCM sign-in failed")
                body = response.json()
                self._access, self._expires = body["access_token"], now + int(body.get("expires_in", 3600))
            return self._access

    def send(self, token, payload):
        """Deliver one notification. Raises Gone when the token should be forgotten."""
        tag = str(payload.get("tag", ""))
        message = {"token": token, "notification": {"title": payload["title"], "body": payload["body"]},
                   "data": {"url": str(payload.get("url", "")), "tag": tag, "simulated": "1" if payload.get("simulated") else "0"},
                   "android": {"priority": "HIGH", "notification": {"tag": tag, "channel_id": "alerts"}},
                   "apns": {"payload": {"aps": {"sound": "default"}}}}
        response = self.http.post(FCM_URL.format(self.account["project_id"]), timeout=10, json={"message": message},
                                  headers={"Authorization": "Bearer " + self.access_token()})
        if response.status_code == 200:
            return
        if response.status_code == 401:
            self._access = None  # expired or revoked: sign in again next time
        try:
            error = response.json()["error"]
            codes = {d.get("errorCode") for d in error.get("details", []) if isinstance(d, dict)} | {error.get("status")}
        except (ValueError, KeyError, AttributeError, TypeError):
            codes = set()
        if response.status_code == 404 or codes & DROP_CODES:
            raise Gone()
        raise RuntimeError(f"FCM returned {response.status_code}")
