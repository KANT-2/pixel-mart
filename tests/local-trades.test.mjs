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
const localUrl = await moduleUrl("../utils/local.ts");
const { interestLabel, toggleInterest } = await import(localUrl);
const rulesUrl = await moduleUrl("../utils/localTrades.ts", { "@/utils/local": localUrl });
const { containsContact, parseTradePrice, validateTrade, parseTradeQuery, tradeQueryParams, tradeHref, changeTradeQuery, matchLabels, tradeProximity } = await import(rulesUrl);
const apiUrl = await moduleUrl("../lib/api.ts");
const { localApi } = await import(await moduleUrl("../lib/local.ts", { "@/lib/api": apiUrl }));
const { createLocalResource } = await import(await moduleUrl("../lib/localResource.ts", { "@/lib/api": apiUrl }));
const { default: TradeCard } = await import(await moduleUrl("../components/local/TradeCard.tsx", {
  "@/utils/local": localUrl, "@/utils/localTrades": rulesUrl,
  "@/utils/formatDate": await moduleUrl("../utils/formatDate.ts"), "@/utils/formatPrice": await moduleUrl("../utils/formatPrice.ts"), "@/utils/gameItem": await moduleUrl("../utils/gameItem.ts"), "@/utils/gift": await moduleUrl("../utils/gift.ts"),
  "@/components/PixelIcon": await moduleUrl("../components/PixelIcon.tsx", { "react/jsx-runtime": import.meta.resolve("react/jsx-runtime") }),
  "react/jsx-runtime": import.meta.resolve("react/jsx-runtime"), "next/link": import.meta.resolve("next/link.js"),
}));
const draft = { kind: "have", itemName: "  QA 키링  ", condition: "new", price: "", tradeMethod: "direct", content: "첫 줄\n둘째 줄", productId: null, interestId: null };

test("HAVE·SELL 상태 필수, WISH 선택 가능, trim·길이·방식 검증", () => {
  for (const kind of ["have", "sell"]) assert.ok(validateTrade({ ...draft, kind, condition: "" }).errors.condition);
  assert.equal(validateTrade({ ...draft, kind: "want", condition: "" }).valid, true);
  const result = validateTrade(draft);
  assert.equal(result.values.itemName, "QA 키링"); assert.equal(result.values.content, "첫 줄\n둘째 줄");
  for (const itemName of [" ", "가".repeat(61)]) assert.ok(validateTrade({ ...draft, itemName }).errors.itemName);
  assert.ok(validateTrade({ ...draft, content: "가".repeat(1001) }).errors.content);
  assert.equal(validateTrade({ ...draft, itemName: "가".repeat(60), content: "가".repeat(1000) }).valid, true);
  assert.ok(validateTrade({ ...draft, kind: "bad" }).errors.kind);
  assert.ok(validateTrade({ ...draft, condition: "bad" }).errors.condition);
  assert.ok(validateTrade({ ...draft, tradeMethod: "bad" }).errors.tradeMethod);
});

test("연락처: 전화번호 구분자·이메일·카카오 ID/링크를 물건명과 본문에서 차단", () => {
  const contacts = ["010-1234-5678", "01012345678", "010 1234 5678", "010.1234.5678", "연락 010 - 1234 - 5678", "02-123-4567", "031 123 4567", "test+pixel@example.com", "카톡 아이디 pixel123", "카카오톡 ID: pixel123", "카톡: pixel123", "카톡 pixel123", "카카오톡 링크 https://example.test", "오픈채팅 ID: test", "오픈 채팅 링크", "https://open.kakao.com/o/test", "https://pf.kakao.com/test", "카카오톡ＩＤ：pixel"];
  for (const contact of contacts) {
    assert.equal(containsContact(contact), true, contact);
    assert.equal(validateTrade({ ...draft, itemName: contact }).errors.itemName, "연락처는 적을 수 없어요", contact);
    assert.equal(validateTrade({ ...draft, content: contact }).errors.content, "연락처는 적을 수 없어요", contact);
  }
  for (const text of ["가격은 10000000원", "30,000원", "10000원 · 2개", "2026.10.09 구매", "키캡 104개", "<b>물건 설명</b>"]) assert.equal(containsContact(text), false, text);
  assert.equal(validateTrade({ ...draft, price: "10000000" }).valid, true);
});

