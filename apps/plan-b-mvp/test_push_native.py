"""Native (FCM) push: sender, endpoints, monitor delivery, token cleanup and account deletion. No network: FCM is a fake HTTP object."""

import json
from pathlib import Path
import tempfile
import unittest

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

import push_native
import server
import test_accounts
from push import Push, PushError
from push_native import FcmSender
from test_push_limits import NOW, WATCH, FakeMonitor, FakeSender, alert
from test_server import FakeStatic, FakeTraffic, FakeWeather

PEM = rsa.generate_private_key(65537, 2048).private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()).decode()
ACCOUNT = {"client_email": "svc@proj.iam.example", "private_key": PEM, "project_id": "proj-1"}
TOKEN = "fcm-token-" + "a" * 40
HEADERS = {"X-Reroute-Device": "d" * 20}


class Reply:
    def __init__(self, status=200, body=None):
        self.status_code, self.body = status, body or {}

    def json(self):
        return self.body


class FakeHttp:
    def __init__(self, status=200, body=None):
        self.calls, self.status, self.body = [], status, body

    def post(self, url, **kwargs):
        self.calls.append((url, kwargs))
        if "oauth2" in url:
            return Reply(200, {"access_token": "ya29.test", "expires_in": 3600})
        return Reply(self.status, self.body)


def make(status=200, body=None, clock=lambda: NOW, monitor=None):
    http = FakeHttp(status, body)
    sender = FcmSender(ACCOUNT, http, clock)
    push = Push(tempfile.mkdtemp(), monitor or FakeMonitor(), sender=FakeSender(), clock=clock, env={}, native=sender)
    return push, http


class SenderTests(unittest.TestCase):
    def test_from_env_needs_a_service_account(self):
        self.assertIsNone(FcmSender.from_env({}))
        self.assertIsNone(FcmSender.from_env({"FCM_SERVICE_ACCOUNT_JSON": "not json"}))
        self.assertIsNone(FcmSender.from_env({"FCM_SERVICE_ACCOUNT_FILE": "missing.json"}))
        self.assertIsNotNone(FcmSender.from_env({"FCM_SERVICE_ACCOUNT_JSON": json.dumps(ACCOUNT)}))
        path = Path(tempfile.mkdtemp()) / "sa.json"
        path.write_text(json.dumps(ACCOUNT), encoding="utf-8")
        self.assertIsNotNone(FcmSender.from_env({"FCM_SERVICE_ACCOUNT_FILE": str(path)}))

    def test_signs_in_once_then_sends_with_the_access_token(self):
        http = FakeHttp()
        sender = FcmSender(ACCOUNT, http, lambda: NOW)
        sender.send(TOKEN, {"title": "t", "body": "b", "url": "/?alternatives=x", "tag": "g"})
        sender.send(TOKEN, {"title": "t", "body": "b"})
        urls = [call[0] for call in http.calls]
        self.assertEqual(sum("oauth2" in url for url in urls), 1)
        url, kwargs = http.calls[1]
        self.assertEqual(url, "https://fcm.googleapis.com/v1/projects/proj-1/messages:send")
        self.assertEqual(kwargs["headers"]["Authorization"], "Bearer ya29.test")
        self.assertEqual(kwargs["json"]["message"]["token"], TOKEN)
        self.assertEqual(kwargs["json"]["message"]["data"]["url"], "/?alternatives=x")
        assertion = http.calls[0][1]["data"]["assertion"].split(".")
        self.assertEqual(len(assertion), 3)

    def test_dead_tokens_raise_gone_and_other_errors_do_not(self):
        for status, body in ((404, {"error": {"status": "NOT_FOUND", "details": [{"errorCode": "UNREGISTERED"}]}}), (400, {"error": {"status": "INVALID_ARGUMENT"}})):
            with self.assertRaises(push_native.Gone):
                FcmSender(ACCOUNT, FakeHttp(status, body), lambda: NOW).send(TOKEN, {"title": "t", "body": "b"})
        with self.assertRaises(RuntimeError):
            FcmSender(ACCOUNT, FakeHttp(503, {"error": {"status": "UNAVAILABLE"}}), lambda: NOW).send(TOKEN, {"title": "t", "body": "b"})


