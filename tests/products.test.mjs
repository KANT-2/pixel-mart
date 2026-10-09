import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
async function moduleUrl(path, replacements = {}) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  let output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  for (const [specifier, replacement] of Object.entries(replacements)) output = output.replaceAll(`"${specifier}"`, JSON.stringify(replacement));
  return `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`;
}
const dependencies = {
  react: pathToFileURL(require.resolve("react")).href,
  "@/data/categories": await moduleUrl("../data/categories.ts"),
  "@/data/products": await moduleUrl("../data/products.ts"),
  "@/lib/api": await moduleUrl("../lib/api.ts"),
  "@/utils/productQuery": await moduleUrl("../utils/productQuery.ts"),
};
const productModule = await moduleUrl("../lib/products.ts", dependencies);
const { getCategories, getProducts, getProduct, getProductParams } = await import(productModule);

async function withFetch(fetcher, run) {
  const original = globalThis.fetch;
  globalThis.fetch = fetcher;
  try { await run(); } finally { globalThis.fetch = original; }
}
const json = (data, status = 200) => new Response(JSON.stringify(data), { status });

test("API 페이지 범위 보정과 빈 목록은 정적 상품으로 대체하지 않음", async () => {
  const pages = [];
  await withFetch(async (url) => {
    const page = Number(new URL(url).searchParams.get("page"));
    pages.push(page);
    return json({ items: [], total: 0, page, size: 12, totalPages: 1 });
  }, async () => {
    const result = await getProducts({ page: 999 });
    assert.deepEqual(pages, [999, 1]);
    assert.equal(result.fallback, false);
    assert.deepEqual(result.data.items, []);
  });
});

test("장애 때 카테고리·페이지 폴백, 복구 후 다시 API 사용", async () => {
  await withFetch(async () => { throw new TypeError("offline"); }, async () => {
    const result = await getProducts({ category: "keycap", page: 999 });
    assert.equal(result.fallback, true);
    assert.equal(result.data.page, 3);
    assert.equal(result.data.items.length, 6);
    assert.ok(result.data.items.every((product) => product.categorySlug === "keycap"));
    assert.equal((await getCategories()).data.length, 6);
    assert.equal((await getProduct("1")).data.id, 1);
    assert.equal((await getProduct("999999")).data, undefined);
  });
  await withFetch(async () => json({ items: [], total: 0, page: 1, size: 12, totalPages: 1 }), async () => {
    assert.equal((await getProducts()).fallback, false);
  });
});

test("URL 조건을 API 조건으로 변환하고 잘못된 값은 요청 전에 정리", async () => {
  const queries = [];
  await withFetch(async (url) => {
    queries.push(Object.fromEntries(new URL(url).searchParams));
    return json({ items: [], total: 0, page: 1, size: 12, totalPages: 1 });
  }, async () => {
    await getProducts({ q: "  HP_%  ", category: "keycap", sort: "price_desc", minPrice: 30000, maxPrice: 10000, new: true });
    await getProducts({ q: " ", category: "keycap,goods", sort: "unknown", minPrice: -1, maxPrice: 2 ** 31, page: -2, size: 61 });
  });
  assert.deepEqual(queries, [
    { q: "HP_%", category: "keycap", sort: "price_desc", minPrice: "10000", maxPrice: "30000", isNew: "true", page: "1", size: "12" },
    { sort: "id", page: "1", size: "12" },
  ]);
});

test("메인 추천과 같은 카테고리 조회는 기존 기본순·범위 유지", async () => {
  const queries = [];
  await withFetch(async (url) => {
    queries.push(Object.fromEntries(new URL(url).searchParams));
    return json({ items: [], total: 0, page: 1, size: 12, totalPages: 1 });
  }, async () => {
    await getProducts({ size: 60 });
    await getProducts({ category: "keycap", size: 5 });
  });
  assert.deepEqual(queries, [
    { sort: "id", page: "1", size: "60" },
    { category: "keycap", sort: "id", page: "1", size: "5" },
  ]);
});

