import Link from "next/link";
import { products } from "@/data/products";
import type { ApiCategory } from "@/types/api";
import { changeProductQuery, productHref, type ProductQuery } from "@/utils/productQuery";

interface CategoryTabsProps {
  current?: string; // 선택된 카테고리 slug (없으면 "전체")
  categories: ApiCategory[];
  query?: ProductQuery;
}

export default function CategoryTabs({ current, categories, query }: CategoryTabsProps) {
  // TODO(#16): API productCount로 교체
  const tabs = [
    { slug: undefined, name: "전체", count: products.length },
    ...categories.map((category) => ({
      slug: category.slug,
      name: category.name,
      count: products.filter((product) => product.category === category.name).length,
    })),
  ];

  return (
    <nav aria-label="카테고리" className="-mx-4 mb-8 overflow-x-auto px-4 [scrollbar-width:none]">
      <ul className="flex w-max gap-2">
        {tabs.map((tab) => {
          const active = tab.slug === current;
          return (
            <li key={tab.name}>
              <Link
                href={query ? productHref(changeProductQuery(query, { category: tab.slug })) : tab.slug ? `/products?category=${tab.slug}` : "/products"}
                aria-current={active ? "page" : undefined}
                className={`btn-pixel flex items-center gap-1.5 whitespace-nowrap px-4 py-2 text-sm font-semibold ${
                  active
                    ? ""
                    : "text-sub hover:text-ink"
                }`}
              >
                {tab.name}
                <span className={active ? "text-lime-ink/70" : "text-dim"}>{tab.count}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
