// 픽셀 캔버스·AI 결과 정리 — DOM 없이 테스트할 수 있는 순수 함수 (RGBA 배열, 투명 = alpha 0)

export interface PixelGridData {
  cols: number;
  rows: number;
  pixels: Uint8ClampedArray;
}

export type Rgba = readonly [number, number, number, number];

export const TRANSPARENT: Rgba = [0, 0, 0, 0];

/** 게임 팔레트 — 사이트 색 + 피부·머리카락·옷에 자주 쓰는 색 */
export const PALETTE = [
  "#14102a", "#ffffff", "#8e88b3", "#3a3170",
  "#ffd9b8", "#f2b48a", "#c98a5e", "#7a4b2a",
  "#2b1d14", "#5b3a29", "#ffd54a", "#ff7a96",
  "#c23a5c", "#b6ff5c", "#4caf6a", "#6ef2d6",
  "#2f9e8f", "#a78bff", "#5b3fc8", "#3a6fd8",
] as const;

export function hexToRgba(hex: string): Rgba {
  const value = hex.replace("#", "");
  return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16), 255];
}

export function rgbaToHex([r, g, b]: Rgba): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export function createGrid(cols: number, rows: number): PixelGridData {
  return { cols, rows, pixels: new Uint8ClampedArray(cols * rows * 4) };
}

export function getPixel(grid: PixelGridData, x: number, y: number): Rgba {
  const i = (y * grid.cols + x) * 4;
  const p = grid.pixels;
  return [p[i], p[i + 1], p[i + 2], p[i + 3]];
}

const same = (a: Rgba, b: Rgba) => (a[3] === 0 && b[3] === 0) || (a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3]);

/** 칸 하나 칠하기 (대칭 모드면 좌우 반대 칸도) — 새 격자를 돌려준다 */
export function paint(grid: PixelGridData, x: number, y: number, color: Rgba, mirror = false): PixelGridData {
  if (x < 0 || y < 0 || x >= grid.cols || y >= grid.rows) return grid;
  const pixels = new Uint8ClampedArray(grid.pixels);
  for (const px of mirror ? [x, grid.cols - 1 - x] : [x]) pixels.set(color, (y * grid.cols + px) * 4);
  return { ...grid, pixels };
}

/** 두 칸 사이를 빈틈없이 잇는 칸들 (빠르게 그려도 선이 끊기지 않게) */
export function lineCells(x0: number, y0: number, x1: number, y1: number): [number, number][] {
  const cells: [number, number][] = [];
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    cells.push([x, y]);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
  return cells;
}

/** 같은 색으로 이어진 영역 채우기 (상하좌우) */
export function floodFill(grid: PixelGridData, x: number, y: number, color: Rgba): PixelGridData {
  if (x < 0 || y < 0 || x >= grid.cols || y >= grid.rows) return grid;
  const target = getPixel(grid, x, y);
  if (same(target, color)) return grid;
  const pixels = new Uint8ClampedArray(grid.pixels);
  const read = (cx: number, cy: number): Rgba => {
    const i = (cy * grid.cols + cx) * 4;
    return [pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]];
  };
  const stack: [number, number][] = [[x, y]];
  while (stack.length) {
    const [cx, cy] = stack.pop()!;
    if (cx < 0 || cy < 0 || cx >= grid.cols || cy >= grid.rows || !same(read(cx, cy), target)) continue;
    pixels.set(color, (cy * grid.cols + cx) * 4);
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
  return { ...grid, pixels };
}

/** 문자 맵 스프라이트를 격자 가운데 아래쪽에 놓는다 (템플릿용) */
export function stamp(grid: PixelGridData, rows: string[], palette: Record<string, string>): PixelGridData {
  const height = rows.length;
  const width = Math.max(...rows.map((row) => row.length));
  const left = Math.floor((grid.cols - width) / 2);
  const top = Math.max(0, grid.rows - height - Math.floor(grid.rows / 8));
  let next = grid;
  rows.forEach((row, y) => [...row].forEach((char, x) => {
    if (palette[char]) next = paint(next, left + x, top + y, hexToRgba(palette[char]));
  }));
  return next;
}

/** 칠해진 칸이 있는지 (빈 캔버스 저장 방지) */
export function isEmpty(grid: PixelGridData): boolean {
  for (let i = 3; i < grid.pixels.length; i += 4) if (grid.pixels[i] > 0) return false;
  return true;
}

// ---- AI 결과 정리 ----

/** 마젠타(#FF00FF) 배경과 그 근처 색을 투명으로 — 프롬프트에서 배경을 마젠타로 지정한다 */
export function keyOutMagenta(pixels: Uint8ClampedArray, tolerance = 90): Uint8ClampedArray {
  const result = new Uint8ClampedArray(pixels);
  for (let i = 0; i < result.length; i += 4) {
    const [r, g, b] = [result[i], result[i + 1], result[i + 2]];
    const distance = Math.hypot(255 - r, g, 255 - b);
    if (distance < tolerance || (r > 200 && b > 200 && g < 90)) result[i + 3] = 0;
  }
  return result;
}

