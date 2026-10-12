import styles from "./HeroStage.module.css";

// TODO: 커뮤니티 활동 점수가 정해지면 실제 값으로 연결 — 지금은 게임 화면 느낌을 위한 고정 숫자
const HUD = { hearts: 24, coins: 1280 };

/** 메인 무대 HUD — 하트·코인 옆 숫자 */
export default function HeroHud() {
  return <>
    <span className={`${styles.hud} ${styles.hudHeart}`} aria-hidden="true">× {HUD.hearts}</span>
    <span className={`${styles.hud} ${styles.hudCoin}`} aria-hidden="true">× {HUD.coins.toLocaleString("ko-KR")}</span>
  </>;
}
