import {
  getCenteredSquare,
  getPngByteSize,
  MAX_SOURCE_BYTES,
  quantizeColors,
  type PixelateOptions,
} from "@/utils/pixelate";

export interface PixelatedImage {
  dataUrl: string;
  bytes: number;
}

export function validateImageFile(file: File): void {
  if (!file.type.startsWith("image/")) throw new Error("이미지 파일을 선택해 주세요.");
  if (file.size > MAX_SOURCE_BYTES) throw new Error("사진은 10MB 이하로 선택해 주세요.");
  if (file.size === 0) throw new Error("빈 파일입니다. 다른 사진을 선택해 주세요.");
}

export async function pixelateImage(file: File, options: PixelateOptions): Promise<PixelatedImage> {
  validateImageFile(file);
  if (![16, 24, 32].includes(options.resolution) || ![8, 16].includes(options.colors)) {
    throw new Error("해상도 또는 색 수 설정이 올바르지 않습니다.");
  }

  // 원본은 로컬 URL로만 읽고, 밖으로 내보내는 값은 축소한 PNG뿐이다.
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("사진을 읽을 수 없습니다. PNG, JPEG, WebP 등 다른 이미지로 시도해 주세요."));
      image.src = url;
    });
    const { x, y, size } = getCenteredSquare(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = options.resolution;
    canvas.height = options.resolution;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("이 브라우저에서 이미지 변환을 사용할 수 없습니다.");

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, x, y, size, size, 0, 0, options.resolution, options.resolution);
    const reduced = context.getImageData(0, 0, options.resolution, options.resolution);
    reduced.data.set(quantizeColors(reduced.data, options.colors));
    context.putImageData(reduced, 0, 0);

    const dataUrl = canvas.toDataURL("image/png");
    return { dataUrl, bytes: getPngByteSize(dataUrl) };
  } finally {
    URL.revokeObjectURL(url);
  }
}
