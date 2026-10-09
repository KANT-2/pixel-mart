"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { api, ApiError } from "@/lib/api";
import { aiAvatarStatus, aiImageToGrid, DEFAULT_PHOTO_SIDE, photoToGrid, preparePhoto, requestAiAvatar } from "@/lib/aiAvatar";
import { assertAvatarSize, getOutputSize, getPngByteSize } from "@/utils/pixelate";
import { isEmpty, type PixelGridData } from "@/utils/pixelCanvas";
import type { ApiAiAvatarStatus, ApiUser } from "@/types/api";
import PixelAvatar from "./PixelAvatar";
import PixelCanvasEditor from "./PixelCanvasEditor";
import MotionBoundary from "@/components/hero/MotionBoundary";
import heroStyles from "@/components/hero/HeroStage.module.css";

type Mode = "ai" | "canvas";

/** 격자 → 저장용 PNG. 칸을 정수 배로 키우고, AI 결과처럼 원본이 큰 경우 긴 쪽 640, 직접 그린 그림은 320 */
function gridToPng(grid: PixelGridData, large: boolean): { dataUrl: string; bytes: number; width: number; height: number } {
  const small = document.createElement("canvas");
  small.width = grid.cols;
  small.height = grid.rows;
  small.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(grid.pixels), grid.cols, grid.rows), 0, 0);
  const size = large ? getOutputSize(1024, 1024, { cols: grid.cols, rows: grid.rows }) : getOutputSize(grid.cols, grid.rows, { cols: grid.cols, rows: grid.rows });
  const output = document.createElement("canvas");
  output.width = size.width;
  output.height = size.height;
  const context = output.getContext("2d")!;
  context.imageSmoothingEnabled = false;
  context.drawImage(small, 0, 0, size.width, size.height);
  const dataUrl = output.toDataURL("image/png");
  return { dataUrl, bytes: getPngByteSize(dataUrl), width: size.width, height: size.height };
}

function ModerationNotice() {
  return <p className="pixel-panel border-pink/40 p-4 text-xs leading-relaxed text-sub">
    <strong className="text-pink">⚠ 아바타 이용 안내</strong> · 아바타는 메인 무대·헤더·덕력지도(동의 시)에서 다른 사람에게 보일 수 있어요.
    선정적·폭력적·혐오 표현, 타인 사칭, 욕설·연락처·광고 문구, 저작권 침해 이미지 등 <strong className="text-ink">수위를 넘는 아바타는 경고 없이 삭제되거나 이용이 제한될 수 있어요.</strong>
  </p>;
}

interface AvatarFormProps { user: ApiUser; }

