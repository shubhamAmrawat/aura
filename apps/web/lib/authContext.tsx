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
import { me, logout as authLogout } from "@/lib/authApi";
import { getLikedWallpaperIds } from "@/lib/likesApi";
import { getSavedWallpaperIds } from "@/lib/collectionsApi";

interface AuthContextValue {
  user: User | null;
  setUser: (user: User | null) => void;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
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
  const [loaded, setLoaded] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const refreshUser = useCallback(async () => {
    try {
      const results = await Promise.allSettled([
        me(),
        getLikedWallpaperIds(),
        getSavedWallpaperIds(),
      ]);

      const userRes = results[0];
      const likedRes = results[1];
      const savedRes = results[2];

      if (userRes.status === "rejected") {
        const err = userRes.reason;
        if (err instanceof Error && err.message.toLowerCase().includes("unauthorized")) {
          setUser(null);
          setLikedIds(new Set());
          setSavedIds(new Set());
        }
        return;
      }

      const userData = userRes.value as { user?: User | null };
      setUser(userData.user ?? null);

      if (likedRes.status === "fulfilled") {
        setLikedIds(likedRes.value);
      }
      if (savedRes.status === "fulfilled") {
        setSavedIds(savedRes.value);
      }
    } finally {
      setLoaded(true);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authLogout();
    } catch {
      // Network failure — still clear client state
    }
    setUser(null);
    setLikedIds(new Set());
    setSavedIds(new Set());
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
      value={{
        user,
        setUser,
        refreshUser,
        logout,
        loaded,
        likedIds,
        toggleLikedId,
        savedIds,
        toggleSavedId,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
