import Link from "next/link";
import type { Product } from "@/types/product";
import { formatPrice } from "@/utils/formatPrice";
import WishButton from "@/components/WishButton";
import { rarityOf } from "@/utils/gameItem";

interface ProductCardProps {
  product: Product;
  muted?: boolean;
}

export default function ProductCard({ product, muted = false }: ProductCardProps) {
  // 가격대 등급(COMMON~UNIQUE)을 사진 아래쪽 이름표로 — 게임 아이템처럼
  const rarity = rarityOf(product.price);
  return (
    <article aria-label={`${product.name} 상품 · ${rarity.label} 등급`} className="group flex min-w-0 flex-col pixel-panel p-2 transition sm:p-3 duration-200 hover:-translate-y-1 hover:border-violet/40 hover:bg-panel-2">
      <Link
        href={`/products/${product.id}`}
        className={`flex flex-1 flex-col rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet ${muted ? "opacity-45" : ""}`}
      >
        <div className="relative mb-2 aspect-square overflow-hidden rounded-xl bg-panel-2 sm:mb-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- 과제 권장: 설정 없이 쓰는 일반 img */}
          <img
            src={product.imageUrl}
            alt={product.name}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
          {/* 등급 이름표 — 등급 색 테두리·글씨, 반투명(50%) 어두운 바탕이라 밝은 사진에서도 글씨가 묻히지 않는다 */}
          <span className="absolute bottom-1.5 right-1.5 rounded border px-1.5 py-0.5 font-pixel text-[10px] backdrop-blur-[2px] [text-shadow:0_1px_0_rgb(0_0_0/0.8)] sm:bottom-2 sm:right-2 sm:text-xs"
            style={{ borderColor: rarity.color, color: rarity.color, background: "rgb(13 11 26 / 50%)" }}>{rarity.label}</span>
          {product.isNew && (
            <span className="absolute left-1.5 top-1.5 rounded bg-violet px-1.5 py-0.5 font-pixel text-xs text-night sm:left-2 sm:top-2 sm:px-2">
              NEW
            </span>
          )}
        </div>

        <p className="truncate text-xs text-dim">{product.category}</p>
        <h3 className="mt-0.5 line-clamp-2 text-sm font-bold leading-snug sm:text-base">{product.name}</h3>
      </Link>
      <div className="mt-2 flex items-center justify-between gap-1 sm:mt-3 sm:gap-3">
        <Link href={`/products/${product.id}`} aria-label={`${product.name} ${formatPrice(product.price)} 상세 보기`}
          className={`min-w-0 truncate rounded text-base font-extrabold text-lime sm:text-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet ${muted ? "opacity-45" : ""}`}>{formatPrice(product.price)}</Link>
        <WishButton productId={product.id} productName={product.name} />
      </div>
    </article>
  );
}
