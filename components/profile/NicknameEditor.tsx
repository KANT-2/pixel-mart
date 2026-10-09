"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/components/AuthProvider";
import { api, ApiError } from "@/lib/api";
import type { ApiUser } from "@/types/api";

type Check = "idle" | "checking" | "available" | "taken" | "error";

/** 마이페이지 플레이어 이름 — 닉네임은 하나뿐이라 입력하는 동안 사용 가능 여부를 확인한다 */
export default function NicknameEditor() {
  const { user, loading, updateUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [check, setCheck] = useState<Check>("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const lock = useRef(false);
  const value = text.trim();
  const unchanged = value.toLowerCase() === user?.nickname.toLowerCase();

  useEffect(() => {
    if (!editing || !value || unchanged) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setCheck("checking");
      api.get<{ available: boolean }>(`/users/nickname-check?${new URLSearchParams({ nickname: value })}`, { cache: "no-store", signal: controller.signal })
        .then((result) => setCheck(result.available ? "available" : "taken"))
        .catch(() => { if (!controller.signal.aborted) setCheck("error"); });
    }, 350);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [editing, value, unchanged]);

  if (loading || !user) return null;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || !value || unchanged || check === "taken") return;
    lock.current = true; setBusy(true); setError(null);
    try {
      updateUser(await api.patch<ApiUser>("/users/me", { nickname: value }));
      setEditing(false); setSaved(true);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) setCheck("taken");
      setError(cause instanceof ApiError || cause instanceof Error ? cause.message : "저장하지 못했어요.");
    } finally { lock.current = false; setBusy(false); }
  }

  const hint = !value ? "1~30자로 적어 주세요."
    : unchanged ? "지금 쓰는 닉네임이에요."
      : check === "checking" ? "확인 중…"
        : check === "available" ? "✓ 사용할 수 있어요"
          : check === "taken" ? "✕ 이미 다른 플레이어가 쓰고 있어요"
            : check === "error" ? "확인하지 못했어요. 저장할 때 다시 확인해요." : "";
  const tone = check === "available" && !unchanged ? "text-lime" : check === "taken" && !unchanged ? "text-pink" : "text-dim";

  return <section aria-label="플레이어 이름" className="pixel-panel mb-6 p-5 text-left">
    <p className="font-pixel text-[11px] tracking-widest text-lime">▶ PLAYER NAME</p>
    {!editing ? <div className="mt-2 flex items-center justify-between gap-3">
      <p className="min-w-0 truncate text-xl font-extrabold">{user.nickname}</p>
      <button type="button" onClick={() => { setText(user.nickname); setCheck("idle"); setError(null); setSaved(false); setEditing(true); }} className="btn-pixel h-10 shrink-0 px-4 text-sm font-bold">이름 바꾸기</button>
    </div> : <form onSubmit={save} className="mt-2 space-y-2">
      <label htmlFor="nickname-edit" className="sr-only">새 닉네임</label>
      <div className="flex gap-2">
        <input id="nickname-edit" value={text} maxLength={30} autoFocus autoComplete="nickname" disabled={busy}
          onChange={(event) => { setText(event.target.value); setCheck("idle"); setError(null); }}
          aria-describedby="nickname-hint" aria-invalid={check === "taken" && !unchanged} className="pixel-input h-11 min-w-0 flex-1 px-3" />
        <button type="submit" disabled={busy || !value || unchanged || check === "taken" || check === "checking"} className="btn-lime h-11 shrink-0 px-4 text-sm font-bold disabled:opacity-50">{busy ? "저장 중…" : "저장"}</button>
        <button type="button" disabled={busy} onClick={() => setEditing(false)} className="btn-pixel h-11 shrink-0 px-3 text-sm font-bold">취소</button>
      </div>
      <p id="nickname-hint" role="status" className={`text-xs ${tone}`}>{hint}</p>
    </form>}
    {error && <p role="alert" className="mt-2 text-sm text-pink">{error}</p>}
    {saved && !editing && <p role="status" className="mt-2 text-xs text-mint">닉네임을 바꿨어요.</p>}
    <p className="mt-3 text-xs leading-relaxed text-dim">닉네임은 다른 플레이어와 겹칠 수 없어요 (대소문자 구분 없음). 위시맵에서는 &lsquo;닉네임 공개&rsquo;를 켰을 때만 보여요.</p>
  </section>;
}
