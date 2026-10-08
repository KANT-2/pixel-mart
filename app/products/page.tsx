import type { Metadata } from "next";
import { Suspense } from "react";
import CategoryTabs from "@/components/CategoryTabs";
import Pagination from "@/components/Pagination";
import ProductCard from "@/components/ProductCard";
import { getCategories, getProducts, PAGE_SIZE } from "@/lib/products";
import { EmptyProducts, ProductFallbackNotice, ProductSkeleton } from "@/components/products/ProductStates";

export const metadata: Metadata = {
  title: "전체 상품 | PIXEL MART",
};

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

// Next 16 + Cache Components: searchParams(?category=&page=)는 요청할 때 정해지는 값이라
// 읽는 부분을 <Suspense> 안으로 내려야 나머지 화면을 미리 만들어 둘 수 있습니다.
export default function ProductsPage({ searchParams }: PageProps<"/products">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:px-8">
      <Suspense fallback={<ProductSkeleton count={PAGE_SIZE} />}>
        <ProductList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ProductList({ searchParams }: { searchParams: SearchParams }) {
  const { category: categoryParam, page: pageParam } = await searchParams;

  // 없는 카테고리 slug면 전체 상품을 보여 줌
  const categoryResult = await getCategories();
  const category = categoryResult.data.find((item) => item.slug === categoryParam);

  // page가 숫자가 아니거나 범위를 벗어나면 1 ~ 마지막 페이지 안으로 맞춤
  const result = await getProducts(category?.slug, typeof pageParam === "string" ? Number(pageParam) : 1);
  const { items: pageItems, page: currentPage, totalPages, total } = result.data;

  return (
    <>
      <header className="mb-6">
        <p className="mb-2 font-pixel text-xs tracking-widest text-mint">{category ? category.slug.toUpperCase() : "ALL ITEMS"}</p>
        <h1 className="text-3xl font-extrabold">{category ? category.name : "전체 상품"}</h1>
        <p className="mt-2 text-sm text-sub">
          {category ? `${category.description} · ` : ""}총 {total}개 · {currentPage} / {totalPages} 페이지
        </p>
      </header>

      <CategoryTabs current={category?.slug} categories={categoryResult.data} />
      {(result.fallback || categoryResult.fallback) && <ProductFallbackNotice />}
      {pageItems.length === 0 && <EmptyProducts />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {pageItems.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      <Pagination currentPage={currentPage} totalPages={totalPages} category={category?.slug} />
    </>
  );
}
