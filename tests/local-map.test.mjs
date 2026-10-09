import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

async function load(path) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
}

const map = await load("../utils/localMap.ts");
const { MAP_VIEWS, REGION_CENTERS } = await load("../lib/localMapData.ts");
const regions = JSON.parse(await readFile(new URL("../backend/seed/regions.json", import.meta.url), "utf8"));

test("run-length 행을 펼친다", () => {
  assert.equal(map.decodeRow("3a2,b"), "aaa,,b");
  assert.equal(map.decodeRow("12."), ".".repeat(12));
  assert.equal(map.decodeRow("ab"), "ab");
});

test("모든 지도 행 길이가 cols와 같고 legend 블록이 격자에 있다", () => {
  for (const [code, view] of Object.entries(MAP_VIEWS)) {
    const rows = map.decodeView(view);
    assert.equal(rows.length, view.rows, code);
    for (const row of rows) assert.equal(row.length, view.cols, code);
    map.blockCells(rows, view.legend.length).forEach((cells, i) => assert.ok(cells.length > 0, `${code} ${view.legend[i]}`));
  }
});

test("시드 지역 41개가 모두 지도 블록과 무게중심에 있다", () => {
  const legend = new Set(Object.values(MAP_VIEWS).flatMap((view) => view.legend));
  for (const region of regions) {
    assert.ok(legend.has(region.code), region.code);
    assert.ok(REGION_CENTERS[region.code], region.code);
  }
  // 전체 지도 = 시, 시 지도 = 구, 구 지도 = 생활권
  assert.deepEqual(MAP_VIEWS[""].legend, regions.filter((r) => r.level === "sido").map((r) => r.code).sort());
  for (const district of regions.filter((r) => r.level === "sigungu")) {
    assert.deepEqual(MAP_VIEWS[district.code].legend, regions.filter((r) => r.parentCode === district.code).map((r) => r.code).sort());
  }
});

test("핀 개수: 5명 미만 0개, 약 4~5명당 1개, 최대 6개", () => {
  assert.deepEqual([null, 0, 4, 5, 9, 15, 26, 100].map(map.pinCount), [0, 0, 0, 1, 2, 3, 6, 6]);
});

test("핀 위치는 시드로 재현되고 블록 안·서로 다른 칸이다", () => {
  const cells = Array.from({ length: 60 }, (_, i) => [i % 10, Math.floor(i / 10)]);
  const a = map.pickPinCells(cells, 5, map.hashSeed("41135-01:12"));
  const b = map.pickPinCells(cells, 5, map.hashSeed("41135-01:12"));
  assert.deepEqual(a, b);
  assert.equal(new Set(a.map(String)).size, 5);
  for (const cell of a) assert.ok(cells.some((c) => c[0] === cell[0] && c[1] === cell[1]));
  assert.deepEqual(map.pickPinCells(cells, 0, 1), []);
  assert.equal(map.pickPinCells([[0, 0]], 3, 1).length, 1);
});

test("이름표는 블록 안쪽 칸, 무게중심 가까이", () => {
  const rows = ["....", ".aa.", ".aa.", ".aa.", "...."];
  const cells = map.blockCells(rows, 1)[0];
  const [x, y] = map.labelCell(cells, rows);
  assert.equal(rows[y][x], "a");
  assert.equal(map.labelCell([], rows), null);
});

test("가까운 생활권 찾기 — 판교역 근처는 판교, 부산은 서비스 밖", () => {
  assert.equal(map.nearestZone(37.3948, 127.1112, REGION_CENTERS), "41135-01");
  assert.equal(map.nearestZone(37.5112, 127.0981, REGION_CENTERS), "11710-01"); // 잠실
  assert.equal(map.nearestZone(35.1796, 129.0756, REGION_CENTERS), null);
});

test("고른 지역에 맞는 지도와 경로", () => {
  assert.equal(map.viewCodeFor("41135-01", regions, MAP_VIEWS), "41135");
  assert.equal(map.viewCodeFor("41130", regions, MAP_VIEWS), "41130");
  assert.equal(map.viewCodeFor(null, regions, MAP_VIEWS), "");
  assert.equal(map.viewCodeFor("NOPE", regions, MAP_VIEWS), "");
  assert.deepEqual(map.viewTrail("41135", regions), ["41130", "41135"]);
  assert.deepEqual(map.viewTrail("", regions), []);
});
