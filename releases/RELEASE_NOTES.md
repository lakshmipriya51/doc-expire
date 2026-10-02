# DocExpire 1.0 - release notes

First release of DocExpire: a document expiry tracker that runs as a web app,
an installable PWA, and a native Android/iOS app backed by one Express + MongoDB
service.

## Artifacts

| File | Size | SHA-256 | Signed with |
| --- | --- | --- | --- |
| `docexpire-android-1.0-release.apk` | 3,492,372 bytes | `288a5ff56a1b03140aa9b1f1a1ed8fa75147b715375ce60ff3ea94bf37a020fe` | DocExpire release key |
| `docexpire-android-1.0-debug.apk` | 4,829,887 bytes | `8bdf7459d4c419298b2518c54ee053b9852372b2a4d3daf187b32a3def3e07e7` | Android debug key |

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

- 46/46 backend tests and 27/27 HTTP smoke tests pass against the shipped code.
- Web production build is free of any `localhost` reference.
- Android `assembleDebug` and `assembleRelease` both succeed; signatures and
  bundle contents verified.
- iOS simulator build succeeds (`BUILD SUCCEEDED`), bundle `com.docexpire.app`.
- Cross-user access control on read, update, delete and file download is
  enforced by tests, not just by inspection.
- Uploads are validated by magic bytes, not just by the declared MIME type.

## Known limitations

- **No iOS IPA is published.** Device builds need an Apple Developer team and a
  provisioning profile, neither of which is available here.
- **Uploads are not in the APK or the repo.** On Render's free plan the
  container filesystem is wiped on every deploy and restart. Mount a disk or
  switch to a paid plan before relying on uploaded files.
- **Email reminders are off** until SMTP credentials are configured.
- The web app has been exercised over HTTP, not through an automated browser
  test, so there is no scripted coverage of the rendered UI itself.
