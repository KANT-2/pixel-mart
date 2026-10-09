"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useLocalProfile } from "@/components/local/LocalProvider";
import { LocalError, LocalSkeleton, localInput } from "@/components/local/LocalStates";
import { TradeLogin, TradeRegionPrompt } from "@/components/local/TradeStates";
import ProductPicker from "@/components/local/ProductPicker";
import InterestPicker from "@/components/local/InterestPicker";
import { localApi } from "@/lib/local";
import { ApiError } from "@/lib/api";
import { parseTradeQuery, TRADE_KINDS, TRADE_CONDITIONS, TRADE_METHODS, validateTrade, type TradeDraft } from "@/utils/localTrades";
import type { ApiInterest, ApiProduct, TradeCondition, TradeKind, TradeMethod } from "@/types/api";

export default function TradeForm() {
  const { user, loading } = useAuth(), profile = useLocalProfile(), params = useSearchParams();
  const pathname = usePathname();
  const kind = parseTradeQuery(params).kind ?? "have";
  if (pathname !== "/local/trades/new") return null;
  if (loading) return <LocalSkeleton />;
  if (!user || profile.status === 401) return <TradeLogin next={`/local/trades/new?kind=${kind}`} />;
  if (profile.error) return <LocalError message={profile.error} onRetry={() => void profile.refresh()} />;
  if (profile.loading || !profile.data) return <LocalSkeleton />;
  if (!profile.data.region) return <TradeRegionPrompt />;
  return <AccountTradeForm key={`${user.id}:${profile.data.region.code}:${kind}`} initialKind={kind} />;
}
interface AccountTradeFormProps { initialKind: TradeKind; }
function AccountTradeForm({ initialKind }: AccountTradeFormProps) {
  const router = useRouter(), { pending: authPending, refresh: refreshAuth } = useAuth();
  const [draft, setDraft] = useState<TradeDraft>({ kind: initialKind, itemName: "", condition: "", price: "", tradeMethod: "direct", content: "", productId: null, interestId: null });
  const [product, setProduct] = useState<ApiProduct | null>(null), [interests, setInterests] = useState<ApiInterest[]>([]);
  const [errors, setErrors] = useState<ReturnType<typeof validateTrade>["errors"]>({});
  const [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false), [expired, setExpired] = useState(false), [regionMissing, setRegionMissing] = useState(false);
  const lock = useRef(false), lifetime = useRef<AbortController | null>(null);
  useEffect(() => { const controller = new AbortController(); lifetime.current = controller; return () => controller.abort(); }, []);
  const disabled = busy || authPending;
  function field<K extends keyof typeof errors>(key: K, value: TradeDraft[K]) {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: undefined }));
    setError(null);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || disabled || !lifetime.current) return;
    const check = validateTrade({ ...draft, productId: product?.id ?? null, interestId: interests[0]?.id ?? null });
    setErrors(check.errors); setError(null);
    if (!check.valid) { requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()); return; }
    const signal = lifetime.current.signal;
    lock.current = true; setBusy(true);
    try {
      await localApi.createTrade(check.values, signal);
      if (!signal.aborted) router.push("/local/trades/mine?created=1");
    } catch (cause) {
      if (signal.aborted) return;
      setError(cause instanceof ApiError ? cause.message : "글을 등록하지 못했어요. 다시 시도해 주세요.");
      if (cause instanceof ApiError && cause.status === 401) { setExpired(true); void refreshAuth(); }
      if (cause instanceof ApiError && cause.message === "먼저 내 지역을 설정해 주세요.") setRegionMissing(true);
      lock.current = false; setBusy(false);
    }
  }
  if (expired) return <TradeLogin next={`/local/trades/new?kind=${draft.kind}`} />;
  if (regionMissing) return <TradeRegionPrompt />;
  return <form onSubmit={submit} noValidate className="space-y-6">
    <p className="text-sm text-sub">내 동네 설정에 저장한 지역으로 등록돼요. 다른 사람에게 작성자 정보나 정확한 위치는 표시하지 않아요.</p>
    <fieldset disabled={disabled} className="space-y-5 pixel-panel p-5 sm:p-6">
      <legend className="px-2 text-lg font-bold">물건 정보</legend>
      <label className="block text-sm font-semibold">글 종류<select aria-label="글 종류" value={draft.kind} onChange={(event) => { field("kind", event.target.value as TradeKind); setErrors({}); }} className={`${localInput} mt-2`}>{TRADE_KINDS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <label className="block text-sm font-semibold">물건명<input aria-label="물건명" value={draft.itemName} maxLength={60} onChange={(event) => field("itemName", event.target.value)} aria-invalid={Boolean(errors.itemName)} aria-describedby={errors.itemName ? "trade-name-error" : undefined} className={`${localInput} mt-2`} /></label>
      {errors.itemName && <p id="trade-name-error" role="alert" className="text-sm text-pink">{errors.itemName}</p>}
      <div className="grid gap-4 sm:grid-cols-2"><div><label className="block text-sm font-semibold">물건 상태 {draft.kind !== "want" ? "(필수)" : "(선택)"}<select aria-label="물건 상태" value={draft.condition} onChange={(event) => field("condition", event.target.value as TradeCondition | "")} aria-invalid={Boolean(errors.condition)} aria-describedby={errors.condition ? "trade-condition-error" : undefined} className={`${localInput} mt-2`}><option value="">상태 선택</option>{TRADE_CONDITIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>{errors.condition && <p id="trade-condition-error" role="alert" className="mt-2 text-sm text-pink">{errors.condition}</p>}</div>
        <div><label className="block text-sm font-semibold">희망 가격 (원 · 선택)<input aria-label="희망 가격" inputMode="numeric" value={draft.price} onChange={(event) => field("price", event.target.value)} placeholder="숫자만 입력" aria-invalid={Boolean(errors.price)} aria-describedby={errors.price ? "trade-price-error" : undefined} className={`${localInput} mt-2`} /></label>{errors.price && <p id="trade-price-error" role="alert" className="mt-2 text-sm text-pink">{errors.price}</p>}</div>
      </div>
      <label className="block text-sm font-semibold">거래 방식<select aria-label="거래 방식" value={draft.tradeMethod} onChange={(event) => field("tradeMethod", event.target.value as TradeMethod)} className={`${localInput} mt-2`}>{TRADE_METHODS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <label className="block text-sm font-semibold">내용<textarea aria-label="글 내용" value={draft.content} maxLength={1000} rows={5} onChange={(event) => field("content", event.target.value)} aria-invalid={Boolean(errors.content)} aria-describedby="trade-content-help trade-content-error" className={`${localInput} mt-2 resize-y`} /></label>
      <div id="trade-content-help" className="flex flex-wrap justify-between gap-2 text-xs text-dim"><span>물건 설명만 작성해 주세요. 연락처·정확한 장소는 적을 수 없어요.</span><span>{[...draft.content].length} / 1,000자</span></div>
      <p id="trade-content-error" role={errors.content ? "alert" : undefined} className="text-sm text-pink">{errors.content}</p>
    </fieldset>
    <fieldset disabled={disabled} className="pixel-panel p-5 sm:p-6"><legend className="px-2 text-lg font-bold">상품 연결</legend><ProductPicker selected={product} onChange={setProduct} disabled={disabled} /></fieldset>
    <fieldset disabled={disabled} className="pixel-panel p-5 sm:p-6"><legend className="px-2 text-lg font-bold">취향 연결</legend><InterestPicker selected={interests} onChange={setInterests} single disabled={disabled} /></fieldset>
    {error && <p role="alert" className="rounded-lg border border-pink/30 bg-panel p-4 text-sm text-pink">{error}</p>}
    <button type="submit" disabled={disabled} className="min-h-11 btn-lime px-8 py-3 font-bold text-lime-ink disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint">{busy ? "등록 중…" : "글 등록"}</button>
  </form>;
}
