"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/components/AuthProvider";
import NicknameField, { type NicknameStatus } from "@/components/profile/NicknameField";
import { api, ApiError } from "@/lib/api";
import type { ApiSignupPending, ApiUser } from "@/types/api";

/** 구글 확인 뒤 새 사용자의 닉네임 고르기 — 고른 닉네임이 사용 가능해야 계정이 만들어진다 */
export default function SignupForm() {
  const { updateUser, refresh } = useAuth();
  const router = useRouter();
  const [pending, setPending] = useState<ApiSignupPending | null>(null);
  const [missing, setMissing] = useState(false);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<NicknameStatus>("empty");
  const [rejected, setRejected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    api.get<ApiSignupPending>("/auth/signup", { cache: "no-store", signal: controller.signal })
      .then((data) => { setPending(data); setText(data.googleName); })
      .catch(() => { if (!controller.signal.aborted) setMissing(true); });
    return () => controller.abort();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nickname = text.trim();
    if (lock.current || busy || status !== "available") return;
    lock.current = true; setBusy(true); setError(null);
    try {
      const user = await api.post<ApiUser>("/auth/signup", { nickname });
      updateUser(user);
      await refresh();
      router.replace("/");
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) setRejected(nickname);
      else setError(cause instanceof ApiError || cause instanceof Error ? cause.message : "가입하지 못했어요. 다시 시도해 주세요.");
    } finally { lock.current = false; setBusy(false); }
  }

  if (missing) return <div className="pixel-panel p-6 text-center">
    <p className="font-bold">가입 대기 정보가 없어요</p>
    <p className="mt-2 text-sm text-sub">구글 로그인 뒤 15분 안에 닉네임을 정해야 해요. 다시 로그인해 주세요.</p>
    <Link href="/login" className="btn-lime mt-5 inline-flex min-h-11 items-center px-5 font-bold">로그인으로</Link>
  </div>;
  if (!pending) return <div role="status" aria-label="가입 정보 확인 중" className="h-64 animate-pulse rounded-xl bg-panel" />;

  return <form onSubmit={submit} className="pixel-panel space-y-5 p-5">
    <div>
      <p className="font-pixel text-[11px] tracking-widest text-dim">ACCOUNT</p>
      <p className="mt-1 truncate text-sm text-sub">{pending.email}</p>
    </div>
    <div>
      <label htmlFor="signup-nickname" className="mb-2 block text-sm font-semibold">닉네임</label>
      <NicknameField id="signup-nickname" value={text} onChange={(next) => { setText(next); setError(null); }} disabled={busy}
        onStatus={setStatus} rejected={rejected} placeholder="나의 플레이어 이름" />
    </div>
    {error && <p role="alert" className="text-sm text-pink">{error}</p>}
    <button type="submit" disabled={busy || status !== "available"} className="btn-lime h-12 w-full font-extrabold disabled:opacity-50">
      {busy ? "가입 중…" : "▶ 이 이름으로 시작하기"}
    </button>
    <p className="text-xs text-dim">닉네임은 나중에 마이페이지에서 바꿀 수 있어요.</p>
  </form>;
}
