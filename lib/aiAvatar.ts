import { api } from "@/lib/api";
import { keyOutBackground, opaqueBounds, snapToGrid, type PixelGridData } from "@/utils/pixelCanvas";
import { despeckle, quantizeColors } from "@/utils/pixelate";
import { photoSkinTone, snapSkinTones } from "@/utils/skinTone";
import type { ApiAiAvatarStatus } from "@/types/api";

export const MAX_PHOTO_SOURCE_BYTES = 10 * 1024 * 1024;
/** 서버 설정을 모를 때의 안전한 크기 — Cloudflare FLUX.2 klein은 참고 이미지가 512px보다 작아야 한다 */
export const DEFAULT_PHOTO_SIDE = 504;

/** 동의 문구에 보여 줄 실제 AI 제공자와 보내기 전 사진 크기 */
export function aiAvatarStatus(signal?: AbortSignal): Promise<ApiAiAvatarStatus> {
  return api.get<ApiAiAvatarStatus>("/avatars/ai", { cache: "no-store", signal });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("이미지를 읽을 수 없어요. PNG, JPEG, WebP 사진을 골라 주세요."));
    image.src = src;
  });
}

/** 보내기 전에 긴 변 maxSide px JPEG로 다시 그린다 — 용량을 줄이고 EXIF(위치 등)도 사라진다 */
export async function preparePhoto(file: File, maxSide = DEFAULT_PHOTO_SIDE): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("이미지 파일을 골라 주세요.");
  if (file.size > MAX_PHOTO_SOURCE_BYTES) throw new Error("사진은 10MB 이하로 골라 주세요.");
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("이 브라우저에서는 사진을 처리할 수 없어요.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.88);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** person: 머리:몸 1:2 미니미 형식 / other: 동물·캐릭터·사물을 원래 비율 그대로 */
export type AiSubject = "person" | "other";

export async function requestAiAvatar(photo: string, subject: AiSubject = "person", signal?: AbortSignal): Promise<string> {
  const result = await api.post<{ image: string }>("/avatars/ai", { photo, subject, consent: true }, { signal });
  return result.image;
}

/** 아바타 격자 최대 크기 — 긴 쪽 256칸 */
export const MAX_AVATAR_CELLS = 256;

/** 원본 사진을 작게 그려 피부 톤(밝은·어두운)을 고른다 — AI가 피부색을 바꿔 그려도 사진 기준으로 맞추려고 */
async function skinToneFromPhoto(photo: string) {
  const element = await loadImage(photo);
  const scale = Math.min(1, 96 / Math.max(element.naturalWidth, element.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(element.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(element.naturalHeight * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(element, 0, 0, canvas.width, canvas.height);
  return photoSkinTone(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
}

/** AI가 그린 큰 이미지 → 테두리에서 이어진 단색 배경 제거(투명) → 캐릭터만 잘라 픽셀 격자로 → 색 16개로 정리.
 * 사람이면 피부색을 정해 둔 두 톤(사진 기준) 중 하나로 맞춘다 */
export async function aiImageToGrid(image: string, subject: AiSubject = "person", photo?: string, longCells = MAX_AVATAR_CELLS): Promise<PixelGridData> {
  const element = await loadImage(image);
  const canvas = document.createElement("canvas");
  canvas.width = element.naturalWidth;
  canvas.height = element.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("이 브라우저에서는 이미지를 처리할 수 없어요.");
  context.drawImage(element, 0, 0);
  const data = context.getImageData(0, 0, canvas.width, canvas.height);
  const keyed = keyOutBackground(data.data, canvas.width, canvas.height);
  const bounds = opaqueBounds(keyed, canvas.width, canvas.height);
  if (!bounds) throw new Error("캐릭터를 찾지 못했어요. 다른 사진으로 다시 만들어 보세요.");
  const grid = snapToGrid(keyed, canvas.width, bounds, longCells);
  const cleaned = despeckle(quantizeColors(grid.pixels, 16), grid.cols, grid.rows);
  if (subject !== "person") return { ...grid, pixels: cleaned };
  const tone = photo ? await skinToneFromPhoto(photo).catch(() => null) : null;
  return { ...grid, pixels: snapSkinTones(cleaned, grid.cols, grid.rows, tone) };
}

/** AI 없이 사진을 그대로 픽셀 격자로 — 브라우저 안에서만 처리하고 아무 데도 보내지 않는다 (AI가 못 그렸을 때 대안) */
export async function photoToGrid(photo: string, longCells = 64): Promise<PixelGridData> {
  const element = await loadImage(photo);
  const canvas = document.createElement("canvas");
  canvas.width = element.naturalWidth;
  canvas.height = element.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("이 브라우저에서는 이미지를 처리할 수 없어요.");
  context.drawImage(element, 0, 0);
  const data = context.getImageData(0, 0, canvas.width, canvas.height);
  const grid = snapToGrid(data.data, canvas.width, { x: 0, y: 0, width: canvas.width, height: canvas.height }, longCells);
  const cleaned = despeckle(quantizeColors(grid.pixels, 16), grid.cols, grid.rows);
  return { ...grid, pixels: cleaned };
}
