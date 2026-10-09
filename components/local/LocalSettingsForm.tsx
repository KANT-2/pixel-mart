"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useLocalProfile, useRegions } from "@/components/local/LocalProvider";
import RegionSelector from "@/components/local/RegionSelector";
import InterestPicker from "@/components/local/InterestPicker";
import LocateRegionButton from "@/components/local/LocateRegionButton";
import { useRegionLocator } from "@/components/local/useRegionLocator";
import { LocalError, LocalLogin, LocalSkeleton, localButton } from "@/components/local/LocalStates";
import { ApiError } from "@/lib/api";
import { localApi } from "@/lib/local";
import { localHref } from "@/utils/local";
import type { ApiLocalProfile, ApiRegion } from "@/types/api";

export default function LocalSettings() {
  const { user, loading } = useAuth();
  const profile = useLocalProfile();
  const regions = useRegions();
  const locator = useRegionLocator(regions.data ?? []);
  const params = useSearchParams();
  const candidate = params.get("region");
  const next = `/local/settings${candidate ? `?region=${encodeURIComponent(candidate)}` : ""}`;
  if (loading) return <LocalSkeleton />;
  if (!user || profile.status === 401) return <LocalLogin next={next} />;
  if (profile.error) return <LocalError message={profile.error} onRetry={() => void profile.refresh()} busy={profile.loading} />;
  if (regions.error) return <LocalError message={regions.error} onRetry={() => void regions.refresh()} busy={regions.loading} />;
  if (!profile.data || !regions.data || profile.loading || regions.loading) return <LocalSkeleton />;
  return <SettingsForm key={`${user.id}:${candidate ?? "saved"}`} profile={profile.data} regions={regions.data} candidate={candidate} locator={locator} />;
}

interface SettingsFormProps { profile: ApiLocalProfile; regions: ApiRegion[]; candidate: string | null; locator: ReturnType<typeof useRegionLocator>; }

