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
const productModule = await moduleUrl("../lib/products.ts", {
  react: pathToFileURL(require.resolve("react")).href,
  "@/data/categories": await moduleUrl("../data/categories.ts"),
  "@/data/products": await moduleUrl("../data/products.ts"),
  "@/lib/api": await moduleUrl("../lib/api.ts"),
});
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
    const result = await getProducts(undefined, 999);
    assert.deepEqual(pages, [999, 1]);
    assert.equal(result.fallback, false);
    assert.deepEqual(result.data.items, []);
  });
});

test("장애 때 카테고리·페이지 폴백, 복구 후 다시 API 사용", async () => {
  await withFetch(async () => { throw new TypeError("offline"); }, async () => {
    const result = await getProducts("keycap", 999);
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
