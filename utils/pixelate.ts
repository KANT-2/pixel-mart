export const MAX_AVATAR_BYTES = 50 * 1024;
export const MAX_SOURCE_BYTES = 10 * 1024 * 1024;

export interface PixelateOptions {
  resolution: 16 | 24 | 32;
  colors: 8 | 16;
}

export interface SquareCrop {
  x: number;
  y: number;
  size: number;
}

type Rgba = [number, number, number, number];

interface ColorSample {
  rgba: Rgba;
  count: number;
  key: number;
}

export function getCenteredSquare(width: number, height: number): SquareCrop {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error("이미지 크기를 확인할 수 없습니다.");
  }
  const size = Math.min(width, height);
  return { x: (width - size) / 2, y: (height - size) / 2, size };
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
    throw new Error("아바타는 50KB 이하여야 합니다. 해상도를 낮춰 다시 만들어 주세요.");
  }
  return bytes;
}
