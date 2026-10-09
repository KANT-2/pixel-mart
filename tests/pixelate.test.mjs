import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../utils/pixelate.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { getCenteredSquare, quantizeColors, getPngByteSize, assertAvatarSize, MAX_AVATAR_BYTES } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

function rgbaColors(pixels) {
  return new Set(Array.from({ length: pixels.length / 4 }, (_, i) => pixels.slice(i * 4, i * 4 + 4).join(",")));
}

test("가로·세로·정사각형 사진을 정확한 중앙에서 자른다", () => {
  assert.deepEqual(getCenteredSquare(1200, 800), { x: 200, y: 0, size: 800 });
  assert.deepEqual(getCenteredSquare(600, 900), { x: 0, y: 150, size: 600 });
  assert.deepEqual(getCenteredSquare(32, 32), { x: 0, y: 0, size: 32 });
  assert.deepEqual(getCenteredSquare(101, 100), { x: 0.5, y: 0, size: 100 });
  for (const invalid of [0, -1, Infinity, NaN]) assert.throws(() => getCenteredSquare(invalid, 100));
});

test("median cut은 RGBA 색 수를 8·16개 이하로 줄이고 입력을 변경하지 않는다", () => {
  const pixels = new Uint8ClampedArray(Array.from({ length: 128 }, (_, i) => [i * 2, (i * 31) % 256, 255 - i, 64 + i]).flat());
  const original = pixels.slice();
  for (const count of [8, 16]) {
    const result = quantizeColors(pixels, count);
    assert.ok(rgbaColors(result).size <= count);
    assert.equal(result.length, pixels.length);
    assert.deepEqual(pixels, original);
    assert.deepEqual(quantizeColors(pixels, count), result);
  }
});

test("색이 적은 원본은 유지하고 완전 투명 픽셀은 한 색으로 정규화한다", () => {
  const pixels = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 128, 3, 4, 5, 0, 250, 30, 80, 0]);
  assert.deepEqual(quantizeColors(pixels, 8), new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 128, 0, 0, 0, 0, 0, 0, 0, 0]));
  assert.deepEqual(quantizeColors(new Uint8ClampedArray([2, 3, 4, 0]), 8), new Uint8ClampedArray(4));
  assert.equal(quantizeColors(new Uint8ClampedArray(), 8).length, 0);
});

test("투명색이 있어도 총 색 수 제한을 지키고 불투명 픽셀을 지우지 않는다", () => {
  const pixels = new Uint8ClampedArray([[255, 255, 255, 0], ...Array.from({ length: 40 }, (_, i) => [i * 6, 255 - i * 6, i * 3, 255])].flat());
  const result = quantizeColors(pixels, 8);
  assert.ok(rgbaColors(result).size <= 8);
  assert.deepEqual(result.slice(0, 4), new Uint8ClampedArray(4));
  for (let i = 7; i < result.length; i += 4) assert.equal(result[i], 255);
});

test("같은 색 빈도이면 픽셀 순서가 바뀌어도 같은 팔레트로 변환한다", () => {
  const colors = Array.from({ length: 60 }, (_, i) => [i * 4, (i * 19) % 256, 255 - i * 3, 255]);
  const forward = quantizeColors(new Uint8ClampedArray(colors.flat()), 8);
  const backward = quantizeColors(new Uint8ClampedArray([...colors].reverse().flat()), 8);
  assert.deepEqual(rgbaColors(forward), rgbaColors(backward));
  assert.throws(() => quantizeColors(new Uint8ClampedArray([1, 2, 3]), 8));
  assert.throws(() => quantizeColors(new Uint8ClampedArray(4), 7));
});

test("PNG는 base64 문자열 길이가 아닌 디코딩 바이트를 계산한다", () => {
  for (const bytes of [1, 2, 3, 31, 32, 33, MAX_AVATAR_BYTES]) {
    const dataUrl = `data:image/png;base64,${Buffer.alloc(bytes).toString("base64")}`;
    assert.equal(getPngByteSize(dataUrl), bytes);
    assert.equal(assertAvatarSize(dataUrl), bytes);
  }
  const oversized = `data:image/png;base64,${Buffer.alloc(MAX_AVATAR_BYTES + 1).toString("base64")}`;
  assert.equal(MAX_AVATAR_BYTES, 51200);
  assert.throws(() => assertAvatarSize(oversized), /해상도를 낮춰/);
  for (const invalid of ["", "data:image/jpeg;base64,YQ==", "data:image/png;base64,", "data:image/png;base64,YQ=", "data:image/png;base64,Y===", "data:image/png;base64,!!!!"]) {
    assert.throws(() => getPngByteSize(invalid));
  }
});
