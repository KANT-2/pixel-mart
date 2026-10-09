"use client";

import { useId, useState } from "react";
import { parseQuantityInput } from "@/utils/cart";

interface QuantityInputProps {
  value: number;
  onChange: (quantity: number) => void;
  label: string;
  max?: number;
  disabled?: boolean;
  onValidityChange?: (valid: boolean) => void;
}

export default function QuantityInput({ value, onChange, label, max = 99, disabled = false, onValidityChange }: QuantityInputProps) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stepValue = draft === null ? value : parseQuantityInput(draft, max) ?? value;

  function commit() {
    if (draft === null) return;
    const quantity = parseQuantityInput(draft, max);
    setDraft(null);
    if (quantity === null) {
      setError(`수량은 1~${max} 사이의 정수로 입력해 주세요. 이전 수량으로 되돌렸어요.`);
      onValidityChange?.(false);
      return;
    }
    setError(null);
    onValidityChange?.(true);
    if (quantity !== value) onChange(quantity);
  }

  function step(direction: -1 | 1) {
    if (draft !== null && parseQuantityInput(draft, max) === null) { commit(); return; }
    setDraft(null);
    setError(null);
    onValidityChange?.(true);
    const quantity = stepValue + direction;
    if (quantity >= 1 && quantity <= max && quantity !== value) onChange(quantity);
  }

  const buttonClass = "grid size-10 shrink-0 place-items-center text-lg font-bold text-sub transition-colors hover:bg-panel-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-35";

  return <div>
    <label htmlFor={id} className="mb-2 block text-sm text-dim">수량</label>
    <div className="inline-flex overflow-hidden pixel-input">
      <button type="button" aria-label={`${label} 1개 줄이기`} disabled={disabled || stepValue <= 1}
        onPointerDown={(event) => event.preventDefault()} onClick={() => step(-1)} className={buttonClass}>−</button>
      <input id={id} type="text" inputMode="numeric" autoComplete="off" aria-label={label}
        aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined}
        disabled={disabled} value={draft ?? String(value)}
        onFocus={() => { if (error) setDraft(String(value)); }}
        onChange={(event) => { setDraft(event.target.value); setError(null); onValidityChange?.(true); }}
        onBlur={commit}
        onKeyDown={(event) => {
          // Enter도 blur 한 곳에서 확정해 같은 값을 두 번 보내지 않습니다.
          if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); }
        }}
        className="h-10 w-12 min-w-0 border-x border-line bg-panel text-center font-semibold outline-offset-[-3px] outline-violet disabled:opacity-50" />
      <button type="button" aria-label={`${label} 1개 늘리기`} disabled={disabled || stepValue >= max}
        onPointerDown={(event) => event.preventDefault()} onClick={() => step(1)} className={buttonClass}>+</button>
    </div>
    {error && <p id={`${id}-error`} role="alert" className="mt-2 max-w-xs text-xs leading-relaxed text-pink">{error}</p>}
  </div>;
}
