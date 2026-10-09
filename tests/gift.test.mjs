import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../utils/gift.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { giftHref } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("선물 링크는 거래글 id·물건명·연결 상품만 담는다", () => {
  assert.equal(giftHref({ id: 7, itemName: "카카시 키링", product: { id: 3 } }), "/local/gift?post=7&item=%EC%B9%B4%EC%B9%B4%EC%8B%9C+%ED%82%A4%EB%A7%81&product=3");
  assert.equal(giftHref({ id: 8, itemName: "x".repeat(80), product: null }), `/local/gift?post=8&item=${"x".repeat(60)}`);
});