test("가격은 빈 값=null, 0 포함 정수만 허용하고 소수·기호·상한 초과 차단", () => {
  assert.deepEqual(parseTradePrice(" "), { value: null, error: null });
  for (const raw of ["0", "000", "10000000", " 12345 "]) assert.deepEqual(parseTradePrice(raw), { value: Number(raw), error: null });
  for (const raw of ["-1", "1.1", "1e3", "1,000", "+1", "₩1000", "10000001", "1000원", "abc", "999999999999999999"]) assert.ok(parseTradePrice(raw).error, raw);
});

test("같은 이름의 취향은 종류와 id로 구분하고 단일 선택은 교체, A파트는 20개 유지", () => {
  const character = { id: 11, name: "나루토", type: "character" }, work = { id: 1, name: "나루토", type: "work" };
  assert.equal(interestLabel(character), "나루토 · 캐릭터"); assert.equal(interestLabel(work), "나루토 · 작품");
  assert.deepEqual(toggleInterest([character], work, true).items, [work]);
  assert.deepEqual(toggleInterest([work], work, true).items, []);
  assert.equal(toggleInterest([character], work).items.length, 2);
  assert.ok(toggleInterest(Array.from({ length: 20 }, (_, i) => ({ id: i })), { id: 21 }).error);
});

test("필터 URL은 잘못된 종류·id·페이지를 정리하고 변경 시 페이지 초기화", () => {
  const query = parseTradeQuery(new URLSearchParams("region=41135&kind=have&productId=3&interestId=11&page=2"));
  assert.equal(tradeHref(query), "/local/trades?region=41135&kind=have&productId=3&interestId=11&page=2");
  const next = changeTradeQuery(query, { kind: "want" }); assert.equal(next.page, 1); assert.equal(next.productId, 3); assert.equal(next.region, "41135");
  assert.equal(tradeQueryParams(next).has("page"), false);
  assert.deepEqual(parseTradeQuery(new URLSearchParams("region=&kind=no&productId=-1&interestId=1.2&page=0")), { region: null, hasRegion: true, kind: undefined, q: undefined, nickname: undefined, productId: undefined, interestId: undefined, page: 1 });
  assert.equal(parseTradeQuery(new URLSearchParams()).hasRegion, false);
  assert.equal(tradeHref(parseTradeQuery(new URLSearchParams("q=%20%ED%82%A4%EB%A7%81%20&kind=sell"))), "/local/trades?kind=sell&q=%ED%82%A4%EB%A7%81");
  assert.equal(parseTradeQuery(new URLSearchParams("page=999999999999999999")).page, 1);
});

test("매칭 배지는 서버 proximity·mutual을 사용하고 게시판은 확인된 지역 관계만 표시", () => {
  assert.deepEqual(matchLabels("same_zone", true), ["서로 원하는 교환", "같은 생활권"]);
  assert.deepEqual(matchLabels("same_district", false), ["같은 구"]);
  const regions = [{ code: "a", level: "sido", parentCode: null }, { code: "b", level: "sigungu", parentCode: "a" }, { code: "c", level: "zone", parentCode: "b" }, { code: "d", level: "zone", parentCode: "b" }];
  assert.equal(tradeProximity(regions, "c", "c"), "same_zone"); assert.equal(tradeProximity(regions, "c", "d"), "same_district");
  assert.equal(tradeProximity(regions, null, "c"), null); assert.equal(tradeProximity(regions, "a", "a"), null);
});

