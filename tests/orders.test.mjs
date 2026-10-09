import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

async function moduleUrl(path, dependencies = {}) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  let output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  for (const [specifier, replacement] of Object.entries(dependencies)) output = output.replaceAll(`"${specifier}"`, JSON.stringify(replacement));
  return `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`;
}

const apiModule = await moduleUrl("../lib/api.ts");
const { ApiError } = await import(apiModule);
const { ordersApi } = await import(await moduleUrl("../lib/orders.ts", { "@/lib/api": apiModule }));
const { createOrderResource } = await import(await moduleUrl("../lib/orderResource.ts", { "@/lib/api": apiModule }));
const { DELIVERY_STEPS, getDeliverySteps, canCancelOrder, canAdvanceOrder, validateOrderForm, validateCancelReason, parseOrderId, parseOrderPage } = await import(await moduleUrl("../utils/orders.ts"));
const { formatDate } = await import(await moduleUrl("../utils/formatDate.ts"));

test("주문 받는 사람·주소를 trim하고 공백·길이를 각각 검증", () => {
  assert.deepEqual(validateOrderForm("  픽셀 유저 \n", "\t서울시 픽셀로 42  "), {
    values: { recipientName: "픽셀 유저", address: "서울시 픽셀로 42" }, errors: {}, valid: true,
  });
  const blank = validateOrderForm(" \n\t", "　");
  assert.equal(blank.valid, false);
  assert.ok(blank.errors.recipientName);
  assert.ok(blank.errors.address);
  assert.equal(validateOrderForm("김".repeat(50), "가".repeat(200)).valid, true);
  assert.equal(validateOrderForm("  " + "김".repeat(50), "가".repeat(200) + "  ").valid, true);
  const long = validateOrderForm("김".repeat(51), "가".repeat(201));
  assert.equal(long.valid, false);
  assert.match(long.errors.recipientName, /50/);
  assert.match(long.errors.address, /200/);
  assert.equal(validateOrderForm("😀".repeat(50), "😀".repeat(200)).valid, true);
});

test("취소 사유는 trim 후 1~200자를 허용하고 원문 내부 줄바꿈 유지", () => {
  assert.deepEqual(validateCancelReason("  사유\n둘째 줄 \n"), { value: "사유\n둘째 줄", error: null });
  for (const reason of ["", " \t\n ", "가".repeat(201)]) assert.ok(validateCancelReason(reason).error);
  for (const reason of ["가", "가".repeat(200), "😀".repeat(200)]) assert.equal(validateCancelReason(reason).error, null);
});

test("배송 4단계 상수는 backend STATUS_LABELS와 일치하고 취소 라벨을 포함하지 않음", async () => {
  const source = await readFile(new URL("../backend/app/schemas/order.py", import.meta.url), "utf8");
  const match = source.match(/STATUS_LABELS\s*=\s*(\{[^}]+\})/);
  assert.ok(match, "백엔드 STATUS_LABELS 정의가 있어야 합니다");
  const labels = JSON.parse(match[1].replace(/,\s*}/, "}"));
  assert.deepEqual(DELIVERY_STEPS.map((step) => step.status), ["paid", "preparing", "shipping", "delivered"]);
  for (const step of DELIVERY_STEPS) assert.equal(step.label, labels[step.status]);
});

test("진행 바는 현재 단계까지 표시하고 도달한 서버 라벨·미도달 상수를 사용", () => {
  const order = { status: "preparing", timeline: [
    { status: "paid", label: "서버 주문 완료" },
    { status: "preparing", label: "첫 준비 기록" },
    { status: "cancel_requested", label: "서버 취소 요청" },
    { status: "preparing", label: "서버 준비 복귀" },
  ] };
  const before = JSON.stringify(order);
  assert.deepEqual(getDeliverySteps(order), [
    { status: "paid", label: "서버 주문 완료", reached: true, current: false },
    { status: "preparing", label: "서버 준비 복귀", reached: true, current: true },
    { status: "shipping", label: "배송중", reached: false, current: false },
    { status: "delivered", label: "배송 완료", reached: false, current: false },
  ]);
  assert.equal(JSON.stringify(order), before);
  for (const [index, step] of DELIVERY_STEPS.entries()) {
    const steps = getDeliverySteps({ status: step.status, timeline: [] });
    assert.equal(steps.filter((item) => item.reached).length, index + 1);
    assert.equal(steps.find((item) => item.current).status, step.status);
  }
});