/** 테두리 픽셀 중 가장 흔한 색(16단계로 묶어 셈) — AI가 깐 단색 배경 */
export function borderColor(pixels: Uint8ClampedArray, width: number, height: number): [number, number, number] {
  const counts = new Map<number, { n: number; sum: [number, number, number] }>();
  const add = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    const key = ((pixels[i] >> 4) << 8) | ((pixels[i + 1] >> 4) << 4) | (pixels[i + 2] >> 4);
    const entry = counts.get(key) ?? { n: 0, sum: [0, 0, 0] };
    entry.n++; entry.sum[0] += pixels[i]; entry.sum[1] += pixels[i + 1]; entry.sum[2] += pixels[i + 2];
    counts.set(key, entry);
  };
  for (let x = 0; x < width; x++) { add(x, 0); add(x, height - 1); }
  for (let y = 1; y < height - 1; y++) { add(0, y); add(width - 1, y); }
  let best = { n: 0, sum: [0, 0, 0] as [number, number, number] };
  for (const entry of counts.values()) if (entry.n > best.n) best = entry;
  return best.sum.map((v) => Math.round(v / Math.max(1, best.n))) as [number, number, number];
}

/**
 * 배경 지우기 — 테두리에서 이어진 배경색 영역만 투명으로 (캐릭터 안의 같은 색은 남김).
 * 배경색과 아주 가까운 색으로 갇힌 틈(팔·다리 사이)은 좁은 기준으로 한 번 더 지운다.
 */
export function keyOutBackground(pixels: Uint8ClampedArray, width: number, height: number, tolerance = 80): Uint8ClampedArray {
  const result = new Uint8ClampedArray(pixels);
  const [br, bg, bb] = borderColor(pixels, width, height);
  const near = (i: number, limit: number) => Math.hypot(result[i] - br, result[i + 1] - bg, result[i + 2] - bb) < limit;
  const seen = new Uint8Array(width * height);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    const p = y * width + x;
    if (seen[p] || !near(p * 4, tolerance)) return;
    seen[p] = 1; stack.push(p);
  };
  for (let x = 0; x < width; x++) { push(x, 0); push(x, height - 1); }
  for (let y = 0; y < height; y++) { push(0, y); push(width - 1, y); }
  while (stack.length) {
    const p = stack.pop()!;
    result[p * 4 + 3] = 0;
    const x = p % width, y = (p - x) / width;
    if (x > 0) push(x - 1, y);
    if (x < width - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < height - 1) push(x, y + 1);
  }
  for (let i = 0; i < result.length; i += 4) if (result[i + 3] && near(i, tolerance / 3)) result[i + 3] = 0;
  return result;
}

/** 불투명 픽셀을 감싸는 최소 사각형 (없으면 null) */
export function opaqueBounds(pixels: Uint8ClampedArray, width: number, height: number) {
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3] < 128) continue;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
  }
  return maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/**
 * 큰 이미지의 한 영역을 픽셀 격자로 줄인다 — 칸마다 가장 많이 나온 색(최빈값)을 써서
 * 흐릿한 평균색 대신 원래 도트 색을 지키고, 칸의 절반 이상이 투명이면 투명으로 둔다.
 */
export function snapToGrid(
  pixels: Uint8ClampedArray, width: number,
  area: { x: number; y: number; width: number; height: number },
  longCells: number,
): PixelGridData {
  const cols = area.width >= area.height ? longCells : Math.max(1, Math.round((longCells * area.width) / area.height));
  const rows = area.width >= area.height ? Math.max(1, Math.round((longCells * area.height) / area.width)) : longCells;
  const grid = createGrid(cols, rows);
  const cellW = area.width / cols;
  const cellH = area.height / rows;
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const counts = new Map<number, number>();
      let total = 0;
      let transparent = 0;
      for (let y = Math.floor(area.y + gy * cellH); y < Math.floor(area.y + (gy + 1) * cellH); y++) {
        for (let x = Math.floor(area.x + gx * cellW); x < Math.floor(area.x + (gx + 1) * cellW); x++) {
          const i = (y * width + x) * 4;
          total++;
          if (pixels[i + 3] < 128) { transparent++; continue; }
          // 비슷한 색은 같은 칸으로 묶어 최빈값을 안정적으로 (채널당 상위 5비트)
          const key = ((pixels[i] >> 3) << 10) | ((pixels[i + 1] >> 3) << 5) | (pixels[i + 2] >> 3);
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
      }
      if (!total || transparent * 2 >= total || !counts.size) continue;
      const key = [...counts.entries()].reduce((best, entry) => entry[1] > best[1] ? entry : best)[0];
      const color: Rgba = [((key >> 10) & 31) * 8 + 4, ((key >> 5) & 31) * 8 + 4, (key & 31) * 8 + 4, 255];
      grid.pixels.set(color, (gy * cols + gx) * 4);
    }
  }
  return grid;
}
