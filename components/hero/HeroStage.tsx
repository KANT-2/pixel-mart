import type { CSSProperties } from "react";
import HeroCharacter from "./HeroCharacter";
import MotionBoundary from "./MotionBoundary";
import styles from "./HeroStage.module.css";

interface SpriteLayerProps {
  name: "star" | "heart" | "coin" | "sword" | "chest";
  x: number;
  y: number;
  width: number;
  className?: string;
  delay?: string;
}

function SpriteLayer({ name, x, y, width, className = "", delay }: SpriteLayerProps) {
  const style: CSSProperties = { left: `${x}%`, top: `${y}%`, width: `${width}%`, animationDelay: delay };
  // 원본 스프라이트 비율을 유지해 각 레이어를 픽셀 단위로 표현합니다.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/images/hero-${name}.svg`} alt="" aria-hidden="true" className={`${styles.layer} ${className}`} style={style} />;
}

export default function HeroStage() {
  return (
    <MotionBoundary className={styles.stage}>
      {/* eslint-disable-next-line @next/next/no-img-element -- 서버에서 생성한 고정 비율 픽셀 배경 */}
      <img src="/images/hero-scene-bg.svg" alt="달이 뜬 밤하늘 아래 픽셀 성벽" className={styles.background} width={800} height={600} />
      {/* 800×600 원본 위치를 퍼센트 좌표로 보존해 소품을 더할 수 있습니다. */}
      <SpriteLayer name="star" x={30} y={20} width={2.5} className={styles.star} delay="0s" />
      <SpriteLayer name="star" x={68.75} y={11.667} width={2.5} className={styles.star} delay="0.8s" />
      <SpriteLayer name="star" x={86.25} y={31.667} width={2.5} className={styles.star} delay="1.6s" />
      <SpriteLayer name="heart" x={5} y={6} width={5.625} />
      <SpriteLayer name="heart" x={11.5} y={6} width={5.625} />
      <SpriteLayer name="heart" x={18} y={6} width={5.625} className={styles.emptyHeart} />
      <SpriteLayer name="coin" x={80} y={6} width={5} className={styles.coin} />
      <SpriteLayer name="sword" x={64.625} y={49.667} width={7} />
      <SpriteLayer name="chest" x={75.75} y={55.25} width={13.5} />
      <HeroCharacter />
    </MotionBoundary>
  );
}
