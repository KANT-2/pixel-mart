"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./PixelMap.module.css";
import type { MapViewData } from "@/lib/localMapData";
import { blockCells, blockChar, decodeView, hashSeed, labelBox, labelCell, pickPinCells, seededRandom, type Box, type Cell } from "@/utils/localMap";
import { HEAT_COLORS, HEAT_NONE, LANDMARKS, SPRITES, coversCell, heatTier, placeSprite, seaSpots, spritePaths, type SpriteName } from "@/utils/mapSprites";

export interface MapBlock {
  code: string;
  name: string;
  /** 이름표에 붙일 인원 (없으면 null) */
  count: number | null;
  /** 핀 — 아바타 PNG data URL, null이면 기본 슬라임. ranked면 0번부터 구매 순위 */
  pins: (string | null)[];
  sample: boolean;
  hint?: string;
  /** 인원 대신 세는 단위 (위시맵: "개") */
  unit?: string;
  /** 이름표에 붙일 취향 이름 ("서울 · 슬라임 64명") */
  tag?: string;
  /** 핀 순서가 구매 순위(0번이 1위)인지 */
  ranked?: boolean;
}

interface PixelMapProps {
  view: MapViewData;
  blocks: MapBlock[];
  selected: string | null;
  seedKey: string;
  onSelect: (code: string) => void;
  label: string;
  /** 인원 표시 없이 이름만 (메인 미리보기) */
  namesOnly?: boolean;
  /** 캐릭터를 눌렀을 때 — 없으면 그 지역을 고른 것과 같다 */
  onPinSelect?: (code: string, index: number) => void;
  /** 인원에 따라 지역 색을 적음·보통·많음으로 칠한다 */
  heat?: boolean;
  /** 랜드마크·배 같은 장식 도트 */
  landmarks?: boolean;
}

// 게임 맵 팔레트 — 서비스 지역 블록은 풀밭 계열, 나머지는 어두운 땅·바다
const SEA = "#13204a";
const SEA_WAVE = "#2c4a8a";
const OUTER = "#24322f";
const INNER = "#2e443a";
const TREE = "#1a2a22";
const COAST = "#d8c48a";
const BORDER = "#0b0f1e";
const SELECTED = "#b6ff5c";
const BLOCKS = ["#4caf6a", "#6cc04a", "#38a89a", "#8bbf3c", "#58b07e", "#3f9f5a", "#79c46b", "#46a88c"];

function runsPath(rows: string[], match: (char: string) => boolean) {
  let d = "";
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (!match(row[x])) { x++; continue; }
      const start = x;
      while (x < row.length && match(row[x])) x++;
      d += `M${start} ${y}h${x - start}v1h-${x - start}z`;
    }
  });
  return d;
}

const isLand = (char: string | undefined) => char !== undefined && char !== ".";

/** 칸 경계선: 블록끼리 경계(어두운 선)와 해안선(모래색) */
function edgePaths(rows: string[], selectedChar: string | null) {
  let border = "";
  let coast = "";
  let selected = "";
  const height = rows.length;
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const self = row[x];
      const neighbors: [string | undefined, string][] = [
        [row[x + 1], `M${x + 1} ${y}v1`],
        [y + 1 < height ? rows[y + 1][x] : undefined, `M${x} ${y + 1}h1`],
        [row[x - 1], `M${x} ${y}v1`],
        [y > 0 ? rows[y - 1][x] : undefined, `M${x} ${y}h1`],
      ];
      neighbors.forEach(([other, segment], i) => {
        if (selectedChar && self === selectedChar && other !== selectedChar) selected += segment;
        if (i >= 2 || other === undefined || other === self) return; // 오른쪽·아래만 세어 중복 방지
        if (isLand(self) !== isLand(other)) coast += segment;
        else if (self >= "a" || other >= "a") border += segment;
      });
    }
  });
  return { border, coast, selected };
}

// 칸 하나짜리 도트 나무 (잎 두 단 + 줄기)
const tree = (x: number, y: number) => `M${x + 0.4} ${y + 0.1}h0.2v0.2h-0.2zM${x + 0.25} ${y + 0.3}h0.5v0.35h-0.5z`;
const trunk = (x: number, y: number) => `M${x + 0.44} ${y + 0.65}h0.12v0.25h-0.12z`;

/** 땅의 나무·바다의 물결 — 지도마다 고정된 장식 (지역 블록 안에도 듬성듬성) */
function decorations(rows: string[], seed: number) {
  const random = seededRandom(seed);
  let trees = "";
  let blockTrees = "";
  let trunks = "";
  let waves = "";
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const roll = random();
      const char = row[x];
      if (char === "." && roll < 0.035) waves += `M${x + 0.2} ${y + 0.45}h0.6v0.14h-0.6z`;
      if ((char === "," || char === "#") && roll < 0.09) { trees += tree(x, y); trunks += trunk(x, y); }
      if (char >= "a" && roll < 0.05) { blockTrees += tree(x, y); trunks += trunk(x, y); }
    }
  });
  return { trees, blockTrees, trunks, waves };
}

