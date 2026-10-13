import type { CSSProperties } from "react";
import HeroCharacter from "./HeroCharacter";
import HeroHud from "./HeroHud";
import HeroQuest from "./HeroQuest";
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

interface HeroStageProps {
  /** 메인 배너 — 넓은 화면에서 하늘·성벽을 배너 전체로 늘리고 장면은 오른쪽에 */
  wide?: boolean;
}

export default function HeroStage({ wide = false }: HeroStageProps) {
  return (
    <MotionBoundary className={`${styles.stage} ${wide ? styles.wide : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- 서버에서 생성한 고정 비율 픽셀 배경 */}
      <img src="/images/hero-scene-bg.svg" alt="달이 뜬 밤하늘 아래 픽셀 성벽" className={styles.background} width={800} height={600} />
      {/* 800×600 원본 위치를 퍼센트 좌표로 보존해 소품을 더할 수 있습니다. 넓게 펼칠 때도 장면은 4:3 그대로 */}
      <div className={styles.scene}>
      {/* 넓은 무대에서는 배경 그림 대신 이어 붙인 하늘을 쓰므로 달만 따로 */}
      {/* eslint-disable-next-line @next/next/no-img-element -- 픽셀 달 */}
      <img src="/images/hero-moon.svg" alt="" aria-hidden="true" className={styles.moon} width={36} height={48} />
      <SpriteLayer name="star" x={30} y={20} width={2.5} className={styles.star} delay="0s" />
      <SpriteLayer name="star" x={68.75} y={11.667} width={2.5} className={styles.star} delay="0.8s" />
      <SpriteLayer name="star" x={86.25} y={31.667} width={2.5} className={styles.star} delay="1.6s" />
      {/* 하트는 이웃 카드처럼 아이콘 하나 + "×N" */}
      <SpriteLayer name="heart" x={5} y={6} width={5.625} />
      <SpriteLayer name="coin" x={77} y={6} width={5} className={styles.coin} />
      <HeroHud />
      <SpriteLayer name="sword" x={64.625} y={49.667} width={7} />
      <SpriteLayer name="chest" x={75.75} y={55.25} width={13.5} />
      <HeroCharacter />
      <HeroQuest />
      </div>
    </MotionBoundary>
  );
}
