"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { ApiUser } from "@/types/api";

interface AuthContextValue {
  user: ApiUser | null;
  loading: boolean;
  pending: boolean;
  error: string | null;
  login: (email: string, nickname?: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  updateUser: (nextUser: ApiUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sequence = useRef(0);
  const mutating = useRef(false);

  const updateUser = useCallback((nextUser: ApiUser) => {
    // 로그아웃 중이거나 다른 사용자의 오래된 저장 응답이면 반영하지 않습니다.
    if (mutating.current) return;
    ++sequence.current;
    setUser((current) => current?.id === nextUser.id ? nextUser : current);
  }, []);

  const refresh = useCallback((signal?: AbortSignal): Promise<void> => {
    if (mutating.current) return Promise.resolve();
    const request = ++sequence.current;
    const timeout = AbortSignal.timeout(5000);
    return api.get<ApiUser>("/auth/me", { cache: "no-store", signal: signal ? AbortSignal.any([signal, timeout]) : timeout }).then((nextUser) => {
      if (signal?.aborted || request !== sequence.current) return;
      setUser(nextUser);
      setError(null);
    }).catch((cause: unknown) => {
      if (signal?.aborted || request !== sequence.current) return;
      if (cause instanceof ApiError && cause.status === 401) {
        setUser(null);
        setError(null);
      } else {
        setError("로그인 상태를 확인하지 못했어요. 다시 시도해 주세요.");
      }
    }).finally(() => {
      if (!signal?.aborted && request === sequence.current) setLoading(false);
    });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  const login = useCallback(async (email: string, nickname?: string) => {
    if (mutating.current) return;
    mutating.current = true;
    ++sequence.current;
    setPending(true);
    try {
      const nextUser = await api.post<ApiUser>("/auth/dev-login", { email, ...(nickname ? { nickname } : {}) });
      setUser(nextUser);
      setError(null);
    } finally {
      mutating.current = false;
      setPending(false);
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    if (mutating.current) return;
    mutating.current = true;
    ++sequence.current;
    setPending(true);
    try {
      await api.post("/auth/logout");
      setUser(null);
      setError(null);
    } finally {
      mutating.current = false;
      setPending(false);
      setLoading(false);
    }
  }, []);

  return <AuthContext.Provider value={{ user, loading, pending, error, login, logout, refresh, updateUser }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth는 AuthProvider 안에서만 사용할 수 있습니다.");
  return context;
}
