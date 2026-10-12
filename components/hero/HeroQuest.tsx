"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import styles from "./HeroStage.module.css";

/** 무대 아래 퀘스트 카드 — 비로그인이면 로그인 유도, 로그인하면 쇼핑 유도 */
export default function HeroQuest() {
  const { user } = useAuth();
  return (
    <aside className={styles.quest} aria-label="내 혜택">
      {/* eslint-disable-next-line @next/next/no-img-element -- 픽셀 아이콘 */}
      <img src="/images/logo-invader.svg" alt="" className={styles.questIcon} />
      <div className="min-w-0 flex-1">
        <p className="font-pixel text-[11px] tracking-wider text-dim">PLAYER 1 · QUEST 0/1</p>
        <p className="truncate text-sm font-semibold text-ink">
          {user ? <>첫 구매 완료 시 <b className="text-lime">1,000P</b> 받기</> : <>로그인하고 첫 구매 시 <b className="text-lime">1,000P</b> 받기</>}
        </p>
      </div>
      <Link href={user ? "/products" : "/login?next=/"} className={styles.questBtn}>{user ? "쇼핑하기" : "로그인"}</Link>
    </aside>
  );
}
