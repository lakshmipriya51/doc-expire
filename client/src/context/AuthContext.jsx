import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import authService from '../services/authService';
import { authStorage, isNativePlatform, getApiBaseUrl } from '../services/storage';
import { deviceIdentity } from '../services/deviceIdentity';

const AuthContext = createContext(null);

/**
 * Signs the device in without any UI.
 *
 * The Android app opens straight into DocExpire, so there is no login form to
 * show. Instead the app registers its own device account on first launch (and
 * re-registers if the token is ever rejected), then behaves exactly like a
 * normally signed-in session from that point on.
 */
async function provisionDevice() {
  const identity = deviceIdentity.get();
  const password = identity.password;

  try {
    return await authService.register({ ...identity, confirmPassword: password });
  } catch (error) {
    // 409/400 "already exists" means the account is still there, so sign in.
    if (error.status === 409 || error.status === 400) {
      return authService.login({ email: identity.email, password });
    }
    throw error;
  }
}

/**
 * Holds the authenticated user and the JWT. The token is persisted so a page
 * refresh does not sign the user out, and is re-validated against the API on
 * boot so a revoked or expired session cannot be reused.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isInitialising, setIsInitialising] = useState(true);
  const [provisionError, setProvisionError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const stored = authStorage.get();

    if (!stored?.token) {
      // Web keeps its normal login/register screens.
      if (!isNativePlatform) {
        setIsInitialising(false);
        return undefined;
      }

      // Nothing to validate against yet and no server configured, so there is
      // nothing sensible to do until the user points the app at a backend.
      if (!getApiBaseUrl()) {
        setIsInitialising(false);
        return undefined;
      }

      provisionDevice()
        .then((auth) => {
          if (cancelled) return;
          setUser(auth.user);
          authStorage.save(auth);
        })
        .catch((error) => {
          if (cancelled) return;
          setProvisionError(error.message || 'Could not start a session on this device.');
        })
        .finally(() => {
          if (!cancelled) setIsInitialising(false);
        });

      return () => {
        cancelled = true;
      };
    }

    authService
      .getProfile()
      .then((profile) => {
        if (cancelled) return;
        setUser(profile);
        authStorage.save({ token: stored.token, user: profile });
      })
      .catch(() => {
        if (cancelled) return;
        authStorage.clear();
        setUser(null);

        if (!isNativePlatform) return;

        // Token was rejected: mint a new device identity rather than sending
        // the user to a login screen the app does not have.
        provisionDevice()
          .then((auth) => {
            if (cancelled) return;
            setUser(auth.user);
            authStorage.save(auth);
          })
          .catch((error) => {
            if (cancelled) return;
            setProvisionError(error.message || 'Could not start a session on this device.');
          });
      })
      .finally(() => {
        if (!cancelled) setIsInitialising(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback((auth) => {
    setUser(auth.user);
    authStorage.save(auth);
  }, []);

  const login = useCallback(
    async (credentials) => {
      const auth = await authService.login(credentials);
      persist(auth);
      return auth.user;
    },
    [persist],
  );

  const register = useCallback(
    async (payload) => {
      const auth = await authService.register(payload);
      persist(auth);
      return auth.user;
    },
    [persist],
  );

  const logout = useCallback(() => {
    authStorage.clear();
    setUser(null);
    // On a device there is no sign-in screen to return to, so start a fresh
    // identity instead of leaving the app in a signed-out state.
    if (isNativePlatform) deviceIdentity.clear();
  }, []);

  const updateProfile = useCallback(async (payload) => {
    const updated = await authService.updateProfile(payload);
    const stored = authStorage.get();
    setUser(updated);
    if (stored?.token) authStorage.save({ token: stored.token, user: updated });
    return updated;
  }, []);

  const retryProvisioning = useCallback(() => {
    setProvisionError(null);
    setIsInitialising(true);
    provisionDevice()
      .then((auth) => {
        setUser(auth.user);
        authStorage.save(auth);
      })
      .catch((error) => setProvisionError(error.message || 'Could not start a session.'))
      .finally(() => setIsInitialising(false));
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isInitialising,
      provisionError,
      retryProvisioning,
      login,
      register,
      logout,
      updateProfile,
    }),
    [
      user,
      isInitialising,
      provisionError,
      retryProvisioning,
      login,
      register,
      logout,
      updateProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider.');
  }
  return context;
}

export default AuthContext;
