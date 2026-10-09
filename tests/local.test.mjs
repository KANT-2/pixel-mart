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
const utilsUrl = await moduleUrl("../utils/local.ts");
const { changeRegion, regionPath, toggleInterest, fandomPresentation, parseLocalQuery, localHref, interestProductHref } = await import(utilsUrl);
const apiUrl = await moduleUrl("../lib/api.ts");
const { localApi, loadRegionCatalog } = await import(await moduleUrl("../lib/local.ts", { "@/lib/api": apiUrl }));
const { createLocalResource } = await import(await moduleUrl("../lib/localResource.ts", { "@/lib/api": apiUrl }));
const { default: FandomCount } = await import(await moduleUrl("../components/local/FandomCount.tsx", { "@/utils/local": utilsUrl, "react/jsx-runtime": import.meta.resolve("react/jsx-runtime") }));
const regions = [
  { code: "a", level: "sido", parentCode: null }, { code: "b", level: "sido", parentCode: null },
  { code: "a1", level: "sigungu", parentCode: "a" }, { code: "a2", level: "sigungu", parentCode: "a" },
  { code: "b1", level: "sigungu", parentCode: "b" }, { code: "a11", level: "zone", parentCode: "a1" },
  { code: "b11", level: "zone", parentCode: "b1" },
];

test("지역 상위를 바꾸면 하위는 지워지고, 단계 해제는 부모로 돌아감", () => {
  assert.deepEqual(regionPath(regions, "a11").map((item) => item.code), ["a", "a1", "a11"]);
  assert.equal(changeRegion(regions, "a11", "sido", "b"), "b");
  assert.deepEqual(regionPath(regions, changeRegion(regions, "a11", "sigungu", "a2")).map((item) => item.code), ["a", "a2"]);
  assert.equal(changeRegion(regions, "a11", "zone", ""), "a1");
  assert.equal(changeRegion(regions, "a11", "sigungu", ""), "a");
  assert.equal(changeRegion(regions, "a11", "sido", ""), null);
  assert.equal(changeRegion(regions, "a11", "zone", "b11"), "a11");
  assert.equal(changeRegion(regions, "a11", "sido", "invalid"), "a11");
});

test("취향은 id 기준으로 중복 없이 20개까지, 상한에서도 해제 가능", () => {
  const selected = Array.from({ length: 19 }, (_, id) => ({ id, name: `태그 ${id}` }));
  const twenty = toggleInterest(selected, { id: 19, name: "마지막" });
  assert.equal(twenty.items.length, 20);
  assert.equal(twenty.error, null);
  const overflow = toggleInterest(twenty.items, { id: 20 });
  assert.equal(overflow.items, twenty.items);
  assert.match(overflow.error, /20/);
  assert.equal(toggleInterest(twenty.items, { id: 19, name: "다른 이름" }).items.length, 19);
  assert.equal(selected.length, 19);
});

test("5명 미만·null은 숫자와 막대를 숨기고 샘플 여부는 독립적으로 표시", () => {
  for (const row of [
    { count: null, belowThreshold: true, isSample: true },
    { count: 2, belowThreshold: false, isSample: false },
    { count: 100, belowThreshold: true, isSample: false },
  ]) {
    assert.equal(fandomPresentation(row).count, null);
    const html = renderToStaticMarkup(createElement(FandomCount, { row, maximum: 100 }));
    assert.match(html, /5명 미만/);
    assert.doesNotMatch(html, /style=|100명|2명/);
    assert.equal(html.includes("샘플 데이터"), row.isSample);
  }
  assert.deepEqual(fandomPresentation({ count: 5, belowThreshold: false, isSample: false }), { count: 5, label: "5명", sample: null });
  assert.equal(fandomPresentation({ count: 8, belowThreshold: false, isSample: true }).sample, "샘플 데이터");
});

test("지역·기간·취향 쿼리를 정리하고 명시적인 지역 해제를 보존", () => {
  assert.deepEqual(parseLocalQuery(new URLSearchParams("period=bad&interest=-2&region=1234567890123")), { period: "all", interest: null, region: null, hasRegion: true });
  for (const interest of ["1.5", "0", "a", "99999999999999999999999"]) assert.equal(parseLocalQuery(new URLSearchParams({ interest })).interest, null);
  assert.equal(parseLocalQuery(new URLSearchParams()).hasRegion, false);
  assert.equal(parseLocalQuery(new URLSearchParams("region=")).hasRegion, true);
  assert.equal(localHref(null), "/local?region=");
  assert.equal(localHref("a11", "90d", 3), "/local?region=a11&period=90d&interest=3");
  const href = interestProductHref("<b> & 슬라임");
  assert.equal(new URL(href, "http://local").searchParams.get("q"), "<b> & 슬라임");
});

