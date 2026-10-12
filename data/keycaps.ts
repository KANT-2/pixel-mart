// 키캡 피팅룸에서 끼워 볼 수 있는 키캡 30종 — 키캡 상품(카테고리 keycap) 하나에 그림 하나.
// 그림: public/images/keycaps/<id>.webp (세트는 <id>-1~4), 원본은 public/assets/keycaps/front-view.
// color는 어울림 계산용 대표 색(그림의 채도 높은 부분 평균)이에요.

export type KeycapKind = "one" | "set" | "space";

export interface KeycapItem {
  id: string;
  name: string;
  productId: number;
  kind: KeycapKind;
  material: "resin" | "opaque";
  color: string;
}

export const KEYCAP_KIND_LABEL: Record<KeycapKind, string> = { one: "1u · 아무 키", set: "방향키 4개", space: "스페이스바" };

export const KEYCAPS: KeycapItem[] = [
  { id: "resin-heart", name: "HP 하트 키캡", productId: 1, kind: "one", material: "resin", color: "#ad1d1d" },
  { id: "resin-coin", name: "코인 키캡 세트", productId: 2, kind: "one", material: "resin", color: "#ae7c20" },
  { id: "resin-slime", name: "슬라임 아티산 키캡", productId: 9, kind: "one", material: "resin", color: "#79a631" },
  { id: "red-heart", name: "루비 하트 ESC 키캡", productId: 15, kind: "one", material: "opaque", color: "#bc232c" },
  { id: "coin-spacebar", name: "골드 코인 스페이스바 키캡", productId: 21, kind: "space", material: "opaque", color: "#d6aa44" },
  { id: "treasure-arrows", name: "보물상자 방향키 세트", productId: 27, kind: "set", material: "opaque", color: "#7d4c2c" },
  { id: "purple-gems", name: "보랏빛 보석 포인트 키캡 세트", productId: 33, kind: "set", material: "opaque", color: "#5c2871" },
  { id: "resin-dungeon", name: "던전 게이트 투명 키캡", productId: 39, kind: "one", material: "resin", color: "#5e4279" },
  { id: "silver-sword", name: "은빛 검 메탈 키캡", productId: 45, kind: "one", material: "opaque", color: "#807c7e" },
  { id: "resin-shield", name: "푸른 방패 아티산 키캡", productId: 51, kind: "one", material: "resin", color: "#193db0" },
  { id: "red-potion", name: "회복 포션 ESC 키캡", productId: 57, kind: "one", material: "opaque", color: "#a01c24" },
  { id: "blue-potion-spacebar", name: "마나 포션 스페이스바 키캡", productId: 63, kind: "space", material: "opaque", color: "#1347a6" },
  { id: "star-arrows", name: "노란 별 방향키 세트", productId: 69, kind: "set", material: "opaque", color: "#ddb127" },
  { id: "moon", name: "초승달 포인트 키캡 세트", productId: 75, kind: "one", material: "opaque", color: "#333856" },
  { id: "resin-rocket", name: "우주선 투명 키캡", productId: 81, kind: "one", material: "resin", color: "#3a5db1" },
  { id: "green-alien", name: "인베이더 메탈 키캡", productId: 87, kind: "one", material: "opaque", color: "#347d2e" },
  { id: "resin-cat", name: "픽셀 고양이 아티산 키캡", productId: 93, kind: "one", material: "resin", color: "#bb5e1b" },
  { id: "green-dragon", name: "에메랄드 드래곤 ESC 키캡", productId: 99, kind: "one", material: "opaque", color: "#276849" },
  { id: "spellbook-spacebar", name: "마법서 스페이스바 키캡", productId: 105, kind: "space", material: "opaque", color: "#6a4260" },
  { id: "gold-key-arrows", name: "황동 열쇠 방향키 세트", productId: 111, kind: "set", material: "opaque", color: "#b78b4a" },
  { id: "level-up", name: "레벨업 화살표 포인트 키캡 세트", productId: 117, kind: "one", material: "opaque", color: "#168daf" },
  { id: "resin-diamond", name: "세이브 크리스털 투명 키캡", productId: 123, kind: "one", material: "resin", color: "#1e85a0" },
  { id: "parchment", name: "퀘스트 두루마리 메탈 키캡", productId: 129, kind: "one", material: "opaque", color: "#977555" },
  { id: "resin-crown", name: "보스 왕관 아티산 키캡", productId: 135, kind: "one", material: "resin", color: "#912b1b" },
  { id: "torch", name: "던전 횃불 ESC 키캡", productId: 141, kind: "one", material: "opaque", color: "#d5501e" },
  { id: "ghost-spacebar", name: "유령 스페이스바 키캡", productId: 147, kind: "space", material: "opaque", color: "#5786d4" },
  { id: "castle-arrows", name: "돌 성채 방향키 세트", productId: 153, kind: "set", material: "opaque", color: "#716050" },
  { id: "bomb-set", name: "폭탄 포인트 키캡 세트", productId: 159, kind: "set", material: "opaque", color: "#871b1c" },
  { id: "resin-cloud", name: "구름 투명 키캡", productId: 165, kind: "one", material: "resin", color: "#428fe8" },
  { id: "red-mushroom", name: "산호 버섯 메탈 키캡", productId: 171, kind: "one", material: "opaque", color: "#a13132" },
];

export function keycapByProduct(productId: number): KeycapItem | undefined {
  return KEYCAPS.find((item) => item.productId === productId);
}
