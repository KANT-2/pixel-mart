"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type RefObject } from "react";
import { normalizeProductQuery, productHref } from "@/utils/productQuery";

interface SearchFormProps {
  query: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
  className?: string;
}

function SearchIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 fill-none stroke-current stroke-2">
    <circle cx="10" cy="10" r="6" /><path d="m15 15 6 6" />
  </svg>;
}

function SearchForm({ query, onSubmit, inputRef, className = "" }: SearchFormProps) {
  return <form role="search" aria-label="헤더 상품 검색" onSubmit={onSubmit}
    className={`h-10 min-w-0 items-center rounded-lg border border-line bg-panel focus-within:ring-2 focus-within:ring-violet ${className}`}>
    <input ref={inputRef} name="q" type="search" aria-label="상품 검색어" placeholder="상품 검색" maxLength={50}
      defaultValue={query} className="h-full min-w-0 flex-1 rounded-lg bg-transparent px-3 text-sm text-ink outline-none placeholder:text-dim" />
    <button type="submit" aria-label="상품 검색 실행"
      className="grid size-10 shrink-0 place-items-center rounded-lg text-sub hover:text-ink focus-visible:outline-2 focus-visible:outline-violet">
      <SearchIcon />
    </button>
  </form>;
}

export default function HeaderSearch() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const mobileInput = useRef<HTMLInputElement>(null);
  const panelId = useId();
  const query = pathname === "/products" ? normalizeProductQuery({ q: searchParams.get("q") ?? undefined }).q ?? "" : "";
  const formKey = `${pathname}?${searchParams.toString()}`;

  const close = useCallback(() => {
    setOpen(false);
    // 바깥 클릭의 기본 포커스 이동 뒤에도 검색 버튼으로 돌아오게 한다.
    requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }));
  }, []);

  useEffect(() => {
    if (!open) return;
    mobileInput.current?.focus();
    const closeOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) close();
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, [open, close]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get("q");
    if (open) close();
    router.push(productHref(normalizeProductQuery({ q: typeof value === "string" ? value : "" })));
  }

  return <div ref={root} className="h-full w-full">
    <SearchForm key={`desktop:${formKey}`} query={query} onSubmit={submit} className="hidden w-full lg:flex" />
    <button ref={trigger} type="button" aria-label="상품 검색 열기" aria-expanded={open} aria-controls={panelId}
      onClick={() => open ? close() : setOpen(true)}
      className="grid size-10 place-items-center rounded-lg border border-line bg-panel text-sub hover:text-ink focus-visible:outline-2 focus-visible:outline-violet lg:hidden">
      <SearchIcon />
    </button>
    {open && <div id={panelId} className="absolute inset-x-4 top-3 z-60 flex h-10 gap-2 bg-night md:inset-x-8 lg:hidden">
      <SearchForm key={`mobile:${formKey}`} query={query} inputRef={mobileInput} onSubmit={submit} className="flex flex-1" />
      <button type="button" aria-label="상품 검색 닫기" onClick={close}
        className="grid size-10 shrink-0 place-items-center rounded-lg border border-line bg-panel text-sub hover:text-ink focus-visible:outline-2 focus-visible:outline-violet">
        <span aria-hidden="true" className="text-xl">×</span>
      </button>
    </div>}
  </div>;
}
