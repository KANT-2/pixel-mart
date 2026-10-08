"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { safeNextPath } from "@/utils/safeNextPath";
import { useCart } from "@/components/CartProvider";

export default function AddToCartButton() {
  const { addToCart } = useCart();
  const [added, setAdded] = useState(false);
  const { user, loading } = useAuth();
  const router = useRouter();

  const handleClick = () => {
    if (!user) {
      const next = safeNextPath(window.location.pathname + window.location.search + window.location.hash);
      router.push(`/login?next=${encodeURIComponent(next)}`);
      return;
    }
    // TODO(#38): 로그인 후 서버 장바구니 담기로 교체
    addToCart();
    setAdded(true);
    setTimeout(() => setAdded(false), 1500); // 잠깐 "담았어요!" 표시
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="flex-1 rounded-lg bg-lime px-6 py-4 font-extrabold text-lime-ink shadow-[0_0_24px_rgba(182,255,92,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_0_32px_rgba(182,255,92,0.55)]"
    >
      {added ? "담았어요! ✓" : "장바구니 담기"}
    </button>
  );
}
