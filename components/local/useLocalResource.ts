"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { createLocalResource } from "@/lib/localResource";

export function useLocalResource<T>(load: (signal: AbortSignal) => Promise<T>, delay = 0) {
  const resource = useMemo(() => createLocalResource(load, delay), [load, delay]);
  const snapshot = useSyncExternalStore(resource.subscribe, resource.getSnapshot, resource.getSnapshot);
  useEffect(() => { resource.start(); return () => resource.stop(); }, [resource]);
  return { ...snapshot, refresh: resource.refresh, replace: resource.replace };
}