test("거래 카드는 텍스트로만 렌더링하고 작성자·계정·지역명·연락처를 노출하지 않음", () => {
  const post = { id: 1, kind: "have", status: "open", itemName: "<b>키링</b>", condition: "new", price: 0, tradeMethod: "direct", content: "<script>alert(1)</script>\n둘째 줄", product: null, interest: null, regionCode: "privateCode", regionName: "PRIVATE_LOCATION", nickname: "PRIVATE_AUTHOR", email: "PRIVATE_ACCOUNT", isMine: false, isSample: true, createdAt: "2026-10-09T00:00:00Z" };
  const html = renderToStaticMarkup(createElement(TradeCard, { post, proximity: "same_zone" }));
  assert.match(html, /&lt;b&gt;키링/); assert.match(html, /&lt;script&gt;/); assert.match(html, /whitespace-pre-line/); assert.doesNotMatch(html, /샘플|데모/); assert.match(html, /같은 생활권/); assert.match(html, /0원/);
  assert.doesNotMatch(html, /PRIVATE_|privateCode|<script>|<b>/);
  const redacted = renderToStaticMarkup(createElement(TradeCard, { post: { ...post, content: "010-1234-5678", itemName: "카톡 id pixel" } }));
  assert.doesNotMatch(redacted, /010-1234-5678|카톡 id pixel/);
});

test("거래 API 계약: 배열·Page 구분, 전체 입력 POST·상태 PATCH·상품 검색 24개씩(더 보기)", async (t) => {
  const previous = globalThis.fetch; t.after(() => { globalThis.fetch = previous; });
  const calls = []; globalThis.fetch = async (url, init) => { calls.push({ url, ...init }); return new Response("{}"); };
  await localApi.trades(parseTradeQuery(new URLSearchParams("region=41135&kind=have&productId=3&interestId=11&page=2")));
  await localApi.myTrades(); await localApi.createTrade(validateTrade(draft).values); await localApi.tradeStatus(12, "hidden"); await localApi.matches(); await localApi.wishMap("41135"); await localApi.searchProducts(" 키캡 ");
  assert.match(calls[0].url, /region=41135&kind=have&productId=3&interestId=11&page=2&size=12/);
  assert.equal(calls[1].url, "/api/local/trades/mine"); assert.equal(calls[2].method, "POST"); assert.equal(JSON.parse(calls[2].body).regionCode, undefined);
  assert.equal(calls[3].method, "PATCH"); assert.deepEqual(JSON.parse(calls[3].body), { status: "hidden" });
  assert.equal(calls[4].url, "/api/local/trades/matches"); assert.match(calls[5].url, /wish-map\?region=41135&limit=10/);
  assert.equal(new URL(calls[6].url, "http://local").searchParams.get("size"), "24");
  for (const call of calls) { assert.equal(call.credentials, "same-origin"); assert.equal(call.cache, "no-store"); }
});

test("상품 검색 디바운스와 취소: 마지막 요청만 실행, 늦은 응답은 다음 결과에 섞이지 않음", async (t) => {
  const calls = [];
  const first = createLocalResource(async () => { calls.push("skipped"); return []; }, 300);
  let resolveOld, oldSignal;
  const old = createLocalResource((signal) => new Promise((resolve) => { oldSignal = signal; resolveOld = resolve; }));
  const latest = createLocalResource(async () => { calls.push("last"); return ["new product"]; }, 300);
  t.after(() => { first.stop(); old.stop(); latest.stop(); });
  first.start(); first.stop(); old.start(); old.stop(); latest.start();
  await new Promise((resolve) => setTimeout(resolve, 340));
  resolveOld(["old product"]); await new Promise((resolve) => setImmediate(resolve));
  assert.equal(oldSignal.aborted, true); assert.equal(old.getSnapshot().data, null);
  assert.deepEqual(calls, ["last"]); assert.deepEqual(latest.getSnapshot().data, ["new product"]);
});
