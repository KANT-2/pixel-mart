import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../utils/pixelCanvas.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const c = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

const RED = [255, 0, 0, 255];
const BLUE = [0, 0, 255, 255];

test("칠하기·대칭 칠하기, 입력은 바꾸지 않음", () => {
  const grid = c.createGrid(4, 2);
  const painted = c.paint(grid, 0, 1, RED, true);
  assert.deepEqual(c.getPixel(painted, 0, 1), RED);
  assert.deepEqual(c.getPixel(painted, 3, 1), RED); // 좌우 반대 칸
  assert.deepEqual(c.getPixel(grid, 0, 1), [0, 0, 0, 0]);
  assert.equal(c.paint(grid, 9, 9, RED), grid); // 범위 밖은 그대로
});

test("두 칸 사이 선은 끊기지 않는다", () => {
  const cells = c.lineCells(0, 0, 5, 2);
  assert.deepEqual(cells[0], [0, 0]);
  assert.deepEqual(cells.at(-1), [5, 2]);
  for (let i = 1; i < cells.length; i++) {
    assert.ok(Math.max(Math.abs(cells[i][0] - cells[i - 1][0]), Math.abs(cells[i][1] - cells[i - 1][1])) === 1);
  }
});

test("채우기는 이어진 같은 색만", () => {
  let grid = c.createGrid(3, 3);
  grid = c.paint(grid, 1, 0, RED); grid = c.paint(grid, 1, 1, RED); grid = c.paint(grid, 1, 2, RED); // 가운데 세로 벽
  const filled = c.floodFill(grid, 0, 0, BLUE);
  assert.deepEqual(c.getPixel(filled, 0, 2), BLUE);
  assert.deepEqual(c.getPixel(filled, 2, 0), [0, 0, 0, 0]); // 벽 너머는 그대로
  assert.deepEqual(c.getPixel(filled, 1, 1), RED);
});

test("템플릿 도장과 빈 캔버스 판별", () => {
  const grid = c.createGrid(8, 8);
  assert.equal(c.isEmpty(grid), true);
  const stamped = c.stamp(grid, ["ab", "ba"], { a: "#ff0000", b: "#0000ff" });
  assert.equal(c.isEmpty(stamped), false);
  assert.deepEqual(c.getPixel(stamped, 3, 5), RED);
});

test("색 변환", () => {
  assert.deepEqual(c.hexToRgba("#b6ff5c"), [182, 255, 92, 255]);
  assert.equal(c.rgbaToHex([182, 255, 92, 255]), "#b6ff5c");
});

test("마젠타 배경은 투명, 캐릭터 색은 유지", () => {
  const pixels = new Uint8ClampedArray([255, 0, 255, 255, 240, 20, 235, 255, 255, 214, 184, 255]);
  const keyed = c.keyOutMagenta(pixels);
  assert.deepEqual([keyed[3], keyed[7], keyed[11]], [0, 0, 255]);
});

test("배경 지우기: 테두리에서 이어진 단색 배경만 투명, 캐릭터 안 같은 색은 유지", () => {
  // 5×5: 바깥은 청록 배경(살짝 흔들림), 가운데 3×3은 초록 캐릭터, 그 한가운데 청록 한 칸(눈 하이라이트)
  const w = 5, h = 5, CYAN = [0, 250, 255, 255], CYAN2 = [10, 240, 245, 255], GREEN = [80, 200, 60, 255];
  const pixels = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const inside = x >= 1 && x <= 3 && y >= 1 && y <= 3;
    pixels.set(inside ? (x === 2 && y === 2 ? [0, 120, 130, 255] : GREEN) : ((x + y) % 2 ? CYAN : CYAN2), (y * w + x) * 4);
  }
  c.borderColor(pixels, w, h).forEach((v, i) => assert.ok(Math.abs(v - [5, 245, 250][i]) <= 10));
  const keyed = c.keyOutBackground(pixels, w, h);
  const alpha = (x, y) => keyed[(y * w + x) * 4 + 3];
  assert.equal(alpha(0, 0), 0);
  assert.equal(alpha(4, 2), 0);
  assert.equal(alpha(1, 1), 255);
  assert.equal(alpha(2, 2), 255); // 배경과 다른 어두운 청록 — 캐릭터 일부라 남김
});

test("불투명 영역 경계와 격자 정리(최빈값·투명 칸)", () => {
  // 8×4 이미지: 왼쪽 4×4는 빨강 3 + 파랑 1, 오른쪽 4×4는 투명
  const w = 8, h = 4;
  const pixels = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < 4; x++) pixels.set(x === 0 && y === 0 ? BLUE : RED, (y * w + x) * 4);
  assert.deepEqual(c.opaqueBounds(pixels, w, h), { x: 0, y: 0, width: 4, height: 4 });
  assert.equal(c.opaqueBounds(new Uint8ClampedArray(16), 2, 2), null);

  const grid = c.snapToGrid(pixels, w, { x: 0, y: 0, width: 8, height: 4 }, 2);
  assert.equal(grid.cols, 2);
  assert.equal(grid.rows, 1);
  const [r, g, b, a] = c.getPixel(grid, 0, 0);
  assert.ok(r > 240 && g < 10 && b < 10 && a === 255); // 빨강이 다수
  assert.equal(c.getPixel(grid, 1, 0)[3], 0); // 투명 칸
});
