import type { Rarity } from "@/utils/gameItem";

export type ProductSort = "id" | "new" | "price_asc" | "price_desc" | "popular";

export interface ProductQuery {
  q?: string;
  category?: string;
  sort: ProductSort;
  minPrice?: number;
  maxPrice?: number;
  new?: true;
  /** 아이템 등급 (가격대) — 여러 개 고르면 그중 하나라도 맞는 상품, 순서는 낮은 등급부터 */
  rarity?: Rarity[];
  page: number;
}

export const PRODUCT_MAX_PRICE = 2_147_483_647;
const sorts: readonly string[] = ["id", "new", "price_asc", "price_desc", "popular"];
// utils/gameItem의 등급 키와 같은 값 (이 파일은 테스트에서 단독으로 불러 쓰므로 값은 따로 둔다)
const rarities: readonly string[] = ["common", "rare", "epic", "unique"];
type QueryInput = URLSearchParams | Record<string, string | string[] | undefined>;

function first(input: QueryInput, key: string): string | undefined {
  const value = input instanceof URLSearchParams ? input.get(key) ?? undefined : input[key];
  return Array.isArray(value) ? value[0] : value;
}

function integer(value: string | undefined, maximum = Number.MAX_SAFE_INTEGER): number | undefined {
  if (value === undefined || !/^\d+$/.test(value)) return undefined;
  const number = Number(value);
  return Number.isSafeInteger(number) && number <= maximum ? number : undefined;
}

export function normalizeProductQuery(input: QueryInput, categorySlugs?: readonly string[]): ProductQuery {
  const q = [...(first(input, "q") ?? "").trim()].slice(0, 50).join("").trimEnd();
  const category = first(input, "category");
  const sort = first(input, "sort");
  let minPrice = integer(first(input, "minPrice"), PRODUCT_MAX_PRICE);
  let maxPrice = integer(first(input, "maxPrice"), PRODUCT_MAX_PRICE);
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    [minPrice, maxPrice] = [maxPrice, minPrice];
  }
  const query: ProductQuery = {
    sort: sorts.includes(sort ?? "") ? sort as ProductSort : "id",
    page: integer(first(input, "page")) || 1,
  };
  if (q) query.q = q;
  if (category && category.length <= 200 && /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(category)
    && (!categorySlugs || categorySlugs.includes(category))) query.category = category;
  if (minPrice !== undefined && minPrice > 0) query.minPrice = minPrice;
  if (maxPrice !== undefined) query.maxPrice = maxPrice;
  if (first(input, "new") === "1") query.new = true;
  const picked = new Set((first(input, "rarity") ?? "").split(","));
  const rarity = rarities.filter((key) => picked.has(key)) as Rarity[];
  if (rarity.length) query.rarity = rarity;
  return query;
}

function queryInput(query: Partial<ProductQuery>): Record<string, string | undefined> {
  return {
    q: query.q,
    category: query.category,
    sort: query.sort,
    minPrice: query.minPrice === undefined ? undefined : String(query.minPrice),
    maxPrice: query.maxPrice === undefined ? undefined : String(query.maxPrice),
    new: query.new ? "1" : undefined,
    rarity: query.rarity?.join(","),
    page: query.page === undefined ? undefined : String(query.page),
  };
}

export function productQueryParams(query: Partial<ProductQuery>): URLSearchParams {
  const normalized = normalizeProductQuery(queryInput(query));
  const params = new URLSearchParams();
  if (normalized.q) params.set("q", normalized.q);
  if (normalized.category) params.set("category", normalized.category);
  if (normalized.sort !== "id") params.set("sort", normalized.sort);
  if (normalized.minPrice !== undefined) params.set("minPrice", String(normalized.minPrice));
  if (normalized.maxPrice !== undefined) params.set("maxPrice", String(normalized.maxPrice));
  if (normalized.new) params.set("new", "1");
  if (normalized.rarity) params.set("rarity", normalized.rarity.join(","));
  if (normalized.page !== 1) params.set("page", String(normalized.page));
  return params;
}

export function productHref(query: Partial<ProductQuery>): string {
  const params = productQueryParams(query).toString();
  return params ? `/products?${params}` : "/products";
}

/** 등급 하나를 켜고 끄기 (다시 누르면 해제, 여러 개 동시에) */
export function toggleRarity(current: readonly Rarity[] | undefined, key: Rarity): Rarity[] | undefined {
  const set = new Set(current ?? []);
  if (set.has(key)) set.delete(key);
  else set.add(key);
  const next = rarities.filter((item) => set.has(item as Rarity)) as Rarity[];
  return next.length ? next : undefined;
}

export function changeProductQuery(query: ProductQuery, patch: Partial<ProductQuery>): ProductQuery {
  return normalizeProductQuery(queryInput({ ...query, ...patch, page: 1 }));
}
