interface ProductSkeletonProps {
  count?: number;
}

export function ProductSkeleton({ count = 4 }: ProductSkeletonProps) {
  return (
    <div role="status" aria-label="상품을 불러오는 중" className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="aspect-[3/4] animate-pulse rounded-2xl bg-panel" />
      ))}
    </div>
  );
}

export function ProductFallbackNotice() {
  return <p role="status" className="mb-6 pixel-panel p-4 text-sm text-sub">상품 정보를 불러오지 못해 기본 상품을 보여드리고 있어요. 잠시 후 다시 방문해 주세요.</p>;
}

export function EmptyProducts() {
  return <p className="pixel-panel p-8 text-center text-sub">아직 등록된 상품이 없어요.</p>;
}
