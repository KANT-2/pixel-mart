import {
  despeckle,
  getOutputSize,
  getPixelGrid,
  getPngByteSize,
  MAX_SOURCE_BYTES,
  quantizeColors,
  solidifyAlpha,
  type PixelateOptions,
} from "@/utils/pixelate";

export interface PixelatedImage {
  dataUrl: string;
  bytes: number;
  width: number;
  height: number;
}

export function validateImageFile(file: File): void {
  if (!file.type.startsWith("image/")) throw new Error("이미지 파일을 선택해 주세요.");
  if (file.size > MAX_SOURCE_BYTES) throw new Error("사진은 10MB 이하로 선택해 주세요.");
  if (file.size === 0) throw new Error("빈 파일입니다. 다른 사진을 선택해 주세요.");
}

function canvas2d(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("이 브라우저에서 이미지 변환을 사용할 수 없습니다.");
  return { canvas, context };
}

/** 한 번에 크게 줄이면 색이 뭉개지므로 절반씩 줄여 칸 크기에 가깝게 만든다 */
function shrinkTo(image: CanvasImageSource, width: number, height: number, targetWidth: number, targetHeight: number) {
  let source = image;
  let w = width;
  let h = height;
  while (w / 2 > targetWidth && h / 2 > targetHeight) {
    w = Math.round(w / 2);
    h = Math.round(h / 2);
    const step = canvas2d(w, h);
    step.context.imageSmoothingQuality = "high";
    step.context.drawImage(source, 0, 0, w, h);
    source = step.canvas;
  }
  const result = canvas2d(targetWidth, targetHeight);
  result.context.imageSmoothingQuality = "high";
  // 도트가 또렷해 보이도록 채도·대비를 살짝 올린다
  result.context.filter = "saturate(1.25) contrast(1.08)";
  result.context.drawImage(source, 0, 0, targetWidth, targetHeight);
  return result;
}

export async function pixelateImage(file: File, options: PixelateOptions): Promise<PixelatedImage> {
  validateImageFile(file);
  if (![16, 24, 32, 48].includes(options.resolution) || ![8, 16].includes(options.colors)) {
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
    const { naturalWidth: width, naturalHeight: height } = image;
    // 자르지 않고 원본 비율 그대로 축소
    const grid = getPixelGrid(width, height, options.resolution);
    const small = shrinkTo(image, width, height, grid.cols, grid.rows);
    const reduced = small.context.getImageData(0, 0, grid.cols, grid.rows);
    const solid = solidifyAlpha(reduced.data);
    reduced.data.set(despeckle(quantizeColors(solid, options.colors), grid.cols, grid.rows));
    small.context.putImageData(reduced, 0, 0);

    // 한 칸을 정수 배로 키워 저장 — 어디서 보여도 경계가 흐려지지 않는다
    const size = getOutputSize(width, height, grid);
    const output = canvas2d(size.width, size.height);
    output.context.imageSmoothingEnabled = false;
    output.context.drawImage(small.canvas, 0, 0, size.width, size.height);

    const dataUrl = output.canvas.toDataURL("image/png");
    return { dataUrl, bytes: getPngByteSize(dataUrl), width: size.width, height: size.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}
