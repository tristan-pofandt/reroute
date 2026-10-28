# Native app quick start (Capacitor 8)

The `android/` and `ios/` projects wrap the same React shell. Full design and open items: [docs/engineering/native-wrapper.md](../../../docs/engineering/native-wrapper.md). Nothing here has been run on a device.

## One-time setup (human)

1. **Android:** install Android Studio (bundles JDK 21 and the SDK; accept SDK 36). Set `ANDROID_HOME` (Windows: `%LOCALAPPDATA%\Android\Sdk`).
2. **iOS (Mac only):** install Xcode (current stable) and sign in with an Apple ID. Capacitor 8 uses Swift Package Manager, so no CocoaPods.
3. `cd apps/plan-b-mvp/web && npm install`

## Build and run

```bash
VITE_API_BASE=https://<deployed-domain> npm run build:native   # vite build + copy legacy app.js/app.css + cap sync
npm run android:open          # Android Studio: Run on emulator/device
npm run ios:open              # Xcode (Mac): pick a device, Run
npm run android:build-debug   # CLI gradle assembleDebug (needs JDK + ANDROID_HOME); APK in android/app/build/outputs/apk/debug/
npm run cap:doctor
```

`VITE_API_BASE` is baked into the bundle. The server must allow the origins `https://localhost` (Android) and `reroute://localhost` (iOS) in CORS (see the native-wrapper doc). Optional `VITE_APP_HOSTS=a.com,b.com` lists extra hosts that deep links map into the app.

## Secrets: never commit, where they go

| File | Goes in | Source |
| --- | --- | --- |
| `google-services.json` (FCM) | `android/app/` | Firebase console, Android app `au.reroute.app` |
| `GoogleService-Info.plist` | `ios/App/App/` (add to the target in Xcode) | Firebase console, iOS app |
| Upload keystore `*.jks`, `keystore.properties` | `android/` (or outside the repo) | `keytool -genkeypair -v -keystore reroute-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000`; keep two offline backups |
| APNs auth key `.p8`, `.p12`, provisioning profiles | Apple account / Firebase, never in the repo | Apple Developer portal |
| Google OAuth client IDs, Maps keys | server env or build-time `VITE_*` (client IDs are public; key restrictions protect Maps keys) | Cloud Console |

All of these are in `.gitignore`. Use Play App Signing so Google holds the app signing key and you hold only the upload key.

## Identifiers (placeholders, confirm before the first upload)

- Bundle ID / applicationId `au.reroute.app` (in `capacitor.config.ts`, `android/app/build.gradle`, Xcode). It cannot change after publishing.
- The domain `reroute.example` appears in `AndroidManifest.xml` (App Links), `ios/App/App/App.entitlements` and `capacitor.config.ts`: run `node scripts/set-domain.mjs --domain <host> [--dry-run]` from the repo root. Contacts and the domain for the web build live in `src/config/site.js` (`VITE_*`); `python placeholders.py` lists what is left.

## Versioning

`MAJOR.MINOR.PATCH` is the user-visible version: Android `versionName` (`android/app/build.gradle`), iOS `MARKETING_VERSION`. The build number only ever increases, one per upload: Android `versionCode`, iOS `CURRENT_PROJECT_VERSION`. Bump both platforms together.

## Cut a release

1. Bump versions, then `VITE_API_BASE=https://<domain> npm run build:native`.
2. **Android:** Android Studio, Build, Generate Signed Bundle (AAB) with the upload key. Play Console, Testing, Internal testing, upload the AAB, add testers. New personal accounts need a closed test with 12 testers for 14 days before production (check the current rule).
3. **iOS:** Xcode: set the Team, add Push Notifications, Associated Domains and Sign in with Apple capabilities (paid Apple Developer Program), Product, Archive, Distribute to App Store Connect, then TestFlight internal testing.
4. Fill in the privacy labels and Data safety form from `ios/App/App/PrivacyInfo.xcprivacy` and the native-wrapper doc, then submit.
5. Tag the commit `native-vX.Y.Z-bN`.

Regenerate icons and splash after a logo change: `node scripts/make-native-assets.mjs` then `npx capacitor-assets generate --android --ios --iconBackgroundColor "#4F46E5" --splashBackgroundColor "#090A0F" --splashBackgroundColorDark "#090A0F"`.
