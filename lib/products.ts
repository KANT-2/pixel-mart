import { cache } from "react";
import { categories } from "@/data/categories";
import { products } from "@/data/products";
import { ApiError, serverFetch } from "@/lib/api";
import type { ApiCategory, ApiProduct, Page } from "@/types/api";
import { normalizeProductQuery, productQueryParams, type ProductQuery } from "@/utils/productQuery";

export const PAGE_SIZE = 12;

interface ProductResult<T> {
  data: T;
  fallback: boolean;
}

const fallbackProducts: ApiProduct[] = products.map((product) => ({
  ...product,
  categorySlug: categories.find((category) => category.name === product.category)!.slug,
  isNew: product.isNew ?? false,
}));

export const getCategories = cache(async (): Promise<ProductResult<ApiCategory[]>> => {
  try {
    return { data: await serverFetch<ApiCategory[]>("/categories"), fallback: false };
  } catch {
    return { data: categories, fallback: true };
  }
});

export async function getProducts(options: Partial<ProductQuery> & { size?: number } = {}): Promise<ProductResult<Page<ApiProduct>>> {
  const query = normalizeProductQuery(productQueryParams(options));
  const requested = query.page;
  const requestedSize = options.size ?? PAGE_SIZE;
  const size = Number.isInteger(requestedSize) && requestedSize >= 1 && requestedSize <= 60 ? requestedSize : PAGE_SIZE;
  const params = productQueryParams(query);
  params.delete("new");
  if (query.new) params.set("isNew", "true");
  params.set("page", String(requested));
  params.set("size", String(size));
  params.set("sort", query.sort);
  try {
    let data = await serverFetch<Page<ApiProduct>>(`/products?${params}`);
    if (requested > data.totalPages) {
      params.set("page", String(Math.max(1, data.totalPages)));
      data = await serverFetch<Page<ApiProduct>>(`/products?${params}`);
    }
    return { data, fallback: false };
  } catch {
    const keyword = query.q?.toLowerCase();
    const filtered = fallbackProducts.filter((product) =>
      (!query.category || product.categorySlug === query.category)
      && (!keyword || product.name.toLowerCase().includes(keyword) || product.description.toLowerCase().includes(keyword))
      && (query.minPrice === undefined || product.price >= query.minPrice)
      && (query.maxPrice === undefined || product.price <= query.maxPrice)
      && (!query.new || product.isNew),
    );
    filtered.sort((a, b) => {
      if (query.sort === "new") return Number(b.isNew) - Number(a.isNew) || b.id - a.id;
      if (query.sort === "price_asc") return a.price - b.price || a.id - b.id;
      if (query.sort === "price_desc") return b.price - a.price || a.id - b.id;
      // 정적 데이터에는 전체 찜 개수가 없어 인기순도 기본순으로 표시합니다.
      return a.id - b.id;
    });
    const totalPages = Math.max(1, Math.ceil(filtered.length / size));
    const current = Math.min(requested, totalPages);
    return {
      data: { items: filtered.slice((current - 1) * size, current * size), total: filtered.length, page: current, size, totalPages },
      fallback: true,
    };
  }
}

export const getProduct = cache(async (id: string): Promise<ProductResult<ApiProduct | undefined>> => {
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) < 1) return { data: undefined, fallback: false };
  try {
    return { data: await serverFetch<ApiProduct>(`/products/${Number(id)}`), fallback: false };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return { data: undefined, fallback: false };
    return { data: fallbackProducts.find((product) => product.id === Number(id)), fallback: true };
  }
});

export async function getProductParams() {
  try {
    const first = await serverFetch<Page<ApiProduct>>("/products?sort=id&page=1&size=60");
    const items = [...first.items];
    for (let page = 2; page <= first.totalPages; page++) {
      const next = await serverFetch<Page<ApiProduct>>(`/products?sort=id&page=${page}&size=60`);
      items.push(...next.items);
    }
    if (items.length) return items.map((product) => ({ id: String(product.id) }));
  } catch {
    // 빌드 환경에 백엔드가 없어도 상세 경로를 생성합니다.
  }
  return products.map((product) => ({ id: String(product.id) }));
}
