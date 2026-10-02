/*
 * DocExpire service worker.
 *
 * Two rules matter here:
 *
 *   1. API traffic is NEVER cached. Responses under /api contain document
 *      numbers, expiry dates and uploaded files, and they are only ever meant
 *      for the signed-in user. Caching them would leak data between users of
 *      the same device, so those requests always go to the network and fail
 *      loudly when offline.
 *
 *   2. Only the app shell is cached, so the app opens instantly and still works
 *      with no connection. The shell is revalidated on every load so a deploy
 *      is picked up immediately.
 */

const VERSION = 'v1';
const SHELL_CACHE = `docexpire-shell-${VERSION}`;
const ASSET_CACHE = `docexpire-assets-${VERSION}`;

const SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // A single missing file must not abort the whole install.
      .then((cache) => Promise.allSettled(SHELL_URLS.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== ASSET_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** True for anything the app must always fetch live. */
function isApiRequest(url) {
  return url.pathname.startsWith('/api/');
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Cross-origin traffic is left alone entirely.
  if (url.origin !== self.location.origin) return;

  // Never cache API calls or file downloads.
  if (isApiRequest(url)) return;

  // Navigations: try the network first so a new deploy is picked up, and fall
  // back to the cached shell when the device is offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/index.html').then((cached) => cached || Response.error()),
      ),
    );
    return;
  }

  // Everything else is a build asset with a hashed name, so cache-first is safe
  // and makes repeat visits instant.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          if (response.ok && response.type === 'basic') {
            const copy = response.clone();
            caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached || Response.error());
    }),
  );
});