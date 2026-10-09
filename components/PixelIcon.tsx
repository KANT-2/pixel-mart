/** 사이트의 픽셀 아이콘(HUD 하트·코인·상자 등) — 시스템 이모지 대신 쓴다 */
export type PixelIconName = "heart" | "coin" | "chest" | "star" | "sword" | "slime";

interface PixelIconProps { name: PixelIconName; className?: string; }

export default function PixelIcon({ name, className = "size-4" }: PixelIconProps) {
  // eslint-disable-next-line @next/next/no-img-element -- 작은 픽셀 SVG를 보간 없이 그대로
  return <img src={`/images/hero-${name}.svg`} alt="" aria-hidden="true" className={`inline-block shrink-0 align-[-0.15em] [image-rendering:pixelated] ${className}`} />;
}
