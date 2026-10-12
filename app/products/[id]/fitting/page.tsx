import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import KeycapFittingRoom from "@/components/keycap/KeycapFittingRoom";
import { KEYCAPS, keycapByProduct } from "@/data/keycaps";
import { getProduct } from "@/lib/products";

// 끼워 볼 수 있는 키캡 상품 30종은 미리 생성
export function generateStaticParams() {
  return KEYCAPS.map((item) => ({ id: String(item.productId) }));
}

export async function generateMetadata({ params }: PageProps<"/products/[id]/fitting">): Promise<Metadata> {
  const { id } = await params;
  const { data: product } = await getProduct(id);
  return { title: product ? `키캡 피팅룸 · ${product.name} | PIXEL MART` : "상품을 찾을 수 없습니다 | PIXEL MART" };
}

// 상세 페이지와 같은 방식: params는 Suspense 안쪽에서 기다린다
export default function KeycapFittingPage({ params }: PageProps<"/products/[id]/fitting">) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-8">
      <Suspense fallback={<div aria-label="키캡 피팅룸 준비 중" className="h-[640px] animate-pulse rounded-md bg-panel" />}>
        <FittingContent params={params} />
      </Suspense>
    </div>
  );
}

async function FittingContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: product } = await getProduct(id);
  if (!product) notFound();
  const current = keycapByProduct(product.id) ?? null;
  return <>
    <Link href={`/products/${product.id}`} className="text-sm font-bold text-mint hover:text-lime">◀ {product.name} 상세로</Link>
    <header className="mb-6 mt-3">
      <p className="stage-kicker mb-2 font-pixel text-sm text-mint">KEYCAP FITTING ROOM</p>
      <h1 className="mb-2 text-3xl font-extrabold md:text-4xl">내 키보드에 어울릴까?</h1>
      <p className="text-sub">키캡을 빈 키 위에 끌어다 놓거나, 키캡을 누른 뒤 키 자리를 눌러 끼워 보세요.</p>
      {!current && <p role="status" className="mt-3 text-sm text-pink">이 상품은 끼워 볼 수 있는 키캡이 아니에요. 서랍의 다른 키캡으로 꾸며 보세요.</p>}
    </header>
    <KeycapFittingRoom current={current} productName={product.name} productId={product.id} />
  </>;
}
