"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { ApiError } from "@/lib/api";
import PixelAvatar from "@/components/avatar/PixelAvatar";

interface UserMenuProps { compact?: boolean; }

export default function UserMenu({ compact = false }: UserMenuProps) {
  const { user, loading, pending, error, refresh, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [failedAvatar, setFailedAvatar] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  async function handleLogout() {
    setLogoutError(null);
    try { await logout(); setOpen(false); }
    catch (cause) { setLogoutError(cause instanceof ApiError ? cause.message : "로그아웃하지 못했어요. 다시 시도해 주세요."); }
  }

  return (
    <div ref={root} className={`relative shrink-0 sm:w-36 ${compact ? "w-10" : "w-28"}`}
      onBlur={(event) => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
      }}>
      {loading ? (
        <div role="status" aria-label="로그인 상태 확인 중" className="h-10 w-full animate-pulse rounded-lg bg-panel" />
      ) : user ? (
        <button ref={trigger} type="button" aria-expanded={open} aria-controls={panelId}
          aria-label={`${user.nickname} 사용자 메뉴`} onClick={() => setOpen(!open)}
          className="flex h-10 w-full items-center gap-1.5 rounded-lg border border-line bg-panel px-2 text-sm">
          {user.avatarUrl && user.avatarUrl !== failedAvatar ? (
            <PixelAvatar src={user.avatarUrl} onError={() => setFailedAvatar(user.avatarUrl)} className="size-6 shrink-0" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- 기존 픽셀 스프라이트 재사용
            <img src="/images/hero-slime.svg" alt="" className="size-6 shrink-0 object-contain" />
          )}
          <span className={`min-w-0 flex-1 truncate ${compact ? "hidden sm:block" : ""}`}>{user.nickname}</span><span aria-hidden="true" className={compact ? "hidden sm:inline" : ""}>▾</span>
        </button>
      ) : (
        <Link href="/login" className="flex h-10 w-full items-center justify-center rounded-lg border border-line bg-panel text-sm font-semibold">로그인</Link>
      )}
      {open && user && (
        <div id={panelId} className="absolute right-0 top-12 z-50 w-60 rounded-xl border border-line bg-panel p-2 shadow-lg">
          <Link href="/mypage" onClick={() => setOpen(false)} className="block rounded-lg px-3 py-3 text-sm hover:bg-panel-2">마이페이지</Link>
          <button type="button" disabled={pending} onClick={handleLogout} className="w-full rounded-lg px-3 py-3 text-left text-sm hover:bg-panel-2 disabled:opacity-50">{pending ? "로그아웃 중…" : "로그아웃"}</button>
          {logoutError && <p role="alert" className="px-3 py-2 text-sm text-pink">{logoutError}</p>}
        </div>
      )}
      {error && !loading && <div className="absolute right-0 top-12 w-60 rounded-xl border border-line bg-panel p-3 text-sm text-sub">
        <p role="status">{error}</p><button type="button" onClick={() => void refresh()} className="mt-2 underline">다시 확인</button>
      </div>}
    </div>
  );
}
