import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import FaqBrowser from "@/components/help/FaqBrowser";
import { getFaqs } from "@/lib/faqs";

export const metadata: Metadata = { title: "고객센터 | PIXEL MART" };

async function FaqContent() {
  const result = await getFaqs();
  return <FaqBrowser items={result.data} fallback={result.fallback} />;
}

function FaqSkeleton() {
  return (
    <div role="status" aria-label="FAQ를 불러오는 중" className="space-y-4">
      <div className="h-24 animate-pulse rounded-2xl bg-panel motion-reduce:animate-none" />
      <div className="h-11 animate-pulse rounded-xl bg-panel motion-reduce:animate-none" />
      {Array.from({ length: 5 }, (_, index) => <div key={index} className="h-20 animate-pulse rounded-xl bg-panel motion-reduce:animate-none" />)}
    </div>
  );
}

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 md:px-8 md:py-14">
      <header className="mb-8">
        <p className="mb-3 font-pixel text-xs tracking-widest text-mint">HELP DESK</p>
        <h1 className="text-3xl font-extrabold md:text-4xl">무엇이 궁금하세요?</h1>
        <p className="mt-3 text-sm leading-relaxed text-sub">자주 묻는 질문에서 필요한 안내를 찾아보세요.</p>
      </header>

      <Suspense fallback={<FaqSkeleton />}>
        <FaqContent />
      </Suspense>

      <section aria-label="다른 도움이 필요하세요?" className="mt-12 grid gap-4 sm:grid-cols-2">
        <Link href="/products" className="pixel-panel p-5 hover:border-violet/40 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet">
          <p className="mb-3 font-pixel text-xs text-mint">ITEM GUIDE</p>
          <h2 className="font-bold">상품 Q&A는 상품 상세에서</h2>
          <p className="mt-2 text-sm text-sub">궁금한 아이템을 찾아보세요 <span aria-hidden="true">→</span></p>
        </Link>
        <Link href="/mypage/orders" className="pixel-panel p-5 hover:border-violet/40 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet">
          <p className="mb-3 font-pixel text-xs text-mint">MY ITEMS</p>
          <h2 className="font-bold">주문·배송 확인은 마이페이지에서</h2>
          <p className="mt-2 text-sm text-sub">주문 내역 확인하기 <span aria-hidden="true">→</span></p>
        </Link>
      </section>
    </div>
  );
}
