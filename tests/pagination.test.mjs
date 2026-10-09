import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = await readFile(new URL("../components/Pagination.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022, jsx: ts.JsxEmit.ReactJSX,
} }).outputText.replaceAll('"react/jsx-runtime"', JSON.stringify(pathToFileURL(require.resolve("react/jsx-runtime")).href))
  .replaceAll('"next/link"', '"data:text/javascript,export default %22test-link%22"');
const { default: Pagination } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

function links(node) {
  if (Array.isArray(node)) return node.flatMap(links);
  if (!node || typeof node !== "object") return [];
  return [...(node.props?.href ? [node.props] : []), ...links(node.props?.children)];
}

test("상품 페이지 기본 경로와 첫 페이지의 쿼리 생략을 유지한다", () => {
  const rendered = links(Pagination({ currentPage: 2, totalPages: 3 }));
  assert.deepEqual(rendered.map((link) => link.href), ["/products", "/products", "/products?page=2", "/products?page=3", "/products?page=3"]);
  assert.equal(rendered.find((link) => link["aria-current"] === "page").href, "/products?page=2");
  assert.equal(Pagination({ currentPage: 1, totalPages: 1 }), null);
});

test("상품 카테고리 쿼리·이전/다음 링크를 그대로 유지한다", () => {
  const rendered = links(Pagination({ currentPage: 2, totalPages: 3, category: "keycap" }));
  assert.deepEqual(rendered.map((link) => link.href), [
    "/products?category=keycap", "/products?category=keycap", "/products?category=keycap&page=2",
    "/products?category=keycap&page=3", "/products?category=keycap&page=3",
  ]);
  assert.equal(rendered.find((link) => link["aria-label"] === "이전 페이지").href, "/products?category=keycap");
  assert.equal(rendered.find((link) => link["aria-label"] === "다음 페이지").href, "/products?category=keycap&page=3");
});

test("찜 페이지는 지정한 경로에만 페이지 쿼리를 붙인다", () => {
  const rendered = links(Pagination({ currentPage: 1, totalPages: 2, basePath: "/mypage/wishlist" }));
  assert.deepEqual(rendered.map((link) => link.href), ["/mypage/wishlist", "/mypage/wishlist?page=2", "/mypage/wishlist?page=2"]);
});

test("검색·정렬·가격·NEW 조건을 유지하고 page만 교체한다", () => {
  const query = "q=%ED%82%A4%EC%BA%A1&category=keycap&sort=price_asc&minPrice=1000&maxPrice=30000&new=1&page=2";
  const rendered = links(Pagination({ currentPage: 2, totalPages: 3, query }));
  for (const link of rendered) {
    const url = new URL(link.href, "http://localhost");
    assert.equal(url.pathname, "/products");
    assert.equal(url.searchParams.get("q"), "키캡");
    assert.equal(url.searchParams.get("category"), "keycap");
    assert.equal(url.searchParams.get("sort"), "price_asc");
    assert.equal(url.searchParams.get("minPrice"), "1000");
    assert.equal(url.searchParams.get("maxPrice"), "30000");
    assert.equal(url.searchParams.get("new"), "1");
    assert.ok(url.searchParams.getAll("page").length <= 1);
  }
  assert.equal(new URL(rendered.find((link) => link["aria-label"] === "이전 페이지").href, "http://localhost").searchParams.has("page"), false);
  assert.equal(new URL(rendered.find((link) => link["aria-label"] === "다음 페이지").href, "http://localhost").searchParams.get("page"), "3");
});

test("별도 경로의 쿼리를 상품 필터로 해석하거나 변경하지 않는다", () => {
  const rendered = links(Pagination({ currentPage: 1, totalPages: 2, basePath: "/mypage/wishlist", query: "view=saved&page=8&page=9" }));
  assert.deepEqual(rendered.map((link) => link.href), ["/mypage/wishlist?view=saved", "/mypage/wishlist?view=saved&page=2", "/mypage/wishlist?view=saved&page=2"]);
});
