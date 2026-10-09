"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { api, ApiError } from "@/lib/api";
import { pixelateImage } from "@/lib/pixelateImage";
import { assertAvatarSize, MAX_SOURCE_BYTES } from "@/utils/pixelate";
import type { ApiUser } from "@/types/api";
import PixelAvatar from "./PixelAvatar";
import MotionBoundary from "@/components/hero/MotionBoundary";
import heroStyles from "@/components/hero/HeroStage.module.css";

interface AvatarFormProps { user: ApiUser; }

function AvatarForm({ user }: AvatarFormProps) {
  const { updateUser, refresh, pending } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [original, setOriginal] = useState<string | null>(null);
  const [result, setResult] = useState<{ dataUrl: string; bytes: number; width: number; height: number } | null>(null);
  const [resolution, setResolution] = useState<16 | 24 | 32 | 48>(32);
  const [colors, setColors] = useState<8 | 16>(16);
  const [converting, setConverting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const conversion = useRef(0);
  const operation = useRef(0);
  const busy = useRef(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (original) URL.revokeObjectURL(original); }, [original]);
  useEffect(() => () => { conversion.current++; operation.current++; }, []);

  async function convert(selected: File, nextResolution: 16 | 24 | 32 | 48, nextColors: 8 | 16) {
    const request = ++conversion.current;
    setConverting(true);
    setResult(null);
    setError(null);
    setMessage(null);
    try {
      const converted = await pixelateImage(selected, { resolution: nextResolution, colors: nextColors });
      if (request === conversion.current) setResult(converted);
    } catch (cause) {
      if (request === conversion.current) setError(cause instanceof Error ? cause.message : "사진을 변환하지 못했어요. 다른 사진을 골라 주세요.");
    } finally {
      if (request === conversion.current) setConverting(false);
    }
  }

  function choose(selected?: File) {
    if (!selected) return;
    if (!selected.type.startsWith("image/") || selected.size > MAX_SOURCE_BYTES) {
      setError(selected.size > MAX_SOURCE_BYTES ? "10MB 이하의 사진을 선택해 주세요." : "이미지 파일을 선택해 주세요.");
      if (input.current) input.current.value = "";
      return;
    }
    setFile(selected);
    setOriginal(URL.createObjectURL(selected));
    void convert(selected, resolution, colors);
  }

  async function persist(remove: boolean) {
    if (busy.current || pending || converting || (!remove && !result)) return;
    const request = ++operation.current;
    busy.current = true;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      if (!remove) assertAvatarSize(result!.dataUrl);
      const updated = remove
        ? await api.delete<ApiUser>("/users/me/avatar")
        : await api.put<ApiUser>("/users/me/avatar", { avatarUrl: result!.dataUrl });
      if (request !== operation.current) return;
      updateUser(updated);
      setMessage(remove ? "기본 슬라임으로 돌아왔어요." : "저장했어요! 메인 무대와 헤더에 바로 반영됩니다.");
      if (remove) {
        ++conversion.current;
        setResult(null);
        setFile(null);
        setOriginal(null);
        if (input.current) input.current.value = "";
      }
    } catch (cause) {
      if (request !== operation.current) return;
      if (cause instanceof ApiError && cause.status === 401) await refresh();
      setError(cause instanceof ApiError || cause instanceof Error ? cause.message : "저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      if (request === operation.current) { busy.current = false; setSaving(false); }
    }
  }

  const preview = result?.dataUrl ?? user.avatarUrl;
  return <div className="space-y-6">
    <div className="pixel-panel p-5">
      <label htmlFor="avatar-photo" className="mb-2 block font-bold">사진 선택</label>
      <input ref={input} id="avatar-photo" type="file" accept="image/*" disabled={saving || pending}
        onChange={(event) => choose(event.target.files?.[0])}
        className="block w-full min-w-0 text-sm text-sub file:mr-3 file:rounded-lg file:border-0 file:bg-panel-2 file:px-4 file:py-3 file:font-semibold file:text-ink" />
      <p className="mt-3 text-xs text-dim">최대 10MB · 사진을 자르지 않고 비율 그대로 축소해요. 배경도 함께 픽셀로 변환됩니다.</p>
    </div>
    <div className="grid gap-5 sm:grid-cols-2">
      <div className="pixel-panel p-5">
        <h2 className="mb-4 font-bold">원본 사진</h2>
        <div className="grid aspect-square place-items-center overflow-hidden rounded-lg bg-night">
          {original ? (
            // eslint-disable-next-line @next/next/no-img-element -- 기기 내부 blob URL로만 원본 미리보기
            <img src={original} alt="선택한 원본 사진" className="h-full w-full object-contain" />
          ) : <p className="px-4 text-center text-sm text-dim">사진을 선택하면 여기에 보여요.</p>}
        </div>
      </div>
      <div className="pixel-panel p-5">
        <h2 className="mb-4 font-bold">무대 위 미리보기</h2>
        <MotionBoundary className="grid aspect-square place-items-center rounded-lg bg-night">
          {converting ? <div role="status" aria-label="픽셀 아바타 변환 중" className="size-40 animate-pulse bg-panel-2" /> : (
            <div className={`${heroStyles.bob} grid h-3/5 w-3/5 place-items-center`}>
              {preview ? <PixelAvatar src={preview} alt="변환한 픽셀 아바타" className="h-full w-full" /> : (
                // eslint-disable-next-line @next/next/no-img-element -- 무대와 같은 기존 픽셀 스프라이트
                <img src="/images/hero-slime.svg" alt="기본 슬라임" className="w-full" />
              )}
            </div>
          )}
        </MotionBoundary>
        <p className="mt-3 text-xs text-sub">{result ? `${result.width} × ${result.height}px · PNG ${(result.bytes / 1024).toFixed(1)}KB / 50KB` : "저장 후 메인에서도 같은 모습으로 통통 뛰어요."}</p>
      </div>
    </div>
    <fieldset disabled={saving || pending} className="grid gap-4 pixel-panel p-5 sm:grid-cols-2">
      <legend className="px-2 font-bold">변환 옵션</legend>
      <label className="text-sm">도트 개수 (긴 쪽)
        <select aria-label="도트 개수" value={resolution} onChange={(event) => {
          const value = Number(event.target.value) as 16 | 24 | 32 | 48;
          setResolution(value); if (file) void convert(file, value, colors);
        }} className="mt-2 block w-full pixel-input p-3">
          {[16, 24, 32, 48].map((value) => <option key={value} value={value}>{value}칸</option>)}
        </select>
      </label>
      <label className="text-sm">색 수
        <select aria-label="색 수" value={colors} onChange={(event) => {
          const value = Number(event.target.value) as 8 | 16;
          setColors(value); if (file) void convert(file, resolution, value);
        }} className="mt-2 block w-full pixel-input p-3">
          <option value={8}>8색</option><option value={16}>16색</option>
        </select>
      </label>
    </fieldset>
    {error && <p role="alert" className="pixel-panel p-4 text-sm text-pink">{error}</p>}
    {message && <p role="status" className="text-sm text-mint">{message}</p>}
    <div className="flex flex-wrap gap-3">
      <button type="button" disabled={!result || converting || saving || pending} onClick={() => void persist(false)} className="btn-lime px-6 py-3 font-bold text-lime-ink disabled:opacity-50">{saving ? "반영 중…" : "아바타 저장"}</button>
      <button type="button" disabled={!user.avatarUrl || converting || saving || pending} onClick={() => void persist(true)} className="btn-pixel px-5 py-3 font-semibold disabled:opacity-50">기본으로 되돌리기</button>
      <Link href="/" className="rounded-lg px-4 py-3 text-sub underline">메인 무대 보기</Link>
    </div>
  </div>;
}

export default function AvatarEditor() {
  const { user, loading } = useAuth();
  if (loading) return <div role="status" aria-label="로그인 상태 확인 중" className="h-96 animate-pulse rounded-xl bg-panel" />;
  if (!user) return <div className="pixel-panel p-8 text-center">
    <p className="mb-5 text-sub">아바타를 만들고 저장하려면 로그인해 주세요.</p>
    <Link href="/login?next=/mypage/avatar" className="inline-block btn-lime px-6 py-3 font-bold text-lime-ink">로그인하고 만들기</Link>
  </div>;
  return <AvatarForm key={user.id} user={user} />;
}
