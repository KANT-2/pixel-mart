"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createGrid, floodFill, getPixel, hexToRgba, isEmpty, lineCells, paint, PALETTE, rgbaToHex, stamp, TRANSPARENT,
  type PixelGridData,
} from "@/utils/pixelCanvas";

type Tool = "pen" | "eraser" | "fill" | "picker";

const SIZES = [
  { label: "16 × 16", cols: 16, rows: 16 },
  { label: "24 × 24", cols: 24, rows: 24 },
  { label: "32 × 32", cols: 32, rows: 32 },
  { label: "24 × 32 (세로)", cols: 24, rows: 32 },
  { label: "32 × 48 (전신)", cols: 32, rows: 48 },
] as const;

// 템플릿 — 메인 무대 슬라임과 같은 색·비율
const SLIME = ["......gggg......", "....ggGGGGgg....", "...gGGLLGGGGg...", "..gGGLLGGGGGGg..", "..gGGGGGGGGGGg..",
  ".gGGGGGGGGGGGGg.", ".gGGGKGGGGKGGGg.", "gGGGGKGGGGKGGGGg", "gGPPGGGKKGGGPPGg", "gGGGGGGGGGGGGGGg", "gGGGGGGGGGGGGGGg", ".gggggggggggggg."];
const SLIME_PAL = { g: "#3fa828", G: "#9dff4f", L: "#e2ffbf", K: "#14102a", P: "#ff8ab8" };
const PLAYER = ["....kkkkkk....", "...kHHHHHHk...", "..kHHHHHHHHk..", "..kHSSSSSSHk..", "..kSSKSSKSSk..", "..kSSSSSSSSk..",
  "...kSSPPSSk...", "....kkkkkk....", "...kCCCCCCk...", "..kCCCCCCCCk..", ".kSkCCCCCCkSk.", ".kSkCCCCCCkSk.", "..kkCCCCCCkk..",
  "...kBBBBBBk...", "...kBBkkBBk...", "...kBBk.kBBk..", "...kkk...kkk.."];
const PLAYER_PAL = { k: "#14102a", H: "#5b3a29", S: "#ffd9b8", K: "#14102a", P: "#ff7a96", C: "#3a6fd8", B: "#3a3170" };

interface PixelCanvasEditorProps {
  /** 처음 불러올 격자 (AI 결과 등) */
  initial?: PixelGridData | null;
  disabled?: boolean;
  onChange: (grid: PixelGridData) => void;
}

