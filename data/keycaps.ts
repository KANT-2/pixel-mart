// 키캡 피팅룸에서 끼워 볼 수 있는 키캡 30종 — 키캡 상품(카테고리 keycap) 하나에 그림 하나.
// 그림: public/images/keycaps/<id>.webp (세트는 <id>-1~4), 원본은 public/assets/keycaps/front-view.
// color는 그림의 대표 색(채도 높은 부분 평균), tone은 서랍 색 필터 묶음이에요.

export type KeycapKind = "one" | "set" | "space";
/** 서랍 색 필터용 색 묶음 */
export type KeycapTone = "red" | "gold" | "green" | "blue" | "purple" | "neutral";

export interface KeycapItem {
  id: string;
  name: string;
  productId: number;
  kind: KeycapKind;
  material: "resin" | "opaque";
  color: string;
  tone: KeycapTone;
  /** 1u 키캡 여러 개가 한 상품인 세트의 구성 개수 (없으면 1개짜리 단품) */
  pack?: number;
}

export const KEYCAP_TONES: { value: KeycapTone; label: string; swatch: string }[] = [
  { value: "red", label: "레드", swatch: "#d23a3a" },
  { value: "gold", label: "골드·옐로", swatch: "#e2b23c" },
  { value: "green", label: "그린", swatch: "#4fa83d" },
  { value: "blue", label: "블루", swatch: "#3b7bdc" },
  { value: "purple", label: "퍼플", swatch: "#8a55c9" },
  { value: "neutral", label: "브라운·실버", swatch: "#8d7a66" },
];

export const KEYCAP_KIND_LABEL: Record<KeycapKind, string> = { one: "1u · 아무 키", set: "방향키 4개", space: "스페이스바" };

export const KEYCAPS: KeycapItem[] = [
  { id: "resin-heart", name: "HP 하트 키캡", productId: 1, kind: "one", material: "resin", color: "#ad1d1d", tone: "red" },
  { id: "resin-coin", name: "코인 키캡 세트", productId: 2, kind: "one", material: "resin", color: "#ae7c20", tone: "gold", pack: 3 },
  { id: "resin-slime", name: "슬라임 아티산 키캡", productId: 9, kind: "one", material: "resin", color: "#79a631", tone: "green" },
  { id: "red-heart", name: "루비 하트 ESC 키캡", productId: 15, kind: "one", material: "opaque", color: "#bc232c", tone: "red" },
  { id: "coin-spacebar", name: "골드 코인 스페이스바 키캡", productId: 21, kind: "space", material: "opaque", color: "#d6aa44", tone: "gold" },
  { id: "treasure-arrows", name: "보물상자 방향키 세트", productId: 27, kind: "set", material: "opaque", color: "#7d4c2c", tone: "neutral" },
  { id: "purple-gems", name: "보랏빛 보석 포인트 키캡 세트", productId: 33, kind: "set", material: "opaque", color: "#5c2871", tone: "purple" },
  { id: "resin-dungeon", name: "던전 게이트 투명 키캡", productId: 39, kind: "one", material: "resin", color: "#5e4279", tone: "purple" },
  { id: "silver-sword", name: "은빛 검 메탈 키캡", productId: 45, kind: "one", material: "opaque", color: "#807c7e", tone: "neutral" },
  { id: "resin-shield", name: "푸른 방패 아티산 키캡", productId: 51, kind: "one", material: "resin", color: "#193db0", tone: "blue" },
  { id: "red-potion", name: "회복 포션 ESC 키캡", productId: 57, kind: "one", material: "opaque", color: "#a01c24", tone: "red" },
  { id: "blue-potion-spacebar", name: "마나 포션 스페이스바 키캡", productId: 63, kind: "space", material: "opaque", color: "#1347a6", tone: "blue" },
  { id: "star-arrows", name: "노란 별 방향키 세트", productId: 69, kind: "set", material: "opaque", color: "#ddb127", tone: "gold" },
  { id: "moon", name: "초승달 포인트 키캡 세트", productId: 75, kind: "one", material: "opaque", color: "#333856", tone: "blue", pack: 4 },
  { id: "resin-rocket", name: "우주선 투명 키캡", productId: 81, kind: "one", material: "resin", color: "#3a5db1", tone: "blue" },
  { id: "green-alien", name: "인베이더 메탈 키캡", productId: 87, kind: "one", material: "opaque", color: "#347d2e", tone: "green" },
  { id: "resin-cat", name: "픽셀 고양이 아티산 키캡", productId: 93, kind: "one", material: "resin", color: "#bb5e1b", tone: "gold" },
  { id: "green-dragon", name: "에메랄드 드래곤 ESC 키캡", productId: 99, kind: "one", material: "opaque", color: "#276849", tone: "green" },
  { id: "spellbook-spacebar", name: "마법서 스페이스바 키캡", productId: 105, kind: "space", material: "opaque", color: "#6a4260", tone: "purple" },
  { id: "gold-key-arrows", name: "황동 열쇠 방향키 세트", productId: 111, kind: "set", material: "opaque", color: "#b78b4a", tone: "gold" },
  { id: "level-up", name: "레벨업 화살표 포인트 키캡 세트", productId: 117, kind: "one", material: "opaque", color: "#168daf", tone: "blue", pack: 4 },
  { id: "resin-diamond", name: "세이브 크리스털 투명 키캡", productId: 123, kind: "one", material: "resin", color: "#1e85a0", tone: "blue" },
  { id: "parchment", name: "퀘스트 두루마리 메탈 키캡", productId: 129, kind: "one", material: "opaque", color: "#977555", tone: "neutral" },
  { id: "resin-crown", name: "보스 왕관 아티산 키캡", productId: 135, kind: "one", material: "resin", color: "#912b1b", tone: "red" },
  { id: "torch", name: "던전 횃불 ESC 키캡", productId: 141, kind: "one", material: "opaque", color: "#d5501e", tone: "red" },
  { id: "ghost-spacebar", name: "유령 스페이스바 키캡", productId: 147, kind: "space", material: "opaque", color: "#5786d4", tone: "blue" },
  { id: "castle-arrows", name: "돌 성채 방향키 세트", productId: 153, kind: "set", material: "opaque", color: "#716050", tone: "neutral" },
  { id: "bomb-set", name: "폭탄 포인트 키캡 세트", productId: 159, kind: "set", material: "opaque", color: "#871b1c", tone: "red" },
  { id: "resin-cloud", name: "구름 투명 키캡", productId: 165, kind: "one", material: "resin", color: "#428fe8", tone: "blue" },
  { id: "red-mushroom", name: "산호 버섯 메탈 키캡", productId: 171, kind: "one", material: "opaque", color: "#a13132", tone: "red" },
];

export function keycapByProduct(productId: number): KeycapItem | undefined {
  return KEYCAPS.find((item) => item.productId === productId);
}
