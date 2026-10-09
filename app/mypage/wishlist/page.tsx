import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import WishlistContents, { WishlistSkeleton } from "@/components/wishlist/WishlistContents";

export const metadata: Metadata = { title: "찜한 아이템 | PIXEL MART" };

export default function WishlistPage({ searchParams }: PageProps<"/mypage/wishlist">) {
  return <section className="mx-auto max-w-6xl px-4 py-10 md:px-8">
    <header className="mb-8">
      <Link href="/mypage" className="mb-6 inline-block text-sm text-sub hover:text-ink">← 마이페이지</Link>
      <p className="mb-2 font-pixel text-xs tracking-widest text-pink" aria-hidden="true">MY FAVORITES</p>
      <h1 className="text-3xl font-extrabold">찜한 아이템</h1>
      <p className="mt-3 text-sm text-sub">마음에 든 아이템을 모아 두고 천천히 골라 보세요.</p>
    </header>
    <Suspense fallback={<WishlistSkeleton />}>
      <WishlistQuery searchParams={searchParams} />
    </Suspense>
  </section>;
}

interface WishlistQueryProps {
  searchParams: PageProps<"/mypage/wishlist">["searchParams"];
}

async function WishlistQuery({ searchParams }: WishlistQueryProps) {
  const { page } = await searchParams;
  const requestedPage = typeof page === "string" && /^[1-9]\d*$/.test(page) ? Number(page) : 1;
  return <WishlistContents page={Number.isSafeInteger(requestedPage) ? requestedPage : 1} />;
}
