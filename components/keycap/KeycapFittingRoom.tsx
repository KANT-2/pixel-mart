"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useCart } from "@/components/CartProvider";
import { KEYCAPS, KEYCAP_KIND_LABEL, type KeycapItem, type KeycapKind } from "@/data/keycaps";
import { ARROW_KEYS, WOOTING_80HE as BOARD } from "@/data/keyboards";
import { keycapImage, placeKeycap, recommendKeycaps, removeKeycap, trayKeycaps, withObject, type Placement } from "@/utils/keycapFit";
import { safeNextPath } from "@/utils/safeNextPath";

// 나머지 키 — 비워 두면 스위치가 보이고, 색을 고르면 기본 키캡(무각 키캡 질감 × 색)으로 채워 내 키보드와 비슷하게 맞춘다.
// color는 곱하기 전 색이라 실제 보이는 색은 조금 어둡다 — 그래서 블랙도 약간 밝게 둔다
const BASES = {
  none: { label: "비우기", color: "#1e1c26" },
  black: { label: "블랙", color: "#57545f" },
  white: { label: "화이트", color: "#ffffff" },
  lavender: { label: "라벤더", color: "#d9cbff" },
  cream: { label: "크림", color: "#fff0d2" },
  mint: { label: "민트", color: "#b9f6e8" },
  pink: { label: "핑크", color: "#ffc7de" },
  custom: { label: "직접 고르기", color: "" },
} as const;
const BLANK_KEYCAP = "/images/keycaps/blank.webp";
const KINDS: [KeycapKind | "all", string][] = [["all", "전체"], ["one", "1u"], ["set", "방향키 세트"], ["space", "스페이스바"]];

type BaseKey = keyof typeof BASES;

interface KeycapFittingRoomProps {
  /** 들어온 상세 페이지의 키캡 (서랍 맨 앞, 처음엔 ESC에 끼워 둠) */
  current: KeycapItem | null;
  productName: string;
  productId: number;
}

const pct = (value: number, total: number) => `${(value / total) * 100}%`;
// 손가락으로 쓰는 화면(휴대폰·태블릿)이거나 휴대폰 폭 — 끌어다 놓기 대신 '누르고 → 키 누르기' 안내
const COARSE = "(pointer: coarse), (max-width: 767px)";
const isCoarse = () => window.matchMedia(COARSE).matches;
const subscribeMedia = (query: string) => (onChange: () => void) => { const media = window.matchMedia(query); media.addEventListener("change", onChange); return () => media.removeEventListener("change", onChange); };
const subscribeCoarse = subscribeMedia(COARSE);
// 세로로 든 휴대폰 — 가로로 돌려 보라는 안내 (globals.css의 phone-portrait와 같은 조건)
const PORTRAIT = "(orientation: portrait) and (max-width: 767px)";
const isPortrait = () => window.matchMedia(PORTRAIT).matches;
const subscribePortrait = subscribeMedia(PORTRAIT);

