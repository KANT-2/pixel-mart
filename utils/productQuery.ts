export type ProductSort = "id" | "new" | "price_asc" | "price_desc" | "popular";

export interface ProductQuery {
  q?: string;
  category?: string;
  sort: ProductSort;
  minPrice?: number;
  maxPrice?: number;
  new?: true;
  page: number;
}

export const PRODUCT_MAX_PRICE = 2_147_483_647;
const sorts: readonly string[] = ["id", "new", "price_asc", "price_desc", "popular"];
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
  if (normalized.page !== 1) params.set("page", String(normalized.page));
  return params;
}

export function productHref(query: Partial<ProductQuery>): string {
  const params = productQueryParams(query).toString();
  return params ? `/products?${params}` : "/products";
}

export function changeProductQuery(query: ProductQuery, patch: Partial<ProductQuery>): ProductQuery {
  return normalizeProductQuery(queryInput({ ...query, ...patch, page: 1 }));
}