const percent = (value: number, total: number) => `${(value / total) * 100}%`;

const MAX_ZOOM = 4;
const ZOOM_STEP = 1.5;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

interface Zoom { z: number; x: number; y: number; }

/** (cx, cy)를 고정점으로 배율을 바꾸고, 지도 밖이 보이지 않게 위치를 맞춘다 */
function zoomAround(prev: Zoom, next: number, cx: number, cy: number, width: number, height: number): Zoom {
  const z = clamp(next, 1, MAX_ZOOM);
  const x = cx - ((cx - prev.x) * z) / prev.z;
  const y = cy - ((cy - prev.y) * z) / prev.z;
  return { z, x: clamp(x, width * (1 - z), 0), y: clamp(y, height * (1 - z), 0) };
}

/** 지도 확대·이동 — 버튼·Ctrl+휠(트랙패드 핀치)로 확대하고, 확대한 상태에서 끌어서 옮긴다 */
function useZoom(resetKey: unknown) {
  const ref = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<Zoom>({ z: 1, x: 0, y: 0 });
  const [prevKey, setPrevKey] = useState(resetKey);
  const drag = useRef<{ id: number; startX: number; startY: number; x: number; y: number; moved: boolean } | null>(null);
  const dragged = useRef(false);

  // 다른 지도로 바뀌면 원래 크기로
  if (prevKey !== resetKey) {
    setPrevKey(resetKey);
    setZoom({ z: 1, x: 0, y: 0 });
  }

  const zoomTo = (next: number) => {
    const box = ref.current?.getBoundingClientRect();
    if (box) setZoom((prev) => zoomAround(prev, next, box.width / 2, box.height / 2, box.width, box.height));
  };

  // 휠은 페이지 스크롤을 막아야 해서 passive가 아닌 리스너로 — Ctrl(트랙패드 핀치 포함)을 누를 때만 확대
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      const box = element.getBoundingClientRect();
      setZoom((prev) => zoomAround(prev, prev.z * Math.exp(-event.deltaY * 0.01),
        event.clientX - box.left, event.clientY - box.top, box.width, box.height));
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, []);

  const handlers = {
    onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
      dragged.current = false;
      if (zoom.z <= 1 || event.button !== 0) return;
      drag.current = { id: event.pointerId, startX: event.clientX, startY: event.clientY, x: zoom.x, y: zoom.y, moved: false };
    },
    onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
      const d = drag.current;
      const box = ref.current?.getBoundingClientRect();
      if (!d || d.id !== event.pointerId || !box) return;
      const dx = event.clientX - d.startX;
      const dy = event.clientY - d.startY;
      if (!d.moved && Math.hypot(dx, dy) < 5) return;
      if (!d.moved) { d.moved = true; event.currentTarget.setPointerCapture(event.pointerId); }
      setZoom((prev) => ({ ...prev, x: clamp(d.x + dx, box.width * (1 - prev.z), 0), y: clamp(d.y + dy, box.height * (1 - prev.z), 0) }));
    },
    onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
      dragged.current = Boolean(drag.current?.moved);
      if (drag.current?.moved && event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      drag.current = null;
    },
    // 끌어서 옮긴 뒤 손을 뗀 곳의 지역이 눌리지 않게
    onClickCapture(event: React.MouseEvent) {
      if (dragged.current) { event.stopPropagation(); dragged.current = false; }
    },
  };

  return { ref, zoom, zoomTo, handlers };
}

/**
 * 이름표 실제 크기의 절반(지도 칸 단위) — 핀이 이름표를 가리지 않게. 확대 배율과 무관한 레이아웃 크기로 잰다.
 * 글자·화면 크기가 바뀌면 ResizeObserver로 다시 잰다.
 */
function useLabelSizes(canvasRef: React.RefObject<HTMLDivElement | null>, cols: number, contentKey: string) {
  const [sizes, setSizes] = useState<Record<string, [number, number]>>({});
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const measure = () => {
      const cell = canvas.offsetWidth / cols;
      if (!cell) return;
      const next: Record<string, [number, number]> = {};
      canvas.querySelectorAll<HTMLElement>("[data-label]").forEach((element) => {
        // 0.25칸 단위로 맞춰 미세한 변화로 핀이 다시 섞이지 않게
        const half = (px: number) => Math.ceil((px / cell / 2) * 4) / 4;
        next[element.dataset.label ?? ""] = [half(element.offsetWidth), half(element.offsetHeight)];
      });
      setSizes((prev) => JSON.stringify(prev) === JSON.stringify(next) ? prev : next);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    canvas.querySelectorAll("[data-label]").forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [canvasRef, cols, contentKey]);
  return sizes;
}

