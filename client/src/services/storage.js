const STORAGE_KEY = 'docexpire.auth';

/**
 * Where the API lives, in order of preference:
 *
 *  1. `VITE_API_URL` - an absolute origin such as https://docexpire.onrender.com
 *  2. same origin - used by the web app, because the server ships the built
 *     client and the API together. This is the correct default for every web
 *     deployment and never needs configuring.
 *
 * A Capacitor build cannot use the same origin: inside a native WebView the
 * origin is `capacitor://localhost`, which has no API behind it. Native builds
 * therefore MUST define `VITE_API_URL` at build time. When it is missing we fail
 * loudly instead of silently pointing at localhost, because that is the one
 * mistake that produces an app that launches but cannot talk to a server.
 */
const configuredBaseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

const isNativePlatform =
  typeof window !== 'undefined' &&
  typeof window.Capacitor !== 'undefined' &&
  window.Capacitor.isNativePlatform?.();

if (isNativePlatform && !configuredBaseUrl) {
  console.error(
    '[DocExpire] VITE_API_URL is not set. The mobile app cannot reach the API.\n' +
      '  Set VITE_API_URL in client/.env.production to your deployed DocExpire URL\n' +
      '  (for example https://docexpire.onrender.com) and run "npm run mobile:sync".',
  );
}

let API_BASE_URL = configuredBaseUrl;

if (import.meta.env.DEV && !configuredBaseUrl) {
  // Vite serves the client from :5173 while the API runs on :5000, so local
  // development needs an explicit cross-origin base URL.
  API_BASE_URL = 'http://localhost:5000';
}

/**
 * The JWT is kept in localStorage. Note that this is a deliberate trade-off
 * for a student project: it survives a page refresh, but any script running in
 * the same origin could read it. A production deployment should prefer an
 * httpOnly cookie.
 */
export const authStorage = {
  get() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.token ? parsed : null;
    } catch {
      return null;
    }
  },

  save(auth) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
  },

  clear() {
    window.localStorage.removeItem(STORAGE_KEY);
  },
};

export { API_BASE_URL };
