import axios from 'axios';
import { authStorage, getApiBaseUrl, isNativePlatform } from './storage';

const api = axios.create({
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

/*
 * The base URL is resolved per request rather than captured once, so saving a
 * new server address in Settings takes effect immediately without a restart.
 */
api.interceptors.request.use((requestConfig) => {
  const base = getApiBaseUrl();
  requestConfig.baseURL = `${base}/api`;

  const auth = authStorage.get();
  if (auth?.token) {
    requestConfig.headers.Authorization = `Bearer ${auth.token}`;
  }
  return requestConfig;
});

/**
 * Turns any axios failure into a predictable shape so components never have to
 * dig through error internals or show a raw stack trace to the user.
 */
function normaliseError(error) {
  if (error.response) {
    return {
      status: error.response.status,
      message: error.response.data?.message || 'Something went wrong. Please try again.',
      fieldErrors: error.response.data?.errors || {},
    };
  }

  if (error.code === 'ECONNABORTED') {
    return {
      status: 0,
      message: 'The request timed out. Please check your connection and try again.',
      fieldErrors: {},
    };
  }

  return {
    status: 0,
    message: 'Cannot reach the server. Make sure the backend is running.',
    fieldErrors: {},
  };
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const normalised = normaliseError(error);

    // An expired or revoked token means the session is over. On the web that
    // sends the user to the login screen. In the native app there is no login
    // screen: the session is simply cleared so AuthContext provisions a fresh
    // device identity instead of bouncing the user to a page that does not
    // exist there.
    if (normalised.status === 401 && authStorage.get()?.token) {
      authStorage.clear();
      if (!isNativePlatform && !window.location.pathname.startsWith('/login')) {
        window.location.assign('/login?expired=1');
      }
    }

    return Promise.reject(Object.assign(new Error(normalised.message), normalised));
  },
);

export { api, normaliseError };
export default api;
