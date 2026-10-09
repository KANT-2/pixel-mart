"use client";

import { useMemo } from "react";
import styles from "./PixelMap.module.css";
import type { MapViewData } from "@/lib/localMapData";
import { blockCells, blockChar, decodeView, hashSeed, labelCell, pickPinCells, seededRandom, type Cell } from "@/utils/localMap";

export interface MapBlock {
  code: string;
  name: string;
  /** 이름표에 붙일 인원 (5명 미만이면 null) */
  count: number | null;
  /** 핀 — 아바타 PNG data URL, null이면 기본 슬라임 */
  pins: (string | null)[];
  sample: boolean;
  hint?: string;
  /** 인원 대신 세는 단위 (위시맵: "개") */
  unit?: string;
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

/** 땅의 나무·바다의 물결 — 지도마다 고정된 장식 */
function decorations(rows: string[], seed: number) {
  const random = seededRandom(seed);
  let trees = "";
  let waves = "";
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const roll = random();
      if (row[x] === "." && roll < 0.035) waves += `M${x + 0.2} ${y + 0.45}h0.6v0.14h-0.6z`;
      if ((row[x] === "," || row[x] === "#") && roll < 0.09) trees += `M${x + 0.3} ${y + 0.3}h0.4v0.4h-0.4z`;
    }
  });
  return { trees, waves };
}

const percent = (value: number, total: number) => `${(value / total) * 100}%`;

export default function PixelMap({ view, blocks, selected, seedKey, onSelect, label, namesOnly = false }: PixelMapProps) {
  const rows = useMemo(() => decodeView(view), [view]);
  const cells = useMemo(() => blockCells(rows, view.legend.length), [rows, view.legend.length]);
  const labels = useMemo(() => cells.map((list) => labelCell(list, rows)), [cells, rows]);
  const selectedIndex = selected ? view.legend.indexOf(selected) : -1;
  const edges = useMemo(() => edgePaths(rows, selectedIndex >= 0 ? blockChar(selectedIndex) : null), [rows, selectedIndex]);
  const decor = useMemo(() => decorations(rows, hashSeed(view.legend.join(","))), [rows, view.legend]);
  const blockByCode = new Map(blocks.map((block) => [block.code, block]));
  // 핀 크기: 지도 칸 약 2.6개 너비, 화면이 작아도 22px 이상
  const pinWidth = `max(22px, ${(2.6 / view.cols) * 100}%)`;

  const pins = view.legend.flatMap((code, index) => {
    const block = blockByCode.get(code);
    if (!block?.pins.length) return [];
    const spots = pickPinCells(cells[index], block.pins.length, hashSeed(`${code}:${seedKey}`), labels[index]);
    return spots.map((cell: Cell, i) => ({ key: `${code}-${i}`, cell, src: block.pins[i], delay: (hashSeed(`${code}${i}`) % 6) * 0.15 }));
  });

  return <div className={styles.map} style={{ aspectRatio: `${view.cols} / ${view.rows}` }} role="group" aria-label={label}>
    <svg className={styles.svg} viewBox={`0 0 ${view.cols} ${view.rows}`} aria-hidden="true" preserveAspectRatio="none">
      <rect width={view.cols} height={view.rows} fill={SEA} />
      <path d={decor.waves} fill={SEA_WAVE} className={styles.wave} />
      <path d={runsPath(rows, (c) => c === ",")} fill={OUTER} />
      <path d={runsPath(rows, (c) => c === "#")} fill={INNER} />
      <path d={decor.trees} fill={TREE} />
      {view.legend.map((code, index) => <path key={code} className={styles.block} onClick={() => onSelect(code)}
        d={runsPath(rows, (c) => c === blockChar(index))}
        fill={index === selectedIndex ? SELECTED : BLOCKS[index % BLOCKS.length]}
        fillOpacity={index === selectedIndex ? 0.85 : 1} />)}
      <path d={edges.coast} stroke={COAST} strokeWidth={0.22} fill="none" />
      <path d={edges.border} stroke={BORDER} strokeWidth={0.16} fill="none" />
      {edges.selected && <path d={edges.selected} stroke="#fff" strokeWidth={0.28} fill="none" className={styles.selected} />}
    </svg>
    {pins.map((pin) => <span key={pin.key} className={styles.pin} aria-hidden="true"
      style={{ left: percent(pin.cell[0] + 0.5, view.cols), top: percent(pin.cell[1] + 0.9, view.rows), width: pinWidth }}>
      <span className={styles.pinBody} style={{ animationDelay: `${pin.delay}s` }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- 브라우저에서 만든 작은 PNG·픽셀 SVG를 보간 없이 표시 */}
        <img src={pin.src ?? "/images/hero-slime.svg"} alt="" className={styles.pinImage} />
      </span>
      <span className={styles.pinShadow} />
    </span>)}
    {view.legend.map((code, index) => {
      const cell = labels[index];
      const block = blockByCode.get(code);
      if (!cell || !block) return null;
      return <button key={code} type="button" className={styles.label} aria-pressed={selected === code} onClick={() => onSelect(code)}
        aria-label={namesOnly ? `${block.name} 지도로 이동` : `${block.name}${block.count ? ` · ${block.hint ?? "이웃"} ${block.count}${block.unit ?? "명"}` : block.unit ? ` · ${block.hint ?? ""} 없음` : " · 소수의 이웃"}${block.sample ? " · 샘플 데이터" : ""}`}
        style={{ left: percent(cell[0] + 0.5, view.cols), top: percent(cell[1] + 0.5, view.rows) }}>
        <span className={`${styles.labelName} font-pixel`}>{block.name}</span>
        {!namesOnly && (block.count ? <span className={styles.labelCount}>{block.count}</span> : <span className={styles.labelFew}>·</span>)}
        {block.sample && <span aria-hidden="true" className="text-violet">*</span>}
      </button>;
    })}
  </div>;
}
