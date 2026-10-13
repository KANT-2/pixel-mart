import Link from "next/link";
import { Suspense } from "react";
import ProductCard from "@/components/ProductCard";
import { ProductFallbackNotice, ProductSkeleton } from "@/components/products/ProductStates";
import { deskThemes } from "@/data/deskLookbook";
import { getProduct } from "@/lib/products";

async function ThemeProducts({ searchParams }: PageProps<"/lookbook">) {
  const params = await searchParams;
  const selected = deskThemes.find((theme) => theme.slug === params.theme) ?? deskThemes[0];
  const results = await Promise.all(selected.productIds.map((id) => getProduct(String(id))));
  return <>
    <nav aria-label="데스크 테마" className="my-6 flex flex-wrap gap-3">
      {deskThemes.map((theme) => <Link key={theme.slug} href={`/lookbook?theme=${theme.slug}`} aria-current={theme.slug === selected.slug ? "page" : undefined} className={`${theme.slug === selected.slug ? "btn-lime" : "btn-pixel"} px-4 py-2 text-sm`}>{theme.name}</Link>)}
    </nav>
    <h2 className="mb-4 text-xl font-bold">{selected.name} 데스크</h2>
    {/* eslint-disable-next-line @next/next/no-img-element -- 최적화된 정적 WebP 룩북 이미지 */}
    <img src={selected.image} alt={`${selected.name} 테마 상품을 배치한 데스크 예시`} width={1440} height={810} className="aspect-video w-full rounded-lg object-cover" />
    <p className="my-3 text-sm text-sub">AI로 제작한 상품 배치 예시입니다. 실제 제품의 크기·형태는 상품 상세 정보를 확인해 주세요.</p>
    <h3 className="my-6 text-xl font-bold">이 테마의 상품</h3>
    {results.some((result) => result.fallback) && <ProductFallbackNotice />}
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{results.map((result, index) => result.data ? <ProductCard key={result.data.id} product={result.data} /> : <p key={selected.productIds[index]} className="pixel-panel p-4 text-sub">현재 이 상품은 판매 목록에서 확인할 수 없어요.</p>)}</div>
    <Link href="/products" className="btn-pixel mt-6 inline-block px-4 py-3">전체 상품 보기 →</Link>
  </>;
}

export default function Lookbook(props: PageProps<"/lookbook">) {
  return <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">
    <Link href="/" className="text-sm text-mint">← 홈으로</Link>
    <h1 className="mt-5 text-3xl font-bold">데스크 테마 룩북</h1>
    <Suspense fallback={<ProductSkeleton />}><ThemeProducts {...props} /></Suspense>
  </main>;
}
