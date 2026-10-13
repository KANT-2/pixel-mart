import styles from "./HeroStage.module.css";

// TODO: 커뮤니티 활동 점수가 정해지면 실제 값으로 연결 — 지금은 시안과 같은 고정 숫자
const HUD = { hearts: 2, coins: 3 };

/** 메인 무대 HUD — 하트 뒤 ×2 (이웃 카드와 같은 표기), 코인 뒤 × 003 */
export default function HeroHud() {
  return <>
    <span className={`${styles.hud} ${styles.hudHeart}`} aria-hidden="true">×{HUD.hearts}</span>
    <span className={`${styles.hud} ${styles.hudCoin}`} aria-hidden="true">× {String(HUD.coins).padStart(3, "0")}</span>
  </>;
}
