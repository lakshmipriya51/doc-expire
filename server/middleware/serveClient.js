'use strict';

/**
 * Serves the built React client from the same Express process as the API.
 *
 * This is what makes a single-service deploy possible: the app and the API end
 * up on one origin, so there are no CORS rules to configure and no second host
 * to keep in sync. It also gives a fixed localhost, because `npm run serve`
 * serves the whole app on one port.
 *
 * Nothing happens when the client has not been built yet, so the API keeps
 * working on its own during backend-only development.
 */

const path = require('node:path');
const fs = require('node:fs');
const express = require('express');

const CLIENT_DIST = path.resolve(__dirname, '..', '..', 'client', 'dist');
const INDEX_HTML = path.join(CLIENT_DIST, 'index.html');

// No inline scripts are emitted by the production build, so a strict policy is
// safe here. connect-src allows https: because a native build can talk to a
// deployed API on a different origin.
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self'",
  'connect-src \'self\' https:',
].join('; ');

// The HTML shell and the service worker must always be revalidated, otherwise
// a deploy would leave browsers on an old version of the app.
const NEVER_CACHED = /(^|\/)(index\.html|sw\.js|manifest\.webmanifest)$/;

function isClientBuilt() {
  return fs.existsSync(INDEX_HTML);
}

function serveClient(app) {
  if (!isClientBuilt()) return false;

  app.use(
    express.static(CLIENT_DIST, {
      index: false,
      setHeaders(res, filePath) {
        if (NEVER_CACHED.test(filePath)) {
          res.setHeader('Cache-Control', 'no-cache');
        } else {
          // Vite emits content-hashed filenames, so these can be cached hard.
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    }),
  );

  // Client-side routing means any unknown path has to return the app shell.
  // /api is excluded so unknown API routes still produce a proper JSON 404.
  app.get(/^(?!\/api\/).*/, (req, res) => {
    res.setHeader('Content-Security-Policy', CSP);
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(INDEX_HTML);
  });

  return true;
}

module.exports = { serveClient, isClientBuilt, CLIENT_DIST };