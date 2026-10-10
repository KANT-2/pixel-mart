export const MAX_AVATAR_BYTES = 200 * 1024; // 최대 256×256 격자 (서버와 같은 한도)
export const MAX_SOURCE_BYTES = 10 * 1024 * 1024;

export interface PixelateOptions {
  resolution: 16 | 24 | 32 | 48; // 긴 쪽 칸 수
  colors: 8 | 16;
}

type Rgba = [number, number, number, number];

interface ColorSample {
  rgba: Rgba;
  count: number;
  key: number;
}

// 저장 이미지 크기 — 원본이 이보다 크면 긴 쪽을 최대 길이에 맞추고, 가로·세로 모두 작으면 기본 크기로 둔다
export const AVATAR_MAX_WIDTH = 640;
export const AVATAR_MAX_HEIGHT = 640;
export const AVATAR_BASE_SIZE = 320; // 기본 슬라임과 같은 크기

export interface PixelGrid {
  cols: number;
  rows: number;
}

export interface OutputSize {
  scale: number;
  width: number;
  height: number;
}

function assertSize(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error("이미지 크기를 확인할 수 없습니다.");
  }
}

/** 원본 비율 그대로, 긴 쪽이 cells 칸이 되도록 픽셀 칸 수를 정한다 (자르지 않음) */
export function getPixelGrid(width: number, height: number, cells: number): PixelGrid {
  assertSize(width, height);
  if (width >= height) return { cols: cells, rows: Math.max(1, Math.round((cells * height) / width)) };
  return { cols: Math.max(1, Math.round((cells * width) / height)), rows: cells };
}

/** 저장할 PNG 크기 — 한 칸을 정수 배로 키워 경계가 흐려지지 않게 한다 */
export function getOutputSize(sourceWidth: number, sourceHeight: number, grid: PixelGrid): OutputSize {
  assertSize(sourceWidth, sourceHeight);
  const fitsBox = sourceWidth <= AVATAR_MAX_WIDTH && sourceHeight <= AVATAR_MAX_HEIGHT;
  // 큰 사진은 가로·세로 최대 길이 안에 들어가게, 작은 사진은 기본 크기(긴 쪽 320)로
  const limit = fitsBox
    ? AVATAR_BASE_SIZE / Math.max(grid.cols, grid.rows)
    : Math.min(AVATAR_MAX_WIDTH / grid.cols, AVATAR_MAX_HEIGHT / grid.rows);
  const scale = Math.max(1, Math.floor(limit));
  return { scale, width: grid.cols * scale, height: grid.rows * scale };
}

/** 축소할 때 가장자리에 생기는 반투명 픽셀(테두리처럼 보이는 줄)을 없앤다 */
export function solidifyAlpha(pixels: Uint8ClampedArray): Uint8ClampedArray {
  const result = new Uint8ClampedArray(pixels);
  for (let i = 3; i < result.length; i += 4) result[i] = result[i] >= 128 ? 255 : 0;
  return result;
}

/** 상하좌우 이웃과 모두 다른 외톨이 점을 이웃 다수 색으로 바꿔 깔끔한 도트로 만든다 */
export function despeckle(pixels: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  if (pixels.length !== width * height * 4) throw new Error("픽셀 크기가 올바르지 않습니다.");
  const result = new Uint8ClampedArray(pixels);
  const keyAt = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    return ((pixels[i] << 24) | (pixels[i + 1] << 16) | (pixels[i + 2] << 8) | pixels[i + 3]) >>> 0;
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const neighbors = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]
        .filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < width && ny < height);
      if (neighbors.length < 3) continue;
      const self = keyAt(x, y);
      const counts = new Map<number, { count: number; x: number; y: number }>();
      for (const [nx, ny] of neighbors) {
        const key = keyAt(nx, ny);
        if (key === self) { counts.clear(); break; }
        const entry = counts.get(key);
        if (entry) entry.count += 1;
        else counts.set(key, { count: 1, x: nx, y: ny });
      }
      const majority = [...counts.values()].find((entry) => entry.count >= 3);
      if (!majority) continue;
      const from = (majority.y * width + majority.x) * 4;
      result.set(pixels.subarray(from, from + 4), (y * width + x) * 4);
    }
  }
  return result;
}

