import Link from "next/link";

export default function ProductNotFound() {
  return (
    <section className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="mb-3 font-pixel text-lime">GAME OVER · 404</p>
      <h1 className="mb-3 text-2xl font-extrabold">상품을 찾을 수 없습니다</h1>
      <p className="mb-8 text-sub">주소가 잘못되었거나 판매가 끝난 상품이에요.</p>
      <Link
        href="/products"
        className="inline-block rounded-lg bg-lime px-6 py-3 font-bold text-lime-ink transition hover:-translate-y-0.5"
      >
        상품 목록으로
      </Link>
    </section>
  );
}
