"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import PixelIcon, { type PixelIconName } from "@/components/PixelIcon";
import { notificationApi } from "@/lib/notifications";
import type { ApiNotification } from "@/types/api";

const POLL_MS = 30_000;
const iconButton = "relative grid size-10 shrink-0 place-items-center btn-pixel transition-colors hover:border-violet/40";

/** 알림 종류 → 픽셀 아이콘 */
function iconFor(kind: string): PixelIconName {
  if (kind.startsWith("trade")) return "coin";
  if (kind.startsWith("gift")) return "gift";
  if (kind === "order_placed") return "chest";
  if (kind === "heart_up") return "heart";
  if (kind === "badge") return "star";
  return "coin";
}

function timeAgo(iso: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "방금";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.round(hours / 24)}일 전`;
}

/** 헤더 알림 — 안 읽은 수는 30초마다 확인, 누르면 최근 알림 목록 */
export default function NotificationBell() {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ApiNotification[] | null>(null);
  const [failed, setFailed] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const refreshCount = useCallback(() => {
    notificationApi.unread().then((data) => setUnread(data.unread)).catch(() => undefined);
  }, []);

  // 로그인했을 때만, 창으로 돌아왔을 때도 다시 확인
  useEffect(() => {
    if (!user) return;
    const first = setTimeout(refreshCount, 0);
    const timer = setInterval(refreshCount, POLL_MS);
    window.addEventListener("focus", refreshCount);
    return () => { clearTimeout(first); clearInterval(timer); window.removeEventListener("focus", refreshCount); setUnread(0); setItems(null); };
  }, [user, refreshCount]);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  if (!user) return null;

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next) return;
    setFailed(false);
    try {
      const data = await notificationApi.list();
      setItems(data.items);
      setUnread(data.unread);
    } catch { setFailed(true); }
  }

  async function markRead(ids: number[] | null) {
    setItems((current) => current?.map((item) => ids === null || ids.includes(item.id) ? { ...item, read: true } : item) ?? null);
    try { setUnread((await notificationApi.read(ids)).unread); } catch { refreshCount(); }
  }

  return <div ref={root} className="relative" onKeyDown={(event) => { if (event.key === "Escape" && open) { event.preventDefault(); setOpen(false); } }}>
    <button type="button" onClick={() => void toggle()} aria-expanded={open} aria-controls={panelId}
      aria-label={unread ? `알림, 안 읽은 알림 ${unread}개` : "알림"} title="알림" className={iconButton}>
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 fill-none stroke-current stroke-2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20.5a2 2 0 0 0 4 0" />
      </svg>
      {unread > 0 && <span aria-hidden="true" className="absolute -right-2 -top-2 min-w-5 rounded bg-pink px-1 text-center font-pixel text-xs leading-5 text-night">{unread > 9 ? "9+" : unread}</span>}
    </button>
    {open && <div id={panelId} className="absolute right-0 top-12 z-50 w-80 max-w-[calc(100vw-2rem)] pixel-panel shadow-lg">
      <div className="flex items-center justify-between border-b-2 border-frame px-3 py-2">
        <p className="font-pixel text-xs tracking-widest text-mint">NOTIFICATIONS</p>
        <button type="button" disabled={!items?.some((item) => !item.read)} onClick={() => void markRead(null)}
          className="text-xs font-semibold text-sub hover:text-ink disabled:opacity-40">모두 읽음</button>
      </div>
      {failed ? <p className="p-4 text-sm text-sub">알림을 불러오지 못했어요.</p>
        : !items ? <p role="status" className="animate-pulse p-4 text-sm text-sub">알림을 불러오는 중…</p>
        : items.length === 0 ? <p className="p-6 text-center text-sm text-sub">아직 알림이 없어요.</p>
        : <ul className="max-h-[60vh] overflow-y-auto py-1">{items.map((item) => {
          const body = <>
            <span className={`grid size-8 shrink-0 place-items-center rounded ${item.read ? "bg-panel" : "bg-panel-2"}`}><PixelIcon name={iconFor(item.kind)} className="size-4" /></span>
            <span className="min-w-0 flex-1">
              <span className={`block truncate text-sm ${item.read ? "text-sub" : "font-bold text-ink"}`}>{item.title}</span>
              <span className="block truncate text-xs text-dim">{item.body}</span>
            </span>
            <span className="shrink-0 text-[10px] text-dim">{timeAgo(item.createdAt)}</span>
            {!item.read && <span aria-label="안 읽음" className="size-2 shrink-0 rounded-full bg-pink" />}
          </>;
          const row = "flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-panel-2";
          return <li key={item.id}>{item.href
            ? <Link href={item.href} className={row} onClick={() => { void markRead([item.id]); setOpen(false); }}>{body}</Link>
            : <button type="button" className={row} onClick={() => void markRead([item.id])}>{body}</button>}</li>;
        })}</ul>}
    </div>}
  </div>;
}
