/**
 * Auth context — JWT login/register, persists tokens via secure storage.
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

import { api, clearTokens, setTokens } from "@/src/api";
import { storage } from "@/src/utils/storage";

export type User = {
  id: string;
  email: string;
  display_name: string;
  age?: number;
  gender?: string;
  country?: string;
  languages: string[];
  interests: string[];
  bio?: string;
  photos: string[];
  trust_score: number;
  verified: boolean;
  subscription_tier: "free" | "premium" | "premium_plus";
  coins: number;
  is_admin?: boolean;
  preferred_language?: string;
  referral_code?: string;
};

type Ctx = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  updateUser: (u: User) => void;
};

const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const me = await api<User>("/auth/me");
      setUser(me);
    } catch {
      await clearTokens();
      setUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const t = await storage.secureGet("access_token", null);
      if (t) await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const login = async (email: string, password: string) => {
    const r = await api<{ access_token: string; refresh_token: string; user: User }>(
      "/auth/login",
      { method: "POST", body: { email, password }, auth: false },
    );
    await setTokens(r.access_token, r.refresh_token);
    setUser(r.user);
  };

  const register = async (email: string, password: string, displayName: string) => {
    const r = await api<{ access_token: string; refresh_token: string; user: User }>(
      "/auth/register",
      { method: "POST", body: { email, password, display_name: displayName }, auth: false },
    );
    await setTokens(r.access_token, r.refresh_token);
    setUser(r.user);
  };

  const logout = async () => {
    await clearTokens();
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, loading, login, register, logout, refresh, updateUser: setUser }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth(): Ctx {
  const c = useContext(AuthCtx);
  if (!c) throw new Error("useAuth must be within AuthProvider");
  return c;
}
