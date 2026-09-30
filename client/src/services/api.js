import axios from 'axios';
import { API_BASE_URL, authStorage } from './storage';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((requestConfig) => {
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

    // An expired or revoked token means the session is over: clear it so the
    // app falls back to the login screen instead of looping on 401s.
    if (normalised.status === 401 && authStorage.get()?.token) {
      authStorage.clear();
      if (!window.location.pathname.startsWith('/login')) {
        window.location.assign('/login?expired=1');
      }
    }

    return Promise.reject(Object.assign(new Error(normalised.message), normalised));
  },
);

export { api, normaliseError };
export default api;