function AvatarForm({ user }: AvatarFormProps) {
  const { updateUser, refresh, pending } = useAuth();
  const [mode, setMode] = useState<Mode>("ai");
  const [canvasSeed, setCanvasSeed] = useState<{ key: number; grid: PixelGridData | null; large: boolean }>({ key: 0, grid: null, large: false });
  const [canvasGrid, setCanvasGrid] = useState<PixelGridData | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const busy = useRef(false);

  const onCanvasChange = useCallback((grid: PixelGridData) => setCanvasGrid(grid), []);

  async function save(grid: PixelGridData | null, large: boolean) {
    if (!grid || busy.current || pending) return;
    if (isEmpty(grid)) { setError("빈 캔버스는 저장할 수 없어요. 무언가 그려 주세요."); return; }
    busy.current = true; setSaving(true); setError(null); setMessage(null);
    try {
      const png = gridToPng(grid, large);
      assertAvatarSize(png.dataUrl);
      updateUser(await api.put<ApiUser>("/users/me/avatar", { avatarUrl: png.dataUrl }));
      setMessage(`저장했어요! (${png.width}×${png.height}px) 메인 무대와 헤더에 바로 반영돼요.`);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) await refresh();
      setError(cause instanceof Error ? cause.message : "저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally { busy.current = false; setSaving(false); }
  }

  async function reset() {
    if (busy.current || pending) return;
    busy.current = true; setSaving(true); setError(null); setMessage(null);
    try {
      updateUser(await api.delete<ApiUser>("/users/me/avatar"));
      setMessage("기본 슬라임으로 돌아왔어요.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "되돌리지 못했어요.");
    } finally { busy.current = false; setSaving(false); }
  }

  const tab = "btn-pixel toggle-outline min-h-11 px-4 py-2 text-sm font-bold";
  return <div className="space-y-6">
    <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_260px]">
      <div>
        <div role="tablist" aria-label="아바타 만드는 방법" className="mb-4 flex flex-wrap gap-2">
          <button type="button" role="tab" aria-selected={mode === "ai"} onClick={() => setMode("ai")} className={tab}>AI로 만들기</button>
          <button type="button" role="tab" aria-selected={mode === "canvas"} onClick={() => setMode("canvas")} className={tab}>픽셀 캔버스</button>
        </div>
        {mode === "ai" ? <AiPanel disabled={saving || pending} onSave={(grid) => void save(grid, true)}
          onEdit={(grid) => { setCanvasSeed((seed) => ({ key: seed.key + 1, grid, large: true })); setMode("canvas"); }} />
          : <div className="space-y-4">
            <PixelCanvasEditor key={canvasSeed.key} initial={canvasSeed.grid} disabled={saving || pending} onChange={onCanvasChange} />
            <button type="button" disabled={saving || pending || !canvasGrid} onClick={() => void save(canvasGrid, canvasSeed.large)}
              className="btn-lime min-h-11 px-6 py-2 font-bold disabled:opacity-50">{saving ? "저장 중…" : "이 그림으로 저장"}</button>
          </div>}
      </div>
      <aside className="space-y-3">
        <div className="pixel-panel p-4">
          <h2 className="mb-3 text-sm font-bold">지금 내 아바타</h2>
          <MotionBoundary className="grid aspect-square place-items-center rounded-md bg-night">
            <div className={`${heroStyles.bob} grid h-3/5 w-3/5 place-items-center`}>
              {user.avatarUrl ? <PixelAvatar src={user.avatarUrl} alt="현재 픽셀 아바타" className="h-full w-full" /> : (
                // eslint-disable-next-line @next/next/no-img-element -- 무대와 같은 기존 픽셀 스프라이트
                <img src="/images/hero-slime.svg" alt="기본 슬라임" className="w-full [image-rendering:pixelated]" />
              )}
            </div>
          </MotionBoundary>
          <button type="button" disabled={!user.avatarUrl || saving || pending} onClick={() => void reset()}
            className="btn-pixel mt-3 min-h-10 w-full px-3 py-2 text-sm font-semibold disabled:opacity-50">기본 슬라임으로</button>
        </div>
        <Link href="/" className="block text-center text-sm text-sub underline">메인 무대 보기</Link>
      </aside>
    </div>
    {error && <p role="alert" className="pixel-panel p-4 text-sm text-pink">{error}</p>}
    {message && <p role="status" className="text-sm text-mint">{message}</p>}
    <ModerationNotice />
  </div>;
}

interface AiPanelProps {
  disabled: boolean;
  onSave: (grid: PixelGridData) => void;
  onEdit: (grid: PixelGridData) => void;
}

function AiPanel({ disabled, onSave, onEdit }: AiPanelProps) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [working, setWorking] = useState(false);
  const [result, setResult] = useState<{ grid: PixelGridData; preview: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ApiAiAvatarStatus | null>(null);
  const request = useRef(0);
  useEffect(() => () => { request.current++; }, []);
  // 동의 문구는 서버가 실제로 쓰는 제공자 이름을 그대로 보여 준다
  useEffect(() => {
    const controller = new AbortController();
    aiAvatarStatus(controller.signal).then(setStatus).catch(() => undefined);
    return () => controller.abort();
  }, []);
  const providerName = status?.providerName ?? "AI 제공자";
  const unavailable = status !== null && !status.enabled;

  async function choose(file?: File) {
    if (!file) return;
    setError(null); setResult(null);
    try { setPhoto(await preparePhoto(file, status?.maxPhotoSide ?? DEFAULT_PHOTO_SIDE)); } catch (cause) { setError(cause instanceof Error ? cause.message : "사진을 읽지 못했어요."); }
  }

  // AI가 그리거나(동의 필요), 사진을 브라우저에서 바로 픽셀로 바꾼다(전송 없음)
  async function run(kind: "ai" | "local") {
    if (!photo || working || (kind === "ai" && (!consent || unavailable))) return;
    const id = ++request.current;
    setWorking(true); setError(null); setResult(null);
    try {
      const grid = kind === "ai" ? await aiImageToGrid(await requestAiAvatar(photo)) : await photoToGrid(photo);
      if (id !== request.current) return;
      const small = document.createElement("canvas");
      small.width = grid.cols; small.height = grid.rows;
      small.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(grid.pixels), grid.cols, grid.rows), 0, 0);
      setResult({ grid, preview: small.toDataURL("image/png") });
    } catch (cause) {
      if (id === request.current) setError(cause instanceof Error ? cause.message : "AI 아바타를 만들지 못했어요.");
    } finally { if (id === request.current) setWorking(false); }
  }

  return <div className="space-y-4">
    <div className="pixel-panel space-y-4 p-5">
      <p className="text-sm leading-relaxed text-sub">사진 속 <strong className="text-ink">사람·동물·캐릭터</strong>를 AI가 알아보고, 자세·옷차림·비율을 살린 <strong className="text-lime">픽셀아트 캐릭터</strong>로 다시 그려 줘요. 결과는 픽셀 캔버스에서 다듬을 수 있어요.</p>
      <label htmlFor="ai-photo" className="block text-sm font-bold">사진 고르기 <span className="font-normal text-dim">(JPEG·PNG·WebP, 10MB 이하)</span></label>
      <input id="ai-photo" type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled || working} onChange={(event) => void choose(event.target.files?.[0])}
        className="block w-full min-w-0 text-sm text-sub file:mr-3 file:rounded-md file:border-2 file:border-frame file:bg-panel-2 file:px-4 file:py-2 file:font-semibold file:text-ink" />
      <label className="flex cursor-pointer items-start gap-3 rounded-md bg-night p-3">
        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} disabled={disabled || working}
          className="mt-0.5 size-5 shrink-0 accent-lime" />
        <span className="text-xs leading-relaxed text-sub"><strong className="text-ink">사진이 {providerName}로 전송되는 데 동의해요.</strong> 사진과 AI 원본 이미지는 PIXEL MART에 저장하지 않으며, 마음에 드는 결과를 저장할 때 최종 픽셀 이미지만 남아요. 다른 사람의 사진은 그 사람의 허락을 받은 경우에만 사용해 주세요.</span>
      </label>
      {unavailable && <p role="status" className="text-sm text-pink">지금은 AI 만들기를 쓸 수 없어요. 픽셀 캔버스로 직접 그려 보세요.</p>}
      <button type="button" onClick={() => void run("ai")} disabled={disabled || working || !photo || !consent || unavailable}
        className="btn-lime min-h-11 px-6 py-2 font-bold disabled:opacity-50">{working ? "만드는 중… (최대 1분)" : "AI 픽셀 아바타 만들기"}</button>
      {/* AI 없이 바로 — 사진은 브라우저 밖으로 나가지 않는다 */}
      <button type="button" onClick={() => void run("local")} disabled={disabled || working || !photo}
        className="btn-pixel ml-2 min-h-11 px-4 py-2 text-sm font-bold disabled:opacity-50">사진을 바로 픽셀로 바꾸기</button>
      <p className="text-xs text-dim">&lsquo;바로 픽셀로&rsquo;는 AI 없이 이 기기에서만 바꿔요. 사진을 어디에도 보내지 않아 동의가 필요 없어요.</p>
      {error && <p role="alert" className="text-sm text-pink">{error}</p>}
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      <figure className="pixel-panel p-4">
        <figcaption className="mb-3 text-sm font-bold">고른 사진</figcaption>
        <div className="grid aspect-square place-items-center overflow-hidden rounded-md bg-night">
          {/* eslint-disable-next-line @next/next/no-img-element -- 기기 안에서 줄인 미리보기 */}
          {photo ? <img src={photo} alt="고른 사진 미리보기" className="h-full w-full object-contain" /> : <p className="px-4 text-center text-sm text-dim">사진을 고르면 여기에 보여요.</p>}
        </div>
      </figure>
      <figure className="pixel-panel p-4">
        <figcaption className="mb-3 text-sm font-bold">AI 픽셀 아바타</figcaption>
        <div className="grid aspect-square place-items-center overflow-hidden rounded-md bg-night">
          {working ? <p role="status" className="font-pixel text-sm text-lime motion-safe:animate-[pulse_1s_steps(2)_infinite]">LOADING…</p>
            : result ? <PixelAvatar src={result.preview} alt="AI가 만든 픽셀 아바타" className="h-4/5 w-4/5" />
              : <p className="px-4 text-center text-sm text-dim">결과가 여기에 보여요.</p>}
        </div>
        {result && <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={disabled} onClick={() => onSave(result.grid)} className="btn-lime min-h-10 px-4 py-1.5 text-sm font-bold">이대로 저장</button>
          <button type="button" disabled={disabled} onClick={() => onEdit(result.grid)} className="btn-pixel min-h-10 px-4 py-1.5 text-sm font-bold">캔버스에서 다듬기</button>
          <button type="button" disabled={disabled || working} onClick={() => void run("ai")} className="btn-pixel min-h-10 px-4 py-1.5 text-sm font-bold">다시 만들기</button>
        </div>}
      </figure>
    </div>
  </div>;
}

export default function AvatarEditor() {
  const { user, loading } = useAuth();
  if (loading) return <div role="status" aria-label="로그인 상태 확인 중" className="h-96 animate-pulse rounded-md bg-panel" />;
  if (!user) return <div className="pixel-panel p-8 text-center">
    <p className="mb-5 text-sub">아바타를 만들고 저장하려면 로그인해 주세요.</p>
    <Link href="/login?next=/mypage/avatar" className="btn-lime inline-block px-6 py-3 font-bold">로그인하고 만들기</Link>
  </div>;
  return <AvatarForm key={user.id} user={user} />;
}
