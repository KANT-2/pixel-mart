import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../utils/recentlyViewed.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const r = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

const item = (id) => ({ id, name: `상품 ${id}`, price: id * 1000, imageUrl: `/img/${id}.webp` });

test("최근 본 상품은 맨 앞으로, 중복 없이, 최대 개수 유지", () => {
  let list = [];
  for (const id of [1, 2, 3]) list = r.addRecent(list, item(id));
  assert.deepEqual(list.map((x) => x.id), [3, 2, 1]);
  list = r.addRecent(list, item(1));
  assert.deepEqual(list.map((x) => x.id), [1, 3, 2]);
  assert.equal(Array.from({ length: 20 }, (_, i) => i + 1).reduce((acc, id) => r.addRecent(acc, item(id)), []).length, r.RECENT_MAX);
});

test("상세페이지 목록은 지금 상품만 빼고, 같은 카테고리 상품은 빼지 않는다", () => {
  const list = [item(5), item(4), item(3)];
  assert.deepEqual(r.recentForDetail(list, 4).map((x) => x.id), [5, 3]);
  assert.deepEqual(r.recentForDetail([item(4)], 4), []);
});

test("깨진 저장값은 버리고 하나씩 지울 수 있다", () => {
  assert.deepEqual(r.parseRecent("not json"), []);
  assert.deepEqual(r.parseRecent('{"a":1}'), []);
  assert.deepEqual(r.parseRecent(JSON.stringify([item(1), { id: "x" }, null])).map((x) => x.id), [1]);
  assert.deepEqual(r.removeRecent([item(1), item(2)], 1).map((x) => x.id), [2]);
});
