"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import PixelAvatar from "./PixelAvatar";

export default function AvatarShortcut() {
  const { user, loading } = useAuth();
  return <Link href="/mypage/avatar" className="mb-6 flex items-center gap-4 rounded-xl border border-line bg-panel p-5 text-left">
    {loading ? <span className="size-16 shrink-0 animate-pulse bg-panel-2" /> : user?.avatarUrl ? (
      <PixelAvatar src={user.avatarUrl} className="size-16 shrink-0" />
    ) : (
      // eslint-disable-next-line @next/next/no-img-element -- 기존 픽셀 스프라이트 재사용
      <img src="/images/hero-slime.svg" alt="" className="size-16 shrink-0 object-contain" />
    )}
    <span><span className="block font-bold">내 픽셀 아바타 만들기 →</span><span className="mt-1 block text-sm text-sub">사진 한 장으로 무대 위 주인공이 되어 보세요.</span></span>
  </Link>;
}
