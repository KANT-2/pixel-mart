import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import http from "node:http";
import { test } from "node:test";
import ts from "typescript";

// 새 테스트 런타임 없이 프로젝트의 TypeScript로 공통 API 모듈을 검증합니다.
const source = await readFile(new URL("../lib/api.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { api, ApiError, serverFetch } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("클라이언트 메서드, JSON 본문, 상대 경로, 쿠키", async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return new Response('{"ok":true}');
  };
  try {
    for (const method of ["get", "post", "patch", "put", "delete"]) {
      const result = await api[method]("/api/example", ...(["get", "delete"].includes(method) ? [] : [{ value: "한글" }]));
      assert.equal(result.ok, true);
    }
    assert.deepEqual(calls.map(({ init }) => init.method), ["GET", "POST", "PATCH", "PUT", "DELETE"]);
    assert.ok(calls.every(({ url, init }) => url === "/api/example" && init.credentials === "same-origin"));
    assert.equal(calls[1].init.body, '{"value":"한글"}');
    assert.equal(calls[1].init.headers.get("Content-Type"), "application/json");
  } finally { globalThis.fetch = original; }
});

test("에러 상태·detail, 401, 비 JSON 에러와 빈 성공 응답", async () => {
  const original = globalThis.fetch;
  try {
    for (const [status, body, message] of [
      [404, '{"detail":"상품을 찾을 수 없습니다."}', "상품을 찾을 수 없습니다."],
      [401, '{"detail":"Unauthorized"}', "로그인이 필요합니다"],
      [422, '{"detail":[{"msg":"필수 입력입니다"}]}', "필수 입력입니다"],
      [500, "<html>error</html>", "요청을 처리하지 못했습니다"],
      [200, "not json", "서버 응답을 읽을 수 없습니다"],
    ]) {
      globalThis.fetch = async () => new Response(body, { status });
      await assert.rejects(api.get("/example"), (error) => error instanceof ApiError && error.status === status && error.message === message);
    }
    globalThis.fetch = async () => new Response(null, { status: 204 });
    assert.equal(await api.delete("/example"), undefined);
  } finally { globalThis.fetch = original; }
});

test("서버 URL, 캐시 비활성화, 호출자 취소 신호 유지", async () => {
  const original = globalThis.fetch;
  const previous = process.env.BACKEND_URL;
  const controller = new AbortController();
  process.env.BACKEND_URL = "http://localhost:8765/";
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "http://localhost:8765/api/products");
    assert.equal(init.cache, "no-store");
    controller.abort();
    assert.equal(init.signal.aborted, true);
    return new Response("[]");
  };
  try { await serverFetch("/products", { signal: controller.signal }); }
  finally {
    globalThis.fetch = original;
    if (previous === undefined) delete process.env.BACKEND_URL;
    else process.env.BACKEND_URL = previous;
  }
});

test("서버 무응답은 약 3초 후 중단", async () => {
  const server = http.createServer(() => {});
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const previous = process.env.BACKEND_URL;
  process.env.BACKEND_URL = `http://127.0.0.1:${server.address().port}`;
  const start = performance.now();
  try {
    await assert.rejects(serverFetch("/products"), (error) => error.name === "TimeoutError");
    const elapsed = performance.now() - start;
    assert.ok(elapsed >= 2800 && elapsed < 5000, `elapsed: ${elapsed}`);
  } finally {
    if (previous === undefined) delete process.env.BACKEND_URL;
    else process.env.BACKEND_URL = previous;
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
