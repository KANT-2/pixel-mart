import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

async function moduleUrl(path, dependencies = {}) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  let output = ts.transpileModule(source, { fileName: path, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  for (const [specifier, replacement] of Object.entries(dependencies)) output = output.replaceAll(`"${specifier}"`, JSON.stringify(replacement));
  return `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`;
}
const feedbackModule = await moduleUrl("../utils/productFeedback.ts");
const { tabFromHash, tabForKey, validateReview, canDeleteReview, reviewPageAfterReload } = await import(feedbackModule);
const { createQuestionsAdapter, validateQuestion } = await import(await moduleUrl("../lib/questions.ts"));
const apiModule = await moduleUrl("../lib/api.ts");
const { ApiError } = await import(apiModule);
const { reviewsApi, createReviewStore } = await import(await moduleUrl("../lib/reviews.ts", { "@/lib/api": apiModule, "@/utils/productFeedback": feedbackModule }));
const formatModule = await moduleUrl("../utils/formatDate.ts");
const renderDependencies = { "react/jsx-runtime": import.meta.resolve("react/jsx-runtime"), "@/utils/formatDate": formatModule };
const { default: ReviewEntries } = await import(await moduleUrl("../components/products/ReviewEntries.tsx", renderDependencies));
const { default: QuestionEntries } = await import(await moduleUrl("../components/products/QuestionEntries.tsx", renderDependencies));

test("리뷰 별점 1~5 정수·trim 후 1~500자, 내부 줄바꿈·HTML 문자열 보존", () => {
  for (const rating of [1, 2, 3, 4, 5]) assert.equal(validateReview(rating, "좋아요").valid, true);
  for (const rating of [0, 6, 1.5, NaN, Infinity]) assert.ok(validateReview(rating, "좋아요").errors.rating);
  for (const content of ["", " \n\t ", "가".repeat(501)]) assert.ok(validateReview(5, content).errors.content);
  assert.equal(validateReview(5, "가".repeat(500)).valid, true);
  assert.deepEqual(validateReview(4, "  <b>첫 줄</b>\n둘째 줄  ").values, { rating: 4, content: "<b>첫 줄</b>\n둘째 줄" });
});

test("탭 해시 해석과 좌우 순환·Home·End, 관계없는 키 무시", () => {
  assert.equal(tabFromHash("#reviews"), "reviews");
  assert.equal(tabFromHash("#qna"), "qna");
  for (const hash of ["", "#info", "#reviews-other", "#REVIEWS", "#reviews?x=1"]) assert.equal(tabFromHash(hash), "info");
  assert.equal(tabForKey("info", "ArrowLeft"), "qna");
  assert.equal(tabForKey("qna", "ArrowRight"), "info");
  assert.equal(tabForKey("info", "ArrowRight"), "reviews");
  assert.equal(tabForKey("qna", "ArrowLeft"), "reviews");
  assert.equal(tabForKey("reviews", "Home"), "info");
  assert.equal(tabForKey("reviews", "End"), "qna");
  assert.equal(tabForKey("reviews", "Tab"), null);
});

test("리뷰 삭제 표시 판단은 로그인 + isMine만 사용하고 닉네임은 무관", () => {
  assert.equal(canDeleteReview({ isMine: true, nickname: "바뀐 닉네임" }, true), true);
  assert.equal(canDeleteReview({ isMine: false, nickname: "내 닉네임과 같음" }, true), false);
  assert.equal(canDeleteReview({ isMine: true }, false), false);
  for (const isMine of [undefined, null, "true", 1, false]) assert.equal(canDeleteReview({ isMine }, true), false);
});

test("삭제 후 페이지에 항목이 있으면 유지, 비면 이전 페이지로 이동하며 1보다 작아지지 않음", () => {
  assert.equal(reviewPageAfterReload({ page: 2, totalPages: 3, items: [{ id: 1 }] }), 2);
  assert.equal(reviewPageAfterReload({ page: 2, totalPages: 1, items: [] }), 1);
  assert.equal(reviewPageAfterReload({ page: 3, totalPages: 3, items: [] }), 2);
  assert.equal(reviewPageAfterReload({ page: 5, totalPages: 2, items: [] }), 2);
  assert.equal(reviewPageAfterReload({ page: 1, totalPages: 1, items: [] }), 1);
  assert.equal(reviewPageAfterReload({ page: 1, totalPages: 0, items: [] }), 1);
});

test("리뷰 API는 쿠키 포함 클라이언트 GET·POST, 캐시 비활성, 400·403 서버 메시지 보존", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const calls = [];
  globalThis.fetch = async (url, init) => { calls.push({ url, ...init }); return new Response(JSON.stringify({ id: 7 })); };
  await reviewsApi.list(3, 2);
  await reviewsApi.create(3, { rating: 5, content: "본문" });
  await reviewsApi.remove(3, 7);
  assert.equal(calls[0].url, "/api/products/3/reviews?page=2&size=10");
  assert.equal(calls[0].method, "GET");
  assert.equal(calls[1].url, "/api/products/3/reviews");
  assert.equal(calls[1].method, "POST");
  assert.deepEqual(JSON.parse(calls[1].body), { rating: 5, content: "본문" });
  assert.equal(calls[2].url, "/api/products/3/reviews/7");
  assert.equal(calls[2].method, "DELETE");
  assert.equal(calls[2].body, undefined);
  for (const call of calls) { assert.equal(call.cache, "no-store"); assert.equal(call.credentials, "same-origin"); }
  for (const [status, detail] of [[403, "배송이 완료된 상품만 리뷰를 작성할 수 있습니다."], [400, "이미 리뷰를 작성한 상품입니다."]]) {
    globalThis.fetch = async () => new Response(JSON.stringify({ detail }), { status });
    await assert.rejects(reviewsApi.create(3, { rating: 5, content: "본문" }), { status, message: detail });
  }
});

