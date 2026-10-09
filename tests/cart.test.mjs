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
const utilsUrl = await moduleUrl("../utils/cart.ts");
const { parseQuantityInput, calculateCart, applyCartChanges } = await import(utilsUrl);
const { createCartStore } = await import(await moduleUrl("../lib/cart.ts", { "@/lib/api": apiUrl, "@/utils/cart": utilsUrl }));

function cart(...quantities) {
  return calculateCart(quantities.flatMap((quantity, index) => quantity ? [{
    product: { id: index + 1, name: `상품 ${index + 1}`, price: (index + 1) * 1000 },
    quantity,
    subtotal: 0,
    addedAt: "2026-10-09T00:00:00Z",
  }] : []));
}

async function tick() {
  await new Promise((resolve) => setImmediate(resolve));
}

function network(t) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = (url, init) => new Promise((resolve) => {
    calls.push({
      url, method: init.method, body: init.body ? JSON.parse(init.body) : undefined, signal: init.signal,
      reply(body, status = 200) { resolve(new Response(JSON.stringify(body), { status })); },
    });
  });
  t.after(() => { globalThis.fetch = original; });
  return calls;
}

async function ready(t, initial = cart(1, 2)) {
  const calls = network(t);
  const store = createCartStore(true);
  t.after(() => store.stop());
  assert.equal(store.getSnapshot().loading, true);
  store.start();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "GET");
  calls[0].reply(initial);
  await tick();
  assert.equal(store.getSnapshot().loading, false);
  assert.deepEqual(store.getSnapshot().cart, initial);
  return { calls, store };
}

test("직접 입력은 1~99 정수만 허용하고 상품의 남은 수량 한도를 적용한다", () => {
  for (const raw of ["", " ", "0", "-1", "100", "1.5", "1.0", "NaN", "Infinity", "1e1", "0x10", "1 2"]) {
    assert.equal(parseQuantityInput(raw), null, raw);
  }
  assert.equal(parseQuantityInput(" 1 "), 1);
  assert.equal(parseQuantityInput("99"), 99);
  assert.equal(parseQuantityInput("3", 2), null);
  assert.equal(parseQuantityInput("2", 2), 2);
  assert.equal(parseQuantityInput("1", 0), null);
});

test("낙관적 변경은 원본을 변경하지 않고 소계·총 수량·총 금액을 함께 계산한다", () => {
  const initial = cart(1, 2);
  const changed = applyCartChanges(initial, [{ kind: "update", productId: 1, quantity: 5 }]);
  assert.deepEqual(changed, cart(5, 2));
  assert.deepEqual(initial, cart(1, 2));
  assert.equal(changed.totalQuantity, 7);
  assert.equal(changed.totalPrice, 9000);
  assert.deepEqual(applyCartChanges(changed, [{ kind: "remove", productId: 2 }]), cart(5));
  assert.equal(applyCartChanges(null, []), null);
});

test("비로그인 스토어는 조회하지 않고 빈 상태를 유지한다", async (t) => {
  const calls = network(t);
  const store = createCartStore(false);
  store.start();
  assert.deepEqual(store.getSnapshot(), { cart: null, loading: false, error: null, pendingIds: [] });
  await assert.rejects(store.add(1, 1), /로그인이 필요합니다/);
  assert.equal(calls.length, 0);
  store.stop();
});

test("연속 클릭은 최신 미전송 수량으로 합치고 여러 상품 요청도 직렬화한다", async (t) => {
  const { store, calls } = await ready(t);
  const first = store.update(1, 2);
  const middle = store.update(1, 3);
  const last = store.update(1, 4);
  const other = store.update(2, 7);
  assert.deepEqual(store.getSnapshot().cart, cart(4, 7));
  assert.deepEqual(store.getSnapshot().pendingIds, [1, 2]);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1].body, { quantity: 2 });
  calls[1].reply(cart(2, 2));
  await first;
  await tick();
  assert.deepEqual(store.getSnapshot().cart, cart(4, 7));
  assert.deepEqual(calls[2].body, { quantity: 4 });
  calls[2].reply(cart(4, 2));
  await Promise.all([middle, last]);
  await tick();
  assert.deepEqual(calls[3].body, { quantity: 7 });
  assert.equal(calls[3].url, "/api/cart/items/2");
  calls[3].reply(cart(4, 7));
  await other;
  assert.deepEqual(store.getSnapshot().cart, cart(4, 7));
  assert.deepEqual(store.getSnapshot().pendingIds, []);
});

test("실패한 수량만 되돌리고 같은 상품의 새 입력과 다른 상품 변경은 보존한다", async (t) => {
  const { store, calls } = await ready(t);
  const first = assert.rejects(store.update(1, 3), /수량 변경 실패/);
  const latest = store.update(1, 6);
  const other = assert.rejects(store.update(2, 8), /상품 변경 실패/);
  calls[1].reply({ detail: "수량 변경 실패" }, 400);
  await first;
  await tick();
  assert.deepEqual(store.getSnapshot().cart, cart(6, 8));
  assert.equal(store.getSnapshot().error, "수량 변경 실패");
  calls[2].reply(cart(6, 2));
  await latest;
  await tick();
  assert.equal(store.getSnapshot().error, null);
  calls[3].reply({ detail: "상품 변경 실패" }, 400);
  await other;
  assert.deepEqual(store.getSnapshot().cart, cart(6, 2));
  assert.equal(store.getSnapshot().error, "상품 변경 실패");
});

