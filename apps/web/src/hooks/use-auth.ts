"use client";

import { useState, useEffect, useCallback } from "react";
import { getToken, isTokenExpired, logout } from "@/lib/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  tier: "free" | "pro" | "premium";
  valuation_queries_this_month: number;
  created_at: string;
}

interface AuthState {
  user: UserProfile | null;
  loading: boolean;
  loggedIn: boolean;
  refetch: () => Promise<void>;
  signOut: () => void;
}

/**
 * Hook for reading auth state in client components.
 * Fetches /api/v1/auth/me when a valid token exists.
 * Automatically clears expired tokens.
 */
export function useAuth(): AuthState {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    const token = getToken();
    if (!token || isTokenExpired()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setUser(await res.json());
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  function signOut() {
    logout();
    setUser(null);
  }

  return {
    user,
    loading,
    loggedIn: user !== null,
    refetch: fetchUser,
    signOut,
  };
}