test("취소 상태에서는 배송 진행 바를 숨기고 취소·개발 진행 가능 상태를 제한", () => {
  for (const status of ["cancel_requested", "cancelled"]) assert.deepEqual(getDeliverySteps({ status, timeline: [] }), []);
  for (const status of ["paid", "preparing", "shipping", "delivered", "cancel_requested", "cancelled", "unknown"]) {
    assert.equal(canCancelOrder(status), ["paid", "preparing"].includes(status), status);
    assert.equal(canAdvanceOrder(status), ["paid", "preparing", "shipping"].includes(status), status);
  }
});

test("주문 ID·페이지는 안전한 양의 정수만 허용하며 잘못된 페이지는 1", () => {
  for (const value of ["1", "42", String(Number.MAX_SAFE_INTEGER)]) assert.equal(parseOrderId(value), Number(value));
  for (const value of ["", "0", "01", "-2", "1.5", " 1", "1 ", "1\n", "1e2", "Infinity", "9007199254740992"]) {
    assert.equal(parseOrderId(value), null, value);
    assert.equal(parseOrderPage(value), 1, value);
  }
  assert.equal(parseOrderPage("2"), 2);
  for (const value of [undefined, null, 2, ["2"], { page: "2" }]) assert.equal(parseOrderPage(value), 1);
});

test("UTC 주문 시각을 로컬 YYYY.MM.DD HH:mm으로 표시하고 잘못된 날짜는 -", () => {
  const originalTimezone = process.env.TZ;
  try {
    process.env.TZ = "UTC";
    assert.equal(formatDate("2026-12-31T18:04:05Z"), "2026.12.31 18:04");
    process.env.TZ = "Asia/Seoul";
    assert.equal(formatDate("2026-12-31T18:04:05Z"), "2027.01.01 03:04");
    assert.equal(formatDate("2027-01-01T03:04:05+09:00"), "2027.01.01 03:04");
    assert.equal(formatDate(""), "-");
    assert.equal(formatDate("not-a-date"), "-");
  } finally {
    if (originalTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
  }
});

test("주문 API는 수령 정보만 전송하고 서버 상품·금액 응답을 그대로 반환", async (t) => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  const serverOrder = { id: 42, status: "paid", totalPrice: 98765, items: [{ product: { id: 17 }, quantity: 3, unitPrice: 32921, subtotal: 98763 }] };
  globalThis.fetch = async (url, init) => {
    calls.push({ url, ...init, body: init.body ? JSON.parse(init.body) : undefined });
    return new Response(JSON.stringify(serverOrder));
  };
  t.after(() => { globalThis.fetch = originalFetch; });
  const controller = new AbortController();
  assert.deepEqual(await ordersApi.create({ recipientName: "수령인", address: "주소", items: [{ productId: 1 }], totalPrice: 1000 }, controller.signal), serverOrder);
  await ordersApi.list(2, controller.signal);
  await ordersApi.detail(42, controller.signal);
  await ordersApi.cancel(42, "취소 사유", controller.signal);
  await ordersApi.advance(42, controller.signal);
  assert.deepEqual(calls.map(({ url, method, body }) => ({ url, method, body })), [
    { url: "/api/orders", method: "POST", body: { recipientName: "수령인", address: "주소" } },
    { url: "/api/orders?page=2&size=10", method: "GET", body: undefined },
    { url: "/api/orders/42", method: "GET", body: undefined },
    { url: "/api/orders/42/cancel-requests", method: "POST", body: { reason: "취소 사유" } },
    { url: "/api/dev/orders/42/advance", method: "POST", body: undefined },
  ]);
  for (const call of calls) {
    assert.equal(call.credentials, "same-origin");
    assert.equal(call.cache, "no-store");
    assert.equal(call.signal.aborted, false);
  }
  controller.abort();
  for (const call of calls) assert.equal(call.signal.aborted, true);
});

const tick = () => new Promise((resolve) => setImmediate(resolve));
function resource(t) {
  const calls = [];
  const store = createOrderResource((signal) => new Promise((resolve, reject) => calls.push({ signal, resolve, reject })));
  t.after(() => store.stop());
  return { store, calls };
}

