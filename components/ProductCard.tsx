import Link from "next/link";
import type { Product } from "@/types/product";
import { formatPrice } from "@/utils/formatPrice";
import WishButton from "@/components/WishButton";

interface ProductCardProps {
  product: Product;
  muted?: boolean;
}

export default function ProductCard({ product, muted = false }: ProductCardProps) {
  return (
    <article aria-label={`${product.name} 상품`} className="group flex min-w-0 flex-col rounded-2xl border border-line bg-panel p-2 transition sm:p-3 duration-200 hover:-translate-y-1 hover:border-violet/40 hover:bg-panel-2">
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
