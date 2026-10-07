import Link from "next/link";
import type { Product } from "@/types/product";
import { formatPrice } from "@/utils/formatPrice";

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  return (
    <Link
      href={`/products/${product.id}`}
      className="group flex flex-col rounded-2xl border border-line bg-panel p-3 transition duration-200 hover:-translate-y-1 hover:border-violet/40 hover:bg-panel-2"
    >
      <div className="relative mb-3 aspect-square overflow-hidden rounded-xl bg-panel-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- 과제 권장: 설정 없이 쓰는 일반 img */}
        <img
          src={product.imageUrl}
          alt={product.name}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        />
        {product.isNew && (
          <span className="absolute left-2 top-2 rounded bg-violet px-2 py-0.5 font-pixel text-xs text-night">
            NEW
          </span>
        )}
      </div>

      <p className="text-xs text-dim">{product.category}</p>
      <h3 className="mt-0.5 font-bold">{product.name}</h3>
      <p className="mt-2 text-lg font-extrabold text-lime">{formatPrice(product.price)}</p>
    </Link>
  );
}
