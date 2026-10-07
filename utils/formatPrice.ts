// 9900 → "9,900원"
export function formatPrice(price: number): string {
  return `${price.toLocaleString("ko-KR")}원`;
}
