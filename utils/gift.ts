/** 위시맵 WANT 글에서 선물 화면으로 — 받는 사람·물건은 선물 화면이 글 id로 다시 불러온다 */
export function giftHref(post: { id: number }): string {
  return `/local/gift?post=${post.id}`;
}
