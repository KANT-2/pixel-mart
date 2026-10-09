import type { ApiFandom, ApiInterest, ApiRegion, FandomPeriod, InterestType, RegionLevel } from "@/types/api";

export const INTEREST_TYPES: { value: InterestType; label: string }[] = [
  { value: "character", label: "캐릭터" }, { value: "work", label: "작품" },
  { value: "style", label: "스타일" }, { value: "product_type", label: "상품 종류" },
];
export const FANDOM_PERIODS: { value: FandomPeriod; label: string }[] = [
  { value: "all", label: "전체" }, { value: "30d", label: "최근 30일" }, { value: "90d", label: "최근 90일" },
];

export function regionPath(regions: ApiRegion[], code: string | null): ApiRegion[] {
  const path: ApiRegion[] = [];
  const seen = new Set<string>();
  let current = regions.find((region) => region.code === code);
  while (current && !seen.has(current.code)) {
    path.unshift(current);
    seen.add(current.code);
    current = regions.find((region) => region.code === current?.parentCode);
  }
  return path;
}

export function changeRegion(regions: ApiRegion[], current: string | null, level: RegionLevel, next: string): string | null {
  const levels: RegionLevel[] = ["sido", "sigungu", "zone"];
  const index = levels.indexOf(level);
  const parent = regionPath(regions, current).find((region) => region.level === levels[index - 1]);
  if (!next) return parent?.code ?? null;
  const selected = regions.find((region) => region.code === next && region.level === level);
  return selected && selected.parentCode === (parent?.code ?? null) ? selected.code : current;
}

export function toggleInterest(selected: ApiInterest[], item: ApiInterest): { items: ApiInterest[]; error: string | null } {
  if (selected.some((value) => value.id === item.id)) return { items: selected.filter((value) => value.id !== item.id), error: null };
  if (selected.length >= 20) return { items: selected, error: "취향은 최대 20개까지 선택할 수 있어요." };
  return { items: [...selected, item], error: null };
}

export function fandomPresentation(row: Pick<ApiFandom, "count" | "belowThreshold" | "isSample">) {
  const hidden = row.belowThreshold || row.count === null || row.count < 5;
  return { label: hidden ? "5명 미만" : `${row.count}명`, count: hidden ? null : row.count, sample: row.isSample ? "샘플 데이터" : null };
}

export function parseLocalQuery(params: { get(name: string): string | null }) {
  const rawPeriod = params.get("period");
  const period: FandomPeriod = FANDOM_PERIODS.find((item) => item.value === rawPeriod)?.value ?? "all";
  const rawInterest = params.get("interest");
  const interest = rawInterest && /^[1-9]\d*$/.test(rawInterest) && Number.isSafeInteger(Number(rawInterest)) ? Number(rawInterest) : null;
  const region = params.get("region");
  return { period, interest, region: region && region.length <= 12 ? region : null, hasRegion: region !== null };
}

export function localHref(region: string | null, period: FandomPeriod = "all", interest: number | null = null): string {
  const params = new URLSearchParams();
  // 빈 region은 저장 동네로 돌아가지 않고 사용자가 선택을 해제한 상태를 유지합니다.
  params.set("region", region ?? "");
  if (period !== "all") params.set("period", period);
  if (interest !== null) params.set("interest", String(interest));
  return `/local?${params}`;
}

export function localSettingsHref(region: string | null, anchor = "region") {
  return `/local/settings${region ? `?region=${encodeURIComponent(region)}` : ""}#${anchor}`;
}

export function interestProductHref(name?: string) {
  return name ? `/products?${new URLSearchParams({ q: name })}` : "/products";
}
