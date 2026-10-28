# Reroute native wrapper log (28/10/2026)

**Status:** scaffolded on branch `feature/accounts` by Claude Sonnet 5.5 via Claude Code at T.P's request. **Human review required.** Not built on a device; no participant evidence. Design and open items: [native-wrapper.md](../engineering/native-wrapper.md); human steps: [NATIVE.md](../../apps/plan-b-mvp/web/NATIVE.md).

| Item | Result |
| --- | --- |
| Capacitor 8 project for Android and iOS | generated and committed (no build outputs or secrets) |
| Browser behaviour | unchanged: main chunk +0.17 kB gzip (124.20 to 124.37), no console errors at 390x844, native code lazy |
| Native adapters | geolocation, network, deep links, back button, share, status bar/splash/keyboard, API base, push and social-login clients (the last two not wired to the UI) |
| Store config | Android permissions and App Links, iOS usage string, privacy manifest, entitlements, encryption flag, icons and splash |
| Not done | device builds, iOS build (needs a Mac), push server endpoint, well-known files, real domain and bundle ID, signing, Firebase files |
