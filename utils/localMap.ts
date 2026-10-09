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
export function pinCount(count: number | null | undefined): number {
  if (!count || count < 5) return 0;
  return Math.min(6, Math.max(1, Math.round(count / 4.5)));
}

/** 블록 안 임의 칸 n개 — 서로 떨어지게 고르고, 이름표 칸은 피한다 */
export function pickPinCells(cells: Cell[], n: number, seed: number, avoid: Cell | null = null): Cell[] {
  if (n <= 0 || !cells.length) return [];
  const random = seededRandom(seed);
  const pool = cells.filter((cell) => !avoid || Math.abs(cell[0] - avoid[0]) + Math.abs(cell[1] - avoid[1]) > 1);
  const candidates = (pool.length >= n ? pool : cells).slice();
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const picked: Cell[] = [];
  for (const minGap of [3, 2, 1, 0]) {
    for (const cell of candidates) {
      if (picked.length >= n) break;
      if (picked.includes(cell)) continue;
      if (picked.every((p) => Math.max(Math.abs(p[0] - cell[0]), Math.abs(p[1] - cell[1])) >= minGap)) picked.push(cell);
    }
    if (picked.length >= n) break;
  }
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
