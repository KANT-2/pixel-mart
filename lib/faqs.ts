import { cache } from "react";
import { serverFetch } from "@/lib/api";
import { faqFallback } from "@/lib/faqFallback";
import type { ApiFaq } from "@/types/api";

interface FaqResult {
  data: ApiFaq[];
  fallback: boolean;
}

export const getFaqs = cache(async (): Promise<FaqResult> => {
  try {
    return { data: await serverFetch<ApiFaq[]>("/faqs"), fallback: false };
  } catch {
    return { data: faqFallback, fallback: true };
  }
});
