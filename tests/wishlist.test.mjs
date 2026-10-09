import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

async function moduleUrl(path, dependencies = {}) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  let compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  for (const [specifier, url] of Object.entries(dependencies)) compiled = compiled.replaceAll(`"${specifier}"`, `"${url}"`);
  return `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`;
}

const apiUrl = await moduleUrl("../lib/api.ts");
const { createWishlistStore } = await import(await moduleUrl("../lib/wishlist.ts", { "@/lib/api": apiUrl }));

function item(id, day = id) {
  return { product: { id, name: `상품 ${id}`, price: id * 1000 }, createdAt: `2026-10-${String(day).padStart(2, "0")}T00:00:00Z` };
}

function page(items, page = 1, totalPages = 1) {
  return { items, page, totalPages, size: 60, total: items.length };
}

async function tick() {
  await new Promise((resolve) => setImmediate(resolve));
}

function network(t) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = (url, init) => new Promise((resolve, reject) => {
    calls.push({
      url, method: init.method, signal: init.signal,
      reply(body, status = 200) { resolve(new Response(JSON.stringify(body), { status })); },
      fail(reason) { reject(reason); },
    });
  });
  t.after(() => { globalThis.fetch = original; });
  return calls;
}

async function ready(t, items = []) {
  const calls = network(t);
  const store = createWishlistStore(true);
  t.after(() => store.stop());
  assert.equal(store.getSnapshot().ready, false);
  assert.equal(store.getSnapshot().loading, true);
  store.start();
  calls[0].reply(page(items));
  await tick();
  assert.equal(store.getSnapshot().ready, true);
  assert.equal(store.getSnapshot().loading, false);
  return { calls, store };
}

test("비로그인 상태는 요청 없이 비어 있고 확인 중에는 토글할 수 없다", async (t) => {
  const calls = network(t);
  const guest = createWishlistStore(false);
  guest.start();
  await assert.rejects(guest.toggle(1), /로그인이 필요합니다/);
  assert.equal(guest.getSnapshot().loading, false);
  assert.equal(guest.getSnapshot().wishedIds.size, 0);
  assert.equal(calls.length, 0);
  const store = createWishlistStore(true);
  t.after(() => store.stop());
  store.start();
  await assert.rejects(store.toggle(1), /준비하고 있어요/);
  assert.equal(calls.length, 1);
});

test("모든 페이지를 size=60으로 조회하고 중복 제거·최근순 정렬 후 한 번에 공개한다", async (t) => {
  const calls = network(t);
  const store = createWishlistStore(true);
  t.after(() => store.stop());
  store.start();
  assert.equal(calls[0].url, "/api/wishlist?page=1&size=60");
  calls[0].reply(page([item(1), item(2)], 1, 3));
  await tick();
  assert.equal(store.getSnapshot().wishedIds.size, 0);
  assert.deepEqual(store.getSnapshot().items, []);
  assert.equal(calls[1].url, "/api/wishlist?page=2&size=60");
  calls[1].reply(page([item(3), item(2, 5)], 2, 3));
  await tick();
  assert.equal(calls[2].url, "/api/wishlist?page=3&size=60");
  calls[2].reply(page([item(4, 5)], 3, 3));
  await tick();
  assert.deepEqual(store.getSnapshot().items, [item(4, 5), item(2, 5), item(3), item(1)]);
  assert.deepEqual([...store.getSnapshot().wishedIds], [4, 2, 3, 1]);
  assert.equal(store.getSnapshot().revision, 1);
  assert.equal(store.getSnapshot().loading, false);
});

test("중간 페이지 실패는 일부 목록을 노출하지 않으며 전체 재시도할 수 있다", async (t) => {
  const { calls, store } = await ready(t, [item(1)]);
  const failed = assert.rejects(store.refresh(), /조회 실패/);
  calls[1].reply(page([item(2)], 1, 2));
  await tick();
  calls[2].reply({ detail: "조회 실패" }, 503);
  await failed;
  assert.deepEqual(store.getSnapshot().items, [item(1)]);
  assert.equal(store.getSnapshot().revision, 1);
  assert.equal(store.getSnapshot().error, "조회 실패");
  const retried = store.refresh();
  assert.equal(calls[3].url, "/api/wishlist?page=1&size=60");
  calls[3].reply(page([item(3)]));
  await retried;
  assert.deepEqual(store.getSnapshot().items, [item(3)]);
  assert.equal(store.getSnapshot().revision, 2);
  assert.equal(store.getSnapshot().error, null);
});

