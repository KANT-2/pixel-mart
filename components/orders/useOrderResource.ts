"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { createOrderResource } from "@/lib/orderResource";

export function useOrderResource<T>(load: (signal: AbortSignal) => Promise<T>) {
  const resource = useMemo(() => createOrderResource(load), [load]);
  const snapshot = useSyncExternalStore(resource.subscribe, resource.getSnapshot, resource.getSnapshot);

  useEffect(() => {
    resource.start();
    return () => resource.stop();
  }, [resource]);

  return { ...snapshot, refresh: resource.refresh, replaceData: resource.replaceData };
}