test("다른 상품의 성공 응답은 앞서 실패한 상품의 오류를 지우지 않는다", async (t) => {
  const { store, calls } = await ready(t);
  const failed = assert.rejects(store.update(1, 3), /첫 상품 변경 실패/);
  const other = store.update(2, 7);
  calls[1].reply({ detail: "첫 상품 변경 실패" }, 400);
  await failed;
  await tick();
  calls[2].reply(cart(1, 7));
  await other;
  assert.deepEqual(store.getSnapshot().cart, cart(1, 7));
  assert.equal(store.getSnapshot().error, "첫 상품 변경 실패");
});

test("삭제는 미전송 수량을 취소하고 삭제 중 추가 편집을 막는다", async (t) => {
  const { store, calls } = await ready(t);
  const first = store.update(1, 2);
  const superseded = store.update(1, 9);
  const removed = store.remove(1);
  assert.deepEqual(store.getSnapshot().cart, cart(0, 2));
  await assert.rejects(store.update(1, 10), /삭제 중/);
  calls[1].reply(cart(2, 2));
  await first;
  await tick();
  assert.equal(calls[2].method, "DELETE");
  assert.equal(calls[2].url, "/api/cart/items/1");
  assert.deepEqual(store.getSnapshot().cart, cart(0, 2));
  calls[2].reply(cart(0, 2));
  await Promise.all([removed, superseded]);
  assert.equal(calls.length, 3);
  assert.deepEqual(store.getSnapshot().cart, cart(0, 2));
});

test("삭제 실패는 상품을 복원하며 뒤의 GET도 변경 요청 완료 후 실행한다", async (t) => {
  const { store, calls } = await ready(t);
  const removed = assert.rejects(store.remove(1), /삭제 실패/);
  const refreshed = store.refresh();
  assert.equal(calls.length, 2);
  calls[1].reply({ detail: "삭제 실패" }, 500);
  await removed;
  await tick();
  assert.deepEqual(store.getSnapshot().cart, cart(1, 2));
  assert.equal(calls[2].method, "GET");
  assert.equal(store.getSnapshot().loading, true);
  calls[2].reply(cart(3, 4));
  await refreshed;
  assert.deepEqual(store.getSnapshot().cart, cart(3, 4));
  assert.equal(store.getSnapshot().loading, false);
});

test("담기는 서버 전체 응답을 사용하고 합계 99 초과 오류를 그대로 표시한다", async (t) => {
  const { store, calls } = await ready(t, cart(98));
  const added = store.add(1, 1);
  assert.equal(calls[1].method, "POST");
  assert.deepEqual(calls[1].body, { productId: 1, quantity: 1 });
  calls[1].reply(cart(99));
  await added;
  const failed = assert.rejects(store.add(1, 1), /최대 99개/);
  calls[2].reply({ detail: "같은 상품은 최대 99개 담을 수 있어요" }, 400);
  await failed;
  assert.equal(store.getSnapshot().cart.totalQuantity, 99);
  assert.match(store.getSnapshot().error, /최대 99개/);
  for (const quantity of [0, 100, -1, 1.1, NaN, Infinity]) {
    await assert.rejects(store.update(1, quantity), /1~99/);
    await assert.rejects(store.add(1, quantity), /1~99/);
  }
  assert.equal(calls.length, 3);
});

test("조회 실패는 빈 장바구니로 바꾸지 않고 재시도할 수 있다", async (t) => {
  const calls = network(t);
  const store = createCartStore(true);
  t.after(() => store.stop());
  store.start();
  calls[0].reply({ detail: "잠시 후 다시 시도해 주세요" }, 503);
  await tick();
  assert.equal(store.getSnapshot().cart, null);
  assert.equal(store.getSnapshot().loading, false);
  assert.equal(store.getSnapshot().error, "잠시 후 다시 시도해 주세요");
  const retried = store.refresh();
  calls[1].reply(cart(2));
  await retried;
  assert.deepEqual(store.getSnapshot().cart, cart(2));
  assert.equal(store.getSnapshot().error, null);
});

test("stop 뒤 늦은 응답은 무시하고 StrictMode의 stop/start에서 다시 조회한다", async (t) => {
  const { store, calls } = await ready(t);
  const cancelled = assert.rejects(store.update(1, 5), { name: "AbortError" });
  const queued = assert.rejects(store.update(2, 7), { name: "AbortError" });
  store.stop();
  assert.equal(calls[1].signal.aborted, true);
  await Promise.all([cancelled, queued]);
  store.start();
  assert.equal(calls.length, 3);
  calls[2].reply(cart(3, 4));
  await tick();
  calls[1].reply(cart(5, 2));
  await tick();
  assert.deepEqual(store.getSnapshot().cart, cart(3, 4));
  assert.deepEqual(store.getSnapshot().pendingIds, []);
  assert.equal(store.getSnapshot().error, null);
});

test("인증 계정별 새 스토어는 이전 계정의 장바구니 응답을 공유하지 않는다", async (t) => {
  const calls = network(t);
  const oldUser = createCartStore(true);
  const loggedOut = createCartStore(false);
  const nextUser = createCartStore(true);
  t.after(() => nextUser.stop());
  oldUser.start();
  oldUser.stop();
  loggedOut.start();
  nextUser.start();
  calls[1].reply(cart(4));
  await tick();
  calls[0].reply(cart(9));
  await tick();
  assert.equal(loggedOut.getSnapshot().cart, null);
  assert.deepEqual(nextUser.getSnapshot().cart, cart(4));
  assert.equal(calls.length, 2);
});