test("같은 상품 연타는 최신 의도로 병합하고 다른 상품도 한 요청씩 처리한다", async (t) => {
  const { calls, store } = await ready(t);
  const first = store.toggle(1);
  const second = store.toggle(1);
  const third = store.toggle(1);
  const last = store.toggle(1);
  const other = store.toggle(2);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].method, "PUT");
  assert.deepEqual([...store.getSnapshot().wishedIds], [2]);
  assert.deepEqual(store.getSnapshot().pendingIds, [1, 2]);
  calls[1].reply(item(1));
  await first;
  assert.equal(calls.length, 3);
  assert.equal(calls[2].method, "DELETE");
  assert.equal(store.getSnapshot().wishedIds.has(1), false);
  calls[2].reply({ message: "해제" });
  await Promise.all([second, third, last]);
  assert.equal(calls.length, 4);
  assert.equal(calls[3].url, "/api/wishlist/2");
  calls[3].reply(item(2));
  await other;
  assert.deepEqual(store.getSnapshot().items, [item(2)]);
  assert.deepEqual(store.getSnapshot().pendingIds, []);
});

test("PUT의 실제 상품·생성 시각을 목록 맨 앞에 반영하고 DELETE 성공 때만 목록에서 제거한다", async (t) => {
  const { calls, store } = await ready(t, [item(2)]);
  const added = store.toggle(1);
  assert.deepEqual(store.getSnapshot().items, [item(2)]);
  const response = { ...item(1, 8), product: { ...item(1).product, name: "서버에서 수정한 이름" } };
  calls[1].reply(response);
  await added;
  assert.deepEqual(store.getSnapshot().items, [response, item(2)]);
  const removed = store.toggle(1);
  assert.deepEqual(store.getSnapshot().items, [response, item(2)]);
  assert.equal(store.getSnapshot().wishedIds.has(1), false);
  calls[2].reply({ message: "해제" });
  await removed;
  assert.deepEqual(store.getSnapshot().items, [item(2)]);
});

test("실패한 상품만 롤백하고 다른 상품 성공으로 오류를 지우지 않는다", async (t) => {
  const { calls, store } = await ready(t, [item(1), item(2)]);
  const failed = assert.rejects(store.toggle(1), /해제 실패/);
  const other = store.toggle(2);
  calls[1].reply({ detail: "해제 실패" }, 500);
  await failed;
  assert.equal(store.getSnapshot().wishedIds.has(1), true);
  assert.equal(store.getSnapshot().wishedIds.has(2), false);
  calls[2].reply({ message: "해제" });
  await other;
  assert.equal(store.getSnapshot().errors.get(1), "해제 실패");
  assert.equal(store.getSnapshot().error, "해제 실패");
  const retry = store.toggle(1);
  calls[3].reply({ message: "해제" });
  await retry;
  assert.equal(store.getSnapshot().errors.size, 0);
  assert.equal(store.getSnapshot().error, null);
});

test("실패 응답이 늦게 와도 뒤의 최신 의도는 롤백하지 않는다", async (t) => {
  const { calls, store } = await ready(t);
  const first = assert.rejects(store.toggle(1), /찜 실패/);
  const second = store.toggle(1);
  const latest = store.toggle(1);
  calls[1].reply({ detail: "찜 실패" }, 500);
  await first;
  assert.equal(store.getSnapshot().wishedIds.has(1), true);
  assert.equal(calls[2].method, "PUT");
  calls[2].reply(item(1));
  await Promise.all([second, latest]);
  assert.deepEqual(store.getSnapshot().items, [item(1)]);
  assert.equal(store.getSnapshot().error, null);
});

