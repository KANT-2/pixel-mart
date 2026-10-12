// 키캡 피팅룸 규칙 — 끼우기·빼기, 어울리는 키캡 추천, 서랍 정렬·검색 (순수 함수, 화면과 분리)
import type { KeycapItem, KeycapKind } from "@/data/keycaps";

/** 키 ID → 끼운 키캡 ID */
export type Placement = Record<string, string>;

export interface KeyInfo { id: string; label: string; w: number; }

const ARROWS = ["ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"];

const hasBatchim = (word: string) => { const code = word.charCodeAt(word.length - 1) - 0xac00; return code >= 0 && code <= 11171 && code % 28 > 0; };
/** "HP 하트 키캡을" / "방향키 세트를" — 마지막 글자 받침으로 을/를 */
export function withObject(word: string): string { return word + (hasBatchim(word) ? "을" : "를"); }


export interface PlaceResult { placed: Placement; ok: boolean; message: string; }

/** 키캡 종류에 맞는 자리에만 끼운다 — 스페이스바는 스페이스바, 방향키 세트는 방향키 4개에 한 번에, 1u는 1u 키에 */
export function placeKeycap(placed: Placement, item: KeycapItem, key: KeyInfo): PlaceResult {
  const next = { ...placed };
  if (item.kind === "space") {
    if (key.id !== "Space") return { placed, ok: false, message: "스페이스바 키캡은 스페이스바 자리에만 들어가요." };
    next.Space = item.id;
    return { placed: next, ok: true, message: `${withObject(item.name)} 스페이스바에 끼웠어요.` };
  }
  if (item.kind === "set") {
    for (const arrow of ARROWS) next[arrow] = item.id;
    return { placed: next, ok: true, message: `${withObject(item.name)} 방향키 4개에 한 번에 끼웠어요.` };
  }
  if (key.w !== 1) return { placed, ok: false, message: "1u 키캡이라 Shift·Enter 같은 긴 키에는 맞지 않아요." };
  next[key.id] = item.id;
  return { placed: next, ok: true, message: `${withObject(item.name)} ${key.label} 자리에 끼웠어요.` };
}

/** 키를 누르면 빼기 — 방향키 세트는 네 개를 함께 뺀다 */
export function removeKeycap(placed: Placement, keyId: string, kind: KeycapKind): Placement {
  const next = { ...placed };
  if (kind === "set") for (const arrow of ARROWS) delete next[arrow];
  else delete next[keyId];
  return next;
}

/** 키 위에 올릴 그림 — 세트는 방향키 순서대로 1~4번 그림 */
export function keycapImage(item: KeycapItem, keyId?: string): string {
  const part = item.kind === "set" ? `${item.id}-${keyId ? Math.max(1, ARROWS.indexOf(keyId) + 1) : 1}` : item.id;
  return `/images/keycaps/${part}.webp`;
}

// ---- 색 계산 ----
function rgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}
export function hue(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (!d) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}
const hueGap = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
/** 두 색이 얼마나 다르게 보이는지 0~1 — 밝기만 보면 검은 키캡 위 빨간 키캡을 "비슷하다"고 잘못 봐서 RGB 거리로 */
export function colorDistance(a: string, b: string): number {
  const [r1, g1, b1] = rgb(a), [r2, g2, b2] = rgb(b);
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2) / 441.7;
}

/** 나머지 키 색과 대비가 크고, 이미 끼운 키캡과 색 계열이 가까운 순 */
export function recommendKeycaps(all: KeycapItem[], usedIds: string[], baseColor: string, anchorColor: string, count = 3): KeycapItem[] {
  const anchor = hue(anchorColor);
  return all
    .filter((item) => !usedIds.includes(item.id))
    .map((item) => ({ item, score: colorDistance(item.color, baseColor) * 2 - hueGap(hue(item.color), anchor) / 180 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map(({ item }) => item);
}

/** 서랍 목록 — 보고 있던 키캡을 맨 앞에, 나머지는 원래 순서. 종류 필터와 이름 검색(띄어쓰기 무시) */
export function trayKeycaps(all: KeycapItem[], currentId: string | null, kind: KeycapKind | "all", query: string): KeycapItem[] {
  const keyword = query.replace(/\s/g, "");
  const ordered = currentId ? [...all.filter((item) => item.id === currentId), ...all.filter((item) => item.id !== currentId)] : all;
  return ordered.filter((item) => (kind === "all" || item.kind === kind) && (!keyword || item.name.replace(/\s/g, "").includes(keyword)));
}
