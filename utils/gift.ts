/** 거래 카드·교환 창에서 선물 화면으로 — 거래글 하나를 받는 사람으로 정한다 */
export function giftHref(post: { id: number; itemName: string; product: { id: number } | null }): string {
  const params = new URLSearchParams({ post: String(post.id), item: post.itemName.slice(0, 60) });
  if (post.product) params.set("product", String(post.product.id));
  return `/local/gift?${params}`;
}
