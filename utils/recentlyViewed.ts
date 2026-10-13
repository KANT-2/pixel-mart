// 최근 본 아이템 — 브라우저(localStorage)에만, 상품 카드에 필요한 최소 정보만 저장한다

export interface RecentItem {
  id: number;
  name: string;
  price: number;
  imageUrl: string;
}

export const RECENT_KEY = "pixelmart:recently-viewed:v1";
export const RECENT_MAX = 12;

/** 저장된 문자열을 목록으로 — 깨졌거나 모양이 다르면 버린다 */
export function parseRecent(raw: string | null): RecentItem[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter((item): item is RecentItem => typeof item === "object" && item !== null
      && Number.isSafeInteger(item.id) && typeof item.name === "string"
      && typeof item.price === "number" && typeof item.imageUrl === "string").slice(0, RECENT_MAX);
  } catch {
    return [];
  }
}

/** 방금 본 상품을 맨 앞으로 (이미 있으면 옮기고, 최대 개수 유지) */
export function addRecent(list: RecentItem[], item: RecentItem, max = RECENT_MAX): RecentItem[] {
  return [item, ...list.filter((entry) => entry.id !== item.id)].slice(0, max);
}

export function removeRecent(list: RecentItem[], id: number): RecentItem[] {
  return list.filter((entry) => entry.id !== id);
}

/** 상세페이지 하단에 보여 줄 목록 — 지금 보고 있는 상품만 뺀다 */
export function recentForDetail(list: RecentItem[], currentId: number): RecentItem[] {
  return list.filter((entry) => entry.id !== currentId);
}