test("지역 API의 parent 트리로 코드를 추측하지 않고 저장 경로 복원", async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const calls = [];
  globalThis.fetch = async (url) => {
    const parent = new URL(url, "http://local").searchParams.get("parent");
    calls.push(parent);
    return new Response(JSON.stringify(regions.filter((item) => item.parentCode === parent)));
  };
  const catalog = await loadRegionCatalog(new AbortController().signal);
  assert.equal(catalog.length, regions.length);
  assert.deepEqual(regionPath(catalog, "b11").map((item) => item.code), ["b", "b1", "b11"]);
  assert.deepEqual(calls, [null, "a", "b", "a1", "a2", "b1"]);
});

test("지역·취향 API는 상대 경로와 쿠키를 사용, 저장은 전체 필드 PUT", async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const calls = [];
  globalThis.fetch = async (url, init) => { calls.push({ url, ...init }); return new Response("{}"); };
  await localApi.interests("  슬라임  ", "character");
  await localApi.profile();
  const input = { regionCode: null, interestIds: [11, 12], fandomOptIn: false, profilePublic: true };
  await localApi.save(input);
  await localApi.fandom("a11", "30d", 11);
  await localApi.ranking("a11", "90d");
  assert.equal(new URL(calls[0].url, "http://local").searchParams.get("q"), "슬라임");
  assert.equal(calls[1].method, "GET");
  assert.equal(calls[2].method, "PUT");
  assert.deepEqual(JSON.parse(calls[2].body), input);
  assert.match(calls[3].url, /region=a11&period=30d&interest=11&limit=200/);
  assert.match(calls[4].url, /ranking\?region=a11&period=90d&limit=10/);
  for (const call of calls) { assert.ok(call.url.startsWith("/api/")); assert.equal(call.credentials, "same-origin"); assert.equal(call.cache, "no-store"); }
});

const tick = () => new Promise((resolve) => setImmediate(resolve));
test("300ms 디바운스는 취소한 입력을 요청하지 않고 마지막 검색만 실행", async (t) => {
  const calls = [];
  const first = createLocalResource(async () => { calls.push("old"); return []; }, 300);
  const last = createLocalResource(async () => { calls.push("new"); return []; }, 300);
  t.after(() => { first.stop(); last.stop(); });
  first.start(); first.stop(); last.start();
  assert.deepEqual(calls, []);
  await new Promise((resolve) => setTimeout(resolve, 340));
  assert.deepEqual(calls, ["new"]);
  assert.equal(last.getSnapshot().loading, false);
});

test("검색·계정 변경 시 이전 요청 취소, 취소를 무시하고 도착한 응답도 폐기", async (t) => {
  const calls = [];
  const previous = createLocalResource((signal) => new Promise((resolve) => calls.push({ signal, resolve })));
  const current = createLocalResource(async () => ({ region: "new", interests: [] }));
  t.after(() => { previous.stop(); current.stop(); });
  previous.start(); previous.stop(); current.start(); await tick();
  assert.equal(calls[0].signal.aborted, true);
  calls[0].resolve({ region: "private old", interests: [1] }); await tick();
  assert.equal(previous.getSnapshot().data, null);
  assert.deepEqual(current.getSnapshot().data, { region: "new", interests: [] });
});

test("조회 실패 후 재시도와 늦은 GET보다 저장 응답 우선", async (t) => {
  const calls = [];
  const resource = createLocalResource((signal) => new Promise((resolve, reject) => calls.push({ signal, resolve, reject })));
  t.after(() => resource.stop());
  resource.start(); calls[0].reject(new Error("offline")); await tick();
  assert.ok(resource.getSnapshot().error);
  const retry = resource.refresh();
  resource.replace({ region: "saved" });
  calls[1].resolve({ region: "old GET" }); await retry;
  assert.equal(calls[1].signal.aborted, true);
  assert.deepEqual(resource.getSnapshot().data, { region: "saved" });
  assert.equal(resource.getSnapshot().error, null);
});