const fixture = [
  { id: 8, name: "HP 100% 키캡", price: 10000, category: "키캡", description: "One_dot 장식" },
  { id: 2, name: "hp dot_key", price: 10000, category: "키캡", description: "점 장식", isNew: true },
  { id: 7, name: "별 키캡", price: 30000, category: "키캡", description: "반짝임", isNew: true },
  { id: 1, name: "패드", price: 5000, category: "데스크매트", description: "책상 위" },
  { id: 9, name: "고급 키캡", price: 30000, category: "키캡", description: "고급 소재" },
  { id: 4, name: "네모 키캡", price: 10000, category: "키캡", description: "네모", isNew: true },
];
const fixtureUrl = `data:text/javascript;base64,${Buffer.from(`export const products = ${JSON.stringify(fixture)}`).toString("base64")}`;
const { getProducts: getFixtureProducts } = await import(await moduleUrl("../lib/products.ts", { ...dependencies, "@/data/products": fixtureUrl }));

test("정적 검색은 이름·설명 대소문자를 무시하고 %, _는 일반 문자", async () => {
  await withFetch(async () => { throw new TypeError("offline"); }, async () => {
    for (const [q, ids] of [["HP", [2, 8]], ["one_DOT", [8]], ["%", [8]], ["_", [2, 8]], ["없는 키워드", []]]) {
      const result = await getFixtureProducts({ q });
      assert.equal(result.fallback, true);
      assert.deepEqual(result.data.items.map((item) => item.id), ids, q);
    }
  });
});

test("정적 가격·NEW·카테고리 조건을 함께 적용한 뒤 페이지 처리", async () => {
  await withFetch(async () => { throw new TypeError("offline"); }, async () => {
    const result = await getFixtureProducts({ category: "keycap", minPrice: 10000, maxPrice: 10000, new: true, size: 1, page: 8 });
    assert.deepEqual({ ...result.data, items: result.data.items.map((item) => item.id) }, {
      items: [4], total: 2, page: 2, size: 1, totalPages: 2,
    });
    const zeroPrice = await getFixtureProducts({ maxPrice: 0 });
    assert.equal(zeroPrice.data.total, 0);
    assert.equal(zeroPrice.data.totalPages, 1);
  });
});

test("정적 정렬은 API의 동률 순서와 NEW 우선순위를 유지하고 인기순은 기본순", async () => {
  await withFetch(async () => { throw new TypeError("offline"); }, async () => {
    for (const [sort, ids] of [
      ["id", [1, 2, 4, 7, 8, 9]],
      ["price_asc", [1, 2, 4, 8, 7, 9]],
      ["price_desc", [7, 9, 2, 4, 8, 1]],
      ["new", [7, 4, 2, 9, 8, 1]],
      ["popular", [1, 2, 4, 7, 8, 9]],
    ]) {
      const result = await getFixtureProducts({ sort });
      assert.deepEqual(result.data.items.map((item) => item.id), ids, sort);
    }
  });
});

test("상세 API의 404는 정적 데이터에 같은 ID가 있어도 없는 상품", async () => {
  await withFetch(async () => json({ detail: "상품을 찾을 수 없습니다." }, 404), async () => {
    assert.deepEqual(await getProduct("1"), { data: undefined, fallback: false });
  });
  await withFetch(async () => { assert.fail("잘못된 ID로 API 호출"); }, async () => {
    for (const id of ["abc", "-1", "1.5", "0"]) assert.equal((await getProduct(id)).data, undefined);
  });
});

test("빌드 경로는 API 전체 페이지를 사용하고 장애·빈 API에는 정적 ID 사용", async () => {
  await withFetch(async (url) => {
    const page = Number(new URL(url).searchParams.get("page"));
    return json({ items: [{ id: page + 1000 }], total: 2, page, size: 60, totalPages: 2 });
  }, async () => {
    assert.deepEqual(await getProductParams(), [{ id: "1001" }, { id: "1002" }]);
  });
  for (const fetcher of [
    async () => { throw new TypeError("offline"); },
    async () => json({ items: [], total: 0, page: 1, size: 60, totalPages: 1 }),
  ]) {
    await withFetch(fetcher, async () => {
      const params = await getProductParams();
      assert.equal(params.length, 180);
      assert.deepEqual(params[0], { id: "1" });
    });
  }
});
