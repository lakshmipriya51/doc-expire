import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import authService from '../services/authService';
import { authStorage } from '../services/storage';

const AuthContext = createContext(null);

/**
 * Holds the authenticated user and the JWT. The token is persisted so a page
 * refresh does not sign the user out, and is re-validated against the API on
 * boot so a revoked or expired session cannot be reused.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isInitialising, setIsInitialising] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const stored = authStorage.get();

    if (!stored?.token) {
      setIsInitialising(false);
      return undefined;
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
  }, []);

  const updateProfile = useCallback(async (payload) => {
    const updated = await authService.updateProfile(payload);
    const stored = authStorage.get();
    setUser(updated);
    if (stored?.token) authStorage.save({ token: stored.token, user: updated });
    return updated;
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isInitialising,
      login,
      register,
      logout,
      updateProfile,
    }),
    [user, isInitialising, login, register, logout, updateProfile],
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
