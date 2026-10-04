const STORAGE_KEY = 'docexpire.auth';
const API_URL_KEY = 'docexpire.apiUrl';

const isNativePlatform =
  typeof window !== 'undefined' &&
  typeof window.Capacitor !== 'undefined' &&
  Boolean(window.Capacitor.isNativePlatform?.());

/**
 * Where the API lives, in order of preference:
 *
 *  1. A URL saved on the device (Settings -> Server). This exists so an
 *     installed APK can be pointed at a real backend from the phone, without
 *     rebuilding and re-signing the app for every environment.
 *  2. `VITE_API_URL` - compiled in at build time.
 *  3. The same origin - correct for the web app, because the server ships the
 *     built client and the API together, so the browser needs no configuration.
 *
 * A Capacitor build cannot use the same origin: inside a native WebView the
 * origin is `capacitor://localhost` (or `https://localhost`), which has no API
 * behind it. Native builds therefore need an explicit backend URL, which is
 * why the app shows an offline screen with a link to Settings instead of a
 * blank dashboard when none is set.
 */
const compiledBaseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

let fallbackBaseUrl = compiledBaseUrl;

if (import.meta.env.DEV && !compiledBaseUrl) {
  // Vite serves the client from :5173 while the API runs on :5000, so local
  // development needs an explicit cross-origin base URL.
  fallbackBaseUrl = 'http://localhost:5000';
}

/** Never point at localhost from a real device; it would mean the phone itself. */
function normaliseBaseUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

function readStoredBaseUrl() {
  try {
    return normaliseBaseUrl(window.localStorage.getItem(API_URL_KEY));
  } catch {
    return '';
  }
}

export function getApiBaseUrl() {
  return readStoredBaseUrl() || fallbackBaseUrl;
}

export function setApiBaseUrl(url) {
  const clean = normaliseBaseUrl(url);
  window.localStorage.setItem(API_URL_KEY, clean);
  return clean;
}

export function clearApiBaseUrl() {
  window.localStorage.removeItem(API_URL_KEY);
}

/** True when the app still has no usable backend to talk to. */
export function isMissingServerUrl() {
  return !getApiBaseUrl();
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

export { isNativePlatform };