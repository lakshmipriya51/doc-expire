# DocExpire 1.0 - release notes

First release of DocExpire: an Android mobile application for tracking document
expiry dates and reminders, backed by one Express + MongoDB service.

The Android app opens straight into the dashboard — there is no login or
registration screen in the APK. On first launch it registers its own per-device
account with the API, so each install stays isolated from every other install
while the server-side ownership checks keep working unchanged. The web build is
unaffected and keeps its own login and registration pages.

## Artifacts

| File | Size | SHA-256 | Signed with |
| --- | --- | --- | --- |
| `docexpire-android-1.0-release.apk` | 3,493,817 bytes | `446087afcfbcff0827929e8782004b6158d45fcd928130e0ee5880f933a4f728` | DocExpire release key |
| `docexpire-android-1.0-debug.apk` | 4,831,695 bytes | `8ec39397f2bb5bc8cbef7a8e099c7b9d024dc06a8099c6e34c57349bcd5ad897` | Android debug key |

The release APK is signed with APK Signature Scheme v1 **and** v2, so it installs
on every Android version from 7.0 up. Both artifacts contain the identical web
build and are verified with `apksigner`.

Verify a download before installing:

```bash
shasum -a 256 docexpire-android-1.0-release.apk
~/Library/Android/sdk/build-tools/35.0.0/apksigner verify --verbose \
  docexpire-android-1.0-release.apk
```

## Debug vs release

`docexpire-android-1.0-debug.apk` is a development build: it carries the
standard `CN=Android Debug` certificate, is signed with a throwaway key, is
larger, and is meant only for testing on your own device. It cannot be uploaded
to Google Play and must never be distributed to users.

`docexpire-android-1.0-release.apk` is the buildable release variant and is the
only one intended for distribution.

## Signing key

The release APK was signed with a key generated on the build machine:

- Keystore: `~/.android/docexpire-release.keystore`
- Certificate subject: `CN=DocExpire, OU=Engineering, O=DocExpire, L=Chennai, ST=TN, C=IN`
- Alias: `docexpire`

The keystore and its passwords are **not** in this repository. Android requires
the *same* key to sign every future update, and a new key cannot update an
already-installed app - users would have to uninstall first and lose their data.
Back this keystore up somewhere safe and private now. If it is lost, version
1.0.1 has to ship under a new package name or require a reinstall.

To sign on another machine, create `~/.gradle/gradle.properties` (chmod 600):

```properties
DOCEXPIRE_KEYSTORE_FILE=/absolute/path/to/docexpire-release.keystore
DOCEXPIRE_KEYSTORE_PASSWORD=...
DOCEXPIRE_KEY_ALIAS=docexpire
DOCEXPIRE_KEY_PASSWORD=...
```

`android/app/build.gradle` only enables signing when all four are present, so a
machine without them produces an unsigned `app-release-unsigned.apk` instead of
failing. This key is fine for sideloading and app stores that accept
self-signed uploads, but it is **not** suitable for Google Play, which requires
upload to an app signing key held by Google.

## Mobile builds need a deployed API URL

The APK above was built without `VITE_API_URL`, which is correct for the web
(same-origin `/api`) but **not** for a native app: a Capacitor WebView runs on
the `capacitor://localhost` origin, which has no API behind it, so the app will
show a console warning and fail every request until it is rebuilt against a
deployed backend.

Rebuild once the API is live:

```bash
echo "VITE_API_URL=https://your-docexpire-service.onrender.com" \
  > client/.env.production
npm run mobile:sync
cd android && ./gradlew assembleRelease
```

`VITE_API_URL` is compiled into the JavaScript bundle, so treat it as public
and never put a secret in it.

### CORS and the mobile app

The packaged app runs on the device, so it sends a Capacitor shell origin
(`capacitor://localhost`, `https://localhost` or `http://localhost`) and never
the deployed web origin. The API therefore allows those origins **in addition
to** `CLIENT_URL`, because a strict `CLIENT_URL`-only allowlist rejects every
mobile request as soon as the API is deployed — registration fails on the phone
while the same account works in a browser.

This is safe: `Origin` is chosen by the WebView and cannot be forged by page
script, so a third-party website cannot present itself as one of these origins.
Every other origin is still refused. Both behaviours are covered by tests in
`server/tests/api.test.js`. Set `NATIVE_ORIGINS` if you ever change the
Capacitor scheme in `capacitor.config.json`.

## What was verified

- 48/48 backend tests and 27/27 HTTP smoke tests pass against the shipped code.
- Web production build is free of any `localhost` reference.
- Android `assembleDebug` and `assembleRelease` both succeed; signatures and
  bundle contents verified.
- The app's silent device sign-in was exercised end to end against the running
  API: register (201) → validate session (200) → create document (201) →
  dashboard stats (200), and a repeated register correctly returns 409 and falls
  back to login (200).
- Cross-user access control on read, update, delete and file download is
  enforced by tests, not just by inspection.
- Uploads are validated by magic bytes, not just by the declared MIME type.

## Known limitations

- **No backend is deployed yet.** The shipped APKs were built without
  `VITE_API_URL`, so on first launch they show a **Connect to a server** screen
  where the address of a deployed DocExpire API can be entered; the app then
  signs the device in automatically. Nothing else is required, and no rebuild or
  re-signing is needed to point the APK at a server. Set `VITE_API_URL` and
  rebuild instead if you prefer the address baked into the binary.
- **Uploads are not in the APK or the repo.** On Render's free plan the
  container filesystem is wiped on every deploy and restart. Mount a disk or
  switch to a paid plan before relying on uploaded files.
- **Email reminders are off** until SMTP credentials are configured.
- The UI has been exercised over HTTP and by build/lint, not through an
  automated browser test, so there is no scripted coverage of the rendered
  screens themselves.
