import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../utils/safeNextPath.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { safeNextPath } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("정상 내부 경로·쿼리·해시 유지", () => {
  for (const path of ["/", "/products/1", "/products?category=keycap&page=2#items", "/mypage", "/products?q=%ED%82%A4%EC%BA%A1", "/products?ref=https%3A%2F%2Fexample.com"]) {
    assert.equal(safeNextPath(path), path);
  }
});

test("외부 주소·프로토콜·비문자열·제어문자 거부", () => {
  for (const path of [undefined, null, [], 1, "", "products", "https://example.com", "//example.com", "javascript:alert(1)", "/\\example.com", "/\n/example.com", "/%2fexample.com", "/%5cexample.com", "/%252fexample.com", "/%0a/example.com", "/bad%xx", " /products"]) {
    assert.equal(safeNextPath(path), "/", String(path));
  }
});

test("API 경로·인코딩 및 상위 경로 우회 거부", () => {
  for (const path of ["/api", "/api/", "/api/auth/logout", "/api/auth/google/login?next=/", "/%61pi/auth/me", "/%2561pi/auth/me", "/products/../api/auth/me", "/products/%2e%2e/api/auth/me", "/API/auth/me"]) {
    assert.equal(safeNextPath(path), "/", path);
  }
  assert.equal(safeNextPath("/apiary"), "/apiary");
});

test("로그인 페이지로 돌아가는 반복 이동 방지", () => {
  for (const path of ["/login", "/login/", "/login?next=/login", "/%6cogin", "/products/../login"]) assert.equal(safeNextPath(path), "/");
});
