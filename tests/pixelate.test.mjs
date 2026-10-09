import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../utils/pixelate.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { getPixelGrid, getOutputSize, solidifyAlpha, despeckle, quantizeColors, getPngByteSize, assertAvatarSize, MAX_AVATAR_BYTES } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

function rgbaColors(pixels) {
  return new Set(Array.from({ length: pixels.length / 4 }, (_, i) => pixels.slice(i * 4, i * 4 + 4).join(",")));
}

test("자르지 않고 원본 비율대로 긴 쪽을 칸 수에 맞춘다", () => {
  assert.deepEqual(getPixelGrid(1200, 800, 32), { cols: 32, rows: 21 });
  assert.deepEqual(getPixelGrid(600, 900, 32), { cols: 21, rows: 32 });
  assert.deepEqual(getPixelGrid(500, 500, 24), { cols: 24, rows: 24 });
  assert.deepEqual(getPixelGrid(4000, 10, 16), { cols: 16, rows: 1 });
  for (const invalid of [0, -1, Infinity, NaN]) assert.throws(() => getPixelGrid(invalid, 100, 32));
});

test("큰 사진은 가로·세로 최대 640 안에, 작은 사진은 긴 쪽 320으로 저장한다", () => {
  // 세로가 긴 큰 사진 → 세로를 640에 맞춤
  assert.deepEqual(getOutputSize(3000, 4000, getPixelGrid(3000, 4000, 32)), { scale: 20, width: 480, height: 640 });
  // 가로가 긴 큰 사진 → 가로를 640에 맞춤
  assert.deepEqual(getOutputSize(4000, 3000, getPixelGrid(4000, 3000, 32)), { scale: 20, width: 640, height: 480 });
  // 가로·세로 모두 640 이하 → 긴 쪽 320
  assert.deepEqual(getOutputSize(400, 300, getPixelGrid(400, 300, 32)), { scale: 10, width: 320, height: 240 });
  // 칸 크기는 항상 정수 배 (도트 경계가 흐려지지 않음)
  for (const cells of [16, 24, 32, 48]) {
    const size = getOutputSize(1920, 1080, getPixelGrid(1920, 1080, cells));
    assert.ok(Number.isInteger(size.scale) && size.width <= 640 && size.height <= 640);
  }
});

test("반투명 가장자리 픽셀은 완전 투명·불투명으로 정리한다", () => {
  const pixels = new Uint8ClampedArray([1, 2, 3, 40, 4, 5, 6, 200, 7, 8, 9, 128, 0, 0, 0, 127]);
  assert.deepEqual(Array.from(solidifyAlpha(pixels)).filter((_, i) => i % 4 === 3), [0, 255, 255, 0]);
  assert.equal(pixels[3], 40); // 입력은 바꾸지 않음
});

test("이웃과 모두 다른 외톨이 점은 이웃 다수 색으로 바뀐다", () => {
  const A = [10, 20, 30, 255];
  const B = [200, 0, 0, 255];
  const grid = [A, A, A, A, B, A, A, A, A]; // 3×3 가운데만 B
  const result = despeckle(new Uint8ClampedArray(grid.flat()), 3, 3);
  assert.deepEqual(Array.from(result.slice(16, 20)), A);
  const line = [A, B, B, A, A, A, A, A, A]; // 이어진 선은 유지
  assert.deepEqual(Array.from(despeckle(new Uint8ClampedArray(line.flat()), 3, 3)), line.flat());
  assert.throws(() => despeckle(new Uint8ClampedArray(4), 2, 2));
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
