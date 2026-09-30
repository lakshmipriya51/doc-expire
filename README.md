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

No UI component library and no state-management library are used, so the
frontend stays readable and dependency-light.

---

## Project structure

```
doc-expire/
├── package.json          # Root scripts that orchestrate both workspaces
├── scripts/dev.js        # Runs API and client together
├── .env.example
│
├── server/
│   ├── app.js            # Express app, middleware, error handling
│   ├── server.js         # Startup, DB connection, graceful shutdown
│   ├── config/           # Environment parsing and validation
│   ├── models/           # User, Document, Notification
│   ├── controllers/      # auth, document, notification, dashboard
│   ├── routes/           # Route tables
│   ├── middleware/       # auth, validation, uploads, rate limits
│   ├── utils/            # expiry maths, reminders, email, seed data
│   ├── scripts/          # In-memory database launcher
│   ├── tests/            # Automated test suite
│   └── uploads/          # User uploads (git-ignored)
│
└── client/
    ├── vite.config.js
    └── src/
        ├── pages/        # Landing, auth, dashboard, documents, profile
        ├── components/   # Layout, tables, forms, dialogs
        ├── services/     # Axios API modules
        ├── context/      # Auth context
        └── styles/       # Global stylesheet
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
cp client/.env.example client/.env
```

Then generate a real JWT secret and paste it into `server/.env`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Update `MONGODB_URI` if you are not using a default local MongoDB.

---

## Environment variables

The server reads `server/.env`; the client reads `client/.env`. Only variables
prefixed with `VITE_` reach the browser.

### `server/.env`

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `5000` | API port |
| `NODE_ENV` | `development` | Runtime mode |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/docexpire` | Database connection string. Accepts an Atlas `mongodb+srv://` URL too |
| `JWT_SECRET` | — | **Required.** Signing key for auth tokens |
| `JWT_EXPIRES_IN` | `7d` | Token lifetime |
| `BCRYPT_SALT_ROUNDS` | `12` | Password hashing cost |
| `CLIENT_URL` | `http://localhost:5173` | Comma-separated list of allowed browser origins |
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
| `VITE_API_URL` | `http://localhost:5000` | Base URL of the API |

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

- Passwords are hashed with bcrypt and never returned by the API.
- Every document and file route checks ownership, so one user cannot read or
  download another user's uploads by guessing an ID.
- Uploads are restricted by extension and MIME type, capped at 5 MB, and stored
  outside the static directory with randomly generated filenames. They are only
  reachable through the authenticated file routes.
- Auth endpoints are rate limited to slow down credential guessing.
- Helmet sets standard security headers; CORS is restricted to `CLIENT_URL`.
- Validation happens on the server as well as in the browser.
- Secrets live in `.env` files that are git-ignored. Only `.env.example`
  templates are committed.
- Stack traces are hidden from error responses outside development.

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

---

## License

MIT