function SettingsForm({ profile, regions, candidate, locator }: SettingsFormProps) {
  const { pending: authPending, refresh: refreshAuth } = useAuth();
  const { replace } = useLocalProfile();
  const prefilled = regions.find((region) => region.code === candidate);
  const [regionCode, setRegionCode] = useState(prefilled?.code ?? profile.region?.code ?? null);
  const [interests, setInterests] = useState(profile.interests);
  const [fandomOptIn, setFandomOptIn] = useState(profile.fandomOptIn);
  const [profilePublic, setProfilePublic] = useState(profile.profilePublic);
  const [mapAvatarOptIn, setMapAvatarOptIn] = useState(profile.mapAvatarOptIn ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [expired, setExpired] = useState(false);
  const lock = useRef(false);
  const lifetime = useRef<AbortController | null>(null);
  useEffect(() => { const controller = new AbortController(); lifetime.current = controller; return () => { controller.abort(); }; }, []);
  const selected = regions.find((region) => region.code === regionCode);
  const disabled = busy || authPending;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || disabled || !lifetime.current || interests.length > 20) return;
    const signal = lifetime.current.signal;
    lock.current = true; setBusy(true); setError(null); setSaved(false);
    try {
      const result = await localApi.save({ regionCode, interestIds: interests.map((item) => item.id), fandomOptIn, profilePublic, mapAvatarOptIn }, signal);
      if (signal.aborted) return;
      replace(result);
      setSaved(true);
    } catch (cause) {
      if (signal.aborted) return;
      setError(cause instanceof ApiError ? cause.message : "저장하지 못했어요. 다시 시도해 주세요.");
      if (cause instanceof ApiError && cause.status === 401) { setExpired(true); void refreshAuth(); }
    } finally {
      if (!signal.aborted) { lock.current = false; setBusy(false); }
    }
  }

  if (expired) return <LocalLogin next="/local/settings" />;
  return <form onSubmit={save} className="space-y-6" onChange={() => setSaved(false)}>
    <fieldset id="region" disabled={disabled} className="scroll-mt-36 rounded-xl border border-line bg-panel p-5 sm:p-6">
      <legend className="px-2 text-lg font-bold">01 · 내 동네</legend>
      <p className="mb-4 text-sm leading-relaxed text-sub">시 › 구 › 동·생활권 중 원하는 범위까지 선택하세요. 지역은 사람을 연결하기 위한 정보이지, 개인을 특정하기 위한 정보가 아닙니다.</p>
      {candidate && !prefilled && <p role="status" className="mb-4 text-sm text-pink">링크의 지역을 찾지 못했어요. 아래에서 지역을 다시 선택해 주세요.</p>}
      <RegionSelector regions={regions} value={regionCode} onChange={(code) => { setRegionCode(code); setSaved(false); }} disabled={disabled} />
      <div className="mt-4"><LocateRegionButton label="내 위치로 찾기" locator={locator} disabled={disabled} onFound={(code) => { setRegionCode(code); setSaved(false); }} /></div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className="break-words text-sm text-sub">현재: <strong className="text-ink">{profile.region?.fullName ?? "미설정"}</strong>
          {regionCode !== (profile.region?.code ?? null) && <> → 변경: <strong className="text-mint">{selected?.fullName ?? "미설정"}</strong></>}
        </p>
        <button type="button" disabled={disabled || !regionCode} onClick={() => { setRegionCode(null); setSaved(false); }} className={localButton}>지역 해제</button>
      </div>
      <p className="mt-3 text-xs text-dim">지역을 미리 선택해 들어와도 자동 저장하지 않아요. 아래 ‘저장’을 눌러야 반영돼요.</p>
    </fieldset>
    <fieldset id="interests" disabled={disabled} className="scroll-mt-36 rounded-xl border border-line bg-panel p-5 sm:p-6">
      <legend className="px-2 text-lg font-bold">02 · 내 취향</legend>
      <InterestPicker selected={interests} onChange={(items) => { setInterests(items); setSaved(false); }} disabled={disabled} />
    </fieldset>
    <fieldset disabled={disabled} className="space-y-5 rounded-xl border border-line bg-panel p-5 sm:p-6">
      <legend className="px-2 text-lg font-bold">03 · 활용과 공개</legend>
      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" role="switch" checked={fandomOptIn} onChange={(event) => setFandomOptIn(event.target.checked)} aria-describedby="fandom-purpose" className="mt-1 size-5 shrink-0 accent-mint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint" />
        <span><span className="block font-bold">덕력지도 집계 참여</span><span id="fandom-purpose" className="mt-2 block text-sm leading-relaxed text-sub">선택한 취향은 PIXEL LOCAL 추천과 덕력지도 집계에 활용할 수 있습니다. 참여하면 지역 단위의 익명 취향 인원에 반영돼요. 5명 미만의 정확한 인원은 공개하지 않아요.</span></span>
      </label>
      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" role="switch" checked={profilePublic} onChange={(event) => setProfilePublic(event.target.checked)} aria-describedby="public-purpose" className="mt-1 size-5 shrink-0 accent-mint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint" />
        <span><span className="block font-bold">취향 공개</span><span id="public-purpose" className="mt-2 block text-sm leading-relaxed text-sub">선택한 취향을 다른 사용자에게 공개하는 설정이에요. 현재는 다른 사용자에게 보여 주는 화면이 없으며, 이웃 매칭·프로필에서 쓰일 예정이에요.</span></span>
      </label>
      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" role="switch" checked={mapAvatarOptIn} onChange={(event) => setMapAvatarOptIn(event.target.checked)} aria-describedby="avatar-purpose" className="mt-1 size-5 shrink-0 accent-mint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint" />
        <span><span className="block font-bold">지도에 내 아바타 표시</span><span id="avatar-purpose" className="mt-2 block text-sm leading-relaxed text-sub">덕력지도의 내 동네에 내 픽셀 아바타(없으면 기본 슬라임)가 캐릭터로 나타나요. 같은 동네에서 표시에 동의한 이웃이 5명 이상일 때만, 무작위로 최대 6명이 보이며 닉네임·프로필·정확한 위치는 보여 주지 않아요.</span></span>
      </label>
      <p className="rounded-lg bg-panel-2 p-4 text-xs leading-relaxed text-sub">개인의 구매 행동을 그대로 노출하지 않고, 필요한 경우 익명 집계된 형태로만 서비스에 활용합니다. 구매금액·장바구니·정확한 위치·검색 기록은 공개하지 않아요. 세 설정은 처음에는 꺼져 있고 언제든 변경할 수 있어요.</p>
    </fieldset>
    {error && <p role="alert" className="rounded-lg border border-pink/30 bg-panel p-4 text-sm text-pink">{error}</p>}
    {saved && <p role="status" className="rounded-lg border border-mint/30 bg-panel p-4 text-sm text-mint">내 동네와 취향을 저장했어요.</p>}
    <div className="flex flex-wrap gap-3">
      <button type="submit" disabled={disabled} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-lime bg-lime px-8 py-2 text-sm font-bold text-lime-ink disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint">{busy ? "저장 중…" : "저장"}</button>
      <Link href={localHref(profile.region?.code ?? null)} className={localButton}>덕력지도 보기</Link>
    </div>
  </form>;
}
