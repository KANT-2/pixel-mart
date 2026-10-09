import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
async function moduleUrl(path, replacements = {}) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  let output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  for (const [specifier, replacement] of Object.entries(replacements)) output = output.replaceAll(`"${specifier}"`, JSON.stringify(replacement));
  return `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`;
}

const { getFaqCategories, normalizeFaqCategory, filterFaqs, parseFaqHash, splitFaqText } = await import(await moduleUrl("../utils/faq.ts"));
const fallbackModule = await moduleUrl("../lib/faqFallback.ts");
const { faqFallback } = await import(fallbackModule);
const { getFaqs } = await import(await moduleUrl("../lib/faqs.ts", {
  react: pathToFileURL(require.resolve("react")).href,
  "@/lib/api": await moduleUrl("../lib/api.ts"),
  "@/lib/faqFallback": fallbackModule,
}));

const fixture = [
  { id: 1, category: "배송", question: "배송은 언제 오나요?", answer: "PIXEL MART는 체험용이에요." },
  { id: 2, category: "주문", question: "주문 Q&A", answer: "<b>는 일반 문자입니다. 100% 및 a_b, [괄호]도 그대로." },
  { id: 3, category: "배송", question: "다시 배송", answer: "배송 조회는 마이페이지에서." },
  { id: 4, category: "새 분류", question: "새로운 질문", answer: "새로운 답변" },
];

test("FAQ 분류는 첫 등장 순서와 전체 개수를 유지하며 빈 목록도 처리", () => {
  assert.deepEqual(getFaqCategories(fixture), [
    { category: "배송", count: 2 },
    { category: "주문", count: 1 },
    { category: "새 분류", count: 1 },
  ]);
  assert.deepEqual(getFaqCategories([]), []);
});

test("FAQ 검색은 공백·대소문자를 정리하고 질문·답변과 현재 분류를 함께 검색", () => {
  const ids = (category, query) => filterFaqs(fixture, category, query).map((item) => item.id);
  assert.deepEqual(ids(undefined, "  pIxEl  "), [1]);
  assert.deepEqual(ids(undefined, "  q&a "), [2]);
  assert.deepEqual(ids("배송", "마이페이지"), [3]);
  assert.deepEqual(ids("주문", "배송"), []);
  assert.deepEqual(ids(undefined, " \n\t "), [1, 2, 3, 4]);
  assert.deepEqual(ids("배송", ""), [1, 3]);
  assert.deepEqual(ids(undefined, "없는 질문"), []);
  for (const query of ["<b>", "%", "_", "[괄호]"]) assert.deepEqual(ids(undefined, query), [2], query);
  assert.deepEqual(fixture.map((item) => item.id), [1, 2, 3, 4]);
});

test("없는 FAQ 분류는 전체로 정리하고 응답에 새로 생긴 분류는 허용", () => {
  for (const value of [undefined, null, "", "없는 분류", " 배송 ", "배송,주문"]) {
    assert.equal(normalizeFaqCategory(value, fixture), undefined);
  }
  assert.equal(normalizeFaqCategory("새 분류", fixture), "새 분류");
  assert.equal(normalizeFaqCategory("배송", fixture), "배송");
  assert.equal(normalizeFaqCategory("배송", []), undefined);
});

test("FAQ 해시는 양의 안전한 정수 ID만 허용", () => {
  assert.equal(parseFaqHash("#faq-3"), 3);
  assert.equal(parseFaqHash(`#faq-${Number.MAX_SAFE_INTEGER}`), Number.MAX_SAFE_INTEGER);
  for (const hash of ["", "faq-3", "#FAQ-3", "#faq-0", "#faq--1", "#faq-01", "#faq-3.5", "#faq-3?x=1", "#faq-3x", "#faq-3\n", "#faq-%33", "#faq-9007199254740992"]) {
    assert.equal(parseFaqHash(hash), undefined, hash);
  }
});

test("하이라이트는 원문과 줄바꿈을 보존하며 대소문자·여러 일치 부분을 split", () => {
  assert.deepEqual(splitFaqText("PIXEL\nPixel, pixel!", " pixel "), [
    { text: "PIXEL", match: true },
    { text: "\n", match: false },
    { text: "Pixel", match: true },
    { text: ", ", match: false },
    { text: "pixel", match: true },
    { text: "!", match: false },
  ]);
  assert.deepEqual(splitFaqText("답변 그대로", " \n "), [{ text: "답변 그대로", match: false }]);
  assert.deepEqual(splitFaqText("답변 그대로", "검색 실패"), [{ text: "답변 그대로", match: false }]);
  assert.deepEqual(splitFaqText("", "검색"), []);
});

test("하이라이트는 HTML 같은 문자열과 정규식 특수문자를 일반 텍스트로 분할", () => {
  const source = "<b>안내</b> <B>문자</B> .*[x](a)+?^$|\\ %_";
  assert.deepEqual(splitFaqText(source, "<b>"), [
    { text: "<b>", match: true },
    { text: "안내</b> ", match: false },
    { text: "<B>", match: true },
    { text: "문자</B> .*[x](a)+?^$|\\ %_", match: false },
  ]);
  for (const query of [".*", "[x]", "(a)", "+?^$|\\", "%_", "<b>"]) {
    const parts = splitFaqText(source, query);
    assert.equal(parts.map((part) => part.text).join(""), source);
    assert.ok(parts.some((part) => part.match), query);
    assert.ok(parts.filter((part) => part.match).every((part) => part.text.toLowerCase() === query.toLowerCase()), query);
  }
});

test("FAQ 폴백은 백엔드 시드 10개의 내용과 순서가 동일", async () => {
  const seed = JSON.parse(await readFile(new URL("../backend/seed/faqs.json", import.meta.url), "utf8"));
  assert.equal(faqFallback.length, 10);
  assert.deepEqual(faqFallback, seed);
  assert.deepEqual(getFaqCategories(faqFallback), [
    { category: "주문", count: 2 },
    { category: "배송", count: 2 },
    { category: "취소", count: 1 },
    { category: "리뷰", count: 1 },
    { category: "상품 문의", count: 1 },
    { category: "호환성", count: 2 },
    { category: "기타", count: 1 },
  ]);
});

async function withFetch(fetcher, run) {
  const original = globalThis.fetch;
  globalThis.fetch = fetcher;
  try { await run(); } finally { globalThis.fetch = original; }
}
const json = (data, status = 200) => new Response(JSON.stringify(data), { status });

test("FAQ API는 전체 목록을 한 번 요청하고 정상 빈 응답은 폴백하지 않음", async () => {
  for (const data of [fixture, []]) {
    const paths = [];
    await withFetch(async (url) => {
      const request = new URL(url);
      paths.push(`${request.pathname}${request.search}`);
      return json(data);
    }, async () => {
      assert.deepEqual(await getFaqs(), { data, fallback: false });
    });
    assert.deepEqual(paths, ["/api/faqs"]);
  }
});

test("FAQ API 네트워크·HTTP 장애만 정적 폴백하고 다음 요청은 복구된 API 사용", async () => {
  for (const fetcher of [
    async () => { throw new TypeError("offline"); },
    async () => json({ detail: "잠시 후 다시 시도해주세요" }, 503),
  ]) {
    await withFetch(fetcher, async () => {
      assert.deepEqual(await getFaqs(), { data: faqFallback, fallback: true });
    });
  }
  await withFetch(async () => json(fixture), async () => {
    assert.deepEqual(await getFaqs(), { data: fixture, fallback: false });
  });
});
