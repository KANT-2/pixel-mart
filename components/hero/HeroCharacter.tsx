"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import PixelAvatar from "@/components/avatar/PixelAvatar";
import styles from "./HeroStage.module.css";

export default function HeroCharacter() {
  const { user, loading } = useAuth();
  const [jump, setJump] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  // 큰 아바타(긴 쪽 640)는 슬라임 면적의 2배까지 — 한 변 약 1.41배
  const [large, setLarge] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const greet = () => {
    setJump((previous) => previous + 1);
    setSpeaking(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setSpeaking(false), 2200);
  };

  if (loading) return <div className={styles.characterSlot} aria-hidden="true" data-character-loading="true" />;

  return (
    <>
      <p className={`${styles.bubble} ${speaking ? styles.bubbleVisible : ""}`} role="status" aria-live="polite">
        {speaking && <>GOOD ITEMS,<br />BETTER DAYS!</>}
      </p>
      <button type="button" onClick={greet} className={styles.characterSlot}
        aria-label="픽셀 캐릭터를 점프시키고 인사하기">
        <span className={`${styles.characterBody} ${styles.bob}`}>
          <span key={jump} className={`${styles.characterBody} ${jump > 0 ? styles.jump : ""}`}>
            {user?.avatarUrl ? (
              <PixelAvatar src={user.avatarUrl} alt="내 픽셀 아바타" className={`${styles.avatar} ${large ? styles.avatarLarge : ""}`}
                onLoad={(event) => setLarge(Math.max(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight) >= 640)} />
            ) : (
              // 투명 픽셀 SVG를 무대 좌표에 그대로 표시합니다.
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/images/hero-slime.svg" alt="초록 슬라임" className={styles.slime} width={16} height={12} />
            )}
          </span>
        </span>
      </button>
    </>
  );
}