export default function PixelMap({ view, blocks, selected, seedKey, onSelect, label, namesOnly = false, onPinSelect, heat = false, landmarks = false }: PixelMapProps) {
  const rows = useMemo(() => decodeView(view), [view]);
  const cells = useMemo(() => blockCells(rows, view.legend.length), [rows, view.legend.length]);
  const labels = useMemo(() => cells.map((list) => labelCell(list, rows)), [cells, rows]);
  const selectedIndex = selected ? view.legend.indexOf(selected) : -1;
  const edges = useMemo(() => edgePaths(rows, selectedIndex >= 0 ? blockChar(selectedIndex) : null), [rows, selectedIndex]);
  const decor = useMemo(() => decorations(rows, hashSeed(view.legend.join(","))), [rows, view.legend]);
  const blockByCode = new Map(blocks.map((block) => [block.code, block]));
  const maxCount = Math.max(0, ...blocks.map((block) => block.count ?? 0));
  const blockFill = (code: string, index: number) => {
    if (!heat) return BLOCKS[index % BLOCKS.length];
    const tier = heatTier(blockByCode.get(code)?.count ?? null, maxCount);
    return tier === null ? HEAT_NONE : HEAT_COLORS[tier];
  };
  // 랜드마크: 전체 지도는 지역별 고정, 안쪽 지도는 몇몇 블록에 빌딩 — 바다에는 배
  const sights = useMemo(() => {
    if (!landmarks) return [];
    const seed = hashSeed(view.legend.join(","));
    const placed = view.legend.flatMap((code, index) => {
      const name: SpriteName | null = LANDMARKS[code] ?? (hashSeed(code) % 3 === 0 ? "buildings" : null);
      const spot = name ? placeSprite(cells[index], SPRITES[name], seed + index, labels[index]) : null;
      return name && spot ? [{ key: code, index, name, spot }] : [];
    });
    const boats = seaSpots(rows, SPRITES.boat, 3, seed).map((spot, i) => ({ key: `boat-${i}`, index: -1, name: "boat" as SpriteName, spot }));
    return [...placed, ...boats].map((item) => ({ ...item, paths: spritePaths(SPRITES[item.name], item.spot[0], item.spot[1]) }));
  }, [landmarks, view.legend, cells, labels, rows]);
  const { ref, zoom, zoomTo, handlers } = useZoom(view);
  const canvasRef = useRef<HTMLDivElement>(null);
  const labelSizes = useLabelSizes(canvasRef, view.cols, `${view.legend.join(",")}|${blocks.map((block) => `${block.name}${block.tag}${block.count}`).join(",")}`);
  const zoomed = zoom.z > 1.001;
  // 핀 크기: 지도 칸 1.8개 너비 — 핀 간격(2칸)보다 작아 서로 겹치지 않는다. 확대하면 함께 커진다
  const pinWidth = `max(14px, ${(1.8 / view.cols) * 100}%)`;

  // 이름표 영역 — 실제 크기(지도 칸 단위)를 잰 뒤에는 그 크기로, 다른 블록의 이름표도 피한다
  const labelBoxes: Box[] = view.legend.flatMap((code, index) => {
    const cell = labels[index];
    if (!cell) return [];
    const size = labelSizes[code];
    return [size ? labelBox(cell, size[0], size[1]) : labelBox(cell)];
  });
  const taken: Cell[] = []; // 블록 경계 너머 핀과도 겹치지 않게
  const pins = view.legend.flatMap((code, index) => {
    const block = blockByCode.get(code);
    if (!block?.pins.length) return [];
    // 랜드마크 자리는 비워 두고 (칸이 모자라면 그대로)
    const sight = sights.find((item) => item.index === index);
    const free = sight ? cells[index].filter((cell) => !coversCell(SPRITES[sight.name], sight.spot, cell)) : cells[index];
    // 서로 겹치지 않게 떨어뜨린 자리만 — 좁은 동네는 순위가 높은 캐릭터부터 들어가는 만큼만 (전체 순위는 오른쪽 패널)
    const spots = pickPinCells(free.length >= block.pins.length ? free : cells[index], block.pins.length, hashSeed(`${code}:${seedKey}`), { avoid: labelBoxes, spaced: true, taken });
    taken.push(...spots);
    return spots.map((cell: Cell, i) => ({ key: `${code}-${i}`, code, index: i, name: block.name, ranked: Boolean(block.ranked), cell, src: block.pins[i],
      delay: (hashSeed(`${code}:${seedKey}:${i}`) % 6) * 0.15 }));
  });

  return <div className={styles.map} style={{ aspectRatio: `${view.cols} / ${view.rows}` }} role="group" aria-label={label}>
    <div ref={ref} className={styles.viewport} data-zoomed={zoomed || undefined} {...handlers}>
      <div ref={canvasRef} className={styles.canvas} style={{ transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.z})` }}>
        <svg className={styles.svg} viewBox={`0 0 ${view.cols} ${view.rows}`} aria-hidden="true" preserveAspectRatio="none">
          <rect width={view.cols} height={view.rows} fill={SEA} />
          <path d={decor.waves} fill={SEA_WAVE} className={styles.wave} />
          <path d={runsPath(rows, (c) => c === ",")} fill={OUTER} />
          <path d={runsPath(rows, (c) => c === "#")} fill={INNER} />
          <path d={decor.trees} fill={TREE} />
          {view.legend.map((code, index) => <path key={code} className={styles.block} onClick={() => onSelect(code)}
            d={runsPath(rows, (c) => c === blockChar(index))}
            fill={index === selectedIndex ? SELECTED : blockFill(code, index)}
            fillOpacity={index === selectedIndex ? 0.85 : 1} />)}
          <path d={decor.blockTrees} fill="#000" fillOpacity={0.2} pointerEvents="none" />
          <path d={decor.trunks} fill="#3b2a1e" fillOpacity={0.6} pointerEvents="none" />
          <path d={edges.coast} stroke={COAST} strokeWidth={0.22} fill="none" />
          <path d={edges.border} stroke={BORDER} strokeWidth={0.16} fill="none" />
          {edges.selected && <path d={edges.selected} stroke="#fff" strokeWidth={0.28} fill="none" className={styles.selected} />}
          {sights.map((sight) => <g key={sight.key} pointerEvents="none">
            {sight.paths.map((path) => <path key={path.fill} d={path.d} fill={path.fill} />)}
          </g>)}
        </svg>
        {pins.map((pin) => <button key={pin.key} type="button" className={styles.pin}
          aria-label={pin.ranked ? `${pin.name} 구매 순위 ${pin.index + 1}위 이웃` : `${pin.name} 이웃`}
          onClick={() => (onPinSelect ? onPinSelect(pin.code, pin.index) : onSelect(pin.code))}
          style={{ left: percent(pin.cell[0] + 0.5, view.cols), top: percent(pin.cell[1] + 0.9, view.rows), width: pinWidth }}>
          <span className={styles.pinBody} style={{ animationDelay: `${pin.delay}s` }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- 브라우저에서 만든 작은 PNG·픽셀 SVG를 보간 없이 표시 */}
            <img src={pin.src ?? "/images/hero-slime.svg"} alt="" className={styles.pinImage} />
          </span>
          <span className={styles.pinShadow} />
        </button>)}
        {view.legend.map((code, index) => {
          const cell = labels[index];
          const block = blockByCode.get(code);
          if (!cell || !block) return null;
          // 이름표는 확대해도 같은 크기로 (배율만큼 되돌림)
          return <button key={code} type="button" className={styles.label} data-label={code} aria-pressed={selected === code} onClick={() => onSelect(code)}
            aria-label={namesOnly ? `${block.name} 지도로 이동` : block.tag ? `${block.name} · ${block.tag} ${block.count ? `${block.count}명` : "아직 없음"}` : `${block.name}${block.count ? ` · ${block.hint ?? "이웃"} ${block.count}${block.unit ?? "명"}` : block.unit ? ` · ${block.hint ?? ""} 없음` : " · 아직 없음"}`}
            style={{ left: percent(cell[0] + 0.5, view.cols), top: percent(cell[1] + 0.5, view.rows), transform: `translate(-50%, -50%) scale(${1 / zoom.z})` }}>
            <span className={`${styles.labelName} font-pixel`}>{block.name}{!namesOnly && block.tag && (block.count ? ` · ${block.tag}` : "")}</span>
            {!namesOnly && (block.count ? <span className={styles.labelCount}>{block.count}{block.tag ? "명" : ""}</span>
              : <span className={styles.labelFew}>{block.tag ? "· 아직 없음" : "·"}</span>)}
          </button>;
        })}
      </div>
    </div>
    <div className={styles.zoomControls} role="toolbar" aria-label="지도 확대·축소">
      <button type="button" className={styles.zoomButton} onClick={() => zoomTo(zoom.z * ZOOM_STEP)} disabled={zoom.z >= MAX_ZOOM} aria-label="지도 확대">+</button>
      <button type="button" className={styles.zoomButton} onClick={() => zoomTo(zoom.z / ZOOM_STEP)} disabled={!zoomed} aria-label="지도 축소">−</button>
      <button type="button" className={styles.zoomButton} onClick={() => zoomTo(1)} disabled={!zoomed} aria-label="지도 원래 크기로" title="원래 크기">⟲</button>
    </div>
  </div>;
}
