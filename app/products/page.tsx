import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import CategoryTabs from "@/components/CategoryTabs";
import Pagination from "@/components/Pagination";
import ProductCard from "@/components/ProductCard";
import ProductFilters from "@/components/ProductFilters";
import { getCategories, getProducts, PAGE_SIZE } from "@/lib/products";
import { ProductFallbackNotice, ProductSkeleton } from "@/components/products/ProductStates";
import { normalizeProductQuery, productHref, productQueryParams, type ProductQuery } from "@/utils/productQuery";

export const metadata: Metadata = { title: "전체 상품 | PIXEL MART" };

type QueryInput = Record<string, string | string[] | undefined>;

interface ProductQueryProps {
  searchParams: Promise<QueryInput>;
}

interface ProductResultsProps {
  query: ProductQuery;
  raw: QueryInput;
}

export default function ProductsPage({ searchParams }: PageProps<"/products">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:px-8">
      <Suspense fallback={<ProductSkeleton count={PAGE_SIZE} />}>
        <ProductQueryBoundary searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ProductQueryBoundary({ searchParams }: ProductQueryProps) {
  const raw = await searchParams;
  const query = normalizeProductQuery(raw);
  // 조건을 바꿔도 경계를 새로 만들지 않아, 새 결과가 준비될 때까지 지금 화면을 두었다가 한 번에 바꿉니다 (깜빡임 없음).
  return (
    <Suspense fallback={<ProductSkeleton count={PAGE_SIZE} />}>
      <ProductResults query={query} raw={raw} />
    </Suspense>
  );
}

async function ProductResults({ query: requestedQuery, raw }: ProductResultsProps) {
  const categoryResult = await getCategories();
  const query = normalizeProductQuery(productQueryParams(requestedQuery), categoryResult.data.map((item) => item.slug));
  const category = categoryResult.data.find((item) => item.slug === query.category);
  const result = await getProducts(query);
  const { items, page, totalPages, total } = result.data;
  const currentQuery = { ...query, page };
  const canonical = productQueryParams(currentQuery);
  // 공유된 잘못된 URL도 화면과 같은 조건으로 정리합니다. 키 순서는 비교하지 않습니다.
  if (Object.keys(raw).length !== canonical.size || Object.entries(raw).some(([key, value]) => value !== canonical.get(key))) {
    redirect(productHref(currentQuery));
  }

  return (
    <>
      <header className="mb-6">
        <p className="stage-kicker mb-2 font-pixel text-xs tracking-widest text-mint">{category ? category.slug.toUpperCase() : "ALL ITEMS"}</p>
        <h1 className="text-3xl font-extrabold">{category ? category.name : "전체 상품"}</h1>
        <p className="mt-2 break-words text-sm text-sub" aria-live="polite">
          {query.q ? `‘${query.q}’ 검색 결과 ${total}개` : `총 ${total}개`} · {page} / {totalPages} 페이지
        </p>
      </header>

      <ProductFilters key={canonical.toString()} query={currentQuery} />
      <CategoryTabs current={query.category} categories={categoryResult.data} query={currentQuery} />
      {(result.fallback || categoryResult.fallback) && <ProductFallbackNotice />}
      {result.fallback && query.sort === "popular" && (
        <p role="status" className="mb-6 text-sm text-sub">인기순 정보를 불러오지 못해 기본순으로 표시합니다.</p>
      )}

      {items.length === 0 ? (
        <section className="pixel-panel px-5 py-12 text-center">
          <h2 className="text-xl font-bold">다른 키워드로 찾아보세요</h2>
          <p className="mt-2 text-sm text-sub">가격 범위를 넓히거나 다른 카테고리의 아이템을 만나보세요.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {categoryResult.data.slice(0, 3).map((item) => (
              <Link key={item.slug} href={productHref({ sort: "id", page: 1, category: item.slug })} className="btn-pixel px-4 py-2 text-sm text-sub hover:text-ink focus-visible:outline-2 focus-visible:outline-violet">
                {item.name} 둘러보기
              </Link>
            ))}
          </div>
          <Link href="/products" className="mt-6 inline-block btn-lime px-6 py-3 font-bold text-lime-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet">필터 초기화</Link>
        </section>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {items.map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
      )}

      <Pagination currentPage={page} totalPages={totalPages} query={canonical.toString()} />
    </>
  );
}
