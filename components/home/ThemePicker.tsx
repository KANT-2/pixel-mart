"use client";

import { useEffect, useId, useRef, useState } from "react";

interface ThemePickerProps {
  themes: { slug: string; name: string }[];
  value: number;
  onChange: (index: number) => void;
}

/** 데스크 테마 고르기 — 브라우저 기본 select 목록은 확대 배율에서 깨져 직접 그린다 (배너가 아래를 자르므로 위로 펼침) */
export default function ThemePicker({ themes, value, onChange }: ThemePickerProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(value);
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const pick = (index: number) => { onChange(index); setOpen(false); };
  const toggle = () => { setActive(value); setOpen(!open); };

  return <div ref={root} className="relative" onKeyDown={(event) => {
    if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); return; }
    if (!open || !["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    if (event.key === "ArrowDown") setActive((active + 1) % themes.length);
    else if (event.key === "ArrowUp") setActive((active - 1 + themes.length) % themes.length);
    else pick(active);
  }}>
    <button type="button" aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} aria-label={`데스크 테마: ${themes[value]?.name}`}
      onClick={toggle} className="btn-pixel flex min-h-11 items-center gap-2 px-4 py-2 text-sm font-bold text-ink">
      {themes[value]?.name} 테마<span aria-hidden="true" className={`text-xs text-sub transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
    </button>
    {open && <ul id={listId} role="listbox" aria-label="데스크 테마" aria-activedescendant={`${listId}-${active}`}
      className="absolute bottom-full left-0 z-30 mb-2 min-w-full overflow-hidden rounded-lg border-2 border-frame bg-panel py-1 shadow-[4px_4px_0_var(--color-shadow)]">
      {themes.map((theme, index) => <li key={theme.slug} id={`${listId}-${index}`} role="option" aria-selected={index === value}
        onPointerEnter={() => setActive(index)} onClick={() => pick(index)}
        className={`flex cursor-pointer items-center justify-between gap-3 whitespace-nowrap px-4 py-2 text-sm ${index === active ? "bg-panel-2 text-ink" : "text-sub"}`}>
        {theme.name} 테마{index === value && <span aria-hidden="true" className="text-mint">✓</span>}
      </li>)}
    </ul>}
  </div>;
}
