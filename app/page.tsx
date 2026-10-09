import Link from "next/link";
import { Suspense } from "react";
import ProductCard from "@/components/ProductCard";
import HeroStage from "@/components/hero/HeroStage";
import WorldMapTeaser from "@/components/home/WorldMapTeaser";
import { getProducts } from "@/lib/products";
import { EmptyProducts, ProductFallbackNotice, ProductSkeleton } from "@/components/products/ProductStates";

// 카테고리가 골고루 보이도록 고른 추천 상품
const recommendedIds = [1, 3, 5, 8];

async function RecommendedProducts() {
  const result = await getProducts({ size: 60 });
  const recommended = result.data.items.filter((product) => recommendedIds.includes(product.id));
  return (
    <>
      {result.fallback && <ProductFallbackNotice />}
      {recommended.length === 0 ? <EmptyProducts /> : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {recommended.map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
      )}
    </>
  );
}

function SectionTitle({ quest, title, href }: { quest: string; title: string; href?: string }) {
  return <div className="mb-5 flex items-end justify-between gap-3">
    <div>
      <p className="mb-1 font-pixel text-xs tracking-widest text-lime motion-safe:animate-[pulse_1.2s_steps(2)_infinite]">▶ {quest}</p>
      <h2 className="text-2xl font-extrabold">{title}</h2>
    </div>
    {href && <Link href={href} className="shrink-0 text-sm font-semibold text-sub transition-colors hover:text-ink">전체 보기 →</Link>}
  </div>;
}

export default function Home() {
  return (
    <>
      {/* 히어로 배너 */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-8 pt-10 md:grid-cols-2 md:px-8 md:pb-12 md:pt-14">
        <div>
          <p className="mb-4 flex items-center gap-2 font-pixel text-sm tracking-widest text-mint">
            <span className="size-2 bg-mint" />
            GOOD ITEMS, BETTER DAYS
          </p>
          <h1 className="mb-5 bg-linear-to-b from-white via-[#dccfff] to-mint bg-clip-text font-pixel text-4xl leading-tight font-bold text-transparent drop-shadow-[4px_4px_0_#3a2a80] md:text-6xl">
            일상에 아이템을
            <br />
            장착하세요.
          </h1>
          <p className="mb-8 text-sub md:text-lg">
            좋아하는 게임이 있는 하루는,
            <br />
            언제나 조금 더 특별하니까.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/products" className="btn-lime px-7 py-4 font-extrabold text-lime-ink">
              ▶ 아이템 둘러보기
            </Link>
            <Link href="/local" className="btn-pixel px-6 py-4 font-bold">
              월드맵 열기
            </Link>
          </div>
        </div>

        <HeroStage />
      </section>

      {/* 추천 상품 */}
      <section className="mx-auto max-w-6xl px-4 pb-14 md:px-8">
        <SectionTitle quest="QUEST · RECOMMENDED" title="추천 아이템" href="/products" />

        <Suspense fallback={<ProductSkeleton />}>
          <RecommendedProducts />
        </Suspense>
      </section>

      {/* PIXEL LOCAL 월드맵 입구 */}
      <section className="mx-auto max-w-6xl px-4 pb-20 md:px-8">
        <WorldMapTeaser />
      </section>
    </>
  );
}
