import type { Metadata } from "next";
import { Suspense } from "react";
import CategoryTabs from "@/components/CategoryTabs";
import Pagination from "@/components/Pagination";
import ProductCard from "@/components/ProductCard";
import { products } from "@/data/products";
import { PAGE_SIZE, findCategoryBySlug } from "@/utils/products";

export const metadata: Metadata = {
  title: "전체 상품 | PIXEL MART",
};

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

// Next 16 + Cache Components: searchParams(?category=&page=)는 요청할 때 정해지는 값이라
// 읽는 부분을 <Suspense> 안으로 내려야 나머지 화면을 미리 만들어 둘 수 있습니다.
export default function ProductsPage({ searchParams }: PageProps<"/products">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:px-8">
      <Suspense fallback={<ProductListSkeleton />}>
        <ProductList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ProductList({ searchParams }: { searchParams: SearchParams }) {
  const { category: categoryParam, page: pageParam } = await searchParams;

  // 없는 카테고리 slug면 전체 상품을 보여 줌
  const category = findCategoryBySlug(typeof categoryParam === "string" ? categoryParam : undefined);
  const filtered = category ? products.filter((product) => product.category === category.name) : products;

  // page가 숫자가 아니거나 범위를 벗어나면 1 ~ 마지막 페이지 안으로 맞춤
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const requested = Number(pageParam);
  const currentPage = Number.isInteger(requested) ? Math.min(Math.max(requested, 1), totalPages) : 1;
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <>
      <header className="mb-6">
        <p className="mb-2 font-pixel text-xs tracking-widest text-mint">{category ? category.slug.toUpperCase() : "ALL ITEMS"}</p>
        <h1 className="text-3xl font-extrabold">{category ? category.name : "전체 상품"}</h1>
        <p className="mt-2 text-sm text-sub">
          {category ? `${category.description} · ` : ""}총 {filtered.length}개 · {currentPage} / {totalPages} 페이지
        </p>
      </header>

      <CategoryTabs current={category?.slug} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {pageItems.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      <Pagination currentPage={currentPage} totalPages={totalPages} category={category?.slug} />
    </>
  );
}

function ProductListSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: PAGE_SIZE }, (_, index) => (
        <div key={index} className="aspect-[3/4] animate-pulse rounded-2xl bg-panel" />
      ))}
    </div>
  );
}
