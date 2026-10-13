import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

async function compile(path, replace = {}) {
  let source = await readFile(new URL(path, import.meta.url), "utf8");
  for (const [from, to] of Object.entries(replace)) source = source.replaceAll(from, to);
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  return `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`;
}

const localMap = await compile("../utils/localMap.ts");
const sprites = await import(await compile("../utils/mapSprites.ts", { "@/utils/localMap": localMap }));
const map = await import(localMap);
const { MAP_VIEWS } = await import(await compile("../lib/localMapData.ts"));

test("장식 도트는 행 길이가 같고 팔레트에 있는 문자만 쓴다", () => {
  for (const [name, sprite] of Object.entries(sprites.SPRITES)) {
    const width = sprite.rows[0].length;
    for (const row of sprite.rows) {
      assert.equal(row.length, width, name);
      for (const char of row) assert.ok(char === "." || char in sprite.palette, `${name}: ${char}`);
    }
  }
});

test("전체 지도의 랜드마크는 모두 자기 지역 블록 안에 들어간다", () => {
  const view = MAP_VIEWS[""];
  const rows = map.decodeView(view);
  const cells = map.blockCells(rows, view.legend.length);
  for (const [code, name] of Object.entries(sprites.LANDMARKS)) {
    const index = view.legend.indexOf(code);
    const spot = sprites.placeSprite(cells[index], sprites.SPRITES[name], 1, map.labelCell(cells[index], rows));
    assert.ok(spot, `${code} ${name}`);
    assert.ok(cells[index].some(([x, y]) => x === spot[0] && y === spot[1]));
  }
  assert.equal(sprites.placeSprite([[0, 0]], sprites.SPRITES.tower, 1), null); // 자리가 없으면 그리지 않음
});

test("배는 바다 위에만 띄운다", () => {
  const rows = map.decodeView(MAP_VIEWS[""]);
  const spots = sprites.seaSpots(rows, sprites.SPRITES.boat, 3, 7);
  assert.ok(spots.length > 0);
  for (const [x, y] of spots) assert.equal(rows[y][x], ".");
});

test("지역 색 단계: 가장 많은 곳 대비 적음·보통·많음, 5명 미만은 단계 없음", () => {
  assert.deepEqual([null, 0, 10, 30, 50, 90].map((n) => sprites.heatTier(n, 90)), [null, null, 0, 0, 1, 2]);
});

test("시 단계 이름 줄이기", () => {
  assert.equal(sprites.shortRegionName("서울특별시", "sido"), "서울");
  assert.equal(sprites.shortRegionName("인천광역시", "sido"), "인천");
  assert.equal(sprites.shortRegionName("수원시", "sido"), "수원");
  assert.equal(sprites.shortRegionName("마포구", "sigungu"), "마포구");
});

test("취향 아이콘 파일이 모두 있다", () => {
  const ids = [1, 2, 3, 4, 101, 202];
  for (const id of ids) {
    const src = sprites.interestIcon({ id, name: `취향${id}` });
    assert.ok(existsSync(new URL(`../public${src}`, import.meta.url)), src);
  }
  // 같은 취향은 이름과 상관없이 항상 같은 아이콘
  assert.equal(sprites.interestIcon({ id: 3, name: "가" }), sprites.interestIcon({ id: 3, name: "가" }));
  assert.equal(sprites.interestIcon({ id: 52, name: "픽셀 게임" }), "/images/characters/slime-1.png"); // 장르 태그는 어울리는 캐릭터
});