test("전체 재조회 실패는 상품 오류를 보존하고 전체 성공 뒤에만 함께 지운다", async (t) => {
  const { calls, store } = await ready(t, [item(1)]);
  const failed = assert.rejects(store.toggle(1), /해제 실패/);
  calls[1].reply({ detail: "해제 실패" }, 500);
  await failed;
  const failedRefresh = assert.rejects(store.refresh(), /조회 실패/);
  calls[2].reply(page([item(2)], 1, 2));
  await tick();
  calls[3].reply({ detail: "조회 실패" }, 503);
  await failedRefresh;
  assert.equal(store.getSnapshot().errors.get(1), "해제 실패");
  assert.equal(store.getSnapshot().error, "조회 실패");
  assert.deepEqual(store.getSnapshot().items, [item(1)]);
  const refreshed = store.refresh();
  calls[4].reply(page([item(2)], 1, 2));
  await tick();
  assert.equal(store.getSnapshot().errors.get(1), "해제 실패");
  calls[5].reply(page([item(3)], 2, 2));
  await refreshed;
  assert.equal(store.getSnapshot().errors.size, 0);
  assert.equal(store.getSnapshot().error, null);
  assert.deepEqual(store.getSnapshot().items, [item(3), item(2)]);
});

test("DELETE 404는 성공으로 제거하지만 PUT 404는 오류로 롤백한다", async (t) => {
  const { calls, store } = await ready(t, [item(1)]);
  const removed = store.toggle(1);
  calls[1].reply({ detail: "찜하지 않은 상품입니다." }, 404);
  await removed;
  assert.deepEqual(store.getSnapshot().items, []);
  assert.equal(store.getSnapshot().error, null);
  const failed = assert.rejects(store.toggle(2), /상품을 찾을 수 없습니다/);
  calls[2].reply({ detail: "상품을 찾을 수 없습니다." }, 404);
  await failed;
  assert.equal(store.getSnapshot().wishedIds.has(2), false);
  assert.deepEqual(store.getSnapshot().items, []);
});

test("응답 유실 후 최신 의도가 기존 상태와 같아도 서버에 반드시 전송한다", async (t) => {
  const { calls, store } = await ready(t);
  const failed = assert.rejects(store.toggle(1), /응답이 늦어지고/);
  const undone = store.toggle(1);
  calls[1].fail(new DOMException("timeout", "TimeoutError"));
  await failed;
  assert.equal(calls.length, 3);
  assert.equal(calls[2].method, "DELETE");
  calls[2].reply({ message: "해제" });
  await undone;
  assert.equal(store.getSnapshot().wishedIds.has(1), false);
  assert.equal(store.getSnapshot().error, null);
});

test("GET 재조회도 변경 요청과 직렬화하고 성공 전 서버 목록을 덮어쓰지 않는다", async (t) => {
  const { calls, store } = await ready(t);
  const added = store.toggle(1);
  const refreshed = store.refresh();
  assert.equal(calls.length, 2);
  assert.equal(store.getSnapshot().loading, true);
  calls[1].reply(item(1));
  await added;
  assert.equal(calls[2].method, "GET");
  assert.deepEqual(store.getSnapshot().items, [item(1)]);
  calls[2].reply(page([item(1), item(2)]));
  await refreshed;
  assert.deepEqual(store.getSnapshot().items, [item(2), item(1)]);
});

test("로그아웃 후 늦은 응답을 무시하고 StrictMode 재시작 시 새 조회를 유지한다", async (t) => {
  const { calls, store } = await ready(t, [item(1)]);
  const cancelled = assert.rejects(store.toggle(2), { name: "AbortError" });
  const queued = assert.rejects(store.toggle(3), { name: "AbortError" });
  store.stop();
  await Promise.all([cancelled, queued]);
  assert.equal(calls[1].signal.aborted, true);
  assert.equal(store.getSnapshot().wishedIds.size, 0);
  assert.deepEqual(store.getSnapshot().items, []);
  store.start();
  calls[2].reply(page([item(4)]));
  await tick();
  calls[1].reply(item(2));
  await tick();
  assert.deepEqual(store.getSnapshot().items, [item(4)]);
  assert.equal(calls.length, 3);
});

test("이전 계정의 늦은 페이지 응답은 다음 페이지 요청도 시작하지 않는다", async (t) => {
  const calls = network(t);
  const oldUser = createWishlistStore(true);
  const guest = createWishlistStore(false);
  const nextUser = createWishlistStore(true);
  t.after(() => nextUser.stop());
  oldUser.start();
  oldUser.stop();
  guest.start();
  nextUser.start();
  calls[1].reply(page([item(3)]));
  calls[0].reply(page([item(1)], 1, 4));
  await tick();
  assert.equal(calls.length, 2);
  assert.deepEqual(oldUser.getSnapshot().items, []);
  assert.deepEqual(guest.getSnapshot().items, []);
  assert.deepEqual(nextUser.getSnapshot().items, [item(3)]);
});
