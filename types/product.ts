export interface Product {
  id: number; // 상품 고유 식별자
  name: string; // 상품명
  price: number; // 가격 (원화 기준 숫자)
  category: string; // 카테고리 분류
  imageUrl: string; // 이미지 URL (무료 이미지 또는 대체 이미지)
  description: string; // 상품 요약 설명
  isNew?: boolean; // 신상품 여부 (선택 속성)
}
