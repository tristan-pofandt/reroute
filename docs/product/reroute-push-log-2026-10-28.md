# Reroute native push log

**Status:** Implemented on 2026-10-28 on `feature/accounts` for team review. Not merged, not pushed, not deployed. No Firebase project or key existed: FCM was tested only against a mocked HTTP layer, never on a device.

**Who wrote it:** Claude Sonnet 5.5 via Claude Code at T.P's request (see the [AI-use log](../team/ai-use-log.md)). **Human review required** before any release.

Paths are in `apps/plan-b-mvp/`. Set-up steps: [native-wrapper.md](../engineering/native-wrapper.md).

| Change | Where |
| --- | --- |
| FCM HTTP v1 sender (service-account JWT signed with `cryptography`, no new dependency) | `push_native.py` |
| Native tokens stored with Web Push subscriptions and sent the same disruption alerts by the same monitor; dead tokens removed | `push.py` |
| `POST /api/push/native-register` and `/native-unregister` (rate limited, `X-Reroute-Device` header, 503 JSON when FCM is not configured) | `server.py` |
| Tokens deleted with the account (`Accounts.on_delete`, `request_user`) | `accounts.py` |
| Priming sheet, permission state machine, foreground toast, tap routing, badge reset | `app.js`, `web/src/native/push.js`, `deeplinks.js` |
| Tests | `test_push_native.py`, `web/src/__tests__/push.test.js` |

**Decisions:** FCM for both platforms (upload the APNs key to Firebase); direct APNs skipped because it could not be tested. `google-auth` skipped: signing the JWT with the existing `cryptography` keeps the image unchanged.

**Not done:** device testing, a real FCM send, Firebase and APNs set-up, Privacy text for app notifications, an in-app "Open settings" button (the hint explains the path; the plugin cannot open system settings).
