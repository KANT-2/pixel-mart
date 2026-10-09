"use client";

import { useAuth } from "@/components/AuthProvider";
import { useLocalProfile, useRegions } from "@/components/local/LocalProvider";

export function useLocalSelection(query: { hasRegion: boolean; region: string | null }) {
  const auth = useAuth(), profile = useLocalProfile(), catalog = useRegions();
  const code = query.hasRegion ? query.region : profile.data?.region?.code ?? null;
  const selected = catalog.data?.find((region) => region.code === code) ?? null;
  const loading = auth.loading || catalog.loading || (!query.hasRegion && Boolean(auth.user) && profile.loading);
  return { auth, profile, catalog, selected, loading, invalid: Boolean(code && catalog.data && !selected) };
}