export default function KeycapFittingRoom({ current, productName, productId }: KeycapFittingRoomProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { add } = useCart();
  const [base, setBase] = useState<BaseKey>("none");
  const [customColor, setCustomColor] = useState("#6ef2d6");
  const [switchId, setSwitchId] = useState(BOARD.switches[0].id);
  const [placed, setPlaced] = useState<Placement>(() => current ? placeKeycap({}, current, current.kind === "space" ? { id: "Space", label: "", w: 6.25 } : { id: "Escape", label: "Esc", w: 1 }).placed : {});
  const [view, setView] = useState<"before" | "after">("after");
  const [kind, setKind] = useState<KeycapKind | "all">("all");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [message, setMessage] = useState(current ? `${withObject(current.name)} 끼워 봤어요. 다른 키캡도 끌어다 놓아 보세요.` : "키캡을 끌어다 빈 키 위에 놓아 보세요.");
  const [cartState, setCartState] = useState<"idle" | "adding" | "done" | "error">("idle");
  const rootRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [rotateNote, setRotateNote] = useState(false);
  // 터치 화면은 끌어다 놓기가 안 돼서 '누르고 → 키 누르기' 사용법을 알림으로
  const touch = useSyncExternalStore(subscribeCoarse, isCoarse, () => false);
  const portrait = useSyncExternalStore(subscribePortrait, isPortrait, () => false);
  const [tipClosed, setTipClosed] = useState(false);
  const touchTip = touch && !tipClosed;
  useEffect(() => {
    if (!touch) return;
    const timer = window.setTimeout(() => setTipClosed(true), 8000);
    return () => window.clearTimeout(timer);
  }, [touch]);
  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  // 안드로이드: 전체화면 + 가로 고정. 아이폰 사파리는 화면 방향 잠금을 지원하지 않아 돌려 달라는 안내로
  async function openLandscape() {
    const root = rootRef.current;
    if (!root) return;
    try {
      await root.requestFullscreen();
      const orientation = screen.orientation as ScreenOrientation & { lock?: (direction: "landscape") => Promise<void> };
      if (!orientation.lock) throw new Error("no lock");
      await orientation.lock("landscape");
    } catch {
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
      setRotateNote(true);
    }
  }

  const byId = (id: string) => KEYCAPS.find((item) => item.id === id);
  const baseColor = base === "custom" ? customColor : BASES[base].color;
  const board = BOARD.switches.find((item) => item.id === switchId) ?? BOARD.switches[0];
  const usedIds = useMemo(() => [...new Set(Object.values(placed))], [placed]);
  const used = usedIds.map(byId).filter((item): item is KeycapItem => Boolean(item));
  const recs = recommendKeycaps(KEYCAPS, usedIds, baseColor, used[0]?.color ?? "#a78bff");
  const tray = trayKeycaps(KEYCAPS, current?.id ?? null, kind, query);

  function place(itemId: string | null, keyId: string) {
    const item = itemId ? byId(itemId) : undefined;
    const key = BOARD.keys.find((k) => k.id === keyId);
    setOver(null);
    if (!item || !key) return;
    const result = placeKeycap(placed, item, key);
    setMessage(result.message);
    if (result.ok) { setPlaced(result.placed); setPicked(null); setView("after"); setCartState("idle"); }
  }
  function clickKey(keyId: string) {
    const item = placed[keyId] ? byId(placed[keyId]) : undefined;
    if (item) { setPlaced(removeKeycap(placed, keyId, item.kind)); setMessage(`${withObject(item.name)} 뺐어요.`); setCartState("idle"); }
    else if (picked) place(picked, keyId);
  }
  function pick(item: KeycapItem) {
    const next = picked === item.id ? null : item.id;
    setPicked(next);
    setMessage(next ? `${withObject(item.name)} 골랐어요. 끼울 키를 눌러 주세요.` : "선택을 풀었어요.");
  }
  async function addAll() {
    if (!user) { router.push(`/login?next=${encodeURIComponent(safeNextPath(window.location.pathname))}`); return; }
    setCartState("adding");
    try {
      for (const item of used) await add(item.productId, 1);
      setCartState("done");
    } catch { setCartState("error"); }
  }
  const whereOf = (id: string) => {
    const keys = Object.keys(placed).filter((k) => placed[k] === id);
    if (keys.length === 4 && keys.every((k) => (ARROW_KEYS as readonly string[]).includes(k))) return "방향키";
    return keys.map((k) => BOARD.keys.find((key) => key.id === k)?.label || "스페이스바").join(", ");
  };
  const capButton = (item: KeycapItem, compact = false) => (
    <button key={item.id} type="button" draggable aria-pressed={picked === item.id}
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", item.id);
        event.dataTransfer.effectAllowed = "copy";
        // 끌 때는 카드가 아니라 키캡 그림만 따라오게
        const image = event.currentTarget.querySelector("img");
        if (image) event.dataTransfer.setDragImage(image, image.clientWidth / 2, image.clientHeight / 2);
        setPicked(item.id);
      }}
      onClick={() => pick(item)}
      className={`relative flex min-w-0 cursor-grab flex-col items-center gap-1.5 rounded-md border-2 bg-night px-1.5 py-2 text-center ${picked === item.id ? "border-lime/60" : item.id === current?.id ? "border-sub" : "border-frame/70"}`}>
      {item.id === current?.id && !compact && <span className="absolute left-1 top-1 rounded bg-sub px-1.5 text-[10px] font-black text-night phone-landscape:px-1 phone-landscape:text-[8px]">지금 보는 키캡</span>}
      <span className={`flex items-center justify-center ${compact ? "h-10" : "h-12"}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- 키캡 그림 */}
        <img src={keycapImage(item)} alt="" draggable={false} className="h-full max-w-full object-contain" />
      </span>
      <strong className="line-clamp-2 text-[11px] leading-tight">{item.name}</strong>
      {!compact && <span className="text-[10px] text-dim">{KEYCAP_KIND_LABEL[item.kind]}</span>}
    </button>
  );

  return <div ref={rootRef} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] [&:fullscreen]:overflow-y-auto [&:fullscreen]:bg-night [&:fullscreen]:p-3">
    {/* 휴대폰 세로 — 가로로 보면 키가 커지고 키캡 목록이 옆에 나란히 */}
    <div className="hidden items-center gap-3 rounded-md border-2 border-mint/40 bg-panel p-3 phone-portrait:flex">
      <span aria-hidden="true" className="font-pixel text-xl text-mint">⟲</span>
      <p role="status" className="min-w-0 flex-1 text-sm text-sub">{rotateNote ? <>이 휴대폰은 자동으로 돌릴 수 없어요. <strong className="text-ink">휴대폰을 가로로 돌려 주세요.</strong></> : <>휴대폰을 <strong className="text-ink">가로로 돌리면</strong> 키보드가 크게 보이고 키캡 목록이 옆에 나와요.</>}</p>
      <button type="button" onClick={() => void openLandscape()} className="btn-pixel h-10 shrink-0 px-3 text-xs font-bold text-mint">가로로 크게 보기</button>
    </div>
    {touchTip && <div role="status" className="fixed inset-x-3 bottom-4 z-40 mx-auto flex max-w-md items-start gap-3 rounded-md border-2 border-mint/60 bg-panel p-3 shadow-[4px_4px_0_var(--color-shadow)]">
      <span aria-hidden="true" className="font-pixel text-lg text-mint">TIP</span>
      <div className="min-w-0 flex-1 space-y-2 text-sm leading-relaxed text-ink">
        <p><strong className="text-mint">① 키캡을 먼저 누르고</strong> → <strong className="text-mint">② 끼울 키 자리를 누르면</strong> 끼워져요. 끼운 키를 다시 누르면 빠져요.</p>
        {portrait && <p className="flex flex-wrap items-center gap-2 border-t border-frame pt-2"><span>⟲ 휴대폰을 <strong className="text-mint">가로로 돌리면</strong> 키보드가 크게 보여요.</span>
          <button type="button" onClick={() => void openLandscape()} className="btn-pixel h-8 px-2.5 text-xs font-bold text-mint">가로로 크게 보기</button></p>}
      </div>
      <button type="button" onClick={() => setTipClosed(true)} aria-label="사용법 알림 닫기" className="btn-pixel size-9 shrink-0 text-sm">✕</button>
    </div>}
    {fullscreen && <button type="button" onClick={() => void document.exitFullscreen()} className="btn-pixel fixed right-3 top-3 z-30 h-9 px-3 text-xs font-bold">✕ 나가기</button>}
    {/* 휴대폰 가로 — 왼쪽 키보드, 오른쪽 키캡 목록(따로 스크롤)의 분할 화면 */}
    <div className="min-w-0 space-y-5 phone-landscape:grid phone-landscape:grid-cols-[minmax(0,1fr)_36%] phone-landscape:gap-3 phone-landscape:space-y-0">
      {/* 1. 내 키보드 — 지금 키캡 색·케이스·조명 */}
      <section aria-label="내 키보드" className="pixel-panel flex flex-wrap items-center gap-x-5 gap-y-3 p-4 phone-landscape:col-span-2 phone-landscape:gap-y-2 phone-landscape:p-2.5">
        <span className="font-pixel text-xs text-mint">STEP 1 · MY KEYBOARD</span>
        <label className="flex items-center gap-2 text-sm font-bold">모델
          <select id="keycap-board" name="board" className="pixel-input h-9 py-0 text-sm" value={BOARD.id} onChange={() => undefined}><option value={BOARD.id}>{BOARD.name}</option></select>
        </label>
        <div role="group" aria-label="스위치" className="segmented h-9 text-xs font-bold">
          {BOARD.switches.map((item) => <button key={item.id} type="button" aria-pressed={switchId === item.id} onClick={() => setSwitchId(item.id)}>{item.label}</button>)}
        </div>
        <div role="group" aria-label="나머지 키" className="flex items-center gap-2"><span className="text-sm font-bold">나머지 키</span>
          {(Object.keys(BASES) as BaseKey[]).filter((key) => key !== "custom").map((key) => <button key={key} type="button" aria-pressed={base === key} aria-label={key === "none" ? "나머지 키 비우기 (스위치 보기)" : `나머지 키를 ${BASES[key].label} 키캡으로`} title={BASES[key].label}
            onClick={() => setBase(key)} className={`size-8 rounded-md border-2 ${key === "none" ? "border-dashed border-sub" : "border-frame"} ${base === key ? "outline-3 outline-offset-2 outline-mint" : ""}`} style={{ background: key === "none" ? "transparent" : BASES[key].color }} />)}
          {/* 원하는 색 직접 고르기 */}
          <label title="직접 고르기" className={`relative size-8 cursor-pointer overflow-hidden rounded-md border-2 border-frame ${base === "custom" ? "outline-3 outline-offset-2 outline-mint" : ""}`}
            style={{ background: base === "custom" ? customColor : "conic-gradient(#ff7ab6, #ffd166, #b6ff5c, #6ef2d6, #a78bff, #ff7ab6)" }}>
            <span className="sr-only">나머지 키 색 직접 고르기</span>
            <input id="keycap-base-color" name="baseColor" type="color" value={customColor} onChange={(event) => { setCustomColor(event.target.value); setBase("custom"); }} className="absolute inset-0 cursor-pointer opacity-0" />
          </label>
        </div>
      </section>

      {/* 2. 키보드 — 키캡을 끌어다 놓거나, 고른 뒤 키를 눌러 끼우기 */}
      <section aria-label="키보드 미리보기" className="pixel-panel p-4 phone-landscape:sticky phone-landscape:top-2 phone-landscape:self-start phone-landscape:p-2.5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="font-pixel text-xs text-mint">STEP 2 · {touch ? "키캡을 누르고 키 자리를 눌러 끼우기" : "키캡을 끌어다 키 위에 놓기"}</span>
          <div className="flex items-center gap-2">
            <div role="group" aria-label="비교" className="segmented h-9 text-xs font-bold">
              <button type="button" aria-pressed={view === "before"} onClick={() => setView("before")}>끼우기 전</button>
              <button type="button" aria-pressed={view === "after"} onClick={() => setView("after")}>끼운 후</button>
            </div>
            <button type="button" onClick={() => { setPlaced({}); setMessage("모든 키캡을 뺐어요."); }} className="btn-pixel h-9 px-3 text-xs font-bold text-sub">모두 빼기</button>
          </div>
        </div>
        {/* 모바일에서는 상자 안에서 가로로 밀어 보기 */}
        <div className="overflow-x-auto pb-2">
          <div className="relative min-w-[640px] phone-landscape:min-w-0" style={{ aspectRatio: `${BOARD.width} / ${BOARD.height}` }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- 키캡을 뺀 RGB 스위치 사진 */}
            <img src={board.image} alt={`${BOARD.name} ${board.label} — 키캡을 뺀 모습`} className="absolute inset-0 h-full w-full select-none" draggable={false} />
            {BOARD.keys.map((key) => {
              const item = placed[key.id] ? byId(placed[key.id]) : undefined;
              const show = item && view === "after";
              const fill = !show && base !== "none";
              const inset = BOARD.insetPx;
              return <button key={key.id} type="button" aria-label={`${key.label || "스페이스바"}${item ? ` — ${item.name} 끼움, 눌러서 빼기` : " 자리"}`}
                onClick={() => clickKey(key.id)}
                onDragOver={(event) => { event.preventDefault(); if (over !== key.id) setOver(key.id); }}
                onDragLeave={() => { if (over === key.id) setOver(null); }}
                onDrop={(event) => { event.preventDefault(); place(event.dataTransfer.getData("text/plain") || picked, key.id); }}
                className={`absolute cursor-pointer rounded-[6px] ${over === key.id ? "outline-3 outline-dashed outline-lime" : picked && !item ? "outline-2 outline-mint/70" : "hover:outline-2 hover:outline-white/40"}`}
                style={{
                  left: pct(key.x + inset, BOARD.width), top: pct(key.y + inset, BOARD.height),
                  width: pct(key.w * BOARD.unitPx - 2 * inset, BOARD.width), height: pct(BOARD.unitPx - 2 * inset, BOARD.height),
                }}>
                {/* 기본 키캡 — 밝은 무각 키캡 질감에 색을 곱해 칠하고, 긴 키는 경사면을 그대로 둔 채 가운데만 늘림 */}
                {fill && <span className="absolute inset-0 isolate [container-type:size]">
                  <span className="absolute inset-[2%] rounded-[14cqh]" style={{ background: baseColor }} />
                  <span className="absolute inset-0 mix-blend-multiply" style={{ borderStyle: "solid", borderImage: `url(${BLANK_KEYCAP}) 12% fill / 13cqh stretch` }} />
                </span>}
                {/* eslint-disable-next-line @next/next/no-img-element -- 끼운 키캡 그림 */}
                {show && <img src={keycapImage(item, key.id)} alt="" draggable={false} className="absolute inset-0 h-full w-full object-fill drop-shadow-[0_3px_2px_rgb(0_0_0/0.45)]" />}
              </button>;
            })}
          </div>
        </div>
        <p role="status" className="mt-3 flex items-center gap-2 text-sm text-sub"><span className="size-2 bg-mint shadow-[0_0_8px_var(--color-mint)]" />{touch ? message.replace("다른 키캡도 끌어다 놓아 보세요.", "다른 키캡을 누르고 키 자리를 눌러 보세요.").replace("키캡을 끌어다 빈 키 위에 놓아 보세요.", "키캡을 누르고 끼울 키 자리를 눌러 보세요.") : message}</p>
      </section>


      {/* 키캡 서랍 — 보던 키캡이 맨 앞, 종류·이름으로 찾기 */}
      <section aria-labelledby="keycap-drawer" className="pixel-panel space-y-3 p-4 phone-landscape:max-h-[calc(100svh-16px)] phone-landscape:overflow-y-auto phone-landscape:p-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p><strong id="keycap-drawer">키캡 서랍</strong><span className="ml-2 text-sm text-dim phone-landscape:hidden">{touch ? "키캡을 누른 뒤, 끼울 키 자리를 눌러 주세요" : "끌어서 키 위에 놓거나, 누른 뒤 키를 눌러도 돼요"}</span></p>
          <div className="flex flex-wrap items-center gap-2 phone-landscape:w-full">
            <label htmlFor="keycap-search" className="sr-only">키캡 이름 검색</label>
            <input id="keycap-search" name="keycapQuery" value={query} onChange={(event) => setQuery(event.target.value.slice(0, 20))} placeholder="키캡 이름 (예: 포션)" autoComplete="off" className="pixel-input h-9 w-48 py-0 text-sm phone-landscape:w-full" />
            <div role="group" aria-label="키캡 종류" className="segmented h-9 text-xs font-bold phone-landscape:flex phone-landscape:w-full phone-landscape:[&>button]:flex-1 phone-landscape:[&>button]:px-1">
              {KINDS.map(([value, label]) => <button key={value} type="button" aria-pressed={kind === value} onClick={() => setKind(value)}>{label}</button>)}
            </div>
          </div>
        </div>
        {tray.length ? <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6 phone-landscape:grid-cols-3 phone-landscape:gap-1.5">{tray.map((item) => capButton(item))}</div>
          : <p className="py-6 text-center text-sm text-sub">&lsquo;{query}&rsquo;에 맞는 키캡이 없어요.</p>}
      </section>
    </div>

    <aside className="space-y-4">
      <section aria-labelledby="keycap-combo" className="pixel-panel space-y-2.5 p-4">
        <div className="flex items-baseline justify-between"><h2 id="keycap-combo" className="font-black">내 조합</h2><span className="text-sm text-sub">{used.length ? `키캡 ${used.length}종 · ${Object.keys(placed).length}개` : "비어 있음"}</span></div>
        {used.map((item) => <div key={item.id} className="flex items-center gap-2.5 rounded-md bg-night p-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- 키캡 그림 */}
          <img src={keycapImage(item)} alt="" className="h-8 max-w-16 object-contain" />
          <Link href={`/products/${item.productId}`} className="min-w-0 flex-1 truncate text-sm font-bold hover:text-mint">{item.name}</Link>
          <span className="text-xs text-dim">{whereOf(item.id)}</span>
        </div>)}
        <button type="button" disabled={!used.length || cartState === "adding"} onClick={() => void addAll()} className="btn-lime h-12 w-full font-bold disabled:opacity-50">
          {cartState === "adding" ? "담는 중…" : cartState === "done" ? "장바구니에 담았어요 ✓" : "조합 그대로 장바구니 담기"}
        </button>
        {cartState === "done" && <Link href="/cart" className="block text-center text-sm font-bold text-mint">장바구니 보기 ▶</Link>}
        {cartState === "error" && <p role="alert" className="text-sm text-pink">장바구니에 담지 못했어요. 잠시 후 다시 시도해 주세요.</p>}
        <p className="text-xs text-dim">✓ 체리 프로파일 · {BOARD.name}에 장착 가능</p>
      </section>
      <section aria-labelledby="keycap-recs" className="pixel-panel space-y-2.5 p-4">
        <h2 id="keycap-recs" className="font-black">이 키보드에 어울리는 키캡</h2>
        <div className="grid grid-cols-3 gap-2">{recs.map((item) => capButton(item, true))}</div>
        <p className="text-xs text-dim">나머지 키 색과 대비가 좋고, 끼운 키캡과 색 계열이 가까운 순서예요.</p>
      </section>

      <Link href={`/products/${productId}`} className="btn-pixel grid h-11 place-items-center text-sm font-bold text-sub">{productName} 상세로 돌아가기</Link>
    </aside>
  </div>;
}
