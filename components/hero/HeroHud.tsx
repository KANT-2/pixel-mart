import styles from "./HeroStage.module.css";

// TODO: 커뮤니티 활동 점수가 정해지면 실제 값으로 연결 — 지금은 시안과 같은 고정 숫자
const HUD = { coins: 3 };

/** 메인 무대 HUD — 시안처럼 하트 앞 HP, 코인 뒤 × 003 */
export default function HeroHud() {
  return <>
    <span className={`${styles.hud} ${styles.hudHeart}`} aria-hidden="true">HP</span>
    <span className={`${styles.hud} ${styles.hudCoin}`} aria-hidden="true">× {String(HUD.coins).padStart(3, "0")}</span>
  </>;
}
