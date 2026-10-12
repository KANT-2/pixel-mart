// 덕력지도 픽셀 지도 계산 — DOM 없이 테스트할 수 있는 순수 함수만 둔다

export interface MapGridView {
  cols: number;
  rows: number;
  legend: string[];
  grid: string[];
}

export type Cell = readonly [x: number, y: number];

/** "3a2,b" → "aaa,,b" (숫자는 바로 뒤 문자의 반복 횟수) */
export function decodeRow(encoded: string): string {
  let out = "";
  let count = "";
  for (const char of encoded) {
    if (char >= "0" && char <= "9") count += char;
    else {
      out += char.repeat(count ? Number(count) : 1);
      count = "";
    }
  }
  return out;
}

export function decodeView(view: MapGridView): string[] {
  return view.grid.map(decodeRow);
}

export const blockChar = (index: number) => String.fromCharCode(97 + index);

/** legend 순서의 블록별 칸 목록 */
export function blockCells(rows: string[], legendSize: number): Cell[][] {
  const cells: Cell[][] = Array.from({ length: legendSize }, () => []);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const index = row.charCodeAt(x) - 97;
      if (index >= 0 && index < legendSize) cells[index].push([x, y]);
    }
  });
  return cells;
}

/** 이름표 위치 — 블록 무게중심에 가장 가까운 '안쪽' 칸 (가장자리보다 안쪽을 우선) */
export function labelCell(cells: Cell[], rows?: string[]): Cell | null {
  if (!cells.length) return null;
  const cx = cells.reduce((sum, [x]) => sum + x, 0) / cells.length;
  const cy = cells.reduce((sum, [, y]) => sum + y, 0) / cells.length;
  const interior = rows
    ? cells.filter(([x, y]) => {
      const self = rows[y][x];
      return [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => rows[y + dy]?.[x + dx] === self);
    })
    : [];
  const pool = interior.length ? interior : cells;
  return pool.reduce((best, cell) =>
    (cell[0] - cx) ** 2 + (cell[1] - cy) ** 2 < (best[0] - cx) ** 2 + (best[1] - cy) ** 2 ? cell : best);
}

/** 문자열 → 32비트 시드 (같은 지역·취향이면 핀 배치가 매번 같다 — 개인 데이터는 쓰지 않는다) */
export function hashSeed(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 지역 인원 → 장식 핀 개수 (약 4~5명당 1개, 최대 6개, 5명 미만은 0) */
/** 지역 블록 하나에 올리는 핀 최대 개수 (백엔드 map-avatars와 같은 값) */
export const MAX_PINS = 10;

/** 핀 개수 — 5명 미만 0개, 그 이상은 인원만큼(구매 상위 10명까지) */
export function pinCount(count: number | null | undefined): number {
  if (!count || count < 5) return 0;
  return Math.min(MAX_PINS, count);
}

/** 핀끼리 이만큼(칸) 떨어지면 겹치지 않는다 — 핀 너비가 지도 칸 1.8개 */
export const PIN_GAP = 2;
const PIN_HALF = 0.9;

/** 핀을 놓지 않을 영역 (이름표) — 가운데 좌표와 절반 크기, 지도 칸 단위 */
export interface Box { x: number; y: number; halfW: number; halfH: number; }

/** 이름표 칸에서 만든 기본 영역 — 실제 크기를 재기 전에는 좌우 4칸·위아래 1칸 */
export const labelBox = (cell: Cell, halfW = 4, halfH = 1): Box => ({ x: cell[0] + 0.5, y: cell[1] + 0.5, halfW, halfH });

// 핀은 칸 가운데 아래쪽에 서서 위로 약 1.8칸 — 가운데는 대략 그 칸 위쪽 끝
const pinHits = ([x, y]: Cell, box: Box) => Math.abs(x + 0.5 - box.x) < box.halfW + PIN_HALF && Math.abs(y + 0.1 - box.y) < box.halfH + PIN_HALF;
const gap = (a: Cell, b: Cell) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));

export interface PinOptions {
  /** 핀을 놓지 않을 이름표 영역 */
  avoid?: Box[];
  /** true면 서로 겹치지 않는 만큼만 돌려준다 (n개보다 적을 수 있음) */
  spaced?: boolean;
  /** 이웃 블록에 이미 놓인 핀 — 경계 너머 핀과도 간격을 둔다 */
  taken?: Cell[];
}

/**
 * 블록 안 임의 칸 n개 — 서로 PIN_GAP칸 이상 떨어지게(가능하면 더 넓게) 무작위로 고르고, 이름표 영역은 비운다.
 * spaced가 아니면 블록이 좁을 때 이름표 쪽·더 가까이 순서로 물러서고, 그래도 모자라면 같은 칸을 다시 쓴다.
 */
export function pickPinCells(cells: Cell[], n: number, seed: number, { avoid = [], spaced = false, taken = [] }: PinOptions = {}): Cell[] {
  if (n <= 0 || !cells.length) return [];
  const random = seededRandom(seed);
  const shuffle = (list: Cell[]) => {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  const pool = shuffle(cells.filter((cell) => !avoid.some((box) => pinHits(cell, box))));
  const all = shuffle(cells);
  const picked: Cell[] = [];
  // 이름표를 피한 자리부터 채우고, 모자라면 이름표 아래 자리도 쓴다(이름표가 위에 그려져 글자는 가려지지 않음)
  const steps: [Cell[], number][] = [[pool, PIN_GAP + 1], [pool, PIN_GAP], [all, PIN_GAP], ...(spaced ? [] : [[all, 1], [all, 0]] as [Cell[], number][])];
  for (const [list, minGap] of steps) {
    for (const cell of list) {
      if (picked.length >= n) break;
      if (picked.some((p) => p[0] === cell[0] && p[1] === cell[1])) continue;
      if (!picked.some((p) => gap(p, cell) < minGap) && !taken.some((p) => gap(p, cell) < Math.min(minGap, PIN_GAP))) picked.push(cell);
    }
    if (picked.length >= n) break;
  }
  if (spaced) return picked;
  for (let i = 0; picked.length < n; i++) picked.push(all[i % all.length]);
  return picked;
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

export const SERVICE_RADIUS_KM = 15;

/** 가장 가까운 동·생활권 코드 (서비스 반경 밖이면 null) — 좌표는 이 계산에만 쓰고 버린다 */
export function nearestZone(lat: number, lng: number, centers: Record<string, readonly [number, number]>): string | null {
  let best: string | null = null;
  let bestKm = Infinity;
  for (const [code, [clat, clng]] of Object.entries(centers)) {
    if (!code.includes("-")) continue;
    const km = haversineKm(lat, lng, clat, clng);
    if (km < bestKm) {
      best = code;
      bestKm = km;
    }
  }
  return bestKm <= SERVICE_RADIUS_KM ? best : null;
}

export interface RegionNode {
  code: string;
  parentCode: string | null;
}

/** 지역을 고르면 보여 줄 지도 — 생활권은 부모 구 지도, 시·구는 자기 지도, 없으면 전체 */
export function viewCodeFor(code: string | null, regions: RegionNode[], views: Record<string, unknown>): string {
  let current = code;
  while (current) {
    if (current in views) return current;
    current = regions.find((region) => region.code === current)?.parentCode ?? null;
  }
  return "";
}

/** 전체 › 시 › 구 경로 (지도 코드 기준) */
export function viewTrail(viewCode: string, regions: RegionNode[]): string[] {
  const trail: string[] = [];
  let current: string | null = viewCode || null;
  while (current) {
    trail.unshift(current);
    current = regions.find((region) => region.code === current)?.parentCode ?? null;
  }
  return trail;
}
