import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../utils/gift.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { giftHref } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("선물 링크는 거래글 id만 담는다", () => {
  assert.equal(giftHref({ id: 7 }), "/local/gift?post=7");
});
