"use client";

import { createContext, useCallback, useContext, type ReactNode } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useLocalResource } from "@/components/local/useLocalResource";
import { loadRegionCatalog, localApi } from "@/lib/local";
import type { ApiLocalProfile, ApiRegion } from "@/types/api";

type Resource<T> = ReturnType<typeof useLocalResource<T>>;
const RegionContext = createContext<Resource<ApiRegion[]> | null>(null);
const ProfileContext = createContext<Resource<ApiLocalProfile | null> | null>(null);
interface LocalProviderProps { children: ReactNode; }
interface AccountProviderProps extends LocalProviderProps { userId: number | null; }

export default function LocalProvider({ children }: LocalProviderProps) {
  const { user, loading } = useAuth();
  const regions = useLocalResource(loadRegionCatalog);
  return <RegionContext.Provider value={regions}>
    <AccountProvider key={loading ? "checking" : user?.id ?? "guest"} userId={loading ? null : user?.id ?? null}>{children}</AccountProvider>
  </RegionContext.Provider>;
}

function AccountProvider({ userId, children }: AccountProviderProps) {
  const load = useCallback((signal: AbortSignal) => userId === null ? Promise.resolve(null) : localApi.profile(signal), [userId]);
  const profile = useLocalResource(load);
  return <ProfileContext.Provider value={profile}>{children}</ProfileContext.Provider>;
}

export function useLocalProfile() {
  const value = useContext(ProfileContext);
  if (!value) throw new Error("LocalProvider가 필요합니다.");
  return value;
}

export function useRegions() {
  const value = useContext(RegionContext);
  if (!value) throw new Error("LocalProvider가 필요합니다.");
  return value;
}
