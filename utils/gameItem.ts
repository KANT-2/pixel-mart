// 상품·거래글을 게임 아이템처럼 보여 주는 규칙 (등급·내구도·거래 종류) — 표시용, 데이터는 바꾸지 않는다

export type Rarity = "common" | "uncommon" | "rare" | "epic";

export interface RarityInfo {
  key: Rarity;
  label: string;
  /** 이름·테두리 색 (CSS 변수 이름) */
  color: string;
}

const RARITIES: Record<Rarity, RarityInfo> = {
  common: { key: "common", label: "COMMON", color: "var(--color-sub)" },
  uncommon: { key: "uncommon", label: "UNCOMMON", color: "var(--color-lime)" },
  rare: { key: "rare", label: "RARE", color: "var(--color-mint)" },
  epic: { key: "epic", label: "EPIC", color: "var(--color-violet)" },
};

/** 가격대로 등급 — 1만원 미만 COMMON, 2만원 미만 UNCOMMON, 3만원 미만 RARE, 그 이상 EPIC */
export function rarityOf(price: number | null | undefined): RarityInfo {
  if (price == null || price < 10_000) return RARITIES.common;
  if (price < 20_000) return RARITIES.uncommon;
  if (price < 30_000) return RARITIES.rare;
  return RARITIES.epic;
}

/** 물건 상태 → 내구도 바 */
export function durabilityOf(condition: string | null | undefined): { percent: number; label: string } | null {
  if (condition === "new") return { percent: 100, label: "새 상품" };
  if (condition === "like_new") return { percent: 80, label: "거의 새 상품" };
  if (condition === "used") return { percent: 50, label: "사용감 있음" };
  return null;
}

/** 거래 종류 → 게임 거래소 표시 */
export const TRADE_KIND_GAME: Record<string, { icon: string; tag: string; label: string; tone: string }> = {
  have: { icon: "🎁", tag: "HAVE", label: "교환 가능", tone: "text-mint border-mint/50" },
  want: { icon: "🔍", tag: "WANT", label: "구하는 중", tone: "text-pink border-pink/50" },
  sell: { icon: "🪙", tag: "SELL", label: "판매", tone: "text-lime border-lime/50" },
};

/** 거래 방식 → 아이콘 */
export const TRADE_METHOD_ICON: Record<string, string> = { direct: "🤝", delivery: "📦", both: "🤝📦" };
