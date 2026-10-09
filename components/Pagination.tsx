import Link from "next/link";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  category?: string; // 카테고리 slug — 페이지를 넘겨도 필터 유지
  basePath?: string;
  query?: string;
}

// 1 … 4 5 6 … 15 처럼 처음·끝·현재 주변만 보여 줌
function getPageNumbers(current: number, total: number): (number | "…")[] {
  const pages: (number | "…")[] = [];
  for (let page = 1; page <= total; page++) {
    if (page === 1 || page === total || Math.abs(page - current) <= 1) {
      pages.push(page);
    } else if (pages[pages.length - 1] !== "…") {
      pages.push("…");
    }
  }
  return pages;
}

export default function Pagination({ currentPage, totalPages, category, basePath = "/products", query }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pageHref = (page: number) => {
    const params = new URLSearchParams(query);
    if (category) params.set("category", category);
    params.delete("page");
    if (page > 1) params.set("page", String(page));
    const search = params.toString();
    return search ? `${basePath}?${search}` : basePath;
  };

  const baseClass = "grid h-10 w-8 place-items-center rounded-lg text-sm font-semibold sm:w-10";

  return (
    <nav aria-label="페이지 이동" className="mt-12 flex items-center justify-center gap-1">
      {currentPage > 1 ? (
        <Link href={pageHref(currentPage - 1)} aria-label="이전 페이지" className={`${baseClass} text-sub hover:bg-white/5 hover:text-ink`}>
          ‹
        </Link>
      ) : (
        <span className={`${baseClass} text-dim/40`}>‹</span>
      )}

      {getPageNumbers(currentPage, totalPages).map((page, index) =>
        page === "…" ? (
          <span key={`gap-${index}`} className={`${baseClass} text-dim`}>
            …
          </span>
        ) : (
          <Link
            key={page}
            href={pageHref(page)}
            aria-current={page === currentPage ? "page" : undefined}
            className={`${baseClass} transition-colors ${
              page === currentPage ? "btn-pixel" : "btn-pixel text-sub hover:text-ink"
            }`}
          >
            {page}
          </Link>
        ),
      )}

      {currentPage < totalPages ? (
        <Link href={pageHref(currentPage + 1)} aria-label="다음 페이지" className={`${baseClass} text-sub hover:bg-white/5 hover:text-ink`}>
          ›
        </Link>
      ) : (
        <span className={`${baseClass} text-dim/40`}>›</span>
      )}
    </nav>
  );
}
