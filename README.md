# DocExpire

**Never miss a document renewal again.**

DocExpire is a full-stack document expiry reminder system. It lets you register
important documents (passports, driving licences, insurance policies, visas,
memberships), attach an expiry date and an optional file, and get automatic
reminders before the deadline passes.

Every document is classified automatically, so you never have to work out what
is still valid:

| Status | Meaning |
| --- | --- |
| `EXPIRED` | The expiry date has already passed |
| `EXPIRING_SOON` | Expires within the next 30 days (configurable) |
| `ACTIVE` | More than 30 days remaining |

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Running the app](#running-the-app)
- [Running it permanently on localhost](#running-it-permanently-on-localhost)
- [Deploying to Render](#deploying-to-render)
- [Mobile app](#mobile-app)
- [Demo data](#demo-data)
- [API reference](#api-reference)
- [How reminders work](#how-reminders-work)
- [Testing](#testing)
- [Security notes](#security-notes)
- [Troubleshooting](#troubleshooting)

---

## Features

### Accounts

- Register and sign in with email and password
- Passwords hashed with bcrypt, sessions issued as JWTs
- Update your profile (name, email) and change your password
- Current-password confirmation required before changing a password

### Document management

- Create, view, edit and delete documents
- Fields: name, type, document number, issuing authority, issue date, expiry
  date and free-form notes
- Optional file upload (PDF, JPG, JPEG, PNG) up to 5 MB
- Search across name, number, type and authority
- Filter by status, type, or expiry window; sort and paginate
- Expiry date must be today or later, so you cannot record an already-expired
  document by mistake

### Reminders

- In-app notification feed derived from expiry dates
- Escalating thresholds at 30, 15, 7 and 1 day before expiry, on the day itself,
  and once it has expired
- Unread badge counts on the dashboard and in the sidebar
- Mark a single reminder read, or mark everything read
- Optional email delivery for newly generated reminders

### Dashboard

- Total, expiring-soon, expired and active counts
- Upcoming expirations list, soonest first
- Recent documents

### Interface

- Responsive layout that works on desktop, tablet and mobile
- Collapsible sidebar, form validation, loading states and toast feedback
- In-browser preview and download of uploaded files

---

## Tech stack

**Backend** — Node.js, Express, MongoDB, Mongoose, JWT, bcrypt, Multer,
Helmet, CORS, express-validator, express-rate-limit, Nodemailer (optional)

**Frontend** — React 18, Vite, React Router, Axios, plain CSS

**Mobile** — PWA (manifest + service worker) and Capacitor 7 for the native
Android build

No UI component library and no state-management library are used, so the
frontend stays readable and dependency-light.

---

## Project structure

```
doc-expire/
├── package.json          # Root scripts that orchestrate both workspaces
├── render.yaml           # Render deployment blueprint
├── capacitor.config.json # Native app configuration
├── scripts/
│   ├── dev.js                  # Runs API and client together
│   ├── serve-local.js          # Single fixed-port server (5050)
│   ├── install-local-service.js# macOS auto-start service
│   └── generate-icons.js       # Generates every app icon from code
├── resources/           # 1024px icon + splash source art for native builds
├── .env.example
│
├── server/
│   ├── app.js            # Express app, middleware, error handling
│   ├── server.js         # Startup, DB connection, graceful shutdown
│   ├── config/           # Environment parsing and validation
│   ├── models/           # User, Document, Notification
│   ├── controllers/      # auth, document, notification, dashboard
│   ├── routes/           # Route tables
│   ├── middleware/       # auth, validation, uploads, rate limits, static client
│   ├── utils/            # expiry maths, reminders, email, seed data
│   ├── scripts/          # In-memory DB launcher, end-to-end smoke test
│   ├── tests/            # Automated test suite
│   └── uploads/          # User uploads (git-ignored)
│
├── client/
│   ├── vite.config.js
│   ├── public/           # PWA manifest, service worker, icons
│   └── src/
│       ├── pages/        # Landing, auth, dashboard, documents, profile
│       ├── components/   # Layout, tables, forms, dialogs
│       ├── services/     # Axios API modules
│       ├── context/      # Auth context
│       └── styles/       # Global stylesheet
│
├── android/              # Capacitor Android project (Gradle)
```

---

## Getting started

### Prerequisites

- Node.js 18 or newer (developed on Node 22)
- MongoDB running locally, **or** use the bundled in-memory mode below

### 1. Install

```bash
git clone <your-repo-url> docexpire
cd docexpire
npm run install:all
```

Or install each workspace manually:

```bash
npm install --prefix server
npm install --prefix client
```

### 2. Configure

```bash
cp server/.env.example server/.env
```

Then generate a real JWT secret and paste it into `server/.env`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Update `MONGODB_URI` if you are not using a default local MongoDB.

You do **not** need a `client/.env`. The server serves the built client, so the
browser calls the API on its own origin and no client configuration is required.
See [`client/.env`](#clientenv) for when one is actually needed.

---

## Environment variables

The server reads `server/.env`; the client reads `client/.env`. Only variables
prefixed with `VITE_` reach the browser.

### `server/.env`

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `5000` | API port |
| `LOCAL_PORT` | `5050` | Port used by `npm run serve:local` and the background service |
| `NODE_ENV` | `development` | Runtime mode |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/docexpire` | Database connection string. Accepts an Atlas `mongodb+srv://` URL too |
| `JWT_SECRET` | — | **Required.** Signing key for auth tokens |
| `JWT_EXPIRES_IN` | `7d` | Token lifetime |
| `BCRYPT_SALT_ROUNDS` | `12` | Password hashing cost |
| `CLIENT_URL` | `http://localhost:5173` | Comma-separated list of allowed browser origins |
| `NATIVE_ORIGINS` | Capacitor shell origins | Origins of the packaged mobile app, allowed separately from `CLIENT_URL` |
| `UPLOAD_DIR` | `uploads` | Directory for uploaded files |
| `MAX_UPLOAD_MB` | `5` | Maximum upload size |
| `EXPIRING_SOON_DAYS` | `30` | Window for the "Expiring Soon" status |
| `RATE_LIMIT_DISABLED` | `false` | Bypass request throttling. Development and tests only |
| `EMAIL_ENABLED` | `false` | Turn on optional email reminders |
| `EMAIL_HOST` / `EMAIL_PORT` | — / `587` | SMTP server |
| `EMAIL_USER` / `EMAIL_PASS` | — | SMTP credentials (use an app password) |
| `EMAIL_FROM` | `DocExpire <no-reply@docexpire.dev>` | Sender address |
| `SEED_USER_EMAIL` / `SEED_USER_PASSWORD` / `SEED_USER_NAME` | demo values | Account created by the seed script |

### `client/.env`

| Variable | Default | Description |
| --- | --- | --- |
| `VITE_API_URL` | *(unset — same origin)* | Absolute origin of the API, used only when the client is not served by the API |

The client needs **no configuration for the web app**. The server ships the
built client, so `API_BASE_URL` is empty and every request goes to `/api` on the
same origin that served the page. That is the correct setup for every web
deployment and it is why there is no CORS to configure.

Set `VITE_API_URL` only when the client and the API are on different origins:

- **Mobile builds (required).** A Capacitor WebView runs on the
  `capacitor://localhost` origin, which has nothing behind it. Put the deployed
  URL in `client/.env.production` before `npm run mobile:sync`.
- **Local development (optional).** `npm run dev` serves the client on 5173 and
  the API on 5000, and falls back to `http://localhost:5000` automatically when
  the variable is unset.

> Do **not** create `client/.env` with `VITE_API_URL=http://localhost:5000` for a
> real build. Vite loads `.env` in *every* mode, so that value gets compiled
> into production and mobile bundles and makes them point at the build machine.
> Use `client/.env.production` for the production value instead.

`VITE_API_URL` is compiled into the JavaScript bundle and is readable by anyone
using the app, so never put a secret in it.

---

## Running the app

### With a local MongoDB

```bash
npm run dev
```

This starts the API on port 5000 and the Vite dev server on port 5173. Open
**http://localhost:5173**.

### Without MongoDB installed

```bash
cd server
npm run dev:memory
```

This boots a throwaway in-memory MongoDB, points the app at it and starts the
API. Handy for a quick look around.

Two caveats worth knowing:

- The first run downloads a MongoDB binary (~165 MB) into
  `~/.cache/mongodb-binaries`, so it is not instant.
- All data is discarded when you stop the process. Run `npm run seed` first if
  you want sample documents to look at.

To run the client alongside it, use `npm run dev:client` in a second terminal.

### Production build

```bash
npm run build
```

The static client bundle is written to `client/dist`.

Once the client is built, the API serves it too, so a single process hosts the
whole app. See the next section.

---

## Running it permanently on localhost

The usual `npm run dev` uses two processes on two ports. For a single fixed
address that never moves, use:

```bash
npm run serve:local
```

This builds the client if needed, then serves the **API and the web app together
on port 5050**:

```
http://localhost:5050
```

Because the app is served from the same origin as the API, there is no CORS
setup and no second port to remember.

### Start it automatically at login

```bash
npm run service:install
```

This registers a macOS LaunchAgent (`dev.docexpire.server`), so DocExpire starts
by itself when you log in and restarts if the process dies.

The installer copies the app into `~/Library/Application Support/DocExpire` and
runs it from there, because the project folder is often a cloud-synced location
(iCloud, Drive, Dropbox) and Node cannot reliably read modules from those
network folders. Logs land in that folder too:

```
~/Library/Application Support/DocExpire/logs/service.out.log
~/Library/Application Support/DocExpire/logs/service.err.log
```

Re-run `npm run service:install` after changing the code. It redeploys the copy
and restarts the service, so it is also the update command.

```bash
npm run service:uninstall                    # stop and remove the service
npm run service:uninstall -- --purge         # also delete the deployed copy
```

On first install it builds the client if needed and copies `server/.env` into
the deployed folder, creating one with a generated `JWT_SECRET` if you have not
set one up, so the service starts successfully instead of failing on every boot.

### Reaching it from your phone

The server binds to `0.0.0.0`, so a phone on the same wifi can open it:

```bash
ipconfig getifaddr en0     # your Mac's LAN address
```

Then visit `http://<that-address>:5050` on the phone.

> Use the HTTPS Render deployment below for anything beyond your own network.
> Plain HTTP on a LAN address is fine for local testing, but a login token sent
> over an unencrypted connection can be read by anyone on the same network.

**Change the port** by adding `LOCAL_PORT=5050` to `server/.env`.

---

## Deploying to Render

The app is deployed as **one service**: Express serves the API *and* the built
client, so the web app and the API share a single origin and URL.

`render.yaml` in the repository root holds the whole blueprint.

### 1. Create a MongoDB Atlas database

1. Sign up at <https://www.mongodb.com/atlas> (the free M0 tier is enough).
2. Create a free cluster.
3. Under **Database Access**, add a user with a password.
4. Under **Network Access**, allow access from anywhere (`0.0.0.0/0`). Required
   because Render does not have a static outbound IP.
5. Copy the connection string. It looks like:

   ```
   mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

   Add a database name: `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/docexpire?retryWrites=true&w=majority`

### 2. Deploy

1. Push this repository to GitHub (it already is).
2. Go to <https://dashboard.render.com>, create a free account.
3. **New → Blueprint**, then select the `doc-expire` repository.
4. Render reads `render.yaml` and asks for the two values marked `sync: false`:
   - `MONGODB_URI` — the Atlas string from step 1
   - `CLIENT_URL` — for the first deploy this can be the Render URL Render is
     about to give you, e.g. `https://docexpire.onrender.com`
5. Deploy, then watch the **Logs** tab. A successful build ends with
   `[startup] Serving the web client...`.

### 3. Fix CORS after the first deploy

Render gives the service its URL on first deploy. Set `CLIENT_URL` in the Render
dashboard to exactly that origin (no trailing slash), save, and redeploy.
Without this the browser blocks API calls from the deployed page.

### What the free tier means

- The service sleeps after 15 minutes of inactivity, so the first request after
  a pause takes a few seconds to wake up.
- Uploads are stored on the container filesystem, which is **ephemeral** on the
  free plan: a restart or redeploy discards uploaded files. Document records
  survive in MongoDB, but attached files do not. Use a persistent disk or object
  storage if you need files to last.

---

## Android application

DocExpire is an Android mobile application for tracking important document
expiry dates and reminders. The React client is wrapped in a native shell with
[Capacitor](https://capacitorjs.com), which gives a real `.apk` with a native
status bar and splash screen without rewriting any UI.

### No login screen

The Android app **opens straight into the DocExpire dashboard**. There is no
login page, no registration page and no sign-in step.

The API still needs a bearer token and still keeps each account's documents
separate, so on first launch the app quietly registers its own device account
and remembers it. Each install gets a unique account, so one phone never sees
another phone's documents, and the server-side ownership checks keep working
unchanged. The backend is not modified for this.

The web app is unaffected and still has its own login and registration pages,
with any name, email and password.

### Prerequisites

| Requirement | Version used |
| --- | --- |
| Node.js | 18 or newer (built on 22) |
| JDK | 17 or newer (built on 23) |
| Android SDK | Platform 35 + Build-Tools 35.0.0 |
| Gradle | Supplied by the wrapper (8.11.1), no separate install |
| Android Studio | Optional; the command line below is enough |

### Build the app

```bash
npm install          # install dependencies
npm run install:all  # server + client workspaces
npm run build        # build the React app into client/dist
npx cap sync android # copy client/dist into the Android project
```

`npm run mobile:sync` runs the last two steps together.

### Open in Android Studio

```bash
npx cap open android
```

Or open the `android/` folder directly: **File → Open**, select `android/`, and
let Gradle sync. Use **Build → Build Bundle(s) / APK(s) → Build APK(s)** to
produce an APK from the IDE.

### Build the APK from the command line

```bash
cd android
./gradlew assembleDebug     # android/app/build/outputs/apk/debug/app-debug.apk
./gradlew assembleRelease   # android/app/build/outputs/apk/release/app-release.apk
```

Release signing is opt-in: `android/app/build.gradle` enables it only when all
four of these are present in `~/.gradle/gradle.properties` (chmod 600), and
otherwise produces an unsigned `app-release-unsigned.apk` rather than failing:

```properties
DOCEXPIRE_KEYSTORE_FILE=/absolute/path/to/docexpire-release.keystore
DOCEXPIRE_KEYSTORE_PASSWORD=...
DOCEXPIRE_KEY_ALIAS=docexpire
DOCEXPIRE_KEY_PASSWORD=...
```

Keystores, `*.jks`, `*.p12`, `*.keystore` and `*.mobileprovision` are all
git-ignored; keep them out of the repository. An `.aab` for Google Play is
produced with `./gradlew bundleRelease`.

### Pointing the app at your backend

A phone cannot reach `localhost` on your computer, so the app needs the address
of a deployed DocExpire server. Supply it at build time:

```bash
# client/.env.production
VITE_API_URL=https://your-docexpire-server.onrender.com
```

then run `npm run mobile:sync` again.

If no address was compiled in, the app shows a **Connect to a server** screen
instead of an empty dashboard, and the address can be entered on the phone under
**Server settings**. That means one signed APK can be pointed at a real backend
without rebuilding and re-signing it. Deploy the API first, otherwise the app
cannot load anything.

### Install as a PWA (no build tools)

The client also ships a web app manifest and a service worker, so a deployed
site can be installed from the browser: **Android / Chrome** → menu → *Install
app*.

It launches in its own window with the branded icon and splash, and works
offline for the app shell. The service worker **never caches `/api` responses**,
because document data belongs to one account and caching it could show one
user's documents to another person using the same device.

### Install the ready-made APK

Two APKs are committed under [`releases/`](releases), so the app can be installed
without any build tools:

| File | Use it for |
| --- | --- |
| [`docexpire-android-1.0-release.apk`](releases/docexpire-android-1.0-release.apk) | Sideloading on your own phone. Signed with the DocExpire release key |
| [`docexpire-android-1.0-debug.apk`](releases/docexpire-android-1.0-debug.apk) | Debugging only. Signed with the throwaway Android debug certificate |

To install:

1. Copy the `.apk` to the phone (cable, AirDrop, or cloud drive).
2. Tap it and allow **Install from unknown sources** when Android asks.
3. Launch **DocExpire**.

Both are signed (v1 + v2) and install directly, but neither can be uploaded to
Google Play — the debug one is signed with a throwaway key, and the release key
is not an app-signing key held by Google.

**The shipped APKs were built without `VITE_API_URL`**, because no backend was
deployed when they were produced. The app therefore opens on a **Connect to a
server** screen rather than a broken dashboard, and the address can be entered
on the phone. Alternatively, set `VITE_API_URL`, run `npm run mobile:sync` and
rebuild to bake the address in.

See [`releases/RELEASE_NOTES.md`](releases/RELEASE_NOTES.md) for checksums,
signing details, and how to sign future versions with the same key.

#### App identity

| | |
| --- | --- |
| App id | `com.docexpire.app` |
| App name | DocExpire |
| Config | `capacitor.config.json` |

#### Icons and splash screens

All artwork is **generated from code**, not committed as hand-made binaries, so
it can be regenerated at any size and stays consistent:

```bash
npm run icons
```

This writes the PWA icons to `client/public/icons/` and the 1024px / 2732px
native sources to `resources/`. To push new artwork into the native projects,
run `npx capacitor-assets generate --android --ios` afterwards.

---

## Demo data

```bash
npm run seed
```

Creates the demo account and a set of sample documents spread across every
status, with **fake** document numbers and authorities:

| | |
| --- | --- |
| Email | `demo@docexpire.dev` |
| Password | `Demo@12345` |

The seed script is idempotent, so running it twice will not duplicate anything.

---

## API reference

All routes are prefixed with `/api`. Protected routes expect an
`Authorization: Bearer <token>` header. Responses are JSON; errors come back as
`{ "message": "...", "errors": [ ... ] }` where relevant.

### Health

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/health` | No | Liveness probe with timestamp |

### Authentication — `/api/auth`

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | No | Create an account, returns a token |
| `POST` | `/api/auth/login` | No | Sign in, returns a token and profile |
| `GET` | `/api/auth/profile` | Yes | Current profile |
| `PUT` | `/api/auth/profile` | Yes | Update name and/or email |
| `PUT` | `/api/auth/password` | Yes | Change password (needs the current one) |

### Documents — `/api/documents`

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/documents` | Yes | List, with `search`, `status`, `type`, `expiry`, `sort`, `page`, `limit` |
| `POST` | `/api/documents` | Yes | Create a document, JSON or `multipart/form-data` |
| `GET` | `/api/documents/:id` | Yes | Single document |
| `PUT` | `/api/documents/:id` | Yes | Update a document |
| `DELETE` | `/api/documents/:id` | Yes | Delete a document and its file |
| `GET` | `/api/documents/:id/file` | Yes | Preview the uploaded file inline |
| `GET` | `/api/documents/:id/download` | Yes | Download the uploaded file |

### Notifications — `/api/notifications`

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/notifications` | Yes | Reminder feed |
| `PUT` | `/api/notifications/:id/read` | Yes | Mark one reminder read |
| `PUT` | `/api/notifications/read-all` | Yes | Mark every reminder read |

Reminders are derived from document expiry dates, so they are generated and
cleaned up automatically. There is no manual create or delete.

### Dashboard — `/api/dashboard`

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/dashboard/stats` | Yes | Counts, upcoming expirations and recent documents |

---

## How reminders work

DocExpire does not run a background scheduler. Instead, each reminder is
**derived** from a document's expiry date at the moment it is needed — on sign
in, on the dashboard, after any document change, and when the notification feed
is opened.

For each document the most urgent applicable level is chosen:

| Days until expiry | Level | Notification type |
| --- | --- | --- |
| 30 | `30` | `REMINDER` |
| 15 | `15` | `REMINDER` |
| 7 | `7` | `REMINDER` |
| 1 | `1` | `REMINDER` |
| 0 | `0` | `EXPIRY_TODAY` |
| Already past | `-1` | `EXPIRED` |
| Anything else | No reminder | — |

Note that a reminder is emitted only when a document sits **exactly** on one of
these thresholds, not on every day in between. That keeps the feed to at most
one reminder per threshold per document, so a document does not generate a new
notice every day for a month.

Each `(document, level)` pair is stored once, which keeps the sync idempotent
and preserves the read/unread state across syncs. Stale reminders are removed
when a document is deleted or its expiry date moves far enough that the old
threshold no longer applies.

**Practical consequence:** reminders stay correct after midnight rolls over,
with no cron job or worker process to keep alive. The trade-off is that a
reminder appears the first time the app is opened after a threshold is crossed,
rather than at a fixed hour.

All date maths uses UTC calendar days so a server timezone change cannot shift a
document into the wrong status.

---

## Testing

```bash
npm test
```

The suite uses Node's built-in test runner with `supertest` and an in-memory
MongoDB, so no database installation is needed. It covers expiry and reminder
logic in isolation, plus the HTTP surface: registration and login, password
handling, authorisation between users, document CRUD, uploads, search and
filtering, dashboard counts, and the notification feed.

There is also an end-to-end smoke script that exercises the same flows against
a real listening server:

```bash
cd server
node scripts/smoke-test.js
```

Rate limiting is disabled automatically for tests, so the suite is not affected
by throttling.

---

## Security notes

### Access control

- Passwords are hashed with bcrypt and never returned by the API.
- Every document and file route checks ownership, so one user cannot read,
  update, delete or download another user's uploads by guessing an ID. This is
  covered by tests for each verb, not just by inspection.
- Auth endpoints are rate limited to slow down credential guessing.
- Validation happens on the server as well as in the browser.
- Stack traces are hidden from error responses outside development.

### Uploads

- Capped at 5 MB, and rejected unless the declared MIME type *and* the actual
  file content agree. Magic-byte checking means a file named `invoice.pdf` that
  is really an executable is rejected, not just mislabelled ones.
- Stored outside the static directory under randomly generated filenames, so
  uploads are only reachable through the authenticated file routes.
- Nothing under `server/uploads/` is committed.

### Configuration and secrets

- Secrets live in `.env` files that are git-ignored. Only `.env.example`
  templates are committed, and they contain placeholders only.
- The server **refuses to start in production** with a missing, placeholder or
  trivially short `JWT_SECRET`, or with a `MONGODB_URI` that still contains the
  example placeholder. A deployment cannot quietly run on a shared secret.
- `.gitignore` excludes `*.keystore`, `*.jks`, `*.p12`, `*.pfx` and
  `*.mobileprovision`, so signing material cannot be committed by accident.
- Anything prefixed `VITE_` is compiled into the client bundle and is therefore
  public. Never put a secret in `client/.env*`.

### Response headers

- Helmet sets the standard security headers, and the static client is served
  with a strict `Content-Security-Policy` (`script-src 'self'`, no inline
  scripts, `object-src 'none'`, `frame-ancestors 'none'`).
- CORS is restricted to `CLIENT_URL`, plus the fixed Capacitor shell origins
  (`capacitor://localhost`, `https://localhost`, `http://localhost`). The native
  app runs on the device and never sends the deployed web origin, so without
  those it would be rejected by CORS the moment the API is deployed — which
  shows up as registration failing on a real phone while the web app works.
  Allowing them is safe: the `Origin` header is set by the WebView and cannot be
  forged by page script, so a third-party website cannot borrow them. Any other
  origin is still refused, and both behaviours are covered by tests. Override
  with `NATIVE_ORIGINS` if you change the Capacitor scheme.
- The service worker never caches `/api` responses, so one user's documents
  cannot be shown to another user of the same device.

### Shipped binaries

- The committed APKs are signed but self-hosted; verify them with
  `shasum -a 256` and `apksigner verify` before installing. Checksums are in
  [`releases/RELEASE_NOTES.md`](releases/RELEASE_NOTES.md).
- The native web assets under `android/app/src/main/assets/public` are
  committed on purpose, so a clean checkout builds APKs that actually contain
  the app. Refresh them with `npm run mobile:sync`.

---

## Troubleshooting

**`MONGODB_URI` connection fails on startup** — Make sure MongoDB is running, or
use `npm run dev:memory` from the `server` directory instead.

**Client shows "network error"** — The API is not reachable. Check that the
server is on port 5000 and that `VITE_API_URL` matches. Restart the Vite server
after changing any `VITE_` variable, since Vite only reads them at startup.

**CORS error in the browser console** — The browser origin is not in
`CLIENT_URL`. Add it as a comma-separated value and restart the API.

**Rate limited while developing** — Set `RATE_LIMIT_DISABLED=true` in
`server/.env` for local work, and leave it `false` everywhere else.

**Uploads fail immediately** — Check `UPLOAD_DIR` exists and is writable, and
that `MAX_UPLOAD_MB` fits your files.

**`npm run dev:memory` is slow the first time** — It downloads a MongoDB binary
(~165 MB) on first run and caches it in `~/.cache/mongodb-binaries`.

**Reminder looks stale** — The feed refreshes on sign in, on document changes
and when it is opened. Reload the page.

**`Port 5000 is already in use`** — Something else owns that port. On macOS the
AirPlay receiver often takes 5000, so run `npm run serve:local` (which uses 5050)
or set a different `PORT`.

**The deployed page loads but API calls fail in the console** — Almost always
CORS. `CLIENT_URL` on Render must exactly match the deployed origin, with no
trailing slash, and the service must be redeployed after changing it.

**The native app opens but shows an error** — The shell cannot reach
`localhost`. Set `VITE_API_URL` in `client/.env.production` to your deployed
HTTPS API, run `npm run mobile:sync`, and rebuild the app.

**`cap add ios` fails with "CocoaPods is not installed"** — Run
`brew install cocoapods`.

**The background service did not start** — Check
`~/Library/Application Support/DocExpire/logs/service.err.log`. On first launch
macOS may also ask for permission to allow the item to run.

---

## License

MIT