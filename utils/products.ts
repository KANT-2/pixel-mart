import { categories } from "@/data/categories";
import { products } from "@/data/products";

// 목록 한 페이지에 보여 줄 상품 수 (4·3·2열 어디서나 줄이 딱 맞음)
export const PAGE_SIZE = 12;

// URL의 id는 문자열 → 숫자로 바꿔 비교 ("abc"는 NaN이라 자연스럽게 undefined)
export function findProduct(id: string) {
  return products.find((product) => product.id === Number(id));
}

export function findCategoryBySlug(slug?: string) {
  return categories.find((category) => category.slug === slug);
}

export function findCategoryByName(name: string) {
  return categories.find((category) => category.name === name);
}
