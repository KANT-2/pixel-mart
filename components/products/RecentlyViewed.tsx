"use client";

import Link from "next/link";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { keycapByProduct } from "@/data/keycaps";
import { formatPrice } from "@/utils/formatPrice";
import { rarityOf } from "@/utils/gameItem";
import { RECENT_KEY, addRecent, parseRecent, recentForDetail, removeRecent, type RecentItem } from "@/utils/recentlyViewed";

const CHANGE = "pixelmart:recently-viewed";

function read(): string {
  try { return localStorage.getItem(RECENT_KEY) ?? "[]"; } catch { return "[]"; }
}

function write(list: RecentItem[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
    window.dispatchEvent(new Event(CHANGE));
  } catch { /* 저장소를 못 쓰면(사생활 보호 모드 등) 기록만 건너뛴다 */ }
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE, onChange);
  window.addEventListener("storage", onChange); // 다른 탭에서 본 상품도 반영
  return () => {
    window.removeEventListener(CHANGE, onChange);
    window.removeEventListener("storage", onChange);
  };
}

interface RecentlyViewedProps {
  /** 지금 보고 있는 상품 — 기록하고, 목록에서는 뺀다 */
  current: RecentItem;
}

/** 상세페이지 하단 — 최근 본 아이템을 작은 인벤토리 칸으로 (1개 이상일 때만) */
export default function RecentlyViewed({ current }: RecentlyViewedProps) {
  const raw = useSyncExternalStore(subscribe, read, () => "[]");
  const items = useMemo(() => recentForDetail(parseRecent(raw), current.id), [raw, current.id]);

  // 상세페이지를 열 때마다 맨 앞으로 기록
  useEffect(() => {
    write(addRecent(parseRecent(read()), { id: current.id, name: current.name, price: current.price, imageUrl: current.imageUrl }));
  }, [current.id, current.name, current.price, current.imageUrl]);

  if (items.length === 0) return null;
  return <section aria-labelledby="recently-viewed-title" className="mt-14">
    <div className="mb-4 flex items-end justify-between gap-3">
      <h2 id="recently-viewed-title" className="text-lg font-extrabold">
        <span className="stage-kicker mb-1 block font-pixel text-xs font-normal text-mint">RECENTLY VIEWED</span>
        최근 본 아이템 <span className="text-sm font-semibold text-dim">· {items.length}</span>
      </h2>
      <button type="button" onClick={() => write(parseRecent(read()).filter((entry) => entry.id === current.id))}
        className="text-sm font-semibold text-sub hover:text-ink focus-visible:outline-2 focus-visible:outline-mint">전체 지우기</button>
    </div>
    <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:thin] md:mx-0 md:px-0">
      {items.map((item) => {
        const rarity = rarityOf(item.price);
        const keycap = keycapByProduct(item.id);
        return <li key={item.id} className="group relative w-[38%] shrink-0 snap-start sm:w-36">
          <Link href={`/products/${item.id}`} className="block focus-visible:outline-2 focus-visible:outline-mint">
            <span className="item-slot block overflow-hidden p-1" style={{ ["--rarity" as string]: rarity.color }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- 상품 목록과 같은 일반 img */}
              <img src={item.imageUrl} alt="" className="aspect-square w-full rounded object-cover" />
            </span>
            <span className="mt-2 block truncate text-sm font-semibold">{item.name}</span>
            <span className="block text-sm font-extrabold text-lime">{formatPrice(item.price)}</span>
          </Link>
          {keycap && <Link href={`/products/${item.id}/fitting`} className="mt-1 inline-block text-xs font-semibold text-mint hover:underline">끼워 보기 →</Link>}
          <button type="button" aria-label={`${item.name} 최근 본 아이템에서 지우기`} onClick={() => write(removeRecent(parseRecent(read()), item.id))}
            className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded bg-night/80 text-sm text-sub opacity-100 hover:text-ink focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100">×</button>
        </li>;
      })}
    </ul>
  </section>;
}