test("주문 조회는 시작 시 한 번 실행하고 스냅샷·구독을 갱신", async (t) => {
  const { store, calls } = resource(t);
  let notifications = 0;
  const unsubscribe = store.subscribe(() => notifications++);
  assert.deepEqual(store.getSnapshot(), { data: null, loading: true, error: null, errorStatus: null });
  store.start();
  store.start();
  assert.equal(calls.length, 1);
  calls[0].resolve({ id: 1 });
  await tick();
  assert.deepEqual(store.getSnapshot(), { data: { id: 1 }, loading: false, error: null, errorStatus: null });
  assert.ok(notifications >= 2);
  unsubscribe();
  const previous = notifications;
  store.replaceData({ id: 2 });
  assert.equal(notifications, previous);
});

test("늦게 도착한 이전 주문 GET은 새 조회 응답을 덮지 않음", async (t) => {
  const { store, calls } = resource(t);
  store.start();
  const latest = store.refresh();
  assert.equal(calls[0].signal.aborted, true);
  calls[1].resolve({ id: 2 });
  assert.deepEqual(await latest, { id: 2 });
  calls[0].resolve({ id: 1 });
  await tick();
  assert.deepEqual(store.getSnapshot().data, { id: 2 });
});

test("로그아웃·화면 해제는 개인정보를 즉시 비우고 늦은 성공·실패·교체를 무시", async (t) => {
  const { store, calls } = resource(t);
  store.start();
  calls[0].resolve({ id: 1, address: "이전 계정 주소" });
  await tick();
  const pending = store.refresh();
  const cancelled = assert.rejects(pending, { name: "AbortError" });
  store.stop();
  await cancelled;
  assert.equal(calls[1].signal.aborted, true);
  assert.deepEqual(store.getSnapshot(), { data: null, loading: false, error: null, errorStatus: null });
  calls[1].resolve({ id: 2, address: "늦은 개인정보" });
  store.replaceData({ id: 3 });
  await tick();
  assert.equal(store.getSnapshot().data, null);
  await assert.rejects(store.refresh(), { name: "AbortError" });
  store.start();
  assert.equal(store.getSnapshot().loading, true);
  calls[2].reject(new ApiError("이전 응답", 404));
  store.stop();
  await tick();
  assert.deepEqual(store.getSnapshot(), { data: null, loading: false, error: null, errorStatus: null });
});

test("배송 변경 응답으로 교체하면 기존 GET을 취소해 최신 배송 상태 유지", async (t) => {
  const { store, calls } = resource(t);
  store.start();
  const pending = store.refresh();
  const cancelled = assert.rejects(pending, { name: "AbortError" });
  store.replaceData({ id: 1, status: "shipping", totalPrice: 42000 });
  await cancelled;
  for (const call of calls) {
    assert.equal(call.signal.aborted, true);
    call.resolve({ id: 1, status: "paid", totalPrice: 1000 });
  }
  await tick();
  assert.deepEqual(store.getSnapshot(), { data: { id: 1, status: "shipping", totalPrice: 42000 }, loading: false, error: null, errorStatus: null });
});

test("주문 오류 상태는 서버 404·400 메시지를 보존하고 조회 재시도만 수행", async (t) => {
  const { store, calls } = resource(t);
  store.start();
  calls[0].reject(new ApiError("주문을 찾을 수 없습니다.", 404));
  await tick();
  assert.deepEqual(store.getSnapshot(), { data: null, loading: false, error: "주문을 찾을 수 없습니다.", errorStatus: 404 });
  store.replaceData({ id: 1, status: "paid" });
  const retry = store.refresh();
  const failure = assert.rejects(retry, /서버 조회 실패/);
  calls[1].reject(new ApiError("서버 조회 실패", 400));
  await failure;
  assert.deepEqual(store.getSnapshot(), { data: { id: 1, status: "paid" }, loading: false, error: "서버 조회 실패", errorStatus: 400 });
  const recovered = store.refresh();
  calls[2].resolve({ id: 1, status: "cancel_requested" });
  await recovered;
  assert.deepEqual(store.getSnapshot(), { data: { id: 1, status: "cancel_requested" }, loading: false, error: null, errorStatus: null });
  assert.equal(calls.length, 3);
});