test("리뷰 DELETE의 404·401·기타 서버 오류를 상태와 메시지 그대로 전달", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  for (const [status, detail, expected] of [[404, "리뷰를 찾을 수 없습니다.", "리뷰를 찾을 수 없습니다."], [401, "Unauthorized", "로그인이 필요합니다"], [500, "삭제 요청 처리 실패", "삭제 요청 처리 실패"]]) {
    globalThis.fetch = async () => new Response(JSON.stringify({ detail }), { status });
    await assert.rejects(reviewsApi.remove(3, 7), { status, message: expected });
  }
});

const tick = () => new Promise((resolve) => setImmediate(resolve));
const reviewPage = (page, total = 12, averageRating = 4.5) => ({ items: [{ id: page }], page, total, totalPages: Math.max(1, Math.ceil(total / 10)), size: 10, averageRating });
function makeStore(t) {
  const calls = [];
  const store = createReviewStore(3, { list: (id, page, signal) => new Promise((resolve, reject) => calls.push({ id, page, signal, resolve, reject })) });
  t.after(() => store.stop());
  return { store, calls };
}

test("리뷰 첫 페이지 조회·페이지 이동·등록 후 1페이지 재조회는 평균·개수도 서버 값으로 교체", async (t) => {
  const { store, calls } = makeStore(t);
  store.start(); calls[0].resolve(reviewPage(1)); await tick();
  const next = store.load(2); calls[1].resolve(reviewPage(2)); await next;
  const refreshed = store.load(1); calls[2].resolve(reviewPage(1, 13, 4.7)); await refreshed;
  assert.deepEqual(calls.map((call) => call.page), [1, 2, 1]);
  assert.deepEqual(store.getSnapshot().data, reviewPage(1, 13, 4.7));
});

test("늦은 리뷰 페이지 응답·실패가 새 응답을 덮지 않고 해제 후 응답도 무시", async (t) => {
  const { store, calls } = makeStore(t);
  store.start();
  const newer = store.load(2); calls[1].resolve(reviewPage(2)); await newer;
  calls[0].resolve(reviewPage(1)); await tick();
  assert.equal(store.getSnapshot().data.page, 2);
  assert.equal(calls[0].signal.aborted, true);
  const pending = store.load(1); store.stop(); calls[2].resolve(reviewPage(1)); await pending;
  assert.equal(store.getSnapshot().data, null);
  store.start(); calls[3].resolve(reviewPage(1)); await tick();
  assert.equal(store.getSnapshot().data.page, 1);
});

test("리뷰 GET 실패는 기존 데이터를 보존하고 GET 재시도로 복구, 빈 목록·null 평균 보존", async (t) => {
  const { store, calls } = makeStore(t);
  store.start(); calls[0].resolve(reviewPage(1)); await tick();
  const failed = store.load(1); calls[1].reject(new ApiError("잠시 후 다시 시도해 주세요.", 500)); await failed;
  assert.equal(store.getSnapshot().error, "잠시 후 다시 시도해 주세요.");
  assert.equal(store.getSnapshot().data.total, 12);
  const retry = store.load(1); calls[2].resolve({ ...reviewPage(1, 0, null), items: [] }); await retry;
  assert.equal(store.getSnapshot().error, null);
  assert.equal(store.getSnapshot().data.total, 0);
  assert.equal(store.getSnapshot().data.averageRating, null);
});

test("마지막 페이지 리뷰 삭제 후 현재 페이지를 조회하고 이전 페이지·평균·개수를 갱신", async (t) => {
  const { store, calls } = makeStore(t);
  store.start(); calls[0].resolve(reviewPage(1, 11)); await tick();
  const reload = store.load(2);
  calls[1].resolve({ ...reviewPage(2, 10, 4), items: [] }); await tick();
  assert.equal(calls[2].page, 1);
  calls[2].resolve(reviewPage(1, 10, 4)); await reload;
  assert.deepEqual(calls.map((call) => call.page), [1, 2, 1]);
  assert.equal(store.getSnapshot().data.page, 1);
  assert.equal(store.getSnapshot().data.total, 10);
  assert.equal(store.getSnapshot().data.averageRating, 4);
});

