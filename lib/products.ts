import { cache } from "react";
import { categories } from "@/data/categories";
import { products } from "@/data/products";
import { ApiError, serverFetch } from "@/lib/api";
import type { ApiCategory, ApiProduct, Page } from "@/types/api";

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

export async function getProducts(category?: string, page = 1, size = PAGE_SIZE): Promise<ProductResult<Page<ApiProduct>>> {
  const requested = Number.isSafeInteger(page) && page > 0 ? page : 1;
  const params = new URLSearchParams({ page: String(requested), size: String(size), sort: "id" });
  if (category) params.set("category", category);
  try {
    let data = await serverFetch<Page<ApiProduct>>(`/products?${params}`);
    if (requested > data.totalPages) {
      params.set("page", String(Math.max(1, data.totalPages)));
      data = await serverFetch<Page<ApiProduct>>(`/products?${params}`);
    }
    return { data, fallback: false };
  } catch {
    const filtered = category ? fallbackProducts.filter((product) => product.categorySlug === category) : fallbackProducts;
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
