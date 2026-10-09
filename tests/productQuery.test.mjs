import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../utils/productQuery.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { normalizeProductQuery, productQueryParams, productHref, changeProductQuery, PRODUCT_MAX_PRICE } = await import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);

test("기본값·빈 검색어는 URL에서 생략하고 최대 가격 0은 유지", () => {
  const query = normalizeProductQuery({ q: "   ", sort: "id", page: "1", minPrice: "0", new: "0" });
  assert.deepEqual(query, { sort: "id", page: 1 });
  assert.equal(productHref(query), "/products");
  assert.equal(productHref({ ...query, maxPrice: 0 }), "/products?maxPrice=0");
  assert.equal(productHref({ ...query, category: "keycap", page: 2 }), "/products?category=keycap&page=2");
});

test("중복 키는 첫 값, 검색어는 공백 제거 후 최대 50글자", () => {
  const input = new URLSearchParams("q=HP_%25&q=ignored&sort=new&sort=popular&page=2&page=3");
  assert.deepEqual(normalizeProductQuery(input), { q: "HP_%", sort: "new", page: 2 });
  assert.deepEqual(normalizeProductQuery({ q: [" HP_% ", "ignored"], sort: ["new", "popular"], page: ["2", "3"] }), normalizeProductQuery(input));
  const q = normalizeProductQuery({ q: ` ${"가😀".repeat(30)} ` }).q;
  assert.equal([...q].length, 50);
  assert.equal(q, "가😀".repeat(25));
  const clipped = normalizeProductQuery({ q: `${"a".repeat(49)} trailing` });
  assert.deepEqual(normalizeProductQuery(productQueryParams(clipped)), clipped);
  assert.equal(normalizeProductQuery({ q: ["", "ignore"] }).q, undefined);
});

test("잘못된 정렬·가격·페이지·NEW 값은 서버로 보내기 전에 제외", () => {
  for (const value of ["-1", "a", "1.2", "1e3", "+1", " 1", "Infinity", "9007199254740992"]) {
    const query = normalizeProductQuery({ minPrice: value, maxPrice: value, page: value, sort: "unknown", new: "true" });
    assert.deepEqual(query, { sort: "id", page: 1 }, value);
  }
  assert.equal(normalizeProductQuery({ page: "0" }).page, 1);
  assert.equal(normalizeProductQuery({ minPrice: String(PRODUCT_MAX_PRICE + 1) }).minPrice, undefined);
  assert.equal(normalizeProductQuery({ maxPrice: String(PRODUCT_MAX_PRICE) }).maxPrice, PRODUCT_MAX_PRICE);
  assert.equal(normalizeProductQuery({ new: "1" }).new, true);
});

test("가격 역전은 교정하고 단일 카테고리만 허용", () => {
  const query = normalizeProductQuery({ minPrice: "030000", maxPrice: "010000", category: "keycap" }, ["keycap"]);
  assert.deepEqual(query, { sort: "id", page: 1, category: "keycap", minPrice: 10000, maxPrice: 30000 });
  for (const category of ["keycap,goods", "../keycap", "키캡", " keycap", "a".repeat(201)]) {
    assert.equal(normalizeProductQuery({ category }).category, undefined);
  }
  assert.equal(normalizeProductQuery({ category: "unknown" }, ["keycap"]).category, undefined);
});

test("URL 왕복 시 조건 보존, 필터 변경·해제는 항상 페이지 1", () => {
  const query = normalizeProductQuery({ q: "키캡 & HP", category: "keycap", sort: "price_asc", minPrice: "10000", maxPrice: "30000", new: "1", page: "3" });
  assert.deepEqual(normalizeProductQuery(productQueryParams(query)), query);
  assert.deepEqual(changeProductQuery(query, { category: "goods" }), { ...query, category: "goods", page: 1 });
  const cleared = changeProductQuery(query, { q: undefined, minPrice: undefined });
  assert.equal(cleared.q, undefined);
  assert.equal(cleared.minPrice, undefined);
  assert.equal(cleared.maxPrice, 30000);
  assert.equal(cleared.page, 1);
  assert.equal(query.page, 3);
  assert.equal(productHref(changeProductQuery(query, { q: undefined, category: undefined, sort: "id", minPrice: undefined, maxPrice: undefined, new: undefined })), "/products");
});
