import type { ApiFaq } from "@/types/api";

export function getFaqCategories(items: ApiFaq[]): { category: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
  return Array.from(counts, ([category, count]) => ({ category, count }));
}

export function normalizeFaqCategory(value: string | null | undefined, items: ApiFaq[]): string | undefined {
  return value && items.some((item) => item.category === value) ? value : undefined;
}

export function filterFaqs(items: ApiFaq[], category: string | undefined, query: string): ApiFaq[] {
  const keyword = query.trim().toLowerCase();
  return items.filter((item) =>
    (!category || item.category === category)
    && (!keyword || item.question.toLowerCase().includes(keyword) || item.answer.toLowerCase().includes(keyword)),
  );
}

export function parseFaqHash(hash: string): number | undefined {
  if (!/^#faq-[1-9]\d*$/.test(hash)) return;
  const id = Number(hash.slice(5));
  return Number.isSafeInteger(id) ? id : undefined;
}

export function splitFaqText(text: string, query: string): { text: string; match: boolean }[] {
  const keyword = query.trim();
  if (!keyword) return [{ text, match: false }];
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.split(new RegExp(`(${escaped})`, "gi"))
    .map((part, index) => ({ text: part, match: index % 2 === 1 }))
    .filter((part) => part.text.length > 0);
}
