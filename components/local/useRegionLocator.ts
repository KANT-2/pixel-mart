"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { createRegionLocator } from "@/lib/regionLocator";
import type { ApiRegion } from "@/types/api";

export function useRegionLocator(regions: ApiRegion[]) {
  const pathname = usePathname(), store = useMemo(() => createRegionLocator(), []);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  useEffect(() => { store.start(); return store.stop; }, [store, pathname]);
  return { ...state, locate: (onFound: (code: string) => void) => store.locate(regions, onFound, navigator.geolocation ?? null) };
}