function widestChannel(samples: ColorSample[]) {
  const ranges = [0, 1, 2, 3].map((channel) => {
    let min = 255;
    let max = 0;
    for (const sample of samples) {
      min = Math.min(min, sample.rgba[channel]);
      max = Math.max(max, sample.rgba[channel]);
    }
    return max - min;
  });
  const range = Math.max(...ranges);
  return { channel: ranges.indexOf(range), range };
}

function averageColor(samples: ColorSample[]): Rgba {
  const total = samples.reduce((sum, sample) => sum + sample.count, 0);
  return [0, 1, 2, 3].map((channel) => Math.round(
    samples.reduce((sum, sample) => sum + sample.rgba[channel] * sample.count, 0) / total,
  )) as Rgba;
}

export function quantizeColors(pixels: Uint8ClampedArray, colorCount: 8 | 16): Uint8ClampedArray {
  if (pixels.length % 4 !== 0 || (colorCount !== 8 && colorCount !== 16)) {
    throw new Error("픽셀 또는 색 수 설정이 올바르지 않습니다.");
  }

  const samples = new Map<number, ColorSample>();
  let hasTransparent = false;
  for (let i = 0; i < pixels.length; i += 4) {
    const [r, g, b, a] = pixels.subarray(i, i + 4);
    if (a === 0) {
      hasTransparent = true;
      continue;
    }
    const key = ((r << 24) | (g << 16) | (b << 8) | a) >>> 0;
    const existing = samples.get(key);
    if (existing) existing.count += 1;
    else samples.set(key, { rgba: [r, g, b, a], count: 1, key });
  }

  const result = new Uint8ClampedArray(pixels.length);
  if (!samples.size) return result;

  // 투명색도 한 색으로 세고, 같은 입력은 항상 같은 팔레트로 나눈다.
  const paletteSize = colorCount - Number(hasTransparent);
  const buckets: ColorSample[][] = [[...samples.values()].sort((a, b) => a.key - b.key)];
  while (buckets.length < paletteSize) {
    let selected = -1;
    let largestScore = -1;
    for (let i = 0; i < buckets.length; i++) {
      if (buckets[i].length < 2) continue;
      const score = widestChannel(buckets[i]).range * buckets[i].reduce((sum, sample) => sum + sample.count, 0);
      if (score > largestScore) {
        selected = i;
        largestScore = score;
      }
    }
    if (selected === -1) break;

    const bucket = buckets[selected];
    const { channel } = widestChannel(bucket);
    bucket.sort((a, b) => a.rgba[channel] - b.rgba[channel] || a.key - b.key);
    const halfway = bucket.reduce((sum, sample) => sum + sample.count, 0) / 2;
    let count = 0;
    let split = 1;
    for (let i = 0; i < bucket.length - 1; i++) {
      count += bucket[i].count;
      split = i + 1;
      if (count >= halfway) break;
    }
    buckets.splice(selected, 1, bucket.slice(0, split), bucket.slice(split));
  }

  const palette = buckets.map(averageColor);
  const replacements = new Map<number, Rgba>();
  for (const sample of samples.values()) {
    let nearest = palette[0];
    let nearestDistance = Infinity;
    for (const color of palette) {
      const distance = color.reduce((sum, channel, i) => sum + (channel - sample.rgba[i]) ** 2, 0);
      if (distance < nearestDistance) {
        nearest = color;
        nearestDistance = distance;
      }
    }
    replacements.set(sample.key, nearest);
  }

  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] === 0) continue;
    const key = ((pixels[i] << 24) | (pixels[i + 1] << 16) | (pixels[i + 2] << 8) | pixels[i + 3]) >>> 0;
    result.set(replacements.get(key)!, i);
  }
  return result;
}

export function getPngByteSize(dataUrl: string): number {
  const prefix = "data:image/png;base64,";
  if (!dataUrl.startsWith(prefix)) throw new Error("PNG 이미지만 저장할 수 있습니다.");
  const base64 = dataUrl.slice(prefix.length);
  if (!base64 || base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    throw new Error("PNG 이미지 데이터를 읽을 수 없습니다.");
  }
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return (base64.length / 4) * 3 - padding;
}

export function assertAvatarSize(dataUrl: string): number {
  const bytes = getPngByteSize(dataUrl);
  if (bytes > MAX_AVATAR_BYTES) {
    throw new Error("아바타는 200KB 이하여야 합니다. 해상도를 낮춰 다시 만들어 주세요.");
  }
  return bytes;
}
