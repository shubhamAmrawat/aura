"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { User } from "@aura/types";
import { getToken } from "@/lib/token";
import { me } from "@/lib/authApi";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  setUser: (user: User | null) => void;
  refreshUser: () => Promise<void>;
  loaded: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refreshUser = useCallback(async () => {
    const t = getToken();
    if (!t) {
      setToken(null);
      setUser(null);
      setLoaded(true);
      return;
    }
    setToken(t);
    try {
      const data = await me(t);
      setUser(data.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  return (
    <AuthContext.Provider value={{ user, token, setUser, refreshUser, loaded }}>
      {children}
    </AuthContext.Provider>
  );
}