export default function PixelCanvasEditor({ initial = null, disabled = false, onChange }: PixelCanvasEditorProps) {
  // 현재 격자와 되돌리기 기록을 한 상태로 — 갱신 함수가 두 번 불려도 기록이 꼬이지 않게
  const [history, setHistory] = useState<{ grid: PixelGridData; past: PixelGridData[]; future: PixelGridData[] }>(
    () => ({ grid: initial ?? stamp(createGrid(32, 32), SLIME, SLIME_PAL), past: [], future: [] }));
  const { grid, past, future } = history;
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState<string>("#14102a");
  const [mirror, setMirror] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef<{ last: [number, number] | null; grid: PixelGridData } | null>(null);
  const cell = Math.max(6, Math.floor(384 / Math.max(grid.cols, grid.rows)));

  useEffect(() => { onChange(grid); }, [grid, onChange]);

  // 격자 그리기: 투명은 체크무늬, 칸 경계는 옅은 선
  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext("2d");
    if (!element || !context) return;
    element.width = grid.cols * cell;
    element.height = grid.rows * cell;
    for (let y = 0; y < grid.rows; y++) {
      for (let x = 0; x < grid.cols; x++) {
        const [r, g, b, a] = getPixel(grid, x, y);
        context.fillStyle = a ? `rgb(${r} ${g} ${b})` : (x + y) % 2 ? "#2a2550" : "#211d3b";
        context.fillRect(x * cell, y * cell, cell, cell);
      }
    }
    context.strokeStyle = "rgb(255 255 255 / 0.06)";
    context.beginPath();
    for (let x = 1; x < grid.cols; x++) { context.moveTo(x * cell + 0.5, 0); context.lineTo(x * cell + 0.5, element.height); }
    for (let y = 1; y < grid.rows; y++) { context.moveTo(0, y * cell + 0.5); context.lineTo(element.width, y * cell + 0.5); }
    context.stroke();
    if (mirror) {
      context.strokeStyle = "rgb(110 242 214 / 0.6)";
      context.beginPath(); context.moveTo(element.width / 2, 0); context.lineTo(element.width / 2, element.height); context.stroke();
    }
  }, [grid, cell, mirror]);

  /** before → next 한 번의 작업으로 기록 (같으면 무시) */
  const commit = useCallback((next: PixelGridData, before: PixelGridData) => {
    if (next === before) return;
    setHistory((h) => ({ grid: next, past: [...h.past.slice(-49), before], future: [] }));
  }, []);
  const undo = useCallback(() => setHistory((h) => h.past.length
    ? { grid: h.past[h.past.length - 1], past: h.past.slice(0, -1), future: [h.grid, ...h.future] } : h), []);
  const redo = useCallback(() => setHistory((h) => h.future.length
    ? { grid: h.future[0], past: [...h.past, h.grid], future: h.future.slice(1) } : h), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (disabled || (event.target as HTMLElement).closest("input, textarea, select")) return;
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === "z") { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
      else if ((event.ctrlKey || event.metaKey) && key === "y") { event.preventDefault(); redo(); }
      else if (!event.ctrlKey && !event.metaKey) {
        const map: Record<string, Tool> = { b: "pen", e: "eraser", g: "fill", i: "picker" };
        if (map[key]) setTool(map[key]);
        if (key === "m") setMirror((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [disabled, undo, redo]);

  const cellAt = (event: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const rect = event.currentTarget.getBoundingClientRect();
    return [Math.floor(((event.clientX - rect.left) / rect.width) * grid.cols), Math.floor(((event.clientY - rect.top) / rect.height) * grid.rows)];
  };
  const ink = () => (tool === "eraser" ? TRANSPARENT : hexToRgba(color));

  const down = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const [x, y] = cellAt(event);
    if (tool === "picker") {
      const picked = getPixel(grid, x, y);
      if (picked[3]) { setColor(rgbaToHex(picked)); setTool("pen"); }
      return;
    }
    if (tool === "fill") { commit(floodFill(grid, x, y, ink()), grid); return; }
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = { last: [x, y], grid };
    const color = ink();
    setHistory((h) => ({ ...h, grid: paint(h.grid, x, y, color, mirror) }));
  };
  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const stroke = drawing.current;
    if (!stroke?.last) return;
    const [x, y] = cellAt(event);
    if (x === stroke.last[0] && y === stroke.last[1]) return;
    const color = ink();
    const [lx, ly] = stroke.last;
    setHistory((h) => ({ ...h, grid: lineCells(lx, ly, x, y).reduce((g, [cx, cy]) => paint(g, cx, cy, color, mirror), h.grid) }));
    stroke.last = [x, y];
  };
  const up = () => {
    const stroke = drawing.current;
    drawing.current = null;
    // 한 획(누른 순간~뗀 순간)을 되돌리기 한 번으로
    if (stroke) setHistory((h) => h.grid === stroke.grid ? h : { ...h, past: [...h.past.slice(-49), stroke.grid], future: [] });
  };

  const resize = (cols: number, rows: number) => commit(createGrid(cols, rows), grid);
  const template = (rows: string[], palette: Record<string, string>) => commit(stamp(createGrid(grid.cols, grid.rows), rows, palette), grid);
  const toolButton = "btn-pixel toggle-outline min-h-10 px-3 py-1.5 text-sm font-bold";
  const small = "btn-pixel h-8 px-2 text-xs font-bold disabled:opacity-40";

  // 위: 캔버스 크기·템플릿 한 줄 / 가운데: 캔버스 + 오른쪽 색(그 아래 되돌리기·다시·모두 지우기) / 아래: 그리기 도구
  return <div className="@container space-y-4">
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-bold">
      <label className="flex items-center gap-2">캔버스 크기
        <select disabled={disabled} value={`${grid.cols}x${grid.rows}`} onChange={(event) => { const [c, r] = event.target.value.split("x").map(Number); resize(c, r); }}
          className="pixel-input h-9 w-28 px-2 text-sm">
          {SIZES.map((size) => <option key={size.label} value={`${size.cols}x${size.rows}`}>{size.label}</option>)}
          {!SIZES.some((size) => size.cols === grid.cols && size.rows === grid.rows) && <option value={`${grid.cols}x${grid.rows}`}>{grid.cols} × {grid.rows} (AI)</option>}
        </select>
      </label>
      <div className="flex items-center gap-2">템플릿
        <button type="button" disabled={disabled} onClick={() => template(SLIME, SLIME_PAL)} className="btn-pixel h-9 px-3 text-xs font-bold">슬라임</button>
        <button type="button" disabled={disabled} onClick={() => template(PLAYER, PLAYER_PAL)} className="btn-pixel h-9 whitespace-nowrap px-3 text-xs font-bold">기본 캐릭터</button>
      </div>
    </div>
    <div className="flex flex-col items-start gap-3 @sm:flex-row">
      <div className="pixel-panel w-fit max-w-full min-w-0 shrink overflow-auto p-3">
        <canvas ref={canvas} role="img" aria-label={`픽셀 캔버스 ${grid.cols}×${grid.rows}${isEmpty(grid) ? " (비어 있음)" : ""}`}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
          className={`block max-w-full touch-none [image-rendering:pixelated] ${disabled ? "opacity-60" : "cursor-crosshair"}`} />
      </div>
      <fieldset disabled={disabled} className="shrink-0">
        <legend className="mb-2 text-sm font-bold">색</legend>
        <div className="flex flex-wrap gap-1.5 @sm:grid @sm:grid-cols-3">
          {PALETTE.map((hex) => <button key={hex} type="button" aria-label={`색 ${hex}`} aria-pressed={color === hex}
            onClick={() => { setColor(hex); if (tool !== "fill") setTool("pen"); }}
            className="size-8 rounded border-2 border-frame aria-pressed:border-lime aria-pressed:ring-2 aria-pressed:ring-lime" style={{ backgroundColor: hex }} />)}
        </div>
        <label className="mt-2 flex items-center gap-2 text-xs text-sub">직접 고르기
          <input type="color" value={color} onChange={(event) => setColor(event.target.value)} className="size-8 cursor-pointer rounded border-2 border-frame bg-transparent" />
        </label>
        {/* 되돌리기·다시는 화살표만, 모두 지우기는 그 아래 작게 — 색표 칸 안에 */}
        <div className="mt-3 flex gap-1.5">
          <button type="button" disabled={disabled || !past.length} onClick={undo} aria-label="되돌리기 (Ctrl+Z)" title="되돌리기 (Ctrl+Z)" className={`${small} w-9 text-base`}>↶</button>
          <button type="button" disabled={disabled || !future.length} onClick={redo} aria-label="다시 (Ctrl+Y)" title="다시 (Ctrl+Y)" className={`${small} w-9 text-base`}>↷</button>
        </div>
        <button type="button" disabled={disabled} onClick={() => commit(createGrid(grid.cols, grid.rows), grid)} className={`${small} mt-1.5 w-full`}>모두 지우기</button>
      </fieldset>
    </div>
    <div className="space-y-3">
      <div role="toolbar" aria-label="그리기 도구" className="flex flex-wrap gap-2">
        {([["pen", "펜 (B)"], ["eraser", "지우개 (E)"], ["fill", "채우기 (G)"], ["picker", "스포이드 (I)"]] as [Tool, string][]).map(([value, label]) =>
          <button key={value} type="button" aria-pressed={tool === value} disabled={disabled} onClick={() => setTool(value)} className={toolButton}>{label}</button>)}
        <button type="button" aria-pressed={mirror} disabled={disabled} onClick={() => setMirror((value) => !value)} className={toolButton}>좌우 대칭 (M)</button>
      </div>
      <p className="text-xs leading-relaxed text-dim">크기를 바꾸면 새 캔버스로 시작해요 (되돌리기 가능). 단축키: B 펜 · E 지우개 · G 채우기 · I 스포이드 · M 대칭 · Ctrl+Z 되돌리기</p>
    </div>
  </div>;
}
