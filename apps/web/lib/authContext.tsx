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
import { getToken, clearToken } from "@/lib/token";
import { me } from "@/lib/authApi";
import { getLikedWallpaperIds } from "@/lib/likesApi";
import { getSavedWallpaperIds } from "@/lib/collectionsApi";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  setUser: (user: User | null) => void;
  refreshUser: () => Promise<void>;
  loaded: boolean;
  likedIds: Set<string>;
  toggleLikedId: (id: string) => void;
  savedIds: Set<string>;
  toggleSavedId: (id: string) => void;
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
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const refreshUser = useCallback(async () => {
    const t = getToken();
    if (!t) {
      setToken(null);
      setUser(null);
      setLikedIds(new Set());
      setSavedIds(new Set());
      setLoaded(true);
      return;
    }
    setToken(t);
    try {
      const [userData, ids, saved] = await Promise.all([
        me(t),
        getLikedWallpaperIds(t),
        getSavedWallpaperIds(t),
      ]);
      setUser(userData.user ?? null);
      setLikedIds(ids);
      setSavedIds(saved);
    } catch (err) {
      // Only clear the session on a genuine 401 (expired/invalid token).
      // Network errors or API blips (cold starts, timeouts) must not log the user out.
      if (err instanceof Error && err.message.toLowerCase().includes("unauthorized")) {
        clearToken();
        setToken(null);
        setUser(null);
        setLikedIds(new Set());
        setSavedIds(new Set());
      }
    } finally {
      setLoaded(true);
    }
  }, []);

  const toggleLikedId = useCallback((id: string) => {
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSavedId = useCallback((id: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  return (
    <AuthContext.Provider
      value={{ user, token, setUser, refreshUser, loaded, likedIds, toggleLikedId, savedIds, toggleSavedId }}
    >
      {children}
    </AuthContext.Provider>
  );
}