export const PRODUCT_TABS = ["info", "reviews", "qna"] as const;
export type ProductTab = typeof PRODUCT_TABS[number];

export function tabFromHash(hash: string): ProductTab {
  return hash === "#reviews" ? "reviews" : hash === "#qna" ? "qna" : "info";
}

export function tabForKey(tab: ProductTab, key: string): ProductTab | null {
  const index = PRODUCT_TABS.indexOf(tab);
  if (key === "Home") return "info";
  if (key === "End") return "qna";
  if (key === "ArrowRight") return PRODUCT_TABS[(index + 1) % PRODUCT_TABS.length];
  if (key === "ArrowLeft") return PRODUCT_TABS[(index + PRODUCT_TABS.length - 1) % PRODUCT_TABS.length];
  return null;
}

export function validateReview(rating: number, content: string) {
  const values = { rating, content: content.trim() };
  const errors: { rating?: string; content?: string } = {};
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) errors.rating = "별점을 1~5점 중 선택해 주세요.";
  if (!values.content) errors.content = "리뷰 내용을 입력해 주세요.";
  else if (Array.from(values.content).length > 500) errors.content = "리뷰는 500자 이내로 입력해 주세요.";
  return { values, errors, valid: Object.keys(errors).length === 0 };
}
