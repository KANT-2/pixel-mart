// 키캡 피팅룸 규칙 — 끼우기·빼기와 "내 키보드에 어울리는가" 계산 (순수 함수, 화면과 분리)
import type { KeycapItem, KeycapKind } from "@/data/keycaps";

/** 키 ID → 끼운 키캡 ID */
export type Placement = Record<string, string>;

export interface KeyInfo { id: string; label: string; w: number; }

const ARROWS = ["ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"];

const hasBatchim = (word: string) => { const code = word.charCodeAt(word.length - 1) - 0xac00; return code >= 0 && code <= 11171 && code % 28 > 0; };
/** "HP 하트 키캡을" / "방향키 세트를" — 마지막 글자 받침으로 을/를 */
export function withObject(word: string): string { return word + (hasBatchim(word) ? "을" : "를"); }
/** "블랙 키캡과" / "검은 몸체와" */
export function withAnd(word: string): string { return word + (hasBatchim(word) ? "과" : "와"); }

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
export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
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

export interface MatchHint { tone: "good" | "ok" | "warn" | "info"; text: string; }
export interface MatchResult {
  score: number;
  verdict: string;
  tone: "good" | "ok" | "warn";
  /** 0~100 */
  point: number;
  unity: number;
  lightFit: number;
  hints: MatchHint[];
}

export interface MatchContext {
  /** 나머지 키(기본 키캡 또는 몸체) 색과 이름 — 예: "블랙 키캡", "검은 몸체" */
  baseColor: string;
  baseLabel: string;
  /** 조명 색, 꺼져 있으면 null. "rgb"는 키마다 색이 다른 RGB 조명 */
  lightColor: string | null;
  lightLabel: string;
}

/**
 * 어울림 점수 — 포인트(기본 키캡과의 색 차이) 40% + 통일감(색 계열 개수) 35% + 조명 궁합(색상 거리) 25%.
 * 호환보다 "내 키보드에 어울리는가"를 먼저 보여 주려는 화면용 휴리스틱이에요.
 */
export function matchKeycaps(items: KeycapItem[], context: MatchContext): MatchResult | null {
  if (!items.length) return null;
  const contrast = items.reduce((sum, item) => sum + colorDistance(item.color, context.baseColor), 0) / items.length;
  const groups = new Set(items.map((item) => Math.round(hue(item.color) / 60) % 6)).size;
  const resin = items.some((item) => item.material === "resin");
  const rgbLight = context.lightColor === "rgb";
  const lightFit = rgbLight ? (resin ? 85 : 65)
    : context.lightColor
      ? Math.round(100 - Math.min(...items.map((item) => hueGap(hue(item.color), hue(context.lightColor!)))) / 180 * 60)
      : resin ? 45 : 70;
  const point = Math.min(100, Math.round(contrast * 200));
  const unity = Math.max(10, 100 - (groups - 1) * 30);
  const score = Math.round(point * 0.4 + unity * 0.35 + lightFit * 0.25);
  const tone = score >= 75 ? "good" : score >= 55 ? "ok" : "warn";
  const hints: MatchHint[] = [
    point >= 60 ? { tone: "good", text: `${context.baseLabel} 위에서 포인트가 또렷하게 보여요.` }
      : point >= 30 ? { tone: "ok", text: `${withAnd(context.baseLabel)} 톤이 비슷해 은은하게 어울려요.` }
        : { tone: "warn", text: `${withAnd(context.baseLabel)} 색이 비슷해 잘 안 보여요. 더 밝거나 진한 키캡을 골라 보세요.` },
    groups <= 1 ? { tone: "good", text: "색이 한 계열로 통일돼 깔끔해요." }
      : groups === 2 ? { tone: "ok", text: "포인트 두 가지 색 — 균형이 좋아요." }
        : { tone: "warn", text: `색이 ${groups}가지라 산만할 수 있어요. 한두 개를 빼 보세요.` },
    rgbLight ? (resin ? { tone: "good", text: "RGB 조명이 투명 레진 키캡 속까지 비춰서 더 빛나요." } : { tone: "info", text: "불투명 키캡이라 RGB 빛은 키 사이로만 은은하게 새어 나와요." })
      : !context.lightColor ? { tone: "info", text: resin ? "투명 레진 키캡은 조명을 켜면 속까지 빛나요." : "조명을 켜면 분위기를 더 볼 수 있어요." }
      : lightFit >= 75 ? { tone: "good", text: `${context.lightLabel} 조명과 같은 계열이라 자연스럽게 이어져요.` }
        : { tone: "ok", text: `${context.lightLabel} 조명과 대비돼 키캡이 더 튀어 보여요.` },
  ];
  return { score, verdict: tone === "good" ? "잘 어울려요" : tone === "ok" ? "무난해요" : "조금 아쉬워요", tone, point, unity, lightFit, hints };
}

/** 지금 키캡 색과 대비가 크고, 이미 끼운 키캡(없으면 조명)과 색 계열이 가까운 순 */
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