class RegisterTests(unittest.TestCase):
    def test_register_validates_and_replaces_by_token(self):
        push, _ = make()
        first = push.register_native({"token": TOKEN, "platform": "android", "app_version": "1.0.0", "locale": "en-AU", "watch": WATCH})
        self.assertEqual(first, push.register_native({"token": TOKEN, "platform": "ios", "watch": None}))
        self.assertEqual(len(push._subscriptions), 1)
        for bad in ({"token": "short", "platform": "ios"}, {"token": TOKEN, "platform": "web"}, {"token": TOKEN, "platform": "ios", "locale": "<script>"},
                    {"token": TOKEN, "platform": "ios", "watch": {"lines": []}}):
            with self.assertRaises(PushError):
                push.register_native(bad)

    def test_disabled_without_fcm(self):
        push = Push(tempfile.mkdtemp(), FakeMonitor(), sender=FakeSender(), env={})
        with self.assertRaises(PushError) as caught:
            push.register_native({"token": TOKEN, "platform": "ios"})
        self.assertEqual(caught.exception.status, 503)

    def test_monitor_sends_the_same_alert_to_native_tokens_once_and_a_watchless_token_gets_nothing(self):
        push, http = make(monitor=FakeMonitor(alerts=[alert()]))
        push.register_native({"token": TOKEN, "platform": "android", "watch": WATCH})
        push.register_native({"token": "other-token-" + "b" * 40, "platform": "ios"})
        self.assertEqual(push.check_once(), 1)
        self.assertEqual(push.check_once(), 0)
        sends = [call for call in http.calls if "fcm.googleapis" in call[0]]
        self.assertEqual(len(sends), 1)
        self.assertIn("Disruption on Bus 412", sends[0][1]["json"]["message"]["notification"]["title"])

    def test_unregistered_token_is_deleted_on_send(self):
        push, _ = make(404, {"error": {"details": [{"errorCode": "UNREGISTERED"}]}}, monitor=FakeMonitor(alerts=[alert()]))
        push.register_native({"token": TOKEN, "platform": "android", "watch": WATCH})
        self.assertEqual(push.check_once(), 0)
        self.assertEqual(push._subscriptions, {})

    def test_unregister_and_forget_user(self):
        push, _ = make()
        push.register_native({"token": TOKEN, "platform": "ios"}, "u_1")
        push.register_native({"token": "other-token-" + "b" * 40, "platform": "ios"}, "u_2")
        self.assertEqual(push.forget_user("u_1"), 1)
        self.assertEqual(len(push._subscriptions), 1)
        self.assertTrue(push.unregister_native("other-token-" + "b" * 40))
        self.assertFalse(push.unregister_native("other-token-" + "b" * 40))


class EndpointTests(unittest.TestCase):
    def client(self, native):
        directory = tempfile.mkdtemp()
        monitor = FakeMonitor()
        push = Push(directory, monitor, sender=FakeSender(), env={}, native=FcmSender(ACCOUNT, FakeHttp(), lambda: NOW) if native else None)
        app = server.create_app(key="k", data_dir=directory, monitor=monitor, static=FakeStatic(), weather=FakeWeather(), traffic=FakeTraffic(), push=push)
        return app.test_client(), push

    def test_503_json_when_not_configured(self):
        client, _ = self.client(False)
        reply = client.post("/api/push/native-register", json={"token": TOKEN, "platform": "ios"}, headers=HEADERS)
        self.assertEqual((reply.status_code, reply.is_json), (503, True))

    def test_register_needs_the_device_header_and_stores_the_token(self):
        client, push = self.client(True)
        body = {"token": TOKEN, "platform": "android", "app_version": "1.0.0", "locale": "en-AU", "watch": {**WATCH, "deadline": None}}
        self.assertEqual(client.post("/api/push/native-register", json=body).status_code, 400)
        reply = client.post("/api/push/native-register", json=body, headers=HEADERS)
        self.assertEqual((reply.status_code, reply.get_json()["ok"]), (200, True))
        self.assertEqual(len(push._subscriptions), 1)
        gone = client.post("/api/push/native-unregister", json={"token": TOKEN}, headers=HEADERS)
        self.assertEqual(gone.get_json()["removed"], True)
        self.assertEqual(push._subscriptions, {})


class AccountDeletionTests(unittest.TestCase):
    def test_deleting_an_account_removes_its_push_tokens(self):
        _, acct, _, _ = test_accounts.build()
        push, _ = make()
        acct.on_delete.append(push.forget_user)
        user = acct.login("google", "1001", "ann@example.com", True, "Ann")
        push.register_native({"token": TOKEN, "platform": "ios"}, user)
        push.register_native({"token": "other-token-" + "b" * 40, "platform": "ios"})
        self.assertEqual(acct.delete_user(user)["push_tokens"], 1)
        self.assertEqual(len(push._subscriptions), 1)


if __name__ == "__main__":
    unittest.main()
