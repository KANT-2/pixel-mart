"use client";

import { useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/components/AuthProvider";
import NicknameField, { type NicknameStatus } from "@/components/profile/NicknameField";
import { api, ApiError } from "@/lib/api";
import type { ApiUser } from "@/types/api";

/** 마이페이지 플레이어 이름 — 닉네임은 하나뿐이라 입력하는 동안 사용 가능 여부와 추천안을 보여 준다 */
export default function NicknameEditor() {
  const { user, loading, updateUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<NicknameStatus>("empty");
  const [rejected, setRejected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const lock = useRef(false);

  if (loading || !user) return null;
  const canSave = !busy && (status === "available" || status === "error");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || !canSave) return;
    const nickname = text.trim();
    lock.current = true; setBusy(true); setError(null);
    try {
      updateUser(await api.patch<ApiUser>("/users/me", { nickname }));
      setEditing(false); setSaved(true);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) setRejected(nickname);
      else setError(cause instanceof ApiError || cause instanceof Error ? cause.message : "저장하지 못했어요.");
    } finally { lock.current = false; setBusy(false); }
  }

  return <section aria-label="플레이어 이름" className="pixel-panel mb-6 p-5 text-left">
    <p className="font-pixel text-[11px] tracking-widest text-lime">▶ PLAYER NAME</p>
    {!editing ? <div className="mt-2 flex items-center justify-between gap-3">
      <p className="min-w-0 truncate text-xl font-extrabold">{user.nickname}</p>
      <button type="button" onClick={() => { setText(user.nickname); setRejected(null); setError(null); setSaved(false); setEditing(true); }} className="btn-pixel h-10 shrink-0 px-4 text-sm font-bold">이름 바꾸기</button>
    </div> : <form onSubmit={save} className="mt-2">
      <label htmlFor="nickname-edit" className="sr-only">새 닉네임</label>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <NicknameField id="nickname-edit" value={text} onChange={(next) => { setText(next); setError(null); }} current={user.nickname} disabled={busy} onStatus={setStatus} rejected={rejected} />
        </div>
        <button type="submit" disabled={!canSave} className="btn-lime h-11 shrink-0 px-4 text-sm font-bold disabled:opacity-50">{busy ? "저장 중…" : "저장"}</button>
        <button type="button" disabled={busy} onClick={() => setEditing(false)} className="btn-pixel h-11 shrink-0 px-3 text-sm font-bold">취소</button>
      </div>
    </form>}
    {error && <p role="alert" className="mt-2 text-sm text-pink">{error}</p>}
    {saved && !editing && <p role="status" className="mt-2 text-xs text-mint">닉네임을 바꿨어요.</p>}
    {!editing && <p className="mt-3 text-xs leading-relaxed text-dim">닉네임은 다른 플레이어와 겹칠 수 없어요. 위시맵에서는 &lsquo;닉네임 공개&rsquo;를 켰을 때만 보여요.</p>}
  </section>;
}
