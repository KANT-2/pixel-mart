import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../utils/skinTone.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { isSkinLike, photoSkinTone, SKIN_TONES, snapSkinTones } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

// 위 1/3은 얼굴색, 아래는 옷색인 1×3 격자
const figure = (face, body) => new Uint8ClampedArray([...face, 255, ...body, 255, ...body, 255]);

test("밝은 피부는 밝은 톤으로 맞추고 옷은 그대로", () => {
  const out = snapSkinTones(figure([240, 196, 170], [30, 40, 90]), 1, 3);
  assert.deepEqual([...out.slice(0, 3)], SKIN_TONES.light.base);
  assert.deepEqual([...out.slice(4, 7)], [30, 40, 90]);
});

test("어두운 피부는 어두운 톤으로 — 중간색은 없다", () => {
  const out = snapSkinTones(figure([120, 80, 55], [240, 240, 240]), 1, 3);
  assert.deepEqual([...out.slice(0, 3)], SKIN_TONES.dark.base);
});

test("얼굴색과 색상이 다른 베이지 옷은 건드리지 않는다", () => {
  const out = snapSkinTones(figure([242, 190, 160], [232, 214, 170]), 1, 3);
  assert.deepEqual([...out.slice(4, 7)], [232, 214, 170]);
});

test("피부색이 없으면 바꾸지 않는다", () => {
  const pixels = figure([20, 200, 60], [30, 40, 90]);
  assert.equal(snapSkinTones(pixels, 1, 3), pixels);
  assert.equal(isSkinLike([255, 0, 255]), false);
});

test("분홍빛 도는 아주 흰 피부도 피부로 본다", () => {
  const out = snapSkinTones(figure([229, 213, 214], [30, 40, 90]), 1, 3);
  assert.deepEqual([...out.slice(0, 3)], SKIN_TONES.light.base);
});

test("사진에서 고른 톤이 그림의 얼굴색보다 우선한다", () => {
  const out = snapSkinTones(figure([250, 220, 180], [30, 40, 90]), 1, 3, "dark");
  assert.deepEqual([...out.slice(0, 3)], SKIN_TONES.dark.base);
});

test("사진 위쪽 가운데 피부색으로 톤을 고르고, 회색 배경만 있으면 null", () => {
  const photo = (color) => new Uint8ClampedArray(Array.from({ length: 20 * 20 }, () => [...color, 255]).flat());
  assert.equal(photoSkinTone(photo([110, 70, 45]), 20, 20), "dark");
  assert.equal(photoSkinTone(photo([235, 190, 160]), 20, 20), "light");
  assert.equal(photoSkinTone(photo([200, 200, 205]), 20, 20), null);
});

test("16색으로 줄여 얼굴과 같은 색이 된 큰 옷은 그대로, 따로 떨어진 작은 손은 바꾼다", () => {
  // 4×12: 머리(0~3행) 얼굴색, 4행 검은 선, 5~11행 같은 색 코트(큰 덩어리), 코트 옆 2칸 손
  const face = [242, 217, 204], black = [10, 10, 10], cols = 4, rows = 12;
  const px = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) px.push(...(y === 4 ? black : face), 255);
  const pixels = new Uint8ClampedArray(px);
  // 손: 11행 왼쪽 두 칸을 검은 선으로 코트와 떼어 놓는다
  for (const x of [2, 3]) pixels.set([...black, 255], (10 * cols + x) * 4);
  for (const x of [2, 3]) pixels.set([...face, 255], (11 * cols + x) * 4);
  pixels.set([...black, 255], (11 * cols + 1) * 4);
  const out = snapSkinTones(pixels, cols, rows, "light");
  assert.deepEqual([...out.slice(0, 3)], SKIN_TONES.light.base); // 얼굴
  assert.deepEqual([...out.slice((6 * cols) * 4, (6 * cols) * 4 + 3)], face); // 코트
});