test("계정별 새 스토어는 이전 계정의 늦은 isMine 응답을 공유하지 않음", async (t) => {
  const previous = makeStore(t), current = makeStore(t);
  previous.store.start(); previous.store.stop(); current.store.start();
  current.calls[0].resolve({ ...reviewPage(1), items: [{ id: 7, isMine: false }] }); await tick();
  previous.calls[0].resolve({ ...reviewPage(1), items: [{ id: 7, isMine: true }] }); await tick();
  assert.equal(previous.store.getSnapshot().data, null);
  assert.equal(current.store.getSnapshot().data.items[0].isMine, false);
});

test("질문 데모 입력 검증은 제목·본문 trim과 길이 제한, 텍스트 줄바꿈 보존", () => {
  assert.equal(validateQuestion(" ", " ").valid, false);
  assert.equal(validateQuestion("가".repeat(101), "가").valid, false);
  assert.equal(validateQuestion("제목", "가".repeat(501)).valid, false);
  assert.deepEqual(validateQuestion(" <b>제목</b> ", " 첫 줄\n둘째 줄 ").values, { title: "<b>제목</b>", content: "첫 줄\n둘째 줄" });
});

test("Q&A 데모 비밀글은 본인만 내용·닉네임을 읽고 로그아웃·다른 계정에서는 제거", async () => {
  const adapter = createQuestionsAdapter();
  const owner = { id: 7, nickname: "<b>작성자</b>" };
  await adapter.create(1, owner, { title: "민감한 제목", content: "비공개 본문", isSecret: true });
  const own = (await adapter.list(1, owner))[0];
  assert.equal(own.hidden, false); assert.equal(own.content, "비공개 본문"); assert.equal(own.nickname, owner.nickname);
  for (const viewer of [null, { id: 8, nickname: "다른 계정" }]) {
    const hidden = (await adapter.list(1, viewer))[0];
    assert.equal(hidden.hidden, true);
    for (const key of ["title", "content", "nickname", "answer"]) assert.equal(hidden[key], null);
    assert.ok(!JSON.stringify(hidden).includes("비공개"));
  }
  assert.equal((await adapter.list(1, { ...owner, nickname: "새 닉네임" }))[0].hidden, false);
});

test("질문 어댑터는 상품별 저장·최신순, 새 문서에서는 초기화, 비로그인·취소 요청 저장 거부", async () => {
  const adapter = createQuestionsAdapter(); const user = { id: 1, nickname: "QA" };
  assert.equal(adapter.mode, "demo"); assert.match(adapter.notice, /새로고침/);
  const before = await adapter.list(1, user);
  const input = { title: "추가 질문", content: "본문", isSecret: false };
  await adapter.create(1, user, input);
  assert.equal((await adapter.list(1, null))[0].title, input.title);
  assert.equal((await adapter.list(1, null)).length, before.length + 1);
  assert.equal((await adapter.list(2, null)).length, before.length);
  assert.equal((await createQuestionsAdapter().list(1, null)).length, before.length);
  await assert.rejects(adapter.create(1, null, input), /로그인/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(adapter.create(1, user, input, controller.signal), { name: "AbortError" });
  assert.equal((await adapter.list(1, null)).length, before.length + 1);
  assert.equal(before.some((question) => question.answered), true);
});

test("리뷰·질문 본문·제목·답변·닉네임의 HTML 문자열은 텍스트로만 렌더링", () => {
  const malicious = '<b>텍스트</b>\n<script>alert(1)</script><img src=x onerror=alert(1)>';
  const common = { id: 1, createdAt: "2026-01-01T00:00:00Z", nickname: malicious, content: malicious };
  const review = renderToStaticMarkup(createElement(ReviewEntries, { items: [{ ...common, productId: 1, rating: 5 }] }));
  const question = renderToStaticMarkup(createElement(QuestionEntries, { items: [{ ...common, id: "question-1", title: malicious, answer: malicious, isSecret: false, hidden: false, answered: true }] }));
  for (const html of [review, question]) {
    assert.ok(html.includes("&lt;b&gt;텍스트&lt;/b&gt;")); assert.ok(html.includes("&lt;script&gt;"));
    assert.ok(!html.includes("<script>")); assert.ok(!html.includes("<img")); assert.ok(html.includes("whitespace-pre-line")); assert.ok(html.includes("\n"));
  }
  const masked = renderToStaticMarkup(createElement(QuestionEntries, { items: [{ ...common, id: "hidden", title: malicious, answer: malicious, isSecret: true, hidden: true, answered: true }] }));
  assert.ok(masked.includes("비밀글입니다")); assert.ok(masked.includes("답변 완료")); assert.ok(!masked.includes("텍스트"));
});
