import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import AddToCartButton from "@/components/AddToCartButton";
import WishButton from "@/components/WishButton";
import ProductCard from "@/components/ProductCard";
import { formatPrice } from "@/utils/formatPrice";
import { getProduct, getProducts, getProductParams } from "@/lib/products";
import { ProductFallbackNotice } from "@/components/products/ProductStates";
import ProductDetailTabs from "@/components/products/ProductDetailTabs";

// API가 꺼져 있어도 정적 상품 ID로 상세 경로를 생성합니다.
export function generateStaticParams() {
  return getProductParams();
}

// 브라우저 탭 제목
export async function generateMetadata({ params }: PageProps<"/products/[id]">): Promise<Metadata> {
  const { id } = await params;
  const { data: product } = await getProduct(id);
  return { title: product ? `${product.name} | PIXEL MART` : "상품을 찾을 수 없습니다 | PIXEL MART" };
}

// Next 16 + Cache Components: params를 <Suspense> 밖에서 기다리면 페이지 전환이 즉시 일어나지 않아
// 페이지는 params를 그대로 넘기고, 실제로 읽는 부분(ProductDetail)만 <Suspense> 안에 둡니다.
export default function ProductDetailPage({ params }: PageProps<"/products/[id]">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:px-8">
      <Suspense fallback={<ProductDetailSkeleton />}>
        <ProductDetail params={params} />
      </Suspense>
    </div>
  );
}

async function ProductDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; // Next 15+ : params는 Promise
  const result = await getProduct(id);
  const product = result.data;

  // 없는 id(/products/999, /products/abc) → 같은 폴더의 not-found.tsx 표시
  if (!product) notFound();

  const category = { slug: product.categorySlug, name: product.category };
  const relatedResult = await getProducts({ category: product.categorySlug, size: 5 });
  const related = relatedResult.data.items.filter((item) => item.id !== product.id).slice(0, 4);

  return (
    <>
      {(result.fallback || relatedResult.fallback) && <ProductFallbackNotice />}
      {/* 경로 표시 */}
      <nav aria-label="현재 위치" className="mb-6 flex flex-wrap items-center gap-1.5 text-sm text-dim">
        <Link href="/" className="hover:text-ink">홈</Link>
        <span>›</span>
        <Link href="/products" className="hover:text-ink">전체 상품</Link>
        <span>›</span>
        <Link href={category ? `/products?category=${category.slug}` : "/products"} className="hover:text-ink">
          {product.category}
        </Link>
      </nav>

      {/* 상품 정보 */}
      <section className="grid gap-8 md:grid-cols-2 md:gap-12">
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element -- 과제 권장: 설정 없이 쓰는 일반 img */}
          <img
            src={product.imageUrl}
            alt={product.name}
            className="aspect-square w-full pixel-panel object-cover"
          />
          {product.isNew && (
            <span className="absolute left-4 top-4 rounded bg-violet px-2.5 py-1 font-pixel text-sm text-night">NEW</span>
          )}
        </div>

        <div className="flex flex-col">
          <p className="mb-2 text-sm font-semibold text-mint">{product.category}</p>
          <div className="mb-4 flex items-start justify-between gap-4">
            <h1 className="text-3xl font-extrabold leading-snug md:text-4xl">{product.name}</h1>
            <WishButton productId={product.id} productName={product.name} />
          </div>
          <p className="mb-6 text-3xl font-extrabold text-lime">{formatPrice(product.price)}</p>
          <p className="mb-8 leading-relaxed text-sub">{product.description}</p>

          <dl className="mb-8 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 pixel-panel p-5 text-sm">
            <dt className="text-dim">배송</dt>
            <dd>3만원 이상 무료배송 · 평일 오후 2시 이전 주문 시 당일 출고</dd>
            <dt className="text-dim">상품 번호</dt>
            <dd className="font-pixel">PM-{String(product.id).padStart(3, "0")}</dd>
          </dl>

          <div className="mt-auto flex flex-col gap-3">
            <AddToCartButton productId={product.id} />
            <Link
              href="/products"
              className="grid place-items-center rounded-lg border border-line px-6 py-3 font-bold text-sub transition-colors hover:border-violet/40 hover:text-ink"
            >
              목록으로
            </Link>
          </div>
        </div>
      </section>

      <ProductDetailTabs productId={product.id}>
        <h2 className="mb-4 text-xl font-bold">상품정보</h2>
        <p className="whitespace-pre-line break-words leading-relaxed text-sub">{product.description}</p>
        <p className="mt-5 text-sm text-dim">상품 번호 PM-{String(product.id).padStart(3, "0")} · {product.category}</p>
      </ProductDetailTabs>

      {/* 같은 카테고리 상품 */}
      {related.length > 0 && (
        <section className="mt-16">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="text-xl font-extrabold">같은 카테고리 상품</h2>
            {category && (
              <Link href={`/products?category=${category.slug}`} className="text-sm font-semibold text-sub hover:text-ink">
                {category.name} 더 보기 →
              </Link>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function ProductDetailSkeleton() {
  return (
    <div className="grid gap-8 md:grid-cols-2 md:gap-12">
      <div className="aspect-square animate-pulse rounded-2xl bg-panel" />
      <div className="space-y-4">
        <div className="h-4 w-20 animate-pulse rounded bg-panel" />
        <div className="h-10 w-3/4 animate-pulse rounded bg-panel" />
        <div className="h-8 w-32 animate-pulse rounded bg-panel" />
      </div>
    </div>
  );
}
