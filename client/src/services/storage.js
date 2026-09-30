const STORAGE_KEY = 'docexpire.auth';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

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
