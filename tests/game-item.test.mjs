import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../utils/gameItem.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const g = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("가격대별 아이템 등급", () => {
  assert.deepEqual([null, 0, 9_900, 10_000, 19_900, 20_000, 29_900, 30_000, 99_000].map((p) => g.rarityOf(p).key),
    ["common", "common", "common", "uncommon", "uncommon", "rare", "rare", "epic", "epic"]);
  assert.equal(g.rarityOf(45_000).label, "EPIC");
});

test("물건 상태 → 내구도", () => {
  assert.deepEqual(g.durabilityOf("new"), { percent: 100, label: "새 상품" });
  assert.equal(g.durabilityOf("like_new").percent, 80);
  assert.equal(g.durabilityOf("used").percent, 50);
  assert.equal(g.durabilityOf(null), null);
});

test("거래 종류·방식 표시가 모두 정의돼 있다", () => {
  for (const kind of ["have", "want", "sell"]) assert.ok(g.TRADE_KIND_GAME[kind].tag);
  for (const method of ["direct", "delivery", "both"]) assert.ok(g.TRADE_METHOD_ICON[method]);
});
