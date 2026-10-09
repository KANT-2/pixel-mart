import Link from "next/link";
import { Suspense } from "react";
import ProductCard from "@/components/ProductCard";
import HeroStage from "@/components/hero/HeroStage";
import WorldMapTeaser from "@/components/home/WorldMapTeaser";
import { getCategories, getProducts } from "@/lib/products";
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

// 카테고리 = 게임 인벤토리 슬롯 (기존 픽셀 스프라이트 재사용)
const SLOT_SPRITES: Record<string, string> = {
  keycap: "/images/hero-coin.svg", deskmat: "/images/hero-chest.svg", desk: "/images/hero-sword.svg",
  goods: "/images/hero-heart.svg", living: "/images/hero-star.svg", tech: "/images/logo-invader.svg",
};

async function InventorySlots() {
  const { data } = await getCategories();
  return <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6">
    {data.map((category, index) => <li key={category.slug}>
      <Link href={`/products?category=${category.slug}`} className="btn-pixel group flex aspect-square flex-col items-center justify-center gap-2 p-2 text-center">
        <span className="font-pixel text-[10px] text-dim">{String(index + 1).padStart(2, "0")}</span>
        {/* eslint-disable-next-line @next/next/no-img-element -- 작은 픽셀 SVG를 보간 없이 표시 */}
        <img src={SLOT_SPRITES[category.slug] ?? "/images/hero-star.svg"} alt="" className="h-8 w-8 object-contain [image-rendering:pixelated] transition-transform duration-150 group-hover:-translate-y-1 sm:h-10 sm:w-10" />
        <span className="text-xs font-bold sm:text-sm">{category.name}</span>
      </Link>
    </li>)}
  </ul>;
}

function SectionTitle({ quest, title, href }: { quest: string; title: string; href?: string }) {
  return <div className="mb-5 flex items-end justify-between gap-3">
    <div>
      <p className="mb-1 font-pixel text-xs tracking-widest text-violet">▶ {quest}</p>
      <h2 className="text-2xl font-extrabold">{title}</h2>
    </div>
    {href && <Link href={href} className="shrink-0 text-sm font-semibold text-sub transition-colors hover:text-ink">전체 보기 →</Link>}
  </div>;
}

export default function Home() {
  return (
    <>
      {/* 히어로 배너 */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 md:grid-cols-2 md:px-8 md:py-20">
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
              ▶ 상품 둘러보기
            </Link>
            <Link href="/local" className="btn-pixel px-6 py-4 font-bold">
              🗺 월드맵 열기
            </Link>
          </div>
          {/* 게임 타이틀 화면처럼 깜빡이는 안내 (움직임 줄이기 설정이면 고정) */}
          <p className="mt-6 font-pixel text-xs tracking-[0.3em] text-lime motion-safe:animate-[pulse_1.2s_steps(2)_infinite]">PRESS START</p>
        </div>

        <HeroStage />
      </section>

      {/* 카테고리 인벤토리 */}
      <section className="mx-auto max-w-6xl px-4 pb-14 md:px-8">
        <SectionTitle quest="INVENTORY" title="장착할 아이템 고르기" />
        <Suspense fallback={<div className="grid grid-cols-3 gap-3 sm:grid-cols-6">{Array.from({ length: 6 }, (_, i) => <div key={i} className="aspect-square animate-pulse rounded-md bg-panel" />)}</div>}>
          <InventorySlots />
        </Suspense>
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
