"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { ApiError } from "@/lib/api";
import { safeNextPath } from "@/utils/safeNextPath";

interface LoginFormProps { next?: string; devLoginEnabled: boolean; }

export default function LoginForm({ next, devLoginEnabled }: LoginFormProps) {
  const { user, loading, pending, error: authError, login, refresh } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const destination = safeNextPath(next);
  useEffect(() => { if (!loading && user) router.replace(destination); }, [user, loading, destination, router]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    setError(null);
    try { await login(String(data.get("email") ?? "").trim(), String(data.get("nickname") ?? "").trim() || undefined); }
    catch (cause) { setError(cause instanceof ApiError ? cause.message : "로그인하지 못했어요. 연결을 확인하고 다시 시도해 주세요."); }
  }

  if (loading || user) return <div role="status" aria-label={user ? "원래 페이지로 이동 중" : "로그인 상태 확인 중"} className="h-80 animate-pulse rounded-xl bg-panel" />;

  return <div className="space-y-6">
    {authError && <div role="status" className="pixel-panel p-4 text-sm text-sub">{authError}
      <button type="button" onClick={() => void refresh()} className="ml-2 underline">다시 확인</button>
    </div>}
    <div>
      {/* TODO(#14): 활성화 시 <a href="/api/auth/google/login">로 교체 */}
      <button type="button" disabled aria-disabled="true" className="h-12 w-full cursor-not-allowed btn-pixel font-semibold text-dim">Google로 계속하기</button>
      <p className="mt-2 text-center text-sm text-dim">Google 로그인은 준비 중이에요.</p>
    </div>
    {devLoginEnabled ? <form onSubmit={submit} className="pixel-panel p-5">
      <h2 className="mb-1 text-lg font-bold">개발용 이메일 로그인</h2>
      <p className="mb-5 text-xs text-sub">로컬 개발 환경에서 사용하는 임시 로그인입니다.</p>
      <label htmlFor="email" className="mb-2 block text-sm font-semibold">이메일</label>
      <input id="email" name="email" type="email" required maxLength={320} autoComplete="email" disabled={pending}
        className="mb-4 w-full pixel-input px-3 py-3 text-ink" placeholder="player@example.com" />
      <label htmlFor="nickname" className="mb-2 block text-sm font-semibold">닉네임 <span className="font-normal text-dim">(선택)</span></label>
      <input id="nickname" name="nickname" maxLength={30} autoComplete="nickname" disabled={pending}
        className="mb-5 w-full pixel-input px-3 py-3 text-ink" placeholder="나의 플레이어 이름" />
      {error && <p role="alert" className="mb-4 text-sm text-pink">{error}</p>}
      <button type="submit" disabled={pending} className="w-full btn-lime px-4 py-3 font-bold text-lime-ink disabled:opacity-50">{pending ? "로그인 중…" : "이메일로 로그인"}</button>
    </form> : <p className="pixel-panel p-5 text-sm text-sub">로그인 서비스를 준비하고 있어요. 조금만 기다려 주세요.</p>}
  </div>;
}
