/**
 * Mobile useAuth hook.
 * Reads the stored JWT from AsyncStorage, fetches /auth/me if a token exists,
 * and provides login/logout helpers that update state immediately.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  getToken, clearToken, getProfile,
  login as apiLogin, register as apiRegister, logout as apiLogout,
  type UserProfile,
} from '@/lib/api';

interface AuthState {
  user: UserProfile | null;
  loading: boolean;
  loggedIn: boolean;
}

interface UseAuthReturn extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  refetch: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    loggedIn: false,
  });

  const fetchUser = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) {
        setState({ user: null, loading: false, loggedIn: false });
        return;
      }
      const user = await getProfile();
      setState({ user, loading: false, loggedIn: true });
    } catch {
      // Token invalid or network error
      setState({ user: null, loading: false, loggedIn: false });
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = useCallback(async (email: string, password: string) => {
    await apiLogin(email, password);
    await fetchUser();
  }, [fetchUser]);

  const register = useCallback(async (email: string, password: string, displayName?: string) => {
    await apiRegister(email, password, displayName);
    await fetchUser();
  }, [fetchUser]);

  const logout = useCallback(async () => {
    await apiLogout();
    setState({ user: null, loading: false, loggedIn: false });
  }, []);

  return {
    ...state,
    login,
    register,
    logout,
    refetch: fetchUser,
  };
}
