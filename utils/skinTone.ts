/** 사람 아바타 피부색을 정해 둔 두 가지(밝은 톤·어두운 톤) 중 가까운 쪽으로 맞춘다 — 중간색은 쓰지 않는다 */
type Rgb = [number, number, number];

/** 톤마다 밝은 면·기본·그림자 세 단계 */
export const SKIN_TONES: Record<"light" | "dark", { highlight: Rgb; base: Rgb; shadow: Rgb }> = {
  light: { highlight: [255, 228, 208], base: [247, 203, 172], shadow: [222, 160, 128] },
  dark: { highlight: [138, 90, 60], base: [107, 66, 41], shadow: [74, 44, 26] },
};

function hsv([r, g, b]: Rgb): { h: number; s: number; v: number } {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max / 255 };
}

const luma = ([r, g, b]: Rgb) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;
const hueGap = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
export type SkinTone = keyof typeof SKIN_TONES;
const toneOf = (color: Rgb): SkinTone => (luma(color) >= 0.45 ? "light" : "dark");

/** 피부처럼 보이는 색 — 붉은 주황 계열(분홍빛 도는 아주 흰 피부 포함), minSat보다 진하고 너무 짙지 않은 채도 */
export function isSkinLike(color: Rgb, minSat = 0.05): boolean {
  const { h, s, v } = hsv(color);
  return (h >= 340 || h <= 45) && s >= minSat && s <= 0.7 && v >= 0.25 && color[0] >= color[2];
}

/** 원본 사진에서 피부 톤 고르기 — 전신 사진이면 얼굴이 있는 위쪽 가운데의 피부색 픽셀 밝기 중앙값. 못 찾으면 null */
export function photoSkinTone(pixels: Uint8ClampedArray, width: number, height: number): SkinTone | null {
  const lumas: number[] = [];
  for (let y = 0; y < Math.ceil(height * 0.4); y++) for (let x = Math.floor(width * 0.25); x < Math.ceil(width * 0.75); x++) {
    const i = (y * width + x) * 4;
    const [r, g, b] = [pixels[i], pixels[i + 1], pixels[i + 2]];
    // 흔히 쓰는 RGB 피부색 규칙 + 색상 35° 이하 — 회색 배경·검은 머리카락 가장자리·노란 옷은 빠진다
    if (pixels[i + 3] > 0 && r > 95 && g > 40 && b > 20 && r - g > 15 && r > b && isSkinLike([r, g, b], 0.18) && hsv([r, g, b]).h <= 35) lumas.push(luma([r, g, b]));
  }
  if (lumas.length < 12) return null;
  lumas.sort((a, b) => a - b);
  return lumas[lumas.length >> 1] >= 0.45 ? "light" : "dark";
}

/** 얼굴(위쪽 1/3)에서 가장 많이 쓰인 피부색을 찾아, 그 색과 비슷한 얼굴·손 픽셀을 정해 둔 톤으로 바꾼다.
 * tone을 주면(원본 사진에서 고른 톤) 그 톤으로, 없으면 그림의 얼굴색으로 고른다 */
export function snapSkinTones(pixels: Uint8ClampedArray, cols: number, rows: number, tone?: SkinTone | null): Uint8ClampedArray {
  const key = (i: number) => (pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2];
  const rgb = (k: number): Rgb => [k >> 16, (k >> 8) & 255, k & 255];
  const opaqueRow = (y: number) => { for (let x = 0; x < cols; x++) if (pixels[(y * cols + x) * 4 + 3] > 0) return true; return false; };
  let top = 0;
  while (top < rows && !opaqueRow(top)) top++;
  if (top === rows) return pixels;
  let bottom = rows - 1;
  while (!opaqueRow(bottom)) bottom--;
  const headEnd = top + Math.ceil((bottom - top + 1) / 3);
  const counts = new Map<number, number>();
  for (let y = top; y < headEnd; y++) for (let x = 0; x < cols; x++) {
    const i = (y * cols + x) * 4;
    if (pixels[i + 3] === 0) continue;
    const k = key(i);
    if (isSkinLike(rgb(k))) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  if (!counts.size) return pixels;
  const face = rgb([...counts].sort((a, b) => b[1] - a[1])[0][0]);
  const target = SKIN_TONES[tone ?? toneOf(face)];
  const faceHue = hsv(face).h, faceLuma = luma(face);
  // 색마다 얼굴색과 가까운지와 바꿀 톤 단계 — 색상(hue)·밝기가 얼굴색과 가까운 피부색만
  const mapped = new Map<number, Rgb | null>();
  const toneFor = (i: number) => {
    const k = key(i);
    if (!mapped.has(k)) {
      const c = rgb(k), l = luma(c) - faceLuma;
      const near = isSkinLike(c) && hueGap(hsv(c).h, faceHue) <= 15 && Math.abs(l) <= 0.25;
      mapped.set(k, near ? (l > 0.06 ? target.highlight : l < -0.08 ? target.shadow : target.base) : null);
    }
    return mapped.get(k);
  };
  // 16색으로 줄이면 베이지 옷과 얼굴이 같은 색이 되기도 해서 색만으로는 못 가른다 — 위치로 고른다:
  // 머리 칸에 닿은 덩어리는 머리 칸(+목) 안쪽만, 따로 떨어진 작은 덩어리(손 등)는 통째로, 큰 덩어리(옷)는 그대로
  const opaque = pixels.reduce((n, value, index) => (index % 4 === 3 && value > 0 ? n + 1 : n), 0);
  const neckEnd = Math.min(rows, headEnd + Math.ceil((bottom - top + 1) * 0.05));
  const seen = new Uint8Array(cols * rows);
  const out = new Uint8ClampedArray(pixels);
  for (let start = 0; start < cols * rows; start++) {
    if (seen[start] || pixels[start * 4 + 3] === 0 || !toneFor(start * 4)) continue;
    const blob: number[] = [];
    let touchesHead = false;
    seen[start] = 1;
    for (const stack = [start]; stack.length;) {
      const p = stack.pop()!, x = p % cols, y = (p - x) / cols;
      blob.push(p);
      if (y < headEnd) touchesHead = true;
      for (const q of [x > 0 ? p - 1 : -1, x < cols - 1 ? p + 1 : -1, y > 0 ? p - cols : -1, y < rows - 1 ? p + cols : -1]) {
        if (q >= 0 && !seen[q] && pixels[q * 4 + 3] > 0 && toneFor(q * 4)) { seen[q] = 1; stack.push(q); }
      }
    }
    if (!touchesHead && blob.length > opaque * 0.01) continue;
    for (const p of blob) {
      if (touchesHead && p >= neckEnd * cols) continue;
      [out[p * 4], out[p * 4 + 1], out[p * 4 + 2]] = toneFor(p * 4)!;
    }
  }
  return out;
}
