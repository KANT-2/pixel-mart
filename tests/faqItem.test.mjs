import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const compilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ES2022,
  jsx: ts.JsxEmit.ReactJSX,
};
const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const utilsSource = await readFile(new URL("../utils/faq.ts", import.meta.url), "utf8");
const utilsUrl = moduleUrl(ts.transpileModule(utilsSource, { compilerOptions }).outputText);
const source = await readFile(new URL("../components/help/FaqItem.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions }).outputText
  .replaceAll('"react/jsx-runtime"', JSON.stringify(pathToFileURL(require.resolve("react/jsx-runtime")).href))
  .replaceAll('"@/utils/faq"', JSON.stringify(utilsUrl));
const { default: FaqItem } = await import(moduleUrl(compiled));

function renderFaq({ question, answer, query }) {
  return renderToStaticMarkup(createElement(FaqItem, {
    faq: { id: 3, category: "상품 문의", question, answer },
    query,
    open: true,
    onOpenChange() {},
  }));
}

test("FAQ의 HTML 같은 문자열과 검색어를 실행하지 않고 텍스트로 하이라이트한다", () => {
  const html = renderFaq({ question: "<b> 표시는 무엇인가요?", answer: "<b>굵은 글씨</b>\n<script>alert(1)</script>", query: "<b>" });
  assert.equal((html.match(/<mark\b/g) ?? []).length, 2);
  assert.match(html, /<mark[^>]*>&lt;b&gt;<\/mark>/);
  assert.match(html, /&lt;\/b&gt;\n&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<\/?(?:b|script)>/);
});

test("정규식 문자를 일반 문자로 강조하고 기본 details 접근성·줄바꿈을 유지한다", () => {
  const html = renderFaq({ question: "A+B 호환성", answer: "a+b\nA+B", query: "a+b" });
  assert.equal((html.match(/<mark\b/g) ?? []).length, 3);
  assert.match(html, /<details[^>]*id="faq-3"[^>]*open=""/);
  assert.match(html, /<summary\b/);
  assert.match(html, /whitespace-pre-line/);
  assert.match(html, /<\/mark>\n<mark\b/);
});
