import type { Metadata } from "next";
import { Suspense } from "react";
import LoginForm from "@/components/LoginForm";

export const metadata: Metadata = { title: "로그인 | PIXEL MART" };

async function LoginContent({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const params = await searchParams;
  return <LoginForm next={typeof params.next === "string" ? params.next : undefined}
    devLoginEnabled={process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_DEV_LOGIN === "true"} />;
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return <section className="mx-auto w-full max-w-md px-4 py-12 sm:py-20">
    <p className="mb-3 font-pixel text-xs tracking-widest text-mint">WELCOME, PLAYER</p>
    <h1 className="text-3xl font-extrabold">로그인</h1>
    <p className="mb-8 mt-3 text-sm text-sub">로그인이 필요한 기능을 이용하려면 먼저 로그인해 주세요.</p>
    <Suspense fallback={<div role="status" aria-label="로그인 화면 준비 중" className="h-80 animate-pulse rounded-xl bg-panel" />}>
      <LoginContent searchParams={searchParams} />
    </Suspense>
  </section>;
}